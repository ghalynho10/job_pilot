# Verify: portfolio-private-access-gate · spec 0012 · updated 2026-08-01

_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Two accounts are needed throughout: **UNAPPROVED** (signed in, no `user_access` row) and **APPROVED** (`user_access.status = 'approved'`). Grant and revoke with the `insforge-cli` skill:

```sql
-- grant
INSERT INTO user_access (user_id, status, approved_at, notes)
VALUES ('<uuid>', 'approved', now(), 'portfolio demo')
ON CONFLICT (user_id) DO UPDATE SET status = 'approved', approved_at = now();

-- block
UPDATE user_access SET status = 'blocked' WHERE user_id = '<uuid>';

-- back to unapproved
DELETE FROM user_access WHERE user_id = '<uuid>';
```

## Public and signed out

- [ ] Signed out, load `/` → the homepage renders, no redirect caused by this feature → AC-1
- [ ] Signed out, load `/login` → the login page renders, no approval check runs → AC-1
- [ ] Signed out, request `/dashboard`, `/profile`, `/find-jobs`, a real `/find-jobs/<id>`, and `/private-beta` → each lands on `/login`, and the existing `?error=session` rules are unchanged (present on a deep link to `/find-jobs/<id>`, present when a stale session cookie existed) → AC-2

## Unapproved user, pages

- [ ] As UNAPPROVED, visit `/dashboard` → redirected to `/private-beta` → AC-3
- [ ] Repeat for `/profile`, `/find-jobs`, and `/find-jobs/<id>` → each redirects to `/private-beta` → AC-3
- [ ] Set that account's row to `status = 'blocked'`, repeat one of the four → still `/private-beta`, and the screen text is identical to the no row case → AC-3
- [ ] On `/private-beta`: no app navbar is rendered, so there is no Dashboard, Find Jobs, or Profile link and no search or research control anywhere on the page. The signed in account is shown and the sign out action works, returning to a signed out state → AC-4
- [ ] As APPROVED, visit `/private-beta` directly → redirected to `/dashboard`, not left on a dead end → AC-4
- [ ] Screenshot `/private-beta` at desktop (1440px) and mobile (390px) widths → readable at both, tokens only, no raw hex or raw Tailwind color classes in the source → AC-4

## Approved user, pages

- [ ] As APPROVED, visit `/dashboard`, `/profile`, `/find-jobs`, and `/find-jobs/<id>` → all four render their existing content with no visible change from before this feature → AC-5
- [ ] Confirm no page file moved: `app/dashboard/page.tsx`, `app/profile/page.tsx`, `app/find-jobs/page.tsx`, and `app/find-jobs/[id]/page.tsx` are all still at those paths, and `proxy.ts`'s matcher still lists `/dashboard/:path*`, `/profile/:path*`, `/find-jobs/:path*` (plus the new `/private-beta`) → AC-10
- [ ] Search the four page files for `requireApprovedPage` → each one calls it exactly once, after its signed in check and before its data reads, and none of them queries `user_access` itself → AC-10

## Paid routes

For each of `POST /api/agent/find`, `POST /api/agent/research`, `POST /api/resume/extract`, `POST /api/resume/generate`:

- [ ] With no session cookie → `401` and the generic message, nothing else runs → AC-7
- [ ] With UNAPPROVED's session cookie and an otherwise valid body → `403` and the generic message → AC-6
- [ ] On that same `403` request, confirm no external call was made: no new `agent_runs` row for that user, no new `agent_logs` row, no Browserbase session in the Browserbase dashboard, and no OpenAI usage delta. The guard must sit above body parsing, so an intentionally malformed body still returns `403`, never `400` → AC-6
- [ ] With APPROVED's session cookie → the route behaves exactly as it did before this feature → AC-5, AC-13
- [ ] Confirm `app/api/resume/signed-url/route.ts` was not modified and still works for APPROVED → AC-13

## Kill switch

- [ ] Set `ENABLE_AGENT_RUNS=false`, restart, and as APPROVED post to `/api/agent/find` and `/api/agent/research` → both `503` with the generic message, and no Adzuna, Browserbase, Stagehand, or OpenAI call is made → AC-8
- [ ] Same run, as APPROVED post to `/api/resume/extract` and `/api/resume/generate` → both still succeed, proving the switch is scoped to agent runs only → AC-8
- [ ] Same run, as APPROVED visit `/dashboard` → still renders; the switch does not gate pages → AC-8
- [ ] Unset the variable, restart → both agent routes work again for APPROVED → AC-8

## Database and row level security

- [ ] Inspect the applied schema: `user_access` exists with `user_id` primary key referencing `auth.users(id) ON DELETE CASCADE`, the `status` check constraint over `pending`/`approved`/`blocked`, and RLS enabled → AC-9
- [ ] Confirm the only policy is `user_access_select` and the only grant to `authenticated` is `SELECT`. No insert, update, or delete policy or grant exists → AC-9
- [ ] As APPROVED, attempt `insforge.database.from("user_access").insert([...])`, an `.update(...)`, and a `.delete()` on their own row → all three denied by the database, not by application code. The delete matters as much as the other two: deleting your own row does not grant access, but it does let a blocked user erase the owner's record of that decision → AC-9
- [ ] As APPROVED, select from `user_access` without a filter → exactly one row comes back, their own → AC-9
- [ ] Grep the codebase for `user_access` → the only runtime read is inside `lib/access.ts`; no route, page, layout, or action queries it directly → AC-11
- [ ] Grep every `app/api/**/route.ts` → each one importing a paid module (anything under `agent/`, the resume extractor, the resume generator) also imports `guardPaidRoute`. `app/api/resume/signed-url/route.ts` imports none of them and correctly does not guard → AC-6

## Docs and types

- [ ] `types/index.ts` exports `UserAccessStatus` and `UserAccessRow`; no `any` was introduced anywhere in the diff → AC-12
- [ ] `context/architecture.md` documents the `user_access` table in its schema section → AC-12
- [ ] `ENABLE_AGENT_RUNS` appears in `.env.example` and in the environment variable table in `context/code-standards.md`, with no `NEXT_PUBLIC_` prefix → AC-12

## Commands

- [ ] `npx tsc --noEmit` → no type errors → all ACs
- [ ] `npm run lint` → no lint errors → all ACs
- [ ] `npm test` → all pass, including `tests/access.test.mjs` covering `agentRunsEnabled` over `undefined`, `""`, `"true"`, `"false"`, `"FALSE"` (only exact lowercase `"false"` disables) and `isUserApproved` over missing row, `pending`, `blocked`, `approved`, and a query error (an error returns `false`, never throws); plus the four extended route tests asserting the denial status codes and that the agent and provider mocks are never invoked → AC-6, AC-7, AC-8, AC-11
- [ ] `npm run build` → production build succeeds and all existing routes are still listed, with `/private-beta` added → all ACs

## Build time additions

Three things the build discovered that the criteria above do not name. Added by `/develop` on 2026-08-01.

- [ ] The privilege layer really is narrow, not just policy free. InsForge grants broad data privileges on public tables by default, so the migration revokes before granting. Confirm with `has_table_privilege('authenticated','user_access', ...)`: `SELECT` true, `INSERT` / `UPDATE` / `DELETE` all false, and every privilege false for `anon`. Without the revoke, row level security alone still denies the write, but the second layer AC-9 asks for would not exist → AC-9
- [ ] The gate splits across two files, not one. `lib/access-rules.ts` holds `agentRunsEnabled` and `isUserApproved` and has no runtime imports, so the test runner can load it; `lib/access.ts` holds `guardPaidRoute` and `requireApprovedPage` and re-exports the other two. The split exists because bare Node cannot resolve `next/server`, which is what made AC-11's "unit testable" impossible as a single file. Confirm every app import still comes from `lib/access`, and that `isUserApproved` is still the only reader of `user_access` → AC-11
- [ ] A fifth paid route cannot ship ungated. `tests/access.test.mjs` walks every `app/api/**/route.ts` and fails if one importing a paid module (anything under `agent/`, the resume extractor, the resume generator) does not import `guardPaidRoute`. Confirm it currently counts exactly 4, and that deleting a guard call makes it fail → AC-6

## Acceptance-criteria coverage

- AC-1 (public pages unaffected) → Public and signed out, steps 1 and 2
- AC-2 (signed out redirected to login) → Public and signed out, step 3
- AC-3 (unapproved redirected to private beta) → Unapproved user, pages, steps 1 to 3
- AC-4 (private beta screen behaviour) → Unapproved user, pages, steps 4 to 6
- AC-5 (approved user unchanged) → Approved user, pages, step 1; Paid routes, step 4
- AC-6 (403 before any external call) → Paid routes, steps 2 and 3
- AC-7 (401 preserved) → Paid routes, step 1
- AC-8 (kill switch scoped to agent routes) → Kill switch, all steps
- AC-9 (RLS select only, no self approval) → Database and row level security, steps 1 to 4
- AC-10 (one guard, URLs unchanged) → Approved user, pages, steps 2 and 3
- AC-11 (pure helper, single read site) → Database and row level security, step 5; Commands, `npm test`
- AC-12 (types and docs) → Docs and types, all steps
- AC-13 (existing flows and commands) → Paid routes, steps 4 and 5; Commands, all steps
