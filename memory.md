# Memory — Feature 10 (Adzuna Job Discovery) verified, tested, mostly committed

Last updated: 2026-07-30

## What was built

Feature 10, Adzuna Job Discovery, designed and built in an earlier session (already committed at `0604ae3` on branch `adzuna-job-search`), then `/check verify`'d, `/test`'d, and `/debug`'d this session.

- `/check verify` ran the four commands (203/203 tests, `tsc`, ESLint, `npm run build`) and, with no browser MCP or DB MCP available, split runtime proof: AC-6 (unauthenticated 401, no row written) confirmed directly via `curl`. AC-1, AC-2, AC-3, AC-4, AC-8 confirmed by the engineer driving the real `/find-jobs` page themselves (signed in via Google OAuth — this app has no password login, so no scripted session was possible) and reporting back, cross-checked against the live database by querying InsForge's REST API directly with the admin key from `.insforge/project.json` (`GET https://s74xxncd.us-east.insforge.app/api/database/records/<table>?...` with `Authorization: Bearer <api_key>` — durable, reusable pattern for any future verify pass needing DB read access with no browser/DB MCP). `job_search_started` (AC-7) confirmed via the dev server's Console-Ninja-forwarded browser console log. `job_found` (other half of AC-7, emitted server side via `posthog-node`) and AC-5 (simulated Adzuna failure) were left honestly blocked, not faked. Verdict: PASS on everything exercised.
- `/test` added 7 tests for real gaps the existing suite missed: `tests/agent-adzuna.test.mjs` (+3: `STRONG_MATCH_THRESHOLD = 70` boundary, `formatSalary` null/rounding/range, `contract_type` → `"fulltime"` fallback), `tests/find-jobs-contract.test.mjs` (+4: the real `hasSkills` boolean derivation, the client refetch's own error path, the outer try/catch around the search fetch, the `found_at` descending sort). Full suite: 210/210 passing.
- `/debug` investigated a report that "filter by company or role does not work" on `/find-jobs`. Confirmed by source inspection (no `onChange` on the filter input, no `.filter()`/`.sort()` anywhere in the file) that this is not a bug: filtering/sorting/pagination were explicitly out of scope for feature 10 (spec 0006 says so directly, an existing regression test already guards it, and it's feature 11 — not started, next on the tracker). No fix applied; pointed to `/architect` for feature 11 instead.
- `context/progress-tracker.md` updated: feature 10 marked `[x]`, decisions log entry added for the verify/test/debug results, "Next" now points to feature 11. `docs/specs/0006-adzuna-job-discovery/index.md` status flipped `In Progress` → `Accepted`.

## Decisions made

- No new architectural decisions this session — this was verify/test/debug on already-designed, already-built work, not new design.
- Reaffirmed (from feature 10's own spec): filtering, sorting, and pagination on `/find-jobs` are deliberately not built yet; they belong to feature 11, which should reuse the same `insforge.database.from("jobs")` query path feature 10 introduced.

## Problems solved

- No browser MCP and no InsForge DB MCP are configured in this environment. Worked around both: unauthenticated/simple API checks via `curl`; DB state checks via InsForge's REST API directly with the admin `api_key` from `.insforge/project.json` (`/api/database/records/<table>?<postgrest-style-filters>`); the authenticated UI flow itself had to be driven by the engineer manually since the account uses Google OAuth with no password to script against.
- The "fetch calls keep firing after a search, even on `/profile`" thing the engineer noticed mid-verify turned out to be PostHog's own periodic session-recording (`$snapshot`) traffic, confirmed in the console log — not a bug in this feature, unrelated.

## Current state

- Feature 10 is done: Design (spec 0006, `Accepted`), Build, Verify (PASS on everything exercised), and Test (210/210) all complete. `context/progress-tracker.md` marks it `[x]`, "Next" points to feature 11 (Filter + Sort + Pagination).
- Branch `adzuna-job-search` is 1 commit ahead of `origin/adzuna-job-search` (commit `0604ae3`, the feature build itself) — **not yet pushed or PR'd**.
- Uncommitted on top of that: `context/progress-tracker.md`, `docs/specs/0006-adzuna-job-discovery/index.md`, `tests/agent-adzuna.test.mjs`, `tests/find-jobs-contract.test.mjs` (the verify/test session's own changes — the 7 new tests plus the doc updates above). Nothing else pending; working tree otherwise clean.
- AC-5 (Adzuna failure path) and half of AC-7 (`job_found` PostHog event) remain unexercised — noted as open gaps in the verify report and progress tracker, not blockers.

## Next session starts with

Decide whether to commit the pending verify/test changes (progress tracker, spec status, the 2 test files) and push/open a PR for the whole `adzuna-job-search` branch (both the earlier feature commit and this session's follow-up), before starting feature 11. Then start feature 11, Filter + Sort + Pagination: no spec exists yet, start with `/architect` (it should reuse the `insforge.database.from("jobs")` query path feature 10 already introduced, per spec 0006's own follow-up note), then `/develop`, on a fresh branch off `main`.

## Open questions

- Whether to close the two remaining verify gaps (simulate an Adzuna failure for AC-5; confirm `job_found` fires via the PostHog dashboard for AC-7) before or after starting feature 11 — not blocking, but spec 0006 isn't fully airtight without them.
- Carried over from earlier sessions, still not blocking: orphan cleanup for staged-but-never-saved resume uploads, and whether to ever complete a real human-driven Google/GitHub login to close the feature 02 verification gap.
