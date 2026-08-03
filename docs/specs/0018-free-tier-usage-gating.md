# 0018. Free tier usage gating

**Date**: 2026-08-02
**Status**: Accepted

## Summary

Free accounts get a monthly cap on two paid actions: job searches and company research runs. Once a free account hits its cap, the app shows an upgrade message instead of running the action; Pro accounts are never capped. Usage is tracked on the existing `subscriptions` table and checked and counted in one safe database step, so two requests arriving at the same time cannot both slip through. This also removes the old private beta approval gate, since a subscription (every signed up user is on the free plan by default) becomes the only thing standing between a user and the app.

## Context

Three earlier features (billing foundation, the privileged subscriptions read, and checkout and subscribe) built the billing groundwork: a `subscriptions` table with a `plan` field (`free` or `pro`), a `status` field, and two columns added specifically for this feature, `research_runs_used` and `usage_period_start`. Nothing reads or writes those two columns yet.

The app currently gates access with a separate, older mechanism: a `user_access` table and an `isUserApproved()` check, built for an early private beta before billing existed. Every signed up user is already given a free plan row by default, so keeping both gates running side by side is redundant and confusing to reason about. Spec 0012 already flagged that this feature should retire the private beta gate once billing can stand on its own.

Two app actions cost real money per call: an Adzuna job search (`app/api/agent/find/route.ts`) and a company research run (`app/api/agent/research/route.ts`, which calls out to Browserbase and GPT-4o). Both are guarded today by `guardPaidRoute`, which checks that a session exists and that the agent kill switch is on, then calls `isUserApproved` as its one additional check. Without a cap, a free account can run either action without limit, which is not sustainable once the product is not gated by manual approval alone.

The consequence of not deciding this now: the private beta gate stays as the only access control, which does not scale past a small approved list, and there is no cost ceiling on either paid action for free accounts.

## Requirements

**User stories**:
- As a free account holder, I want to know how many searches and research runs I have left, so I am not surprised when one stops working.
- As a free account holder who has used up my monthly cap, I want a clear prompt to upgrade instead of a confusing error, so I understand why the action did not run.
- As a Pro subscriber, I want every search and research run to work without a cap, so my paid plan feels unlimited.
- As the product owner, I want spend on Adzuna and Browserbase/GPT-4o bounded per free account, so cost stays predictable.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: A free plan account can run up to 10 Adzuna job searches and 3 company research runs within a rolling 30 day window measured from `usage_period_start` (set at account creation, then moved forward automatically the next time either action is taken after the previous window has expired).
- **AC-2**: The 11th search or 4th research run within that window is blocked before the paid provider is called, and the response and the page both show an upgrade prompt instead of a generic error.
- **AC-3**: A Pro plan account in good standing (`plan = 'pro'` and `status` is `active` or `trialing`) is never capped and never has its usage counted, regardless of how many searches or research runs it makes. A Pro account whose `status` has lapsed (`past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `paused`) is capped the same as a free account, since a lapsed payment should not keep unlimited usage running.
- **AC-4**: Once 30 days have passed since an account's window started, its next action (either kind) resets both counters together (the acted on counter to 1, the other to 0) and starts a new window, rather than continuing to add to the old count or leaving the other counter stuck at its old value.
- **AC-5**: Two requests for the same free account arriving at nearly the same time, when only one unit of quota remains, result in exactly one being allowed and one being capped; neither an over count nor an under count occurs.
- **AC-6**: A request that fails the route's existing validation (for example, a profile with no skills, or a job id that does not exist) does not consume a unit of quota, since no paid provider was called.
- **AC-7**: The former private beta gate (`user_access` table read, `isUserApproved()`, the `/private-beta` page) no longer runs; a free plan account with no `user_access` row can still use the app up to its cap.
- **AC-8**: The find jobs page and the company research card each show, before the cap is hit, how many of the monthly allowance remain (for example "7 of 10 searches left this cycle"); Pro accounts see no such counter since it does not apply to them.

## Options considered

### Option 1: One Postgres function that checks the cap and increments the count in the same call

A `SECURITY DEFINER` Postgres function, callable through the service role client already used for `subscriptions`, takes the account id, which action, and its limit. In one round trip it reads the plan, and for a free account only, either raises the counter and reports allowed, or reports capped without changing anything, using a single `UPDATE ... WHERE` that only succeeds when there is quota left.

**Pros**:
- The check and the increment happen in the same database statement, so two simultaneous requests cannot both read "quota left" before either one writes; this is what makes AC-5 hold.
- Matches a pattern already in this codebase: the Stripe fulfillment path also uses a `SECURITY DEFINER` function to make a privileged, atomic write.

**Cons**:
- A Postgres function is one more piece of database logic to read and maintain outside of application code, rather than a plain table update the app code can see directly.

### Option 2: Read the current count first, then a separate update from the app code

The route reads `subscriptions` for the account's plan and current count, decides in application code whether it is under the cap, and if so runs a second call to increment.

**Pros**:
- Simpler to read; both steps are plain application code, no database function to reason about.

**Cons**:
- The `subscriptions` table is only reachable through PostgREST's table API (InsForge's REST layer over Postgres), whose update endpoint accepts static replacement values only; it cannot express "set this column to itself plus one" or a conditional reset in one call. Doing the increment in application code would still need a second call back to the database to write the new number, which reopens the same gap as below.
- Two requests racing between the read and the write can both read "under the cap" before either writes, letting a free account exceed its cap; this breaks AC-5 outright, which is the reason this option is not used elsewhere for the same table (spec 0015 already called this out for `research_runs_used`).

### Option 3: A shared counter across both actions instead of two separate ones

One `used` column and one cap cover both an Adzuna search and a company research run, instead of `research_runs_used` and a new `adzuna_searches_used` column.

**Pros**:
- One column, one number to show in the UI, slightly less schema.

**Cons**:
- A company research run costs far more (Browserbase plus GPT-4o) than a job search; a shared counter would let a free account burn its whole month on ten cheap searches, or force the research cap down to match the cheaper action. Spec 0015 already rejected a shared counter for exactly this reason when `research_runs_used` was first added.

## Decision

**Chosen option**: Option 1: one Postgres function that checks the cap and increments the count in the same call, keeping two separate counters (Option 3 rejected) rather than two application level calls (Option 2 rejected).

## Rationale

AC-5 (no over counting under concurrent requests) is only guaranteed if the check and the increment happen as one database statement; Option 2's two step read then write cannot give that guarantee, and this same tradeoff was already settled the same way when `research_runs_used` was designed (spec 0015's follow up names the exact `UPDATE ... CASE WHEN` shape this feature now uses). Keeping the counters separate (rejecting Option 3) follows directly from the cost gap between the two actions: company research calls Browserbase and GPT-4o per run, while a job search only calls the Adzuna API, so the two actions need independently sized caps rather than one shared number.

## Feature design

**Data model sketch**:
- `subscriptions` gains one column: `adzuna_searches_used integer NOT NULL DEFAULT 0`, with a `CHECK (adzuna_searches_used >= 0)` constraint, mirroring the existing `research_runs_used` column and its constraint added in spec 0016.
- `usage_period_start` (already on the table) continues to govern both counters as one shared rolling window, rather than adding a second period column per action. When the window expires, **both** counters reset together in the same statement (the one being acted on resets to 1, the other resets to 0), not just the counter for the action that happened to run. Resetting only the acted on counter would strand the other counter at its old value forever, since nothing else ever rolls its clock forward on its behalf; see Key invariants below for why this must happen in one statement. A user who does only research runs does also get their unused search counter zeroed early once the shared window expires, rather than it continuing to accumulate against a window it never used; this is an accepted simplification of sharing one clock, not a bug (see Consequences).
- No other table changes. The former `user_access` table is left in place, unread, rather than dropped in this feature (see Consequences and Follow-up).

**State transitions**: none; this is a counter with a rolling reset, not a state machine.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/agent/find | POST | jobTitle, location | search results, usage `{used, limit}` | session | 401 signed out, 403 `usage_capped`, 500 usage check failed |
| /api/agent/research | POST | job id | research dossier, usage `{used, limit}` | session | 401 signed out, 403 `usage_capped`, 404 job not found, 500 usage check failed |
| `check_and_increment_usage` (Postgres function, service role only) | RPC | user id, action (`search` or `research`), limit | allowed, plan, used, period start | service role | none; always returns exactly one row (`allowed: false` when the guarded update below affects zero rows, never an empty result set) |

**Key invariants**:
- A free account's counter for an action can never go above that action's limit; the database `UPDATE ... WHERE` guard, not application code, is what enforces this under concurrent requests.
- The check and the write are one statement, and the expiry test is evaluated inside that same statement's `WHERE`/`CASE`, not read into a variable beforehand and branched on in a separate step. Concretely, the acting statement is shaped like:
  Shown here for `action = 'research'`; for `action = 'search'` the two `CASE` expressions on the counters swap roles the same way.
  ```sql
  UPDATE subscriptions
  SET research_runs_used   = CASE WHEN usage_period_start < now() - interval '30 days' THEN 1 ELSE research_runs_used + 1 END,
      adzuna_searches_used = CASE WHEN usage_period_start < now() - interval '30 days' THEN 0 ELSE adzuna_searches_used END,
      usage_period_start   = CASE WHEN usage_period_start < now() - interval '30 days' THEN now() ELSE usage_period_start END
  WHERE user_id = $1
    AND (usage_period_start < now() - interval '30 days' OR research_runs_used < $2)
  RETURNING research_runs_used, adzuna_searches_used, usage_period_start;
  ```
  Because the expiry check inside `WHERE`/`CASE` is re-evaluated per statement under Postgres's normal read committed behavior, two concurrent requests against an expired window cannot both take the "reset" branch and both write `1`: whichever commits first moves `usage_period_start` forward, so the second one re-checks expiry against the now current `usage_period_start`, sees the window is no longer expired, and takes the plain increment branch instead (or is capped by it, if the limit is already reached). This is what makes AC-5 hold in both the plain increment case and the reset case, not only the increment case.
- The function first ensures a row exists for the account (`INSERT ... ON CONFLICT (user_id) DO NOTHING`) before running the guarded update above, so a missing `subscriptions` row is never the reason zero rows are affected; zero rows affected always means the account is capped, never "no row to update."
- A Pro account in good standing never has either counter read for a decision or incremented; `plan = 'pro' AND status IN ('active', 'trialing')` short circuits inside the function before either counter is touched (see AC-3 for the lapsed-status case).
- Quota is only spent once a request has passed the route's own validation (profile has skills, job exists) and is about to call the paid provider, never earlier. A downstream failure of the paid provider itself still spends the unit, since the money was already at risk.
- `usage_period_start` only moves forward when the guarded update above finds the window expired; reading usage (`remainingUsage()`) never changes it, but must independently treat an already expired window as zero used, even though the database has not yet performed the write that would formally reset it, so the number a page shows never appears more capped than the next real request would be.

**Security model**:
- `check_and_increment_usage` runs as `SECURITY DEFINER` with `SET search_path = pg_catalog, public, pg_temp` (matching the existing hardened `fulfill_stripe_subscription` trigger's convention) and has `EXECUTE` revoked from `PUBLIC`, matching the existing rule that `subscriptions` privileges are revoked from `anon` and `authenticated` and only the service role client may touch this table. Application code calls it only from `lib/access-rules.ts`, through the same service role client `getSubscription()` already uses.
- Removing `isUserApproved()` means there is no longer a separate approval list; every authenticated user is subject to the subscription and usage check instead. Signed out requests are still rejected by `guardPaidRoute`'s existing session check, unchanged. The existing `ENABLE_AGENT_RUNS` kill switch in `guardPaidRoute` is unaffected by any of this and stays as the operational fallback to hard stop both metered routes if the usage check itself ever misbehaves after the old gate is removed (see Migration plan, Risks).

**Configuration required**: none; no new environment variables. The two numeric caps (10 searches, 3 research runs) are constants in `lib/access-rules.ts`, not environment configuration, since they are a product decision rather than a per environment setting.

**Critical test scenarios** (each maps to an acceptance criterion above):
- Happy path: a free account makes 3 searches, sees "7 of 10 left", then a research run succeeds and shows "2 of 3 left", verifies **AC-1**, **AC-8**.
- Failure case (cap hit): the 11th search in one window is blocked before Adzuna is called, and the response's `code` is `usage_capped`, verifies **AC-2**.
- Failure case (concurrency): a deterministic test that calls `check_and_increment_usage` directly over two separate database connections for the same account pinned at 1 unit of quota left, issuing both calls without waiting on each other's result, then asserts exactly one row shows `allowed = true` and the stored counter advanced by exactly 1, not 2; verifies **AC-5**. (Driving this through the two HTTP routes instead would be too timing dependent to assert on reliably; the RPC boundary is where the guarantee actually lives.)
- Failure case (reset, single action): an account's `usage_period_start` more than 30 days old gets its counter reset to 1, not 4, on its next action, verifies **AC-4**.
- Failure case (reset, other counter): an account at 10/10 searches and 0/3 research, with `usage_period_start` more than 30 days old, that then makes a research call: `research_runs_used` becomes 1 and `adzuna_searches_used` resets to 0 in the same call, so the account's next search is allowed rather than permanently stuck at the old cap; verifies **AC-4**.
- Auth/permission: a Pro account in good standing making 20 searches in a row never receives a 403 and its counters are never touched; a Pro account with `status = 'past_due'` making the same request is capped like a free account once its counter reaches the limit; verifies **AC-3**.
- Validation ordering: a request for company research on a job id that does not exist returns its normal 404 without changing `research_runs_used`, verifies **AC-6**.
- Old gate removed: an account with no row in `user_access` (or that table entirely absent from the request path) can still search and research up to its cap, verifies **AC-7**.

## Build plan

1. Write the migration adding `adzuna_searches_used` (with its non negative check) and the `check_and_increment_usage` Postgres function, using the single guarded `UPDATE ... CASE WHEN` statement described in Feature design (both counters reset together on an expired window, the expiry check evaluated inside the same statement, `status` checked alongside `plan` for the Pro short circuit), plus `SET search_path` and the `REVOKE EXECUTE ... FROM PUBLIC` line, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**.
2. In `lib/access-rules.ts`: add `checkAndIncrementUsage()` (calls the RPC through the service role client, fails closed on any error) and `remainingUsage()` (read only helper for the "N of M left" display); extend `getSubscription()`'s select and the `Subscription`/`SubscriptionRow` types in `types/index.ts` to include `adzunaSearchesUsed`; remove `isUserApproved()`, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-7**.
3. In `lib/access.ts`: remove the approval check from `guardPaidRoute` (it keeps only its session and kill switch check); add `enforceUsageCap(userId, action)`, which returns the 403 `usage_capped` response shape (with `used` and `limit`) on denial; remove `requireApprovedPage` entirely, satisfies **AC-2**, **AC-7**.
4. Wire the company research vertical slice end to end: call `enforceUsageCap(userId, "research")` in `app/api/agent/research/route.ts` right after its existing job lookup and before `runCompanyResearch`; thread a `usage` value down through `app/find-jobs/[id]/page.tsx` into `CompanyResearchCard`, which shows the remaining count and an upgrade banner in place of its normal error state when capped, satisfies **AC-1**, **AC-2**, **AC-6**, **AC-8**.
5. Repeat the same wiring for job search: `enforceUsageCap(userId, "search")` in `app/api/agent/find/route.ts` after its existing profile check and before `runJobSearch`; thread `usage` through `app/find-jobs/page.tsx` into `FindJobsPage`, satisfies **AC-1**, **AC-2**, **AC-6**, **AC-8**.
6. Remove the old gate now that both actions are metered: delete `app/private-beta/page.tsx`, the `/private-beta` entry in the proxy matcher, the four `requireApprovedPage` call sites (`app/dashboard/page.tsx`, `app/find-jobs/page.tsx`, `app/find-jobs/[id]/page.tsx`, `app/profile/page.tsx`), and the `isUserApproved` re-check block in `actions/billing.ts`, satisfies **AC-7**.
7. Update `tests/access.test.mjs` and `tests/billing-contract.test.mjs`: remove or rewrite every test asserting on `isUserApproved`, `user_access`, `requireApprovedPage`, or `/private-beta` as load bearing behavior; add tests for `checkAndIncrementUsage` (Pro always allowed without incrementing, free under cap allowed and increments, free at cap denied without incrementing, RPC error denies); add a test pinning that `enforceUsageCap` is called in both routes after their existing validation and before the paid call, satisfies **AC-1** through **AC-7**.

## Consequences

**Positive**:
- Cost on both paid actions is now bounded per free account instead of unlimited.
- The app no longer depends on a manually maintained approval list; any signed up user can use the product up to the free cap without needing to be added to `user_access` first.
- The atomic check and increment pattern this feature introduces is reusable if a third metered action is added later.

**Negative / tradeoffs**:
- Sharing one `usage_period_start` across both counters, and resetting both together when it expires, means an account that only ever uses one of the two actions still has its unused counter zeroed early whenever the other one triggers a reset, rather than that counter continuing to accumulate against a window it never used; this is a minor unfairness accepted for simplicity rather than adding a second period column per action.
- A paid provider call that fails after quota was already spent (an Adzuna error, a Browserbase timeout) still consumes that unit; a user who hits such a failure has one fewer retry within the same window. This is intentional (quota tracks money at risk, not successful outcomes) but is a real cost to the user experience worth knowing about.
- The `user_access` table is left in the database, unread, rather than dropped in this feature, which leaves one piece of unused schema behind until the follow up cleanup runs.

**Neutral**:
- One new Postgres function (`check_and_increment_usage`) is added to the project's small existing set of `SECURITY DEFINER` functions; anyone debugging usage counts now needs to know to look at the function, not just the table.
- The response shape for a capped request (`code: "usage_capped"`, `used`, `limit`) is a new, slightly richer error shape than the plain `{success: false, error}` used elsewhere; this is additive and does not change any existing response shape.
- A Stripe driven downgrade from Pro back to free does not itself reset either counter (the fulfillment trigger from spec 0017 never touches usage columns). This is left as is rather than fixed here: whatever counters an account carries into free plan status are evaluated by the same rolling window logic on its next action, which is either still fair (the account already spent that quota while it was, at another point, on the free plan) or gets reset anyway once 30 days have passed.

## Migration plan

**Strategy**: feature flagged by ordering, not by a runtime flag. The build plan's own order is the rollout mechanism: schema and enforcement functions ship first (inert until routes call them), then each metered route is wired up as its own deployable step, and the old gate is only removed last, once both new caps are confirmed working.

**Phases**:
1. Ship the migration (new column, new function). No behavior changes yet; nothing calls the function.
2. Ship company research capping end to end (route, UI). The old `isUserApproved` gate is still in place underneath it, so a bug in the new cap check fails no worse than before.
3. Ship job search capping end to end, same reasoning.
4. Remove `isUserApproved`, `requireApprovedPage`, and `/private-beta`. Only after phases 2 and 3 are confirmed working, since this phase removes the fallback gate.

**Rollback**: phases 1 to 3 can each be reverted independently by reverting that phase's commit; the new column and function are additive and harmless to leave in place even if a later phase is reverted. Phase 4 should only be reverted together with restoring `isUserApproved`'s call site, since removing the fallback gate and then reverting the new cap check would leave a route with no gate at all.

**Risks**: the main risk is the window between phase 2/3 and phase 4, where an account could in principle be captured by neither gate's intended behavior if the new cap check has a bug; keeping `isUserApproved` in place as a fallback during that window is the mitigation, which is why phase 4 is ordered last rather than bundled with phases 2 to 3. A second, distinct risk sits after phase 4: once the fallback gate is gone, both routes' only remaining protection against a database outage or a bug in `check_and_increment_usage` is that they fail closed (a 500, not a silent bypass), which is safe but means an outage in that one function fully blocks both actions for every account, free and Pro alike. The existing `ENABLE_AGENT_RUNS` kill switch on `guardPaidRoute` is the operational response already available for this case (it can pause both routes independently of the usage check), so no new kill switch needs to be built, but this is worth knowing before phase 4 ships rather than discovering it during an incident.

## Follow-up

- [ ] Drop the `user_access` table (and its unused `UserAccessRow`/`UserAccessStatus` types in `types/index.ts`) once this feature has been live for a while and nobody has needed to look at the old approval history.
- [ ] Update `context/project-overview.md`'s "Features Out of Scope" list, which still lists "Payment or subscription system" as out of scope; this was already flagged stale by spec 0015 and remains unfixed.
- [ ] Decide, in a later feature, whether `ON DELETE CASCADE` on `subscriptions` (deferred since spec 0015) should be added; unrelated to usage gating but still open.
