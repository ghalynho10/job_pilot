# 0007. Filter, sort, and pagination on the Find Jobs page

**Date**: 2026-07-30
**Status**: Accepted

## Summary

This decision wires up the filter box, the match dropdown, the sort dropdown, and the pagination footer on the Find Jobs page, all of which were built as inert, non working placeholders in feature 09 (spec 0005). It also fixes a real gap: today the page only ever shows jobs from the search a user just ran in that browser tab, so a returning user sees an empty page until they search again. After this feature, the page loads a user's previously found jobs automatically, and the whole list can be filtered by company or role text, filtered to only strong or only weak matches, sorted, and paged through 20 rows at a time, all computed in the browser over one query, no new backend calls per interaction.

## Context

Feature 10 (spec 0006, Adzuna Job Discovery) made the Find Jobs page real: a search calls Adzuna, scores every result with GPT4o (a large language model), and saves it. Spec 0006 explicitly deferred all filter, sort, and pagination behavior to this feature, and left a specific follow up note asking it to reuse the same `insforge.database.from("jobs")` query path it introduced rather than building a second one. Spec 0005 (feature 09) already fixed the exact semantics this feature must deliver, decided at that time to avoid two features inventing conflicting rules: All Matches / High Match (score 70 or above) / Low Match (below 70) for the match filter, sort by Match Score / Newest / Oldest, and 20 rows per page.

The forces at play: the `jobs` table already exists and already enforces row level security scoped to the signed in user (spec 0001), so no new backend authorization work is needed, only a client side query and some in browser logic. The realistic data volume is small: each search adds at most 10 rows (Adzuna's page size used by feature 10), and there is no rate limiting on how often a user can search (spec 0006, a deliberately accepted gap), so a heavy user's total row count could still grow into the hundreds over many sessions, which is a real but not urgent scale concern.

## Requirements

**User stories**:
- As a job seeker, I want to see the jobs I already found in past sessions when I open the page, so that I don't have to search again just to see my saved list.
- As a job seeker, I want to filter my saved jobs by company or role, and by how well they match me, so that I can focus on the ones worth my time.
- As a job seeker, I want to sort my saved jobs and page through them, so that a long list stays usable.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: On page load, before any search is run this session, the page fetches the signed in user's existing `jobs` rows and shows the results table (filter bar, table, pagination) if any exist, instead of staying hidden until a new search.
- **AC-2**: A user with zero `jobs` rows ever (a genuinely new user) sees a distinct "no jobs yet, run a search" message in the results area on page load, not an empty table and not the filter controls.
- **AC-3**: Typing into the filter box narrows the visible rows to those whose `company` or `title` contains the typed text, case insensitive, as a substring match, updated as the user types.
- **AC-4**: Selecting "High Match" in the match dropdown shows only rows with `match_score` 70 or above; selecting "Low Match" shows only rows with `match_score` below 70 (a null `match_score`, meaning scoring failed for that job, counts as not matching either filter and is hidden by both); "All Matches" shows every row regardless of score.
- **AC-5**: The sort dropdown reorders the currently filtered rows by Match Score (highest first, a null score sorts last), Newest (`found_at` descending, the existing default), or Oldest (`found_at` ascending).
- **AC-6**: The table shows at most 20 rows at a time; the pagination footer's Previous/Next and page number buttons move between pages of the current filtered and sorted list, the active page is visually marked, Previous is disabled on page 1 and Next is disabled on the last page, and the "Showing X to Y of Z results" text reflects the real filtered count, not the total unfiltered count.
- **AC-7**: Changing the filter text, the match dropdown, or the sort dropdown resets the current page back to 1.
- **AC-8**: If the filter and match dropdown combination matches zero rows, the results area shows a distinct "no jobs match your filters" message instead of an empty table, without touching the underlying job list.
- **AC-9**: Submitting a new search (the existing Find Jobs button) resets the filter text, match dropdown, sort dropdown, and page number back to their defaults (All Matches, sorted by Match Score, page 1) for the newly loaded set of jobs.
- **AC-10**: An unauthenticated visit to `/find-jobs` is still redirected by the existing `proxy.ts` gate before any of this feature's code runs (no change from spec 0005, restated here since this feature adds a new fetch on page load).

## Options considered

See [rationale.md](rationale.md).

## Decision

**Chosen option**: Client side filter, sort, and pagination over one full fetch, with the fetch also running on page load

The page (and its client component) fetch the user's full `jobs` list once, either on page mount or right after a new search, and every filter, sort, and page change is a pure, synchronous operation over that already loaded array in React state. No new API route, no query parameters added per interaction, no URL state.

The default sort is **Match Score** (highest first), matching the design's existing default selection in spec 0005, both on initial page load and after resetting following a new search (AC-9).

## Feature design

**Data model sketch**:

No new tables, columns, or migrations. This feature only reads the existing `jobs` table (spec 0001, extended by spec 0006), which already carries every field needed: `company`, `title`, `match_score`, `found_at`, plus the fields the table already renders (`salary`, `source`, `id`).

**State transitions**: Not applicable, no persisted entity or backend state machine. The only "state" is client side UI state (filter text, match filter, sort, page number), reset to defaults on page load and on every new search (AC-9).

**API surface**:

No new route. This feature reuses the existing InsForge database client query already used by feature 10's post search refetch:

| Call | Where | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `insforge.database.from("jobs").select("*").order("found_at", { ascending: false })` | Runs on page mount (new), and after a successful search (existing, from feature 10) | none (row level security scopes to the caller) | the caller's full job list | session cookie, InsForge row level security | a `PostgrestError` on the returned `error` field; the page shows a load error message, not a crash |

**Key invariants**:
- The match score threshold that separates High Match from Low Match is `70`, the same value `agent/adzuna.ts` already uses internally as `STRONG_MATCH_THRESHOLD`. This feature centralizes that threshold into a shared constant (`MATCH_THRESHOLD` in `lib/match-score.ts`, alongside the existing `getMatchScoreTier` helper) that both `agent/adzuna.ts` and the new filter logic import, rather than each defining its own `70`. This also fulfils this project's own stated invariant that the match threshold is defined once.
- Filtering, sorting, and pagination never mutate or re-fetch the underlying `jobs` array; they are derived (computed) values over it, recomputed on every relevant state change.
- A page change, filter change, or sort change never issues a network request; only a page load or a new search does.
- Pagination math always uses the length of the filtered array, never the unfiltered total, so "Showing X to Y of Z" and the page count are always consistent with what is currently visible.

**Security model**: Unchanged from spec 0006. Row level security on `jobs` already scopes every `select` to `user_id = auth.uid()`; this feature issues no new writes and no new route, so no new security surface is introduced. `/find-jobs` stays behind the existing `proxy.ts` authenticated route gate (AC-10).

**Configuration required**: None. No new environment variables, secrets, or dependencies.

**Critical test scenarios**:
- Happy path: a returning user with several past jobs opens `/find-jobs`, sees them immediately without searching, filters by company text, switches to High Match, sorts by Oldest, and pages to page 2, each step producing the correct visible rows, verifies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-6**.
- Failure case: a filter and match combination matches nothing, the distinct "no matches" message shows and the underlying job list is untouched (clearing the filter immediately restores the full list), verifies **AC-8**.
- Edge case: a brand new user with zero jobs ever sees the "no jobs yet" message, not an empty table, verifies **AC-2**.
- Edge case: changing the sort while on page 3 of a filtered view returns to page 1, verifies **AC-7**.
- Edge case: running a new search while a filter, non default sort, and page 2 are active resets all four to their defaults for the new results, verifies **AC-9**.
- Auth/permission: an unauthenticated request to `/find-jobs` is redirected before any of this feature's fetch or rendering code runs, verifies **AC-10**.

## Build plan

This project defaults to end to end slices for production work (no build approach recorded in `AGENTS.md` or a scope header; the same default spec 0006 used). Feature 10 already delivered the backend and the single query path; this feature is entirely client side logic layered onto an existing, already working page, so there is no natural "backend then UI" split the way spec 0006 had. The plan instead sequences from the data layer outward: first the shared threshold constant and the pure derivation logic (filter, sort, paginate), each independently testable with no UI, then the page level fetch on mount, then wiring that logic into the existing markup, so every piece is verifiable in isolation before the last task makes it visible on screen.

1. [x] Move the match threshold into a shared `MATCH_THRESHOLD` constant in `lib/match-score.ts` and update `agent/adzuna.ts`'s `STRONG_MATCH_THRESHOLD` usage to import it instead of redefining `70`, satisfies the shared invariant above (supports **AC-4**)
2. [x] Add pure derivation helpers (e.g. `lib/find-jobs-filters.ts`): a function that filters a `JobRow[]` by text and match tier, a function that sorts a `JobRow[]` by the three sort modes (null scores last), and a function that pages a `JobRow[]` given a page number and page size, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**
3. [x] `app/find-jobs/page.tsx`: fetch the caller's `jobs` rows server side (same pattern already used there for the `profiles` row), ordered newest first, and pass them to `FindJobsPage` as an initial prop, satisfies **AC-1**, **AC-2**
4. [x] `components/find-jobs/FindJobsPage.tsx`: add filter text, match filter, sort, and page state; wire the existing filter input, "All Matches" dropdown, and "Match Score" dropdown to that state (adding the two missing dropdown options each); compute the visible rows through the new helpers; wire the existing pagination footer's Previous/Next/page number buttons and the "Showing X to Y of Z" text to the real paged, filtered result; reset page to 1 on any filter/sort change (**AC-7**) and reset all four on a new successful search (**AC-9**); render the new empty states for "no jobs yet" (**AC-2**) and "no jobs match your filters" (**AC-8**)
5. [x] Tests: unit tests for the three pure helpers (text match case insensitivity, the 70 point boundary, null score handling in both the match filter and the score sort, page slicing at boundaries), and contract tests for `FindJobsPage` covering the reset behaviors (AC-7, AC-9), the two distinct empty states (AC-2, AC-8), and the initial server fetched prop rendering (AC-1), covering **AC-1** through **AC-9**

## Consequences

**Positive**:
- The page finally shows a returning user's own saved jobs without forcing a redundant search, closing a real, user visible gap.
- Filter, sort, and page changes are instant, no loading state, no extra network round trips, since everything after the one fetch is pure client side computation.
- The match threshold stops being duplicated; a future change to what counts as a strong match only touches one constant.

**Negative / tradeoffs**:
- The whole job list is fetched at once regardless of how many rows exist. For a heavy user who has searched many times with no rate limit (spec 0006's own accepted gap), this means downloading and holding hundreds of rows in memory to show 20 at a time. Accepted as fine at this project's realistic scale; revisit with server side pagination if row counts genuinely grow large.
- Filter, sort, and page state resets on every new search (AC-9) and is not preserved across a page refresh (local component state, not URL state), so a user who refreshes mid browse loses their filter and returns to page 1. Accepted: this is a private, single user list with no stated need for a shareable or refresh surviving view.

**Neutral**:
- Introduces `lib/find-jobs-filters.ts` as a new pattern: small, pure, framework free helper functions colocated with the existing `lib/match-score.ts`, consistent with this project's existing `lib/` conventions.
- `app/find-jobs/page.tsx` gains a second server side data fetch (jobs, alongside the existing profile fetch), the same established pattern, not a new one.

## Follow-up

- [ ] If the total `jobs` row count for a single user ever becomes large enough that fetching the full list on every page load feels slow, revisit with server side filtering, sorting, and pagination (the alternative considered and set aside in this decision, see rationale.md).
- [ ] Consider rate limiting job searches (already flagged as a follow up in spec 0006); it directly bears on how large a single user's `jobs` table can grow, which is the main risk this feature accepts.

## Rationale

Full reasoning, the options considered, and the sourcing behind this decision are in [rationale.md](rationale.md).
