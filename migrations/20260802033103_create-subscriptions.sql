-- Feature 1: billing foundation. One row per account recording the plan, Stripe
-- billing status, Stripe customer and subscription ids, and a monthly count of
-- company research runs. Written by privileged server side code only; no end
-- user can read, insert, or update any row directly. See
-- docs/specs/0015-billing-foundation/index.md.

-- ============================================================================
-- Table
-- ============================================================================

-- user_id references auth.users rather than profiles on purpose: a subscription
-- is an account fact, not a profile fact, so it must survive a user who has
-- signed in but never filled in a profile, the same reasoning as user_access.
CREATE TABLE subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN (
      'active', 'trialing', 'past_due', 'canceled',
      'incomplete', 'incomplete_expired', 'unpaid', 'paused'
    )
  ),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  research_runs_used integer NOT NULL DEFAULT 0,
  usage_period_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_subscriptions_updated_at();

-- ============================================================================
-- Row level security: no client access at all, in either direction
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- No policies exist, and the omission is the whole point of this table. Unlike
-- user_access, which grants owner SELECT through a policy, subscriptions grants
-- nothing. Nothing in features 1 through 3 needs a client side read of this
-- table, so there is no reason to open even a SELECT path.
--
-- The REVOKE below is load bearing and must not be removed. InsForge grants
-- broad data privileges on public tables to anon and authenticated by default,
-- so leaving the write grants unwritten does NOT leave the user without them.
-- Row level security would still deny every operation (no policy permits any),
-- but the privilege layer is the intended second line of defence, and it only
-- exists if the broad default is explicitly taken away first.
REVOKE ALL ON subscriptions FROM anon, authenticated;
