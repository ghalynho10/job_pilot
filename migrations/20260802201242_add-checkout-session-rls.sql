-- Feature 2: checkout & subscribe. Two changes needed before the checkout UI
-- can be wired up. See docs/specs/0017-checkout-and-subscribe.

-- ============================================================================
-- last_stripe_event_at: ordering guard for the fulfillment trigger
-- ============================================================================

-- Stripe delivers webhook events with no cross-event ordering guarantee. This
-- column records the Stripe-side creation time of the last event that actually
-- wrote to this row, so the fulfillment trigger (added in the next migration)
-- can refuse to let a late, out-of-order event regress a newer status back to
-- an older one. It is never read by application code, only by that trigger.
ALTER TABLE subscriptions
  ADD COLUMN last_stripe_event_at timestamptz;

-- ============================================================================
-- RLS on the InsForge managed Stripe checkout session table
-- ============================================================================

-- payments.stripe_checkout_sessions ships with RLS enabled and no policies,
-- so an authenticated user cannot create or read their own Checkout attempt
-- until app specific policies are added. The checkout-session endpoint sends
-- an idempotencyKey, so a retry may look up an existing row via ON CONFLICT;
-- both INSERT and SELECT are required, scoped to the caller's own user id.
CREATE POLICY "users create their stripe checkout sessions"
ON payments.stripe_checkout_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  subject_type = 'user'
  AND subject_id = auth.uid()::text
);

CREATE POLICY "users read their stripe checkout sessions"
ON payments.stripe_checkout_sessions
FOR SELECT
TO authenticated
USING (
  subject_type = 'user'
  AND subject_id = auth.uid()::text
);
