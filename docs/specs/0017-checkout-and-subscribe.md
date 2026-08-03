# 0017. Checkout & subscribe

**Date**: 2026-08-02
**Status**: Done

## Summary

Nothing in the app can yet turn a free account into a paying one. This spec adds that path: a signed in user clicks Upgrade on their profile, completes a Stripe hosted Checkout page for the single Pro plan, and their account is marked Pro once InsForge's verified Stripe webhook events reach a database trigger. No new pages, no direct Stripe SDK dependency, and no self serve cancel or billing portal yet.

## Context

Feature 1 (billing foundation) and 1a (privileged subscriptions read) are done: a `subscriptions` table exists, revoked from client access, and `getSubscription(userId)` in `lib/access-rules.ts` reliably reads it with a free plan default. A single Stripe test product and price already exist for the $9/month Pro plan; the concrete catalog IDs live in environment/provider configuration, not public source. Nothing consumes any of this yet.

The project has already committed to InsForge's managed Payments product over a direct Stripe SDK dependency (`context/library-docs.md`, "InsForge Payments: Stripe"), and to fulfilling subscription state from verified `payments.webhook_events` rows rather than Checkout success URLs, per both `context/library-docs.md` and the `insforge`/`insforge-cli` skills' payments guides. Compliance scope: PCI-DSS applies to any payment flow, but hosted Stripe Checkout means card data never touches this app's servers (SAQ A eligibility); no card handling code is written here.

## Requirements

**User stories**:
- As a free plan user, I want to upgrade to Pro from my profile page, so that I can access the paid parts of JobPilot.
- As a paying user, I want my account to reflect Pro status shortly after I pay, so that I am not blocked from features I already paid for.
- As the developer, I want fulfillment to come from verified Stripe events rather than a redirect URL, so that a user cannot fake a paid status by hitting the success URL directly.

**Acceptance criteria**:
- **AC-1**: A signed in free plan user sees an "Upgrade to Pro" option on `/profile`.
- **AC-2**: Clicking Upgrade creates a Stripe Checkout Session scoped to that user (via `insforge.payments.stripe.createCheckoutSession`) and redirects them to Stripe's hosted page.
- **AC-3**: On successful payment, the user lands on `/dashboard?upgraded=1` with a success banner; their subscription eventually shows `plan: "pro"` once the webhook driven trigger fulfills it.
- **AC-4**: A Pro user does not see the Upgrade CTA, and a direct invocation of the checkout action from a Pro account is rejected, never creating a second Stripe subscription.
- **AC-5**: Fulfillment is idempotent — a duplicate or out of order webhook event never overwrites a newer subscription state with an older one.
- **AC-6**: Canceling out of Stripe Checkout returns the user to `/profile` with no subscription change.

## Options considered

### Option 1: InsForge managed Checkout + a database fulfillment trigger (chosen)

Use `insforge.payments.stripe.createCheckoutSession` for the Checkout Session, and a `SECURITY DEFINER` Postgres trigger on `payments.webhook_events` (an InsForge managed, pre-verified event ledger) to write `public.subscriptions`. No app owned webhook route.

**Pros**:
- No new Next.js route to secure or maintain; InsForge already verifies the Stripe signature before a row ever lands in `payments.webhook_events`
- Fulfillment logic lives in SQL next to the table it protects, the same pattern already used for `subscriptions`' RLS lockdown
- Matches the project's own documented convention (`context/library-docs.md`, the `insforge`/`insforge-cli` payments guides)

**Cons**:
- Debugging fulfillment means reading Postgres trigger logs and `payments.webhook_events` rows, not application logs
- SQL `jsonb` path extraction is less ergonomic to test than TypeScript

### Option 2: App owned `/api/webhooks/stripe` route

Register a Next.js route as the Stripe webhook endpoint, verify the signature with the Stripe SDK, and write `public.subscriptions` from route code.

**Pros**:
- Fulfillment logic lives in TypeScript, the language most of the app is already written in
- Easier to unit test with the project's existing Node test runner

**Cons**:
- Requires adding a direct Stripe SDK dependency and re-implementing signature verification InsForge already does
- Adds a public, unauthenticated route that must itself be hardened (replay protection, rate limiting)
- Contradicts the project's already made decision to route Stripe integration through InsForge Payments, not a direct SDK

### Option 3: Poll Stripe for subscription status instead of using webhooks

After Checkout success, poll `payments.stripe_subscriptions` (InsForge's mirrored catalog) from the dashboard page until the status updates, instead of a trigger.

**Pros**:
- No trigger to write or reason about

**Cons**:
- Polling is fundamentally not durable: a user who never returns to the dashboard after paying never gets fulfilled
- Directly contradicts the documented fulfillment rule ("fulfill from `payments.webhook_events`, not `payments.transactions` or mirrored catalog tables")

## Decision

**Chosen option**: Option 1: InsForge managed Checkout Session creation plus a database fulfillment trigger on `payments.webhook_events`.

**Implementation skills**: `insforge` (InsForge official skill, `.claude/skills/insforge/`, `payments/stripe.md`) for the Checkout Session call and the subscription fulfillment trigger pattern · `insforge-cli` (InsForge official skill, `.claude/skills/insforge-cli/`, `references/payments/stripe.md` and `references/database/access-control.md`) for the RLS policies and migration workflow

## Rationale

InsForge already verifies and ledgers every Stripe webhook event before it reaches the database, and its own payments documentation gives a complete, tested pattern for resolving the billing subject and writing an app owned entitlement table from that ledger. Building a parallel `/api/webhooks/stripe` route would duplicate signature verification InsForge already does correctly, and would contradict the project's existing decision (spec 0015) to use InsForge Payments rather than a direct Stripe SDK dependency. Polling is not durable and is explicitly called out as the wrong pattern in the project's own library docs.

The single largest risk in this design is Stripe's lack of cross event ordering guarantees: `customer.subscription.updated` events can arrive out of order or be retried. The `last_stripe_event_at` column and the `WHERE ... last_stripe_event_at IS NULL OR incoming > current` guard in the trigger's `ON CONFLICT DO UPDATE` clause exist specifically to make a late, stale event a no-op rather than a silent regression.

## Feature design

**Data model sketch**:
- `subscriptions.last_stripe_event_at` (new, nullable `timestamptz`): records the Stripe-side creation time of the last event that wrote this row. Written only by the fulfillment trigger, never read by application code.
- `payments.stripe_checkout_sessions` (InsForge managed): app specific RLS added, `INSERT` and `SELECT` for `authenticated` where `subject_type = 'user' AND subject_id = auth.uid()::text`. `SELECT` is required alongside `INSERT` because the checkout call sends an `idempotencyKey`, and a retry may resolve to an existing row via `ON CONFLICT`.
- `payments.webhook_events` (InsForge managed): unchanged, used only as the fulfillment trigger's source.

**State transitions**: `subscriptions.status` takes Stripe's own subscription status vocabulary verbatim (`active`, `trialing`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused`), already the table's `CHECK` constraint from spec 0015. The fulfillment trigger passes `payload -> data -> object ->> status` straight through rather than mapping event types to statuses by hand; Stripe already sets `status = 'canceled'` on the subscription object by the time `customer.subscription.deleted` fires, so no separate cancellation branch is needed.

**API surface**:

| Surface | Kind | Auth | Behavior |
|---|---|---|---|
| `startCheckout()` (`actions/billing.ts`) | Server Action | signed in user | Reads `getSubscription(userId)`; rejects (redirect to `/profile?error=already_pro`) if already `plan === "pro"`. Otherwise calls `insforge.payments.stripe.createCheckoutSession("test", {...})` with `subject: {type: "user", id: userId}`, `successUrl: ${origin}/dashboard?upgraded=1`, `cancelUrl: ${origin}/profile`, `idempotencyKey: user:${userId}:pro-monthly`, and redirects the browser to the returned Checkout URL. |
| `public.fulfill_stripe_subscription()` | `SECURITY DEFINER` trigger function on `payments.webhook_events` | none (never reachable from the client) | Fires `AFTER INSERT OR UPDATE`, filtered to `provider = 'stripe' AND processing_status = 'processed' AND event_type IN ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted')`. Resolves the billing subject from the subscription object's own `metadata` (falling back to `payments.customer_mappings` by `stripe customer id` only if metadata is absent), then upserts `public.subscriptions`. |

No `/api/webhooks/stripe` route: fulfillment is the trigger above. `startCheckout` is implemented as a Next.js Server Action (`"use server"`), the existing pattern this codebase already uses for every other redirect inducing operation (`actions/auth.ts`'s `signInWithGoogle`/`signInWithGitHub`), rather than a JSON API route.

**Key invariants**:
- Checkout Session creation is always scoped to the caller's own authenticated `userId`; it never accepts a target user id from a request body, and the RLS policy on `payments.stripe_checkout_sessions` enforces the same at the data layer.
- `startCheckout` re-checks `isUserApproved`, not just the authenticated session, before ever calling InsForge payments — a Server Action is directly invocable with just a session cookie, so it cannot rely on the page having rendered the gate.
- The fulfillment trigger never regresses `subscriptions` to an older state: `last_stripe_event_at IS NULL OR incoming.created >= current.last_stripe_event_at` gates every write (`>=`, not `>`, because Stripe's `created` has only second granularity and two events in the same second must still both apply in arrival order rather than the second being dropped).
- Only one paid plan exists today (Pro); a resolved subscription event sets `plan` from `status` (`'canceled'`/`'incomplete_expired'` → `'free'`, everything else → `'pro'`), so a canceled account is not permanently stranded on Pro with no way to resubscribe.
- The whole resolve-and-upsert body runs inside its own exception handler: any ordinary SQL error (a bad UUID cast, an FK violation from a deleted user, a UNIQUE violation) degrades to a logged warning rather than aborting InsForge's own write to `payments.webhook_events`.
- An unresolvable billing subject on a subscription event never fails silently: the trigger `RAISE WARNING`s with the Stripe event id.
- The trigger also filters on `NEW.environment = 'test'`, matching the checkout call's currently hardcoded environment; the two must change together at live launch.

**Security model**:
- PCI-DSS named explicitly; hosted Stripe Checkout keeps this app out of card data handling (SAQ A eligibility).
- The fulfillment trigger runs `SECURITY DEFINER` with `search_path` pinned to `pg_catalog, public, pg_temp`, and is reachable only by InsForge's own insert into `payments.webhook_events`, never by the client.
- `payments.stripe_checkout_sessions` RLS: `subject_type = 'user' AND subject_id = auth.uid()::text`, both `INSERT` and `SELECT`.

**Configuration required**: none new. Stripe keys already live in InsForge's managed payments config (`npx @insforge/cli payments stripe config set`), not app environment variables.

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):
- Happy path: a free user visits `/profile`, clicks Upgrade, is redirected to a real Stripe Checkout URL for the Pro price — verifies **AC-1**, **AC-2**
- Already Pro: `startCheckout()` called with a `plan: "pro"` subscription redirects to `/profile?error=already_pro` without calling InsForge payments — verifies **AC-4**
- Fulfillment happy path: a `customer.subscription.created` event with a resolvable `user` subject upserts `subscriptions` to `plan: "pro"` with the event's status and Stripe ids — verifies **AC-3**
- Idempotency / out of order: an older event (by Stripe `created` timestamp) arriving after a newer one is a no-op; the row keeps the newer status — verifies **AC-5**
- Cancel path: canceling out of Stripe Checkout returns to `/profile` with the subscription unchanged — verifies **AC-6**

## Build plan

1. [x] Migration: add `last_stripe_event_at timestamptz` to `subscriptions`; add `INSERT`/`SELECT` RLS policies on `payments.stripe_checkout_sessions` scoped to `auth.uid()`, satisfies **AC-2**, **AC-5** — `migrations/20260802201242_add-checkout-session-rls.sql`
2. [x] Migration: `SECURITY DEFINER` fulfillment trigger function + trigger on `payments.webhook_events`, resolving the subject from event metadata and upserting `public.subscriptions` with the ordering guard, satisfies **AC-3**, **AC-5** — `migrations/20260802201305_add-stripe-subscription-fulfillment.sql`
3. [x] Server Action `startCheckout` (`actions/billing.ts`): auth check, already-Pro rejection via `getSubscription`, calls `insforge.payments.stripe.createCheckoutSession`, redirects to the returned URL, satisfies **AC-1**, **AC-2**, **AC-4**
4. [x] UI: `UpgradeCard` + `UpgradeButton` on `app/profile/page.tsx` — current plan from `getSubscription`, Upgrade button hidden once `plan === "pro"`, error banner for `?error=checkout|already_pro`, satisfies **AC-1**, **AC-4**, **AC-6**
5. [x] UI: `UpgradeSuccessBanner` on `app/dashboard/page.tsx` when `?upgraded=1` is present, satisfies **AC-3**
6. [x] Verify the fulfillment trigger's SQL logic directly against the real database (initial grant, newer update applies, older out-of-order update is rejected), satisfies **AC-3**, **AC-5**
7. [x] `/check review` on a fresh model (opus) found a blocker (unguarded trigger upsert) and five majors (missing approval gate, strict ordering guard dropping same-second events, `plan` stuck at `pro` after cancellation, a permanent idempotency key risking a stale Checkout URL, context files not updated) — see `docs/reviews/2026-08-02-checkout-and-subscribe.md`
8. [x] Fixed the blocker and all five majors, plus two cheap minors (missing `environment` filter, a null-blind subject type check): `migrations/20260802212929_fix-stripe-subscription-fulfillment.sql`, `migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql`, `actions/billing.ts` (approval gate, dated idempotency key, `getAppOrigin` moved inside the guarded region), `context/ui-registry.md`, `context/progress-tracker.md`. Re-verified against the real trigger via a temp table (same-second event applies, cancellation flips `plan` to `free`, a malformed subject id warns instead of erroring, a `live`-environment event is ignored). TypeScript, ESLint, and the 403-test suite re-run clean.

## Consequences

**Positive**: no new pages, no direct Stripe SDK dependency, fulfillment logic lives entirely in the database next to the table it protects, matching how `subscriptions` was already locked down in feature 1. `startCheckout` reuses the same Server Action + redirect pattern the codebase already uses for OAuth.

**Negative / tradeoffs**: no self serve cancel/downgrade or billing portal yet, no full audit trail of plan changes (only current state), and a single flat Pro price with no plan comparison UI. None of these are precluded by this design, only deferred per the feature 2 scope row: the Billing Portal is InsForge's own named path for later self service, an audit trail is an additive table the same trigger can also write to, and a third tier is a wider `CHECK` constraint plus another Stripe price, not a redesign of checkout or fulfillment.

## Follow-up

- [ ] A full end to end browser verification (real login, real Stripe test card, confirming the webhook lands and the UI updates) has not been run in this session; only the fulfillment trigger's SQL logic was verified directly against the database, and the app was confirmed to boot and correctly gate `/profile` and `/dashboard` when signed out. This should be the first thing checked in a normal browser before considering the feature demo ready.
- [ ] No automated tests were added for `actions/billing.ts` or the fulfillment trigger; `/test checkout & subscribe` should follow.
- [ ] `project-overview.md` still lists payment/subscription as out of scope; update now that checkout exists.
- [ ] `ON DELETE CASCADE` on `subscriptions` remains a deferred policy question (pre-existing, from spec 0015).
- [ ] Feature 3 (usage gating) is the next natural consumer of `plan`/`status` on `subscriptions`.

## References

None.
