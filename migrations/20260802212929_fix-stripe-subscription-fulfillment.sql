-- Feature 2: checkout & subscribe. Fixes to the fulfillment trigger from
-- migrations/20260802201305_add-stripe-subscription-fulfillment.sql, found by
-- a fresh model /check review (docs/reviews/2026-08-02-checkout-and-subscribe.md)
-- before this ever reached a real Stripe event:
--
-- 1. Blocker: the resolve-and-upsert logic ran with no exception handling.
--    Because this trigger fires AFTER INSERT OR UPDATE on InsForge's own
--    payments.webhook_events, any ordinary SQL error inside it (a bad uuid
--    cast, an FK violation from a deleted user, a UNIQUE violation) would
--    abort the write to webhook_events itself, not just this one row's
--    fulfillment. The whole body now runs inside its own exception handler
--    that logs and no-ops instead of raising.
-- 2. The ordering guard used a strict `>`, so two events created in the same
--    Stripe-clock second (their granularity is whole seconds) could arrive
--    in the wrong logical order and the guard would silently and
--    permanently drop the later one. Changed to `>=`.
-- 3. `plan` was hardcoded to 'pro' on every subscription event, including
--    customer.subscription.deleted, so a canceled account stayed shown as
--    Pro forever: the UI kept the Upgrade CTA hidden and startCheckout kept
--    rejecting the account as already_pro, with no way back to paying.
--    plan now derives from status: Stripe's own terminal, no-longer-billed
--    states ('canceled', 'incomplete_expired') fall back to 'free'; every
--    other status (active, trialing, past_due, unpaid, paused, incomplete)
--    still has a live subscription behind it and stays 'pro'.
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
     OR NEW.processing_status <> 'processed'
     OR NEW.event_type NOT IN (
       'customer.subscription.created',
       'customer.subscription.updated',
       'customer.subscription.deleted'
     ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Subscription events carry the app's metadata directly on the
    -- subscription object, unlike invoice events where it is nested under
    -- parent.subscription_details.metadata.
    v_subject_type := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_type';
    v_subject_id := NEW.payload -> 'data' -> 'object' -> 'metadata' ->> 'insforge_subject_id';
    v_customer_id := NEW.payload -> 'data' -> 'object' ->> 'customer';

    -- Fall back to the customer mapping only when the event itself has no
    -- subject metadata; events from other checkout attempts may not have
    -- created that mapping row yet, so the payload is always checked first.
    IF v_subject_id IS NULL THEN
      SELECT m.subject_type, m.subject_id
      INTO v_subject_type, v_subject_id
      FROM payments.customer_mappings m
      WHERE m.provider = NEW.provider
        AND m.environment = NEW.environment
        AND m.provider_customer_id = v_customer_id;
    END IF;

    IF v_subject_id IS NULL OR v_subject_type <> 'user' THEN
      RAISE WARNING 'Stripe event % has no resolvable user subject', NEW.provider_event_id;
      RETURN NEW;
    END IF;

    v_subscription_id := NEW.payload -> 'data' -> 'object' ->> 'id';
    v_status := NEW.payload -> 'data' -> 'object' ->> 'status';
    v_event_created := to_timestamp((NEW.payload ->> 'created')::bigint);

    -- Only one paid plan exists today (Pro). A subscription in a terminal,
    -- no-longer-billed state has no live access behind it; every other
    -- status still does.
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
