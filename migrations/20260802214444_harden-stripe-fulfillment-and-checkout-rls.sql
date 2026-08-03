-- Feature 2: checkout & subscribe. Two more hardening fixes from the same
-- /check review (docs/reviews/2026-08-02-checkout-and-subscribe.md):
--
-- 1. The fulfillment trigger never checked NEW.environment. Today only
--    "test" is configured, so this was not yet exploitable, but the app's
--    own checkout call (actions/billing.ts) is hardcoded to "test" too, and
--    the two must flip together at live launch or a test mode event (Stripe
--    test cards are trivial to produce) would grant real Pro entitlement.
--    Filtering on environment now costs nothing and removes that trap later.
-- 2. `v_subject_type <> 'user'` is null blind: if a payload carried a
--    resolvable insforge_subject_id but no insforge_subject_type, the
--    comparison evaluates to NULL, which plpgsql treats as false, and the
--    trigger would write a subscription for a subject it never actually
--    confirmed was type 'user'. IS DISTINCT FROM treats NULL as a real
--    mismatch instead.
CREATE OR REPLACE FUNCTION public.fulfill_stripe_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_subject_type TEXT;
  v_subject_id TEXT;
  v_customer_id TEXT;
  v_subscription_id TEXT;
  v_status TEXT;
  v_plan TEXT;
  v_event_created TIMESTAMPTZ;
BEGIN
  IF NEW.provider <> 'stripe'
     OR NEW.environment <> 'test'
     OR NEW.processing_status <> 'processed'
     OR NEW.event_type NOT IN (
       'customer.subscription.created',
       'customer.subscription.updated',
       'customer.subscription.deleted'
     ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_subject_type := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_type';
    v_subject_id := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_id';
    v_customer_id := NEW.payload -> 'data' -> 'object' ->> 'customer';

    IF v_subject_id IS NULL THEN
      SELECT m.subject_type, m.subject_id
      INTO v_subject_type, v_subject_id
      FROM payments.customer_mappings m
      WHERE m.provider = NEW.provider
        AND m.environment = NEW.environment
        AND m.provider_customer_id = v_customer_id;
    END IF;

    IF v_subject_id IS NULL OR v_subject_type IS DISTINCT FROM 'user' THEN
      RAISE WARNING 'Stripe event % has no resolvable user subject', NEW.provider_event_id;
      RETURN NEW;
    END IF;

    v_subscription_id := NEW.payload -> 'data' -> 'object' ->> 'id';
    v_status := NEW.payload -> 'data' -> 'object' ->> 'status';
    v_event_created := to_timestamp((NEW.payload ->> 'created')::bigint);

    v_plan := CASE
      WHEN v_status IN ('canceled', 'incomplete_expired') THEN 'free'
      ELSE 'pro'
    END;

    INSERT INTO public.subscriptions (
      user_id, plan, status, stripe_customer_id, stripe_subscription_id, last_stripe_event_at
    )
    VALUES (
      v_subject_id::uuid, v_plan, v_status, v_customer_id, v_subscription_id, v_event_created
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      last_stripe_event_at = EXCLUDED.last_stripe_event_at
    WHERE public.subscriptions.last_stripe_event_at IS NULL
       OR EXCLUDED.last_stripe_event_at >= public.subscriptions.last_stripe_event_at;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fulfill_stripe_subscription failed for event %: %', NEW.provider_event_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Assert the RLS precondition instead of resting on it. AGENTS.md calls out
-- exactly this trap for InsForge managed tables: broad SELECT/INSERT/UPDATE
-- are granted to anon/authenticated by default, so if RLS were ever not
-- already enabled here, the policies added in
-- migrations/20260802201242_add-checkout-session-rls.sql would be inert.
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op if already enabled.
ALTER TABLE payments.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;
