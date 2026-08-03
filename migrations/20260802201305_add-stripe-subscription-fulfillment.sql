-- Feature 2: checkout & subscribe. Durable fulfillment: turns a verified
-- Stripe subscription event into the account's subscription row. Never reads
-- Checkout success URLs; those are UX redirects only. See
-- docs/specs/0017-checkout-and-subscribe.
--
-- Stripe's subscription object status vocabulary (active, trialing, past_due,
-- canceled, incomplete, incomplete_expired, unpaid, paused) is exactly the
-- vocabulary subscriptions.status already checks against (see
-- migrations/20260802033103_create-subscriptions.sql), so this trigger passes
-- it straight through rather than mapping event types to statuses by hand.
-- Cancellation needs no separate branch: Stripe sets status = 'canceled' on
-- the subscription object itself by the time customer.subscription.deleted
-- fires.
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

  -- Subscription events carry the app's metadata directly on the subscription
  -- object, unlike invoice events where it is nested under
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

  -- Only one paid plan exists today (Pro), so any subscription event means
  -- this account is on it; status carries the actual lifecycle state.
  INSERT INTO public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id, last_stripe_event_at
  )
  VALUES (
    v_subject_id::uuid, 'pro', v_status, v_customer_id, v_subscription_id, v_event_created
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    last_stripe_event_at = EXCLUDED.last_stripe_event_at
  WHERE public.subscriptions.last_stripe_event_at IS NULL
     OR EXCLUDED.last_stripe_event_at > public.subscriptions.last_stripe_event_at;

  RETURN NEW;
END;
$$;

CREATE TRIGGER fulfill_stripe_subscription_from_webhook
  AFTER INSERT OR UPDATE ON payments.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fulfill_stripe_subscription();
