-- Feature 3: free tier usage gating. Adds a second usage counter for Adzuna
-- job searches and a SECURITY DEFINER RPC that atomically checks the cap,
-- increments the counter, and resets both counters when the 30 day window
-- expires. See docs/specs/0018-free-tier-usage-gating.md.

-- ============================================================================
-- Column: adzuna_searches_used
-- ============================================================================

-- Guarded: an earlier session may have applied this column out of band, so
-- only add it when it is not already present, the same pattern as the
-- non-negative CHECK constraint migration before this one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions'
      AND column_name = 'adzuna_searches_used'
  ) THEN
    ALTER TABLE subscriptions
      ADD COLUMN adzuna_searches_used integer NOT NULL DEFAULT 0;
  END IF;
END;
$$;

-- Both usage columns carry the same non-negative guard. This one is added here
-- rather than in an earlier migration because the column itself did not exist
-- yet, and an earlier session may have applied the column ahead of this
-- migration file, in which case the guard is already in place and this is a
-- no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_adzuna_searches_non_negative'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_adzuna_searches_non_negative
      CHECK (adzuna_searches_used >= 0);
  END IF;
END;
$$;

-- ============================================================================
-- RPC: check_and_increment_usage
-- ============================================================================

-- Atomic check and increment with a rolling 30 day window reset. The function
-- always returns exactly one row (allowed, plan, used, period start), never an
-- empty result set: a missing subscriptions row is created silently on first
-- call, and a capped account gets allowed = false rather than zero rows.
--
-- The guarded UPDATE shape is what makes AC-5 hold under concurrent requests.
-- The WHERE clause and the CASE expressions inside SET are both re-evaluated
-- per statement under Postgres's read committed isolation, so two concurrent
-- calls racing against a nearly full cap or an expired window cannot both slip
-- through.
--
-- The Pro short circuit (plan = 'pro' AND status IN ('active', 'trialing'))
-- returns allowed = true without touching either counter. A Pro account whose
-- status has lapsed (past_due, canceled, etc.) falls through to the free tier
-- cap check, which is what AC-3 requires.
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_user_id uuid,
  p_action text,
  p_search_limit integer,
  p_research_limit integer
)
RETURNS TABLE(
  allowed boolean,
  plan text,
  used integer,
  limit_val integer,
  period_start timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_updated record;
  v_action_limit integer;
BEGIN
  -- Ensure a row exists before anything else. A missing row is the ordinary
  -- state of every new signup before their first metered action; creating it
  -- here means callers never need to handle "no row to update" separately.
  INSERT INTO public.subscriptions (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Read plan and status first. A Pro account in good standing short circuits
  -- immediately, never touching either counter, which is what AC-3 requires.
  SELECT s.plan, s.status
  INTO v_plan, v_status
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id;

  -- Failsafe: the INSERT above guarantees a row, but if it somehow did not
  -- take (e.g. a concurrent delete), treat as free and capped.
  IF v_plan IS NULL THEN
    allowed := false;
    plan := 'free';
    used := CASE WHEN p_action = 'search' THEN p_search_limit ELSE p_research_limit END;
    limit_val := CASE WHEN p_action = 'search' THEN p_search_limit ELSE p_research_limit END;
    period_start := now();
    RETURN NEXT;
    RETURN;
  END IF;

  -- Pro in good standing: always allowed, no counter touched, period start
  -- is informational only.
  IF v_plan = 'pro' AND v_status IN ('active', 'trialing') THEN
    allowed := true;
    plan := 'pro';
    used := 0;
    limit_val := 0;
    SELECT s.usage_period_start INTO period_start
    FROM public.subscriptions s WHERE s.user_id = p_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Free tier (or lapsed Pro): set which counter and limit apply.
  IF p_action = 'search' THEN
    v_action_limit := p_search_limit;
  ELSE
    v_action_limit := p_research_limit;
  END IF;

  -- The guarded update. Both counters reset together when the window expires,
  -- not just the one being acted on. The WHERE clause is re-evaluated per
  -- statement, so two concurrent calls cannot both take the reset branch or
  -- both slip past the cap.
  --
  -- For search: the CASE swaps the counter roles: search increments to 1 on
  -- reset (research resets to 0), and increments normally otherwise.
  -- For research: research increments to 1 on reset (search resets to 0),
  -- and increments normally otherwise.
  IF p_action = 'search' THEN
    UPDATE public.subscriptions
    SET adzuna_searches_used = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN 1
          ELSE adzuna_searches_used + 1
        END,
        research_runs_used = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN 0
          ELSE research_runs_used
        END,
        usage_period_start = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN now()
          ELSE usage_period_start
        END
    WHERE user_id = p_user_id
      AND (usage_period_start < now() - interval '30 days'
           OR adzuna_searches_used < v_action_limit)
    RETURNING adzuna_searches_used, research_runs_used, usage_period_start
    INTO v_updated;
  ELSE
    UPDATE public.subscriptions
    SET research_runs_used = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN 1
          ELSE research_runs_used + 1
        END,
        adzuna_searches_used = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN 0
          ELSE adzuna_searches_used
        END,
        usage_period_start = CASE
          WHEN usage_period_start < now() - interval '30 days' THEN now()
          ELSE usage_period_start
        END
    WHERE user_id = p_user_id
      AND (usage_period_start < now() - interval '30 days'
           OR research_runs_used < v_action_limit)
    RETURNING adzuna_searches_used, research_runs_used, usage_period_start
    INTO v_updated;
  END IF;

  -- Zero rows affected means the cap was hit: the WHERE clause excluded the
  -- row because neither the window was expired nor the counter was under the
  -- limit. Return the current state (what the cap is) without changing it.
  IF NOT FOUND THEN
    allowed := false;
    plan := v_plan;
    used := v_action_limit;
    limit_val := v_action_limit;
    SELECT s.usage_period_start INTO period_start
    FROM public.subscriptions s WHERE s.user_id = p_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Allowed. Return the counter that was just incremented (or reset to 1).
  allowed := true;
  plan := v_plan;
  used := CASE WHEN p_action = 'search'
    THEN v_updated.adzuna_searches_used
    ELSE v_updated.research_runs_used
  END;
  limit_val := v_action_limit;
  period_start := v_updated.usage_period_start;
  RETURN NEXT;
END;
$$;

-- The function must not be callable by the anon or authenticated roles. Only
-- the service role client (lib/insforge-service.ts) may invoke it, the same
-- privilege boundary every other subscriptions read and write already respects.
REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer, integer) FROM authenticated;
