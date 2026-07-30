# Verify: 11 Filter + Sort + Pagination · spec 0007 · updated 2026-07-30

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

_Confirmed working by the engineer's own manual pass in a signed-in browser session on 2026-07-30 (this environment has no browser automation or OAuth credentials, so `/check verify` itself could not drive these steps; see the note at the bottom)._

- [x] As a returning user with existing `jobs` rows, open `/find-jobs` → the filter bar, table, and pagination footer show immediately, no search needed → AC-1
- [x] As a brand new user with zero `jobs` rows ever, open `/find-jobs` → see "No jobs yet. Run a search above to find your first matches." in the results area, not an empty table and not the filter controls → AC-2
- [x] Type a company name into the filter box → rows narrow to matches (case insensitive substring) on company or title, updated as you type → AC-3
- [x] Select "High Match" → only rows with match_score >= 70 show; select "Low Match" → only rows with match_score < 70 show; a job with a null score is hidden by both; "All Matches" shows everything → AC-4
- [x] Sort by Match Score → highest first, nulls last; Newest → found_at descending; Oldest → found_at ascending → AC-5
- [x] With more than 20 filtered rows, the table shows at most 20 at a time; Previous/Next and page number buttons move pages; the active page is marked; Previous disabled on page 1, Next disabled on the last page; "Showing X to Y of Z" matches the filtered count → AC-6
- [x] While on page 2+, change the filter text, match dropdown, or sort dropdown → page resets to 1 → AC-7
- [x] Enter a filter/match combination that matches nothing → "No jobs match your filters." shows instead of an empty table; clearing the filter restores the full list → AC-8
- [x] With a filter, non default sort, and page 2 active, run a new search (Find Jobs button) → filter text, match dropdown, sort dropdown, and page all reset to defaults (All Matches, Match Score, page 1) for the new results → AC-9
- [x] Visit `/find-jobs` while signed out → redirected by `proxy.ts` before any page code runs → AC-10 (also confirmed by `/check verify` itself: `curl -D - http://localhost:3000/find-jobs` → `307` to `/login`)

## Commands

- [x] `npm test` → all tests pass (223/223), including `tests/find-jobs-filters.test.mjs` and the updated `tests/find-jobs-contract.test.mjs` → AC-1 through AC-9
- [x] `npx tsc --noEmit` → no type errors → supports all ACs
- [x] `npx next build` → build succeeds, `/find-jobs` route generated → supports all ACs

## Acceptance-criteria coverage

- AC-1 … covered by the initial server fetched `jobs` prop and its render step
- AC-2 … covered by the "no jobs yet" empty state (jobs.length === 0 && status === "idle")
- AC-3 … covered by `filterJobs` text matching, wired to the filter input
- AC-4 … covered by `filterJobs` match tier logic using the shared `MATCH_THRESHOLD`
- AC-5 … covered by `sortJobs`, wired to the sort dropdown
- AC-6 … covered by `paginateJobs` and the pagination footer's real page state
- AC-7 … covered by the three `handle*Change` functions each calling `setPage(1)`
- AC-8 … covered by the "no jobs match your filters" empty state (visibleJobs.length === 0)
- AC-9 … covered by the reset calls at the top of `handleSubmit`
- AC-10 … unchanged, already covered by `proxy.ts` and spec 0005
