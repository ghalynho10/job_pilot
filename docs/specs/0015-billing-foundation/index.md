# 0015. Billing foundation: subscription data model and Stripe setup

**Date**: 2026-08-01
**Status**: In Progress

## Summary

This decision adds a `subscriptions` table that records each account's plan (free or pro), its Stripe billing status, and a monthly count of company research runs. It also provisions the Stripe product and price for the paid plan. It does not build checkout or usage gating; those are the next two features. This spec only lays the data and Stripe groundwork they both depend on.

## Requirements

**User stories**:
- As the product owner, I want each account's plan and Stripe identifiers stored in one place, so that checkout (feature 2) and usage gating (feature 3) can both read and write a single source of truth.
- As a user, I want my own billing usage counter to reset every month, so that a free plan resets rather than permanently locking me out after one busy month.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: A `subscriptions` table exists with one row per account it has ever needed to track, holding `plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `research_runs_used`, and `usage_period_start`. The migration applies cleanly and the new table is typed in the generated types the rest of the app already uses.
- **AC-2**: No authenticated user can read, insert, or update a `subscriptions` row directly through the normal InsForge client (PostgREST), their own or anyone else's; the table is reachable only through privileged, service role code (the `getSubscription()` accessor and future webhook/usage writers).
- **AC-3**: A user with no `subscriptions` row yet reads back as the free plan with zero research runs used, so the app never needs a special case for "row missing" versus "row present and free."
- **AC-4**: A Stripe product named "Pro" and a recurring monthly price of $9 exist, provisioned through InsForge's payments setup, ready for feature 2's checkout flow to reference.

## Decision

**Chosen option**: A dedicated `subscriptions` table, metering company research runs specifically (rejecting a shared, all provider counter; full options considered in [rationale.md](rationale.md)).

Add a `subscriptions` table shaped like `user_access`, with a `research_runs_used` counter scoped to the company research agent, and provision one Stripe product and price for the single paid plan.

**Implementation skills**: `insforge` (InsForge official skill, `.claude/skills/insforge/`) for the app code side (typed accessor, RLS) · `insforge-cli` (InsForge official skill, `.claude/skills/insforge-cli/`) for provisioning the Stripe product and price through InsForge's payments setup

## Feature design

**Data model sketch**:

```
subscriptions
  user_id               uuid PK, references auth.users(id) on delete cascade
  plan                  text NOT NULL default 'free', check in ('free', 'pro')
  status                text NOT NULL default 'active',
                        check in ('active', 'trialing', 'past_due', 'canceled',
                                  'incomplete', 'incomplete_expired', 'unpaid', 'paused')
  stripe_customer_id    text, unique, nullable
  stripe_subscription_id text, unique, nullable
  research_runs_used    integer NOT NULL default 0
  usage_period_start    timestamptz NOT NULL default now()
  created_at            timestamptz NOT NULL default now()
  updated_at            timestamptz NOT NULL default now(), maintained by an update trigger
                        (mirroring `profiles_updated_at` in the core tables migration)
```

No row exists for a user until something privileged first needs to write one (see [rationale.md](rationale.md)). `status` uses Stripe's own subscription status vocabulary, including `paused`, so feature 2's webhook handler can write any Stripe-issued status through without translation or risking a check constraint violation on delivery. `usage_period_start` lets feature 3 detect "this is a new month" and reset `research_runs_used` to 0, always through a single atomic `UPDATE` statement (never a read then write), with no cron job required.

Any writer that creates a row (feature 2's webhook fulfillment, or a usage increment path) must use `INSERT ... ON CONFLICT (user_id) DO UPDATE SET <only the changed columns>`, never a plain insert or a blind full-row upsert. This is the invariant that stops a late usage increment from recreating a row with `plan = 'free'` under a user whose row already says `'pro'`.

**State transitions** (`status` field, driven by Stripe webhooks in feature 2, not built here):
`incomplete` → `active` → (`past_due` → `active` on retry, or → `canceled`/`unpaid` on failure) → `canceled`

**API surface**:

This feature adds no new HTTP endpoints. It adds one server side function:

| Function | Inputs | Output | Auth | Notes |
|---|---|---|---|---|
| `getSubscription(userId)` | `userId: string` | `{ plan, status, researchRunsUsed, usagePeriodStart, stripeCustomerId, stripeSubscriptionId }` | server side only (not exposed to the client directly) | Returns the free plan default when no row exists; never creates a row itself |

**Key invariants**:
- A `subscriptions` row's `user_id` is unique and immutable (it is the primary key).
- `plan` is always one of `'free'` or `'pro'`; `status` is always one of Stripe's own subscription status values.
- No end user request can set `plan` to `'pro'` or write `stripe_customer_id`/`stripe_subscription_id` directly; only privileged server side code (the webhook handler in feature 2, or a usage increment path) writes this table.
- A missing row and a row with `plan = 'free', research_runs_used = 0` are equivalent from every reader's point of view.

**Security model**:
No direct client access at all, in either direction. `getSubscription()` is server side only and nothing in features 1 through 3 needs a client side read of this table (a future billing settings page would call a server action or server component, not query `subscriptions` from the browser). So, unlike `user_access`, this table gets no `SELECT` grant either: `REVOKE ALL ON subscriptions FROM anon, authenticated` runs with row level security enabled and no policies at all, denying every direct client operation at both the privilege layer and the row level security layer (InsForge grants broad privileges by default, so this revoke is load bearing and must not be dropped in a later migration). Only privileged, service role code (the `getSubscription()` accessor now, a webhook handler and usage writer in later features) ever touches this table. No compliance scope applies (no payment card data is stored here; Stripe holds that).

**Configuration required**:
- None beyond what InsForge's payments setup already manages. The Stripe test product and price are provisioned as InsForge payments configuration, not as a new application level environment variable. Test catalog identifiers: product `prod_UzqR2eky7x4Jco`, price `price_1Tzql4HWEI4hd2koBoXmbWLF` (`usd`, `900`, monthly). Feature 2 will read or reference that price through the InsForge payments path documented in `context/library-docs.md`.

**Critical test scenarios**:
- Happy path: a fresh user with no `subscriptions` row calls `getSubscription()` and receives the free plan default with zero usage, verifies **AC-3**.
- Failure case: an authenticated user attempts a direct `SELECT`, `INSERT`, or `UPDATE` on `subscriptions` through the InsForge client, including a query for their own `user_id`; all are rejected or return no row, verifies **AC-2**.
- Auth/permission: only server side code using the service role can read or write any row; there is no end user identity under which this table is reachable at all, verifies **AC-2**.

## Build plan

1. Confirm there is no existing trigger or automation creating `profiles` rows automatically (already checked in the design conversation: there is none; `profiles` rows are created by the client's own upsert, which `subscriptions` deliberately does not mirror since it must not grant end users write access), satisfies **AC-3**.
2. Write the migration under `migrations/`: create the `subscriptions` table, enable row level security with no policies, run `REVOKE ALL ON subscriptions FROM anon, authenticated` with no grant back (stricter than `user_access`, since no client ever reads this table directly), and add an `updated_at` maintenance trigger mirroring `profiles_updated_at`, satisfies **AC-1**, **AC-2**.
3. Load the `insforge-cli` skill and provision the Stripe product "Pro" with a recurring $9 per month price through InsForge's payments setup, satisfies **AC-4**.
4. Load the `insforge` skill and add the typed `Subscription` shape plus the `getSubscription(userId)` accessor near `lib/access-rules.ts`, returning the free plan default when no row exists, satisfies **AC-3**.
5. Apply the migration against the InsForge project and confirm the generated types pick up the new table, satisfies **AC-1**.
6. Verify end to end: confirm RLS denies cross user reads and direct writes (AC-2), confirm `getSubscription()` returns the free default for a user with no row (AC-3), and confirm the Stripe product and price are visible in InsForge's payments configuration (AC-4).

## Consequences

**Positive**:
- Features 2 (checkout) and 3 (usage gating) both get one typed accessor and one table to build against, instead of inventing their own shape mid build.
- The write lockdown (no end user `INSERT`/`UPDATE`) is enforced at creation, not retrofitted after a self upgrade bug is found in production.

**Negative / tradeoffs**:
- One more table to join against `profiles` for any view that needs both account and plan information.
- Metering only company research runs (not a shared counter) means a second metered action, if one is ever added, needs its own column or a small refactor rather than reusing `research_runs_used` as is.

**Neutral**:
- No `subscriptions` row exists for a user until a privileged write path creates one; this is intentional (see [rationale.md](rationale.md)) but means an admin querying "all pro users" or "all free users with any row" must remember that "no row" also means free, not just "row present, plan = free."

## Follow-up

- [ ] `project-overview.md:202` still lists "Payment or subscription system" under Features Out of Scope; this is now stale since billing was added to `docs/scope/scope.md`. Update it when feature 2 or 3 ships.
- [x] A Stripe/payments section now exists in `context/library-docs.md`, capturing the InsForge payments setup and app integration rules pulled during implementation.
- [ ] Feature 2 (checkout) should create the `subscriptions` row (with `stripe_customer_id` set) at checkout session creation, not only on webhook fulfillment; otherwise a user who starts checkout and gets retried by Stripe before the webhook lands can end up with a duplicate Stripe customer, and reads as free/gated during that gap. The webhook handler then updates the existing row rather than inserting a fresh one.
- [ ] Feature 2's webhook handler needs an idempotency guard (e.g. a `stripe_event_id` ledger, or only ever applying a status update alongside the event's own timestamp) so an out of order or retried Stripe delivery cannot overwrite a newer status with an older one.
- [ ] Feature 3 must implement the monthly usage reset and increment as one atomic `UPDATE ... SET research_runs_used = CASE WHEN <period expired> THEN 1 ELSE research_runs_used + 1 END, usage_period_start = CASE WHEN <period expired> THEN now() ELSE usage_period_start END` statement, never a read then write; concurrent requests racing a plain read-modify-write can undercount. It must also decide the exact period semantics (calendar month vs a rolling 30 days vs Stripe's own `current_period_start`) and replace `isUserApproved()` in `lib/access-rules.ts` with a subscription and usage check, per that function's own docstring.
- [ ] Whether a `subscriptions` row should survive a user deletion (it currently cascades, like every other table in this project) is an open policy question: a cascade silently drops billing history for a user whose Stripe subscription may keep charging until canceled there separately. Revisit before a real account deletion flow ships; not blocking for this feature, since no such flow exists yet.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
