# Memory — Feature 11 (Filter + Sort + Pagination) built, verified, tested, merged

Last updated: 2026-07-30

## What was built

Feature 11, Filter + Sort + Pagination on the Find Jobs page (spec `docs/specs/0007-filter-sort-pagination-find-jobs/`), designed, built, verified, and tested this session. Now merged to `main` via PR #6 ("Adzuna job search"), alongside feature 10's own follow-up commits.

- `lib/match-score.ts`: added shared `MATCH_THRESHOLD = 70` constant.
- `agent/adzuna.ts`: now imports `MATCH_THRESHOLD` instead of its own duplicated `STRONG_MATCH_THRESHOLD = 70`.
- `lib/find-jobs-filters.ts` (new): pure `filterJobs`, `sortJobs`, `paginateJobs` helpers (text + match-tier filter, three sort modes with null-score handling, page slicing).
- `app/find-jobs/page.tsx`: now fetches the caller's `jobs` server side on page load (ordered `found_at` descending) and passes them to `FindJobsPage` as `initialJobs`, so a returning user sees their saved jobs without searching again.
- `components/find-jobs/FindJobsPage.tsx`: filter text, match filter, sort, and page state wired to the previously inert filter box, match dropdown, sort dropdown, and pagination footer. Two new empty states ("no jobs yet" vs "no jobs match your filters"). Page resets to 1 on any filter/sort change; all four reset to defaults on a new search.
- `tsconfig.json`: added `allowImportingTsExtensions` so `lib/find-jobs-filters.ts` can import `./match-score.ts` with an explicit extension — needed because the project's `node --experimental-strip-types` test runner has no path-alias resolution, so a real (non-type-only) cross-file import via the `@/` alias fails at runtime under `node --test` even though it works fine under Next's bundler.
- Tests: `tests/find-jobs-filters.test.mjs` (new, 11 tests — real unit tests importing the helpers). `tests/find-jobs-contract.test.mjs` and `tests/agent-adzuna.test.mjs` updated (the old versions asserted the *pre*-feature-11 placeholder state, e.g. a hardcoded `PAGE_NUMBERS = [1, 2, 3, 8]` and "no `onChange` wired yet" — those assertions were flipped to test the real wiring). `tests/match-score.test.mjs` +1 test for `MATCH_THRESHOLD`'s real value. All contract-test titles for feature 11 tagged with their `AC-N` for traceability. Full suite: 227/227 passing.
- `/check verify`: no browser MCP or OAuth-scriptable session available in this environment. Verified directly: AC-10 (unauthenticated `/find-jobs` → 307 to `/login`) via `curl`; `npm test`, `tsc --noEmit`, `next build` all clean. AC-1 through AC-9 (the actual filter/sort/pagination UI behavior) were confirmed by the engineer driving the real signed-in page themselves and reporting back — recorded as such in `verify.md`, not fabricated.
- `docs/specs/0007-filter-sort-pagination-find-jobs/index.md` status: `Proposed` → `In Progress` → `Accepted`. `context/progress-tracker.md`: feature 11 marked `[x]`, "Next" now points to feature 12.

## Decisions made

- Centralized the match-score threshold (70) into `lib/match-score.ts`'s `MATCH_THRESHOLD`, imported by both `agent/adzuna.ts` and `lib/find-jobs-filters.ts`, per spec 0007's own stated invariant (was previously duplicated).
- Filtering, sorting, and pagination are pure client-side derivations over one full fetch (all of a user's `jobs` rows), no new API route, no server round-trip per interaction. Accepted tradeoff: fetches the whole list even at large row counts; revisit with server-side pagination only if that becomes a real problem (spec 0007's own noted follow-up).
- `allowImportingTsExtensions: true` added to `tsconfig.json` — a small, permanent project convention change (not feature-scoped) enabling real cross-file imports between `lib/*.ts` files that need to run under the raw `node --test` runner, not just under Next's bundler. Worth remembering if this comes up again: the project's test runner has no `@/` alias resolution, so any `lib/` file that needs both (a) a real runtime import of another local module and (b) to be executed directly by `node --test` (not just source-regex-matched) needs this pattern: relative import + explicit `.ts` extension.

## Problems solved

- `node --experimental-strip-types --test` couldn't resolve `@/lib/match-score` (a real, non-type-only import) — TS path aliases aren't resolved by node's raw ESM loader, only by Next's bundler/tsc. Type-only imports (`import type { X } from "@/types"`) are unaffected since `--experimental-strip-types` elides them entirely before resolution ever runs. Fixed by switching the value import to a relative path with an explicit `.ts` extension (`./match-score.ts`) plus the `allowImportingTsExtensions` tsconfig flag (otherwise tsc's `bundler` moduleResolution rejects `.ts`-extension imports with TS5097).
- No browser MCP or OAuth-scriptable session available for `/check verify` (same environment limitation noted in the previous session's memory for feature 10) — handled the same way: curl for unauthenticated/HTTP-level checks, honest `BLOCKED` for anything needing a signed-in browser session, then the engineer manually drove the page and confirmed it worked, recorded in `verify.md` rather than fabricated.

## Current state

- Feature 11 is fully done: Design (spec 0007, `Accepted`), Build, Verify (engineer-confirmed working), and Test (227/227) all complete.
- Merged to `main` via PR #6, which also carried over feature 10's own uncommitted verify/test follow-up work from the prior session. `git status` is clean; `main` is up to date with `origin/main`. No open branch, no pending commits.
- `context/progress-tracker.md`: "Last completed: 11 Filter + Sort + Pagination", "Next: 12 Job Details Page — Full UI".

## Next session starts with

Start feature 12, Job Details Page — Full UI (Phase 4). Per `context/build-plan.md`: job data from DB is already available from Phase 3, so wire real data for job info and match sections immediately; the Company Research section shows an empty state only in this feature (feature 13 builds the research agent). No spec exists yet for feature 12 — start with `/architect` (it's a full new UI page, a decision-owed case per `/develop`'s own gate), on a fresh branch off `main`.

## Open questions

- Carried over from earlier sessions, still not blocking: orphan cleanup for staged-but-never-saved resume uploads; whether to ever complete a real human-driven Google/GitHub login to fully close the feature 02 verification gap; AC-5 (Adzuna failure path) and half of AC-7 (`job_found` PostHog event) from feature 10 remain unexercised by an automated run (noted in that feature's own verify report, not a feature-11 blocker).
