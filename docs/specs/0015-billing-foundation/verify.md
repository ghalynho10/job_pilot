# Verify: Billing foundation · spec 0015 · updated 2026-08-02
_Steps derived from spec 0015 acceptance criteria. /check verify runs these; /test locks the durable ones._

## Commands
- [ ] `npx @insforge/cli db query "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'subscriptions' ORDER BY ordinal_position;"` → 9 columns: user_id (uuid, NOT NULL), plan (text, NOT NULL, default 'free'), status (text, NOT NULL, default 'active'), stripe_customer_id (text, nullable), stripe_subscription_id (text, nullable), research_runs_used (integer, NOT NULL, default 0), usage_period_start (timestamptz, NOT NULL, default now()), created_at (timestamptz, NOT NULL, default now()), updated_at (timestamptz, NOT NULL, default now()) → AC-1
- [ ] `npx @insforge/cli db query "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'subscriptions';"` → rowsecurity is true → AC-2
- [ ] `npx @insforge/cli db query "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'subscriptions' AND grantee IN ('anon', 'authenticated');"` → zero rows returned → AC-2
- [ ] `npx @insforge/cli db query "SELECT tgname FROM pg_trigger WHERE tgname = 'subscriptions_updated_at';"` → one row returned → AC-1

## UI / manual
- [ ] From a browser context (Client Component or browser console), attempt `insforge.database.from("subscriptions").select("*").eq("user_id", "<real user id>")` → the query is rejected or returns an empty array → AC-2
- [ ] Call `getSubscription(insforge, "<nonexistent user id>")` from server side code → returns `{ plan: "free", status: "active", researchRunsUsed: 0, usagePeriodStart: "<ISO timestamp>", stripeCustomerId: null, stripeSubscriptionId: null }` → AC-3
- [ ] Call `getSubscription(insforge, "<real user id>")` for a user with no subscriptions row → returns the same free plan default as above, and the subscriptions table still has zero rows for that user → AC-3

## Stripe setup
- [x] `npx @insforge/cli payments stripe status` → test environment is connected, webhook is configured, last sync succeeded → AC-4
- [x] `npx @insforge/cli payments stripe catalog --environment test --json` → product named "Pro" exists, and the configured recurring price is active at `usd`, `unitAmount: 900`, `recurringInterval: "month"` → AC-4

## Acceptance-criteria coverage
- AC-1: subscription table exists with correct columns → covered by columns query + updated_at trigger query
- AC-2: no authenticated user can read, insert, or update directly → covered by RLS check, grants check, and manual browser test
- AC-3: missing row reads back as free plan with zero usage → covered by two getSubscription() calls (nonexistent id + real user with no row)
- AC-4: Stripe Pro product and $9/month price exist → covered by Stripe status and catalog checks
