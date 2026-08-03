# Review, billing-foundation (feature 2: checkout & subscribe), 2026-08-02

**Reviewed by**: claude-opus-5 (author on claude-opus-5, different session)
**Scope**: 11 files, uncommitted working tree vs `main`
**Verdict**: Blocked

## Summary

This implements spec 0017 end to end: a `startCheckout` Server Action that creates an InsForge-managed Stripe Checkout Session, a `SECURITY DEFINER` fulfillment trigger on `payments.webhook_events` that upserts `public.subscriptions`, and three small UI pieces. The shape of the design is right — metadata-first subject resolution, an ordering guard, redirects correctly placed outside the `try` block, and every color drawn from design tokens rather than raw hex. The headline problems are all in the trigger and the action's guards: the trigger has no exception handling, so a single malformed or stale event can abort InsForge's own webhook ingestion; `startCheckout` skips the private-beta approval gate that this repo's own code comments insist every privileged path must re-check; the ordering guard uses strict `>` against a second-granularity timestamp, which silently drops same-second events; and a canceled subscriber is permanently left on `plan = 'pro'` with no way back through the UI or the action.

## Blockers

### 🔴 Fulfillment trigger has no exception guard, so one bad event can wedge the payments ledger, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:68-81`

**Problem**: The `INSERT ... ON CONFLICT` runs unguarded inside an `AFTER INSERT OR UPDATE` row trigger on `payments.webhook_events`. `AFTER` row triggers execute in the same transaction as the triggering statement, so any exception raised here aborts InsForge's write of the webhook event row itself. At least four realistic payloads raise one:

- **FK violation**: `subscriptions.user_id` references `auth.users(id)`. A user who deletes their account while their Stripe subscription is still live will produce a `customer.subscription.deleted`/`.updated` event whose `insforge_subject_id` no longer exists in `auth.users`.
- **NOT NULL / CHECK violation**: `v_status` comes from `payload -> data -> object ->> 'status'` and is written into a `NOT NULL` column with a closed `CHECK` vocabulary (`migrations/20260802033103_create-subscriptions.sql:17-22`). A null status, or any status Stripe adds to the vocabulary in future, raises.
- **UNIQUE violation**: `stripe_customer_id` and `stripe_subscription_id` are both `UNIQUE`. If either value is already attached to a different `user_id` row, the `ON CONFLICT (user_id)` branch does not catch it and the write raises.
- **Cast failure**: `v_subject_id::uuid` (line 72) raises `invalid input syntax for type uuid` for any non-UUID subject id that still carries `subject_type = 'user'`.

**Why it matters**: The failure mode is not "one user doesn't get fulfilled." It is that the verified event never lands in `payments.webhook_events` at all, InsForge's ingestion endpoint returns an error, Stripe retries on its backoff schedule and eventually gives up, and the ledger — the single source of truth this whole design rests on — has a hole in it. The blast radius is every user's payment events flowing through that endpoint, not just the one whose payload was malformed. The manual verification described in the spec's build plan step 6 exercised only well-formed payloads with valid users, so none of these paths were touched.

**Suggested fix**: Wrap everything from the subject resolution through the upsert in a `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING 'fulfillment failed for stripe event %: %', NEW.provider_event_id, SQLERRM; END;` block, so a bad event degrades to a logged warning and a still-ledgered row rather than an aborted transaction. Additionally, validate `v_status` against the known vocabulary before the insert and skip (with a warning) if it is null or unrecognized, so an unknown future Stripe status is a no-op instead of an exception the handler has to absorb. The trigger already establishes the right instinct for unresolvable subjects at line 57-60 — this is the same instinct applied to the write itself.

## Major

### 🟠 `startCheckout` skips the private-beta approval gate, `actions/billing.ts:28-45`

**Problem**: The action checks that the caller is signed in and that they are not already Pro, but never calls `isUserApproved` / the equivalent of `requireApprovedPage`. Every other privileged surface in this codebase does. `app/profile/page.tsx:33` gates the page, but a Server Action is directly invocable with nothing more than a valid session cookie — it does not require the page to have rendered.

**Why it matters**: This repo's own doctrine, written in `lib/access.ts:50-55`, is explicit: *"The page gate is user experience only. A hand crafted request with a valid session cookie never renders a page, which is why each paid route re-checks here on its own rather than trusting the redirect."* A signed-in user whose `user_access.status` is `pending` or `blocked` can invoke `startCheckout` directly, reach Stripe Checkout, and pay for a product they are gated out of. That is both an authorization gap and a refund liability, and it is the exact scenario the comment above was written to prevent.

**Suggested fix**: Add an `isUserApproved(insforge, data.user.id)` check immediately after the auth check, before the subscription read, redirecting to `/private-beta` on failure. Same ordering as the pages, so a denied caller costs one auth call and one indexed lookup.

### 🟠 Ordering guard drops same-second events, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:64,80-81`

**Problem**: `v_event_created` is derived from `to_timestamp((NEW.payload ->> 'created')::bigint)` — Stripe's event `created` field has **one-second** granularity. The guard then requires `EXCLUDED.last_stripe_event_at > public.subscriptions.last_stripe_event_at`, strictly greater. Two events with the same `created` second therefore resolve to equal timestamps and the second one is silently discarded.

**Why it matters**: Stripe routinely emits `customer.subscription.created` and `customer.subscription.updated` within the same second during checkout completion, and again on `incomplete → active`, `trialing → active`, and `past_due → active` recovery. In every one of those pairs the *later* event carries the status the app actually cares about, and it is the one that gets dropped — leaving the row stuck at the earlier lifecycle state with no retry that can ever fix it (a Stripe redelivery of the same event has the same `created` value, so it is dropped too). The spec claims AC-5 is satisfied and the manual verification confirmed the guard rejects an *older* event; it did not test the equal-timestamp case, which is where the guard is wrong rather than conservative.

**Suggested fix**: Second-granularity alone is not a sufficient ordering key. Either compare on the subscription object's own `payload -> data -> object ->> 'created'` plus a tiebreaker, or keep the event timestamp but change the guard to `>=` and add a secondary discriminator (e.g. skip only when the incoming `provider_event_id` has already been applied). At minimum, `>=` narrows the failure from "later state permanently lost" to "same-second events apply in arrival order," which is a far smaller and far less damaging window than the current behavior.

### 🟠 A canceled subscriber is permanently stranded on `plan = 'pro'`, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:72` + `actions/billing.ts:43-45`

**Problem**: The trigger hardcodes `plan = 'pro'` for *every* resolved subscription event, including `customer.subscription.deleted` (which writes `status = 'canceled'` but leaves `plan = 'pro'`). `startCheckout` then rejects any caller with `plan === "pro"`, and `UpgradeCard` (`components/profile/UpgradeCard.tsx:20-35`) shows "You're on the Pro plan." and hides the button on the same condition.

**Why it matters**: Once a subscription is canceled — whether the user cancels from a Stripe receipt email, or Stripe cancels it after the `unpaid` dunning cycle — the account shows "You're on the Pro plan", the Upgrade CTA is gone, and a direct action invocation is rejected with `already_pro`. There is no path back to paying, in the UI or the action, and no billing portal in this feature to escape through. The same is true for `past_due` and `unpaid`. The spec documents the "any event sets plan = pro" choice at line 103, but does not reckon with these consequences. It also sets up feature 3 to grant paid entitlement to canceled users if it gates on `plan` alone.

**Suggested fix**: Two options, either is fine. Derive `plan` from status in the trigger (`CASE WHEN v_status IN ('active','trialing','past_due') THEN 'pro' ELSE 'free' END`), keeping `status` as the detailed record; or keep `plan = 'pro'` as written but make both the action's rejection and the card's "already Pro" branch test `plan === "pro" && status is entitling` rather than `plan` alone. The first is simpler and makes `getSubscription().plan` mean what its name implies for every downstream consumer.

### 🟠 Permanent `idempotencyKey` may make an abandoned checkout unrecoverable, `actions/billing.ts:63`

**Problem**: The key `user:${userId}:pro-monthly` is stable for the lifetime of the account. The companion migration's own comment (`migrations/20260802201242_add-checkout-session-rls.sql:22-24`) confirms InsForge resolves a repeat call to the *existing* row via `ON CONFLICT`, which is why the `SELECT` policy was needed. Stripe Checkout Sessions expire 24 hours after creation.

**Why it matters**: This is AC-6's second half. A user who clicks Upgrade, abandons Checkout, and returns the next day gets the stored, now-expired session URL rather than a fresh one — landing on a Stripe expired-link page with no way to retry, permanently. The cancel path itself works (the `cancelUrl` is correct); it is the *retry after cancel* that is at risk. I could not confirm from the SDK reference whether InsForge mints a new session when the stored one has expired, so this needs verification rather than a blind fix — but if it does not, upgrade is a one-shot operation per account.

**Suggested fix**: Verify the reuse-vs-expiry behavior against the live InsForge project (create a session, let it expire or expire it in Stripe, call again with the same key). If the expired URL is returned, add a rotating component to the key — a coarse time bucket, or an attempt counter — so retries after the expiry window mint a fresh session while true double-submits within a single attempt still dedupe. Note that `context/library-docs.md:201` prescribes exactly this key format, so whichever way it resolves, that line should be updated with the finding.

### 🟠 `ui-registry.md` and `progress-tracker.md` were not updated, `context/ui-registry.md`, `context/progress-tracker.md`

**Problem**: Three new UI components ship in this change (`UpgradeCard`, `UpgradeButton`, `UpgradeSuccessBanner`) and neither context file was touched — `ui-registry.md` was last modified Aug 1, `progress-tracker.md` at 03:36 on Aug 2, both before this feature's files were written at 16:1x. `docs/scope/scope.md` *was* updated correctly.

**Why it matters**: `AGENTS.md` lists "Update `progress-tracker.md` and `ui-registry.md` after every feature" under "Rules That Never Change" — a hard project rule, not a preference. `UpgradeCard` introduces a plan-status card pattern and `UpgradeSuccessBanner` a `role="status"` success-banner pattern that the next feature (usage gating, which the scope says will show upgrade prompts) will want to match. Unrecorded, they get reinvented divergently.

**Suggested fix**: Run `/imprint` for the three components and add the feature-2 rows to `progress-tracker.md`.

## Minor

### 🟡 No tests, despite an established near-zero-cost pattern for exactly this, `actions/billing.ts`, `app/dashboard/page.tsx`

The spec's own follow-up flags this, so it is not a novel finding — but the specific gap is worth naming. This project's test convention is source-contract tests (`tests/auth-contract.test.mjs`, `tests/profile-contract.test.mjs`, `tests/dashboard-page.test.mjs`), which assert on file text and cost minutes to write. `tests/dashboard-page.test.mjs` in particular already asserts the ordering of the dashboard's gates and was not extended for the new banner. A `tests/billing-contract.test.mjs` in the same style would pin the properties that matter most here and that the Blocker/Major findings above are all about: that the auth check precedes the subscription read, that the already-Pro rejection precedes the `createCheckoutSession` call, that the approval gate is present at all, and that no `redirect()` sits inside a `try` block. Those are exactly the invariants a future refactor will silently break.

### 🟡 Fulfillment trigger does not filter on `environment`, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:28-36`

The guard checks `provider`, `processing_status`, and `event_type`, but not `NEW.environment` — even though the fallback query at line 53 correctly scopes by it. Today everything is test mode so there is no live bug. The moment live mode is enabled alongside it, a test-mode subscription event (trivially produced with a Stripe test card) will write the same `public.subscriptions` row and grant real Pro entitlement. Add an explicit environment check now, while it costs one line, rather than after both modes are live.

### 🟡 `v_subject_type <> 'user'` is null-blind, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:57`

If the payload carries `insforge_subject_id` but not `insforge_subject_type`, the condition evaluates to `FALSE OR NULL` = `NULL`, plpgsql treats that as false, and the trigger proceeds to write a subscription for a subject it never actually validated as a user. Use `v_subject_type IS DISTINCT FROM 'user'`.

### 🟡 `getAppOrigin` can throw, contradicting the action's documented contract, `actions/billing.ts:26,47-50`

The JSDoc states "Never throws: every failure path redirects back to /profile with an error code rather than surfacing an unhandled exception, since this runs as a form action with no error boundary of its own." But `getAppOrigin` (`lib/auth-routing.ts:15,26`) throws on a missing or non-http(s) `NEXT_PUBLIC_APP_URL`, and the call at line 47 is outside the `try`. A production misconfiguration surfaces as an unhandled Server Action error, which is precisely what the comment promises cannot happen. Either move the call inside the guarded region and redirect to `/profile?error=checkout` on failure, or soften the comment to name this exception.

### 🟡 Checkout-session RLS migration rests on an unasserted precondition, `migrations/20260802201242_add-checkout-session-rls.sql:20-41`

The comment asserts `payments.stripe_checkout_sessions` "ships with RLS enabled and no policies," and the migration adds two policies on that assumption without asserting it. `AGENTS.md` calls out this exact trap for InsForge tables: broad `SELECT, INSERT, UPDATE` are granted to `anon`/`authenticated` by default, so if RLS is *not* enabled on this managed table in some environment or after some InsForge upgrade, these policies are inert and every authenticated user can read and write every other user's checkout sessions. The existing `migrations/20260801120001_create-user-access.sql` is the project's own model for doing this defensively. Add an explicit `ALTER TABLE payments.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;` (idempotent) and a `REVOKE ALL ... FROM anon, authenticated;` followed by the narrow `GRANT`, so the lockdown is stated by this migration rather than inherited from an assumption.

### 🟡 Success banner asserts Pro status from a URL parameter alone, `app/dashboard/page.tsx:84,163` + `components/dashboard/UpgradeSuccessBanner.tsx:11-14`

The banner renders purely on `?upgraded=1` and reads "You're on the Pro plan now." Anyone who types that URL, or who abandons payment after Stripe redirects, sees a confident claim of paid status. No entitlement is actually granted (the trigger is the only writer, correctly), so this is cosmetic — but the dashboard is not currently reading `getSubscription` at all, and once feature 3 adds that read, the banner should defer to it: show the confident text when the row is already `pro`, and the "may take a few seconds" text only while it is not.

## Nits

- ⚪ `migrations/20260802201305_add-stripe-subscription-fulfillment.sql:87-90`, the trigger has no `WHEN` clause, so every row written to `payments.webhook_events` — every provider, every event type — pays a plpgsql function call to reach the early return at line 35. A `WHEN (NEW.provider = 'stripe' AND NEW.processing_status = 'processed')` clause skips the call entirely for the majority of rows.
- ⚪ `actions/billing.ts:56`, the `"test"` environment is hardcoded alongside a test-mode price id. The price has an explanatory comment; the environment string does not. A brief note that both flip together at live launch would save someone changing one and not the other.
- ⚪ `actions/billing.ts:28`, `Promise<never>` is an accurate but unusual return type for a form action; `Promise<void>` is the conventional signature and reads more obviously as "React form action" at the call site in `UpgradeCard.tsx:32`.

## Strengths

- The `redirect()` placement is correct throughout — every call sits outside the `try` block, so Next's throw-based redirect is never swallowed. This is a genuinely easy thing to get wrong, and `lib/access.ts:88-90` shows the team already learned it once.
- Metadata-first subject resolution with `payments.customer_mappings` as fallback (lines 41-55), with a comment explaining *why* that order and not the reverse (the mapping row may not exist yet). This is the correct precedence and the reasoning is preserved for the next reader.
- `SECURITY DEFINER` with `search_path` pinned to `pg_catalog, public, pg_temp` — the right hardening, not skipped.
- Zero hardcoded hex and zero raw Tailwind color classes across all three new components; every token (`success-lightest`, `success-foreground`, `accent-dark`, `border-error`) resolves in `app/globals.css`. `UpgradeButton` also gets `min-h-11` for touch target and a real `useFormStatus` pending state.
- The `searchParams` handling in both pages correctly narrows the `string | string[]` union rather than assuming a scalar.
- Spec 0017 itself is unusually good: real options considered with honest cons, the ordering-hazard rationale stated explicitly, and the gaps disclosed in Follow-up rather than papered over.

## Resolution (2026-08-02, same day)

Fixed in `migrations/20260802212929_fix-stripe-subscription-fulfillment.sql` and `migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql` (both applied to the real project and re-verified against the actual trigger via a temp table + the real function, not just by hand):

- **Blocker** (exception guard): the resolve-and-upsert body now runs inside its own `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...` block. Verified with a deliberately malformed `insforge_subject_id` (not a UUID) — the insert into the test webhook table succeeded with a logged warning instead of raising.
- **Major** (missing approval gate): `actions/billing.ts` now calls `isUserApproved(insforge, data.user.id)` right after the auth check, redirecting to `/private-beta` on failure, same ordering as the page guards.
- **Major** (strict `>` ordering guard): changed to `>=`. Verified: a same-second update (`created` equal to the prior event) now applies.
- **Major** (`plan` stuck at `pro` after cancellation): `plan` is now derived from `status` (`CASE WHEN v_status IN ('canceled', 'incomplete_expired') THEN 'free' ELSE 'pro' END`). Verified: a `customer.subscription.deleted`/`status: canceled` event flips the row to `plan: free`, and a subsequent older reactivate attempt is still correctly rejected by the ordering guard.
- **Major** (permanent idempotency key risking a stale/expired Checkout URL on retry): the key now buckets by UTC date (`user:${userId}:pro-monthly:${date}`) instead of being permanent, per `actions/billing.ts`.
- **Major** (`ui-registry.md`/`progress-tracker.md` not updated): both updated with the three new components and the feature 2 status.
- **Minor** (no `environment` filter): the trigger now also requires `NEW.environment = 'test'`, matching the app's currently hardcoded checkout environment; both must change together at live launch (commented in the migration).
- **Minor** (`v_subject_type <> 'user'` null-blind): changed to `IS DISTINCT FROM 'user'`.
- **Minor** (`getAppOrigin` throwing outside the `try`, contradicting the "never throws" docstring): moved inside the guarded region alongside the checkout call, matching `actions/auth.ts`'s `startOAuth` pattern.
- **Minor** (unasserted RLS precondition on `payments.stripe_checkout_sessions`): added an explicit (idempotent) `ALTER TABLE payments.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;`. Applying it confirmed RLS was already enabled (no-op), so the assumption held, but it is now asserted rather than inherited.

**Not fixed, left as follow-up** (both genuinely low stakes and out of scope for a same-day fix pass):
- No automated tests added yet for `actions/billing.ts` or the trigger (still needs a `/test` pass; noted in the spec's Follow-up).
- The dashboard success banner's confident "You're on the Pro plan now" copy still doesn't check `getSubscription` itself — deferred until feature 3 reads it on that page anyway.
- The three nits (missing `WHEN` clause on the trigger, hardcoded `"test"` environment string without an inline comment, `Promise<never>` vs `Promise<void>`) were not addressed.

TypeScript, ESLint, and the full 403-test suite were re-run after these fixes and all pass.

## Test coverage

The existing 403-test suite passes but covers none of this change. `getSubscription` — the one dependency `startCheckout` leans on — is covered by `tests/access.test.mjs` from feature 1a. New and uncovered: all of `actions/billing.ts` (auth guard, missing approval guard, already-Pro rejection, checkout error handling, redirect targets), the entire fulfillment trigger, and the two `searchParams` branches in the pages. `tests/dashboard-page.test.mjs` exists and asserts that page's structure but was not extended for the new banner. Given the project's source-contract test style, a `tests/billing-contract.test.mjs` covering the guard ordering in `startCheckout` is the highest-value addition and would have caught the missing approval gate (Major #1) directly. The trigger's branching logic — ordering guard, subject fallback, unresolvable-subject warning — is the riskiest code in the change and is verifiable only against a live database today; the manual verification covered the happy path and the strictly-older-event case, but not equal timestamps, missing users, null statuses, or unresolvable subjects, which is where the Blocker and two of the Majors live.
