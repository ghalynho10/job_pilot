# 0016. Privileged subscriptions read

**Date**: 2026-08-02
**Status**: In Progress

## Summary

The `getSubscription()` accessor, built in spec 0015, queries the `subscriptions` table which is fully revoked from the `authenticated` role. The only client factory in the project, `createInsforgeServer()`, creates an `authenticated` scoped client, so `getSubscription()` always fails the read and silently returns the free plan default for everyone. This spec adds a service role client factory so privileged server side code can actually read the table, and changes the return type to a discriminated union so callers can tell a failed read from a genuine free user.

## Context

Spec 0015 built the `subscriptions` table with a deliberate security choice: `REVOKE ALL ON subscriptions FROM anon, authenticated` with no policies granting anything back. That choice is correct. The problem is that no client in the project can reach the table on the other side of that wall.

The project has one client factory, `createInsforgeServer()` in `lib/insforge-server.ts`, which wraps `createServerClient` from `@insforge/sdk/ssr` with the current request's cookies. That client runs as the `authenticated` role, the same role the table is revoked from.

A code review (see `docs/reviews/2026-08-02-billing-foundation.md`) confirmed this at runtime: `getSubscription()` cannot read a real row with any client this project can construct. It always falls through to the `freeDefault`. The review also found that both the error branch and the catch branch return that same default, so no test or caller can distinguish a broken read from a genuine free user. Features 2 (checkout) and 3 (usage gating) will be the first real callers and would inherit a silently broken accessor.

No compliance scope applies: no payment card data is stored in the `subscriptions` table.

## Requirements

**User stories**:
- As a developer building feature 2 (checkout), I want `getSubscription()` to reliably return the current plan and Stripe identifiers for a paying user, so that the checkout flow can skip the upgrade prompt for users who already pay.
- As a developer building feature 3 (usage gating), I want to know when a subscription read genuinely failed rather than being silently told "free," so that I can choose whether to fail open (allow the action) or fail closed (block and retry) per call site.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: A service role client factory exists that creates an InsForge client with the `service_role` key, and the key is never exposed to the browser (no `NEXT_PUBLIC_` prefix, not imported in a client component or client action).
- **AC-2**: `getSubscription()` uses the service role client and successfully reads a real `subscriptions` row when one exists for the given user, returning the correct plan, status, Stripe identifiers, and usage counters.
- **AC-3**: `getSubscription()` returns a discriminated result: `{ ok: true, subscription: Subscription }` on success, `{ ok: false }` on any failure (missing row, privilege denied, network error, thrown exception). A missing row is still an `ok: true` with the free plan default, not a failure.
- **AC-4**: `getSubscription()` is re-exported from `lib/access.ts`, consistent with how `isUserApproved` and `agentRunsEnabled` are surfaced through the same seam.
- **AC-5**: A `CHECK (research_runs_used >= 0)` constraint exists on the `subscriptions` table, preventing a bug from writing negative usage that would make the free tier cap ineffective.
- **AC-6**: The existing 393 tests still pass, and new tests verify that a service role client can read a real row and that the discriminated union correctly distinguishes success from failure.

## Options considered

### Option 1: Service role client factory (chosen)

Add a new factory, `createInsforgeServiceClient()`, that reads `SERVICE_ROLE_KEY` from the environment and creates an InsForge client with the `service_role` key. `getSubscription()` uses this client instead of the user scoped one. The key lives in `.env.local` as `SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`), and the factory is imported only from server side code.

**Pros**:
- Simplest path: no new SQL, no new deployment unit, no new network hop
- Follows the existing pattern (`createInsforgeServer` already exists as a client factory)
- The service role key is already available in the InsForge dashboard
- The factory is reusable for future privileged operations (webhook handler in feature 2, usage increment in feature 3)

**Cons**:
- Adds a second client factory to maintain
- The service role key is powerful (it bypasses all RLS); must be kept server only

### Option 2: SECURITY DEFINER SQL function

Create a Postgres function with `SECURITY DEFINER` that runs as the table owner, bypassing RLS. The app calls `insforge.rpc('get_subscription', { user_id })` instead of querying the table directly.

**Pros**:
- Keeps the key surface smaller (no new client factory)
- The function's interface is explicit and auditable (only exposes what it chooses to)

**Cons**:
- Adds SQL surface to maintain (the function body, its signature, its grants)
- InsForge RPC calls still go through the authenticated client, so the function itself needs `SECURITY DEFINER` and explicit grants
- Less reusable: a webhook handler or usage increment path would each need their own SQL function, spreading the privileged logic across more surfaces

### Option 3: InsForge edge function

Create an InsForge edge function with elevated privileges that exposes an HTTP endpoint for reading subscriptions. The app calls the edge function's URL instead of querying the table.

**Pros**:
- Centralizes privileged access in one place
- The edge function is independently deployable and testable

**Cons**:
- Adds a deployment unit and a network hop for every subscription read
- More moving parts than the other options
- Overkill for a single table read that only server side code calls

## Decision

**Chosen option**: Option 1: Service role client factory

Add a `createInsforgeServiceClient()` factory in `lib/insforge-server.ts` (or a new `lib/insforge-service.ts` file) that reads `SERVICE_ROLE_KEY` from `process.env` and creates a client with the `service_role` key. Change `getSubscription()` to accept this privileged client and return a discriminated union `{ ok: true, subscription: Subscription } | { ok: false }`.

**Implementation skills**: `insforge` (InsForge official skill, `.claude/skills/insforge/`) for the service role client construction pattern · `insforge-cli` (InsForge official skill, `.claude/skills/insforge-cli/`) for the CHECK constraint migration

## Rationale

The service role client factory is the simplest fix in the codebase that already has one client factory. It reuses the existing pattern rather than introducing a new category of thing (a SQL function or an edge function) for a single table read. The service role key already exists in the InsForge dashboard; the project just needs to add it to its environment.

The discriminated union (`{ ok: true, subscription } | { ok: false }`) is already the pattern used by `guardPaidRoute` in `lib/access.ts` (which returns `{ ok: true }` or `{ ok: false, response }`). Using the same shape keeps the access surface consistent. A missing row is still `ok: true` with the free plan default, so callers that do not care about the distinction (most readers) can ignore the `ok` wrapper and read `result.subscription` directly after a truthiness check. Callers that need to distinguish a transient failure (feature 3's usage gating, which should fail open for reads) can branch on `ok`.

The `CHECK (research_runs_used >= 0)` constraint is a low cost data integrity guard. Feature 3's atomic increment is the primary defence against negative counts, but a CHECK constraint means even a bug in that increment cannot silently break the cap.

## Feature design

**API surface**:

The signature changes from:

```
getSubscription(insforge: InsForgeClient, userId: string): Promise<Subscription>
```

to:

```
getSubscription(userId: string): Promise<{ ok: true; subscription: Subscription } | { ok: false }>
```

The function no longer takes an `insforge` argument; it constructs its own service role client internally. This keeps the privilege boundary explicit: nothing outside this function needs to know which client it uses.

**Key invariants**:
- `SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_` and is never imported in a client component, client action, or any file with `"use client"`
- `createInsforgeServiceClient()` is never called from a client component or a server action that could be invoked from the browser
- `getSubscription()` is the only place that reads `subscriptions` directly; all other code reads through this function
- A missing row returns `{ ok: true, subscription: freeDefault }`, not `{ ok: false }`; a missing row is the ordinary state of every new signup

**Security model**:
No change to the table's security posture. The `REVOKE ALL` and zero policies remain in place. The service role client bypasses RLS by design (that is the point of the service role), but it is only used from server side code that the browser cannot reach. The `SERVICE_ROLE_KEY` env var is server only; a `NEXT_PUBLIC_` prefix would ship it to the browser and must be caught in review.

**Configuration required**:
- `SERVICE_ROLE_KEY`: the InsForge service role key, added to `.env.local` (and `.env.example` as a placeholder). Never prefixed with `NEXT_PUBLIC_`.

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):
- Happy path: call `getSubscription("real-user-id")` for a user with a subscriptions row → returns `{ ok: true, subscription: { plan: "pro", ... } }`, verifies **AC-2**
- Missing row: call `getSubscription("user-with-no-row")` → returns `{ ok: true, subscription: { plan: "free", researchRunsUsed: 0, ... } }`, verifies **AC-3**
- Service role key missing or invalid: call `getSubscription(...)` when `SERVICE_ROLE_KEY` is unset or wrong → returns `{ ok: false }`, verifies **AC-1**, **AC-3**
- The key is not in the browser: grep for `NEXT_PUBLIC_SERVICE_ROLE_KEY` in the codebase → no matches, verifies **AC-1**
- Negative usage blocked: attempt to insert a row with `research_runs_used = -1` → CHECK constraint violation, verifies **AC-5**

## Build plan

1. [x] Add `SERVICE_ROLE_KEY` to `.env.example` as a placeholder and to `.env.local` with the actual key from the InsForge dashboard, satisfies **AC-1**
2. [x] Create `lib/insforge-service.ts` with `createInsforgeServiceClient()` that reads `SERVICE_ROLE_KEY` and returns a service role client, satisfies **AC-1**
3. [x] Write a migration adding `ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_research_runs_non_negative CHECK (research_runs_used >= 0);`, satisfies **AC-5**
4. [x] Change `getSubscription()` in `lib/access-rules.ts`: remove the `insforge` parameter, use `createInsforgeServiceClient()` internally, return `{ ok: true, subscription } | { ok: false }`, satisfies **AC-2**, **AC-3**
5. [x] Re-export `getSubscription` from `lib/access.ts`, satisfies **AC-4**
6. [x] Update tests in `tests/access.test.mjs`: add tests for the discriminated union shape, a service role success case, and a missing key failure case; verify the existing 398 tests still pass, satisfies **AC-6**
7. [x] Verify end to end: confirm `getSubscription()` reads a real row through the service role client, confirm the CHECK constraint rejects negative usage, and confirm the key is never exposed to the browser, satisfies **AC-1**, **AC-2**, **AC-5**

## Consequences

**Positive**:
- `getSubscription()` becomes a working accessor that features 2 and 3 can depend on
- The service role client factory is reusable for the webhook handler (feature 2) and usage increment (feature 3)
- The discriminated union gives callers explicit control over fail open vs fail closed per call site

**Negative / tradeoffs**:
- A second client factory adds a small maintenance surface
- The service role key is powerful; a misconfiguration (e.g. accidentally prefixing it `NEXT_PUBLIC_`) would be a serious security issue

**Neutral**:
- `getSubscription()` no longer accepts an injectable client, which makes unit testing with a fake client harder. The test will need to mock `createInsforgeServiceClient` at the module level or use environment based testing

## Follow-up

- [ ] Features 2 and 3 are the first real callers of the fixed `getSubscription()`; they should be built next and will exercise the new return shape in production paths
- [ ] `project-overview.md` still lists payment or subscription system as out of scope; update when checkout (feature 2) ships
- [ ] `ON DELETE CASCADE` on `subscriptions` remains a deferred policy question (pre-existing, from spec 0015)

## Rationale

Reasoning and options: see above.
