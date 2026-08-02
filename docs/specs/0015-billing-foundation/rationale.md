# Rationale: Billing foundation

## Context

Scope feature 1 (`docs/scope/scope.md`) needs a decision: how subscription state is tracked (plan, status, Stripe customer and subscription ids, a monthly usage counter) and a Stripe product and price provisioned that every later billing feature depends on. Feature 2 (checkout and subscribe) and feature 3 (free tier usage gating) both build on whatever this spec decides, so getting the shape wrong here means both later features inherit the mistake.

Today there is no billing code anywhere in the project (confirmed by searching `app/`, `lib/`, `actions/`, and `migrations/` for "stripe," "subscription," "billing," and "payment"). The only related piece of code is `lib/access-rules.ts`'s `isUserApproved()`, whose own docstring says billing "replaces this function body with a subscription plus usage check" once features 1 through 3 land. That function currently reads a temporary table, `user_access`, built for a private beta gate (spec 0012), which was always meant to be replaced, not extended.

The project already has one closely related precedent to learn from: `user_access` (`migrations/20260801120001_create-user-access.sql`). It references `auth.users` directly rather than `profiles`, deliberately, so the access fact survives a user who has signed in but never filled out a profile. It also revokes all default privileges before granting `SELECT` only, because InsForge grants broad `SELECT, INSERT, UPDATE` privileges to `anon` and `authenticated` by default on any new table, even with no matching row level security policy; leaving that default in place would mean row level security is the only thing stopping a write, not the privilege grant too. Both of those decisions apply just as much to billing state as they did to the beta gate.

The project uses InsForge's built in Payments capability (Stripe Checkout, Billing Portal, webhook based fulfillment) rather than a hand rolled Stripe SDK integration, per `AGENTS.md`'s payments section and the installed `insforge`/`insforge-cli` skills. No Stripe dependency exists in `package.json` today, and this spec does not add one; provisioning happens through InsForge's CLI, not application code.

## Options considered

### Option 1: A dedicated `subscriptions` table

A new table, separate from `profiles`, keyed by `user_id` referencing `auth.users`, following the same shape as `user_access` (select only for the owner, no write grant to end users).

**Pros**:
- Mirrors a pattern already proven in this codebase (`user_access`), so reviewers and future readers already know how to reason about it.
- Keeps billing writes isolated from `profiles`, which grants its owner row `INSERT`/`UPDATE`; a billing field on `profiles` would need a second, harder to audit carve out to stop a user granting themselves "pro" through a normal profile update.
- Free to evolve independently (new plans, new Stripe fields) without touching the profile schema everything else depends on.

**Cons**:
- One more table and one more join for anything that needs both profile and plan data.

### Option 2: Add billing columns to `profiles`

Add `plan`, `status`, `stripe_customer_id`, and the usage columns directly onto the existing `profiles` table.

**Pros**:
- One fewer table; a profile read already returns plan info with no join.

**Cons**:
- `profiles` already grants its owner row `UPDATE` (so a user can edit their own name, skills, and so on). Stopping a user from writing `plan = 'pro'` themselves through that same grant means either column level privileges (InsForge/PostgREST does not support this cleanly at the row level security layer) or a trigger that silently reverts unauthorized changes, both more fragile than simply not granting the write in the first place.
- Mixes an account level fact (what a user is paying for) with a profile level fact (their resume details), which is exactly the reasoning that already led `user_access` to live apart from `profiles`.

### Option 3: Meter every paid provider call in one shared counter

Instead of a `research_runs_used` counter scoped to the company research agent, add one generic `usage_count` that increments on every `guardPaidRoute()` call (research, Adzuna search, resume extraction).

**Pros**:
- One counter to reason about; gating logic in feature 3 checks one number.

**Cons**:
- Company research (a Browserbase session plus a GPT-4o call) costs far more per use than an Adzuna search. A shared counter caps cheap, frequent actions at the same rate as the expensive one, which would throttle free tier browsing for a reason unrelated to actual cost.
- Harder to reverse: once callers depend on one shared field, splitting it apart later touches every call site again. A named `research_runs_used` field can be generalized into a shared model later if it turns out to be needed, but starting narrow is the safer default here.

## Rationale

The engineer confirmed metering company research runs specifically, not a shared counter, because it is the single most expensive per user action today with one clear call site (`app/api/agent/research/route.ts`), while Adzuna searches are cheap and frequent enough that folding them into the same cap would throttle free tier browsing for an unrelated reason. This is the same judgment already made once in this codebase when `user_access` was split out of `profiles`, specifically so a self grantable field could never live somewhere a user already has write access. Repeating that shape for `subscriptions` costs one join, which is cheap, against a mistake (a user upgrading their own plan through a normal profile edit) that would be expensive to notice and fix later.

The read side is deliberately tolerant of a missing row. Every existing migration in this project was checked, and none of them use a Postgres trigger on `auth.users` to auto create a related row; `profiles` rows are created by the client's own upsert on first save, which relies on `profiles` granting its owner `INSERT`, a grant `subscriptions` must not have. Introducing a brand new automation pattern (an `auth.users` insert trigger) just for this one table would be a new mechanism nothing else in the project uses, for a problem that has a simpler answer: a missing `subscriptions` row simply reads back as the free plan with zero usage, exactly matching how `user_access`'s own missing row convention already means "not yet approved." A row only gets created once something actually needs to persist state (feature 2's webhook fulfillment on first checkout, or feature 3's first usage increment for a free user); both of those already run as privileged server side code and can perform that insert directly, so no new provisioning mechanism is needed.

One deviation from the `user_access` precedent was made after a cross check of the drafted spec: `user_access` grants its owner a direct `SELECT`, because `lib/access.ts` originally needed a client reachable read. `subscriptions` is read exclusively through the server side `getSubscription()` accessor; nothing in features 1 through 3 calls PostgREST directly for this table, and a future billing settings page would go through a server action or server component rather than a client side query. Since the client read grant would be unused surface, it is dropped entirely rather than added and left unused: `REVOKE ALL` runs with no grant back and row level security enabled with zero policies, so every direct client path (read or write, own row or not) is denied at both the privilege and row level security layers. This is strictly narrower than `user_access` and costs nothing, since no planned feature needs the client read path.
