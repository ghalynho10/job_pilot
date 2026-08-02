# Review, billing-foundation, 2026-08-02

**Reviewed by**: claude-opus-5 (author model not recorded)
**Scope**: 12 files, branch vs `main` (merge base `490e417`)
**Verdict**: Changes requested

## Summary

The change lays the billing data foundation: a `subscriptions` table locked down with RLS-plus-REVOKE, a `Subscription`/`SubscriptionRow` type pair, a `getSubscription()` read accessor, and 10 new tests. The SQL is the strongest part of the diff, it gets the InsForge default-grants gotcha exactly right and carries the Stripe status vocabulary in full. The headline problem is on the read side: with the table revoked from `authenticated` and no service-role client anywhere in the repo, `getSubscription()` cannot actually read a row under any client this project can construct, and its error path silently converts that failure into "free plan", so the defect is invisible in every test and in the app. Secondary issues: the migration tests assert the SQL file's text rather than the applied schema, and the new accessor is not exported through the `lib/access.ts` seam its own docstring designates.

## Major

### 🟠 `getSubscription()` has no client that can read the table it queries, `lib/access-rules.ts:97`

**Problem**: The migration runs `REVOKE ALL ON subscriptions FROM anon, authenticated` with RLS on and zero policies, so the table is reachable only by privileged/service-role code. The spec and the docstring both say so. But the only client factory in the repo is `lib/insforge-server.ts:5`, `createServerClient({ cookies })`, which authenticates as the end user (role `authenticated`). There is no service-role client, and no service-role key in `.env.example`. Every call to `getSubscription()` with the client this project can actually build will come back as a privilege error, hit the `if (error)` branch at line 115, log, and return `freeDefault`.

**Why it matters**: The accessor is inert as shipped. Nothing calls it yet, so nothing is wrong in production today, but feature 2/3 will attach to it and inherit an accessor that always reports "free", meaning a paying customer reads as free and gets capped. It also means the spec's own AC-3 verify step ("call `getSubscription()` for a user with no row → free default") passes for the wrong reason and cannot distinguish success from total failure. Note `context/library-docs.md` puts fulfillment writes in DB trigger functions off `payments.webhook_events`, which are privileged and unaffected, this gap is read-side only.

**Suggested fix**: Decide and record how privileged reads are made in this project before feature 2 builds on the accessor, either add a service-role client factory alongside `createInsforgeServer()` (with the key server-only, never `NEXT_PUBLIC_`), or move the read behind a privileged path (edge function / SQL function with `SECURITY DEFINER`). Then make `getSubscription()` take that client type specifically so a user-scoped client cannot be passed by mistake. Until then, at minimum say in the docstring that no such client exists yet.

### 🟠 A failed read is silently indistinguishable from a genuinely free user, `lib/access-rules.ts:115-135`

**Problem**: Both the `error` branch and the `catch` branch return the same `freeDefault` object a real free user produces. The caller gets no signal that anything went wrong. The docstring justifies this as "a transient database read should not block access", but the returned value is the *more* restricted state, not the less restricted one, so on this table returning free is exactly what blocks access. This is the opposite of `isUserApproved()` above it, where deny-on-error is correct because failing open costs money.

**Why it matters**: It permanently masks the issue above, no test and no runtime signal can tell "the whole table is unreadable" from "this user has no row". Once feature 3 gates on `researchRunsUsed`, one transient PostgREST failure downgrades a paying customer to a capped free user with only a generic log line to show for it.

**Suggested fix**: Return a discriminated result (e.g. `{ ok: true, subscription }` / `{ ok: false }`, or `Subscription | null` with the free default synthesised by the caller) so each call site chooses its own failure posture: a billing settings page can show an error, and a usage gate can deliberately fail open for a known-pro user rather than silently capping them. Keep the never-throws property, just stop conflating the two outcomes.

## Minor

### 🟡 `getSubscription` is not re-exported from the seam file, `lib/access.ts:17`

**Problem**: `lib/access-rules.ts:11-13` states the convention: "Import these through `lib/access.ts`, which re-exports both. That keeps the gate a single named seam for the rest of the app." `lib/access.ts` re-exports `agentRunsEnabled` and `isUserApproved` but not `getSubscription`, so any future caller must reach past the seam into `lib/access-rules.ts` directly.

**Why it matters**: Small now, but feature 2 and 3 are the first callers and will set the import pattern for everything after. Two import paths for one module is exactly the drift the seam exists to prevent.

**Suggested fix**: Add `getSubscription` to the re-export on `lib/access.ts:17`, or update the comment to say the accessor is intentionally not part of the route-guard seam.

### 🟡 The migration tests assert the SQL text, not the applied schema, `tests/access.test.mjs:369-435`

**Problem**: Every AC-1/AC-2 assertion reads `migrations/*_create-subscriptions.sql` as a string and regex-matches it. Nothing connects to the database. They prove the file is spelled a particular way, not that the table exists, that RLS is on, or that the grants were actually removed. Meanwhile the four DB-level checks in `docs/specs/0015-billing-foundation/verify.md:5-8` are all unchecked, yet `docs/scope/scope.md:153` marks "Verify it" as done.

**Why it matters**: The entire security argument for this table lives in the privilege layer, and the suite that is supposed to lock it cannot observe that layer. If the migration was never applied, or applied and later overridden by an InsForge-side grant, all 10 tests still pass green. The unchecked verify boxes suggest this has not actually been confirmed against the live project.

**Suggested fix**: Run the four `verify.md` queries against the InsForge project and tick them (particularly the `role_table_grants` query returning zero rows, that is the one nothing else can substitute for). Keep the text assertions as a regression guard against a later migration re-granting, they are fine for that, just do not treat them as evidence the schema is correct.

### 🟡 `subscriptions` is undocumented in `context/architecture.md`

**Problem**: `context/architecture.md` has a `### user_access` section (and `tests/access.test.mjs:519` asserts its presence), but the new `subscriptions` table has no equivalent entry. AGENTS.md requires the context docs be updated after every feature.

**Why it matters**: The next person designing feature 2 reads `architecture.md` for the data model and will not find the table the whole slice depends on, or its unusual "no policies at all" access rule.

**Suggested fix**: Add a `### subscriptions` section mirroring the `user_access` one, calling out that the table has no client-reachable path in either direction, and extend the AC-12 documentation test to assert it.

### 🟡 `usagePeriodStart` in the free default is a fresh `now()` on every call, `lib/access-rules.ts:91`

**Problem**: The default object is rebuilt per call, so two consecutive reads for the same (nonexistent) row return different `usagePeriodStart` values. The existing test only asserts `typeof sub.usagePeriodStart === "string"` (`tests/access.test.mjs:273`), so the behavior is unpinned.

**Why it matters**: Feature 3 is specced to derive "is this a new month" from `usage_period_start`. A caller that reads the default and then compares it against a stored value will see a period that never expires and never began. Harmless today, a trap for the very next feature.

**Suggested fix**: Document explicitly that the default's `usagePeriodStart` is a placeholder that must not be used for period arithmetic (the atomic `UPDATE` in feature 3 should use the DB's own value), or make it a fixed sentinel so the "no row" case is recognisable.

### 🟡 No non-negative constraint on the usage counter, `migrations/20260802033103_create-subscriptions.sql:25`

**Problem**: `research_runs_used integer NOT NULL DEFAULT 0` accepts negative values. `plan` and `status` both carry CHECK constraints; this column does not.

**Why it matters**: Feature 3 writes this column with an atomic `UPDATE ... SET research_runs_used = CASE ...`. A sign error or a bad reset expression would silently store a negative count and hand every affected user unlimited runs, with no database-level tripwire.

**Suggested fix**: Add `CHECK (research_runs_used >= 0)` while the table is still empty; it is free now and awkward to add later.

### 🟡 Both access readers log under the same undifferentiated prefix, `lib/access-rules.ts:116` and `:133`

**Problem**: `getSubscription` logs `"[lib/access]"`, the same string `isUserApproved` uses, with no mention of which table or user failed.

**Why it matters**: Given that a failed subscriptions read is otherwise invisible (see the Major above), the log line is the only signal it produces, and it cannot be told apart from an approval-gate failure when triaging.

**Suggested fix**: Use a distinct tag (e.g. `"[lib/access:getSubscription]"`) so the billing read is greppable on its own.

## Nits

- ⚪ `.gitignore:62`, `redesign/` is unrelated to the billing slice; it will read as noise in this branch's history.
- ⚪ `migrations/20260802033103_create-subscriptions.sql:45`, `CREATE OR REPLACE FUNCTION` followed by a bare `CREATE TRIGGER` makes the migration non-re-runnable; a `DROP TRIGGER IF EXISTS` first would make it idempotent (matches the existing files, so author's call).
- ⚪ `migrations/20260802033103_create-subscriptions.sql:35`, `set_subscriptions_updated_at` is a byte-for-byte copy of `set_profiles_updated_at`; a single generic `public.set_updated_at()` would serve both. The spec explicitly chose mirroring, so this is preference only.
- ⚪ `tests/access.test.mjs:431`, `assert.match(sql, /'paused'/)` would pass if `'paused'` appeared only in a comment; anchoring the match inside the `status IN (...)` list would tighten it.
- ⚪ `tests/access.test.mjs:350`, the "never inserts" test slices the source from `getSubscription` to end of file, so it silently starts covering any function added after it.

## Strengths

- The `REVOKE ALL ... FROM anon, authenticated` with no grant back is exactly right for this project's InsForge default-grants hazard, and the load-bearing comment explains *why* it must survive future migrations rather than just what it does. The `user_access` comparison in the comment is genuinely useful to the next reader.
- The `status` CHECK carries Stripe's full vocabulary including `paused`, `incomplete_expired`, and `unpaid`, so feature 2's webhook cannot fail a delivery on a constraint violation. That is a real production failure mode caught at design time.
- The spec's Follow-up section is unusually good: the `INSERT ... ON CONFLICT` invariant, the webhook idempotency guard, the atomic usage `UPDATE`, and the cascade-on-user-delete policy question are all the right hazards, written down where feature 2 and 3 will find them.
- `getSubscription` selects named columns rather than `*`, and the test at `tests/access.test.mjs:326` locks that in both directions.
- `user_id uuid PRIMARY KEY REFERENCES auth.users (id)` follows the project convention rather than pointing at `profiles`, with the reasoning recorded inline.

## Test coverage

10 new tests, all passing (37 total in `tests/access.test.mjs`). The `getSubscription` behavioral tests are genuinely good: missing row, populated row, query error, thrown error, table and filter scoping, column selection, and a source-level guard against insert/upsert. They use a recording fake that asserts the actual query shape rather than just a return value.

Two gaps. First, the migration tests (AC-1, AC-2) are text assertions over the SQL file rather than schema assertions against the database, so they cannot detect an unapplied migration or a later re-grant at the InsForge level, see the Minor above. Second, nothing covers the interaction between the two Major findings: there is no test asserting what a caller observes when the read is denied, because the accessor makes that case indistinguishable from success by design. If the error path is changed to a discriminated result, that becomes testable and should be tested.
