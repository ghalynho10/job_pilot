# 0005. Find Jobs page UI

**Date**: 2026-07-30
**Status**: Accepted

## Summary

This spec covers building the full Find Jobs page as its own screen, matching the provided design exactly, using static mock data. It gives the user the search form, a green success banner, and a jobs table with a color coded match score, salary, source badge, and date found, all rendered exactly as shown in `context/designs/find-jobs.png`. None of the controls (search, filter, sort, pagination) are wired to real behavior yet; that real interactivity, against real database rows, is a separate, later feature (11) per `context/build-plan.md`. This feature is purely the visual and structural build, so it can be reviewed and demoed on its own before any backend work begins.

## Context

> ⚠️ Premise note: `context/build-plan.md` already splits this work into three features: 09 (this one, UI on mock data, no logic), 10 (the real Adzuna search that populates the `jobs` table), and 11 (wiring filter, sort, and pagination to that real data, with its own specific semantics: All Matches / High Match `>= 70` / Low Match `< 70`, sort by Match Score / Newest / Oldest, 20 rows per page). An earlier draft of this spec built the filter/sort/pagination controls as fully interactive against a client side mock array, which would have duplicated feature 11's work with different, invented semantics (90/80 score bands, 6 rows per page). This spec follows the project's own plan: feature 09 stays UI only, with feature 11 owning all real interactivity.

`context/build-plan.md` scopes feature 09 as: "Build the complete Find Jobs page UI with mock data. No logic yet." The design (`context/designs/find-jobs.png`) shows the search controls card, a success banner, a filter bar, a 6 row jobs table with a color coded match score, and a pagination footer. Building this screen correctly, matching the design pixel for pixel, is real work worth its own review pass, independent of the Adzuna integration (feature 10) and the real filter/sort/pagination logic (feature 11) that come after it.

## Requirements

**User stories**:
- As a job seeker, I want to see a search form for job title and location so that I can see what the eventual real search will look like.
- As a job seeker, I want to see a representative table of job matches, with a clearly color coded match score, so that I can evaluate the page's design before real search results exist.

**Acceptance criteria**:
- **AC-1**: The page renders the search controls card (JOB TITLE input, LOCATION input, Find Jobs button) exactly matching `context/designs/find-jobs.png`, before the Find Jobs button is clicked.
- **AC-2**: The JOB TITLE and LOCATION inputs are real, typeable text inputs with no validation or submission wiring; typing into them changes only their own value, nothing else on the page.
- **AC-3**: Clicking "Find Jobs" reveals the results area: the green success banner ("Found 8 jobs and saved 4 strong matches.") and the jobs table, both hidden before the first click. No network call happens; this is a static reveal.
- **AC-4**: The jobs table renders columns COMPANY, ROLE, MATCH SCORE, SALARY EST., SOURCE, DATE FOUND for exactly the 6 mock rows shown in the design (Vercel, Stripe, Linear, Notion, OpenAI, Figma), from a typed `lib/mock-jobs.ts` dataset shaped to mirror the real `jobs` table (spec 0001) so feature 10/11 can later swap in real data with no shape change.
- **AC-5**: The match score renders as a colored horizontal bar plus a percentage: green at 94%, 96%, and 91%; blue at 88% and 85%; orange at 72%, matching the design exactly.
- **AC-6**: The SOURCE column renders a "Search" or "URL" badge, sourced from each mock row's `source` field (`'search' | 'url'`), matching the real `jobs.source` check constraint's two values.
- **AC-7**: The filter text input, "All Matches" dropdown, and "Match Score" sort dropdown render exactly as shown in the design (correct placeholder text, correct default selected option) but have no filter, sort, or search behavior wired; they are visually complete, functionally inert placeholders for feature 11.
- **AC-8**: The pagination footer renders the static text "Showing 1 to 6 of 24 results" and the page controls (Previous, 1, 2, 3, …, 8, Next, with 1 shown active) exactly as in the design; none of the controls change what's on screen when clicked.
- **AC-9**: Every interactive element added by this feature (Find Jobs button, both text inputs, both dropdowns, filter input, pagination buttons) carries this project's standard `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` treatment (per `ui-registry.md`'s existing project wide rule), and the two dropdowns are native `<select>` elements, not custom listboxes, so they are keyboard operable and screen reader accessible without extra work.
- **AC-10**: The `/find-jobs` route is protected by the existing `proxy.ts` auth gate; an unauthenticated visitor is redirected the same way as `/dashboard` and `/profile`.
- **AC-11**: The table is wrapped in a horizontally scrolling container below the desktop breakpoint so no column is clipped or wrapped awkwardly on narrow viewports.

## Options considered

See `rationale.md`.

## Decision

**Chosen option**: Option 1: Fully static UI, no interactivity, using a schema shaped mock dataset

Build `/find-jobs` as a page matching the design exactly, revealed by the Find Jobs button click, with static mock data and inert filter/sort/pagination controls. All real interactivity (filter, sort, pagination, search) is left to feature 11, against real data.

## Rationale

See `rationale.md`.

## Feature design

**Data model sketch**:

No database migration in this feature. The `jobs` table already exists (spec 0001, `migrations/20260718170543_create-core-tables.sql`) and is the real data source for features 10 and 11. This feature defines a client side `MockJob` type in `lib/mock-jobs.ts`, shaped to mirror the `jobs` columns this page (and the upcoming job details page, feature 12) will need, populated with exactly the 6 rows shown in the design:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | mirrors `jobs.id` (uuid) |
| `company` | `string` | mirrors `jobs.company` |
| `title` | `string` | mirrors `jobs.title`, rendered as ROLE |
| `matchScore` | `number` | mirrors `jobs.match_score`, 0 to 100 |
| `salary` | `string` | mirrors `jobs.salary`, pre-formatted range e.g. "$160k - $200k" |
| `source` | `'search' \| 'url'` | mirrors `jobs.source`'s check constraint exactly |
| `foundAtLabel` | `string` | a pre-formatted static label ("2 hours ago", "Yesterday", "2 days ago"), not computed from a real date, since this page never recomputes it |
| `location` | `string` | mirrors `jobs.location`; not rendered by this page but included so feature 12 (Job Details) can reuse the same mock shape later |
| `externalApplyUrl` | `string` | mirrors `jobs.external_apply_url`; same reuse reasoning as `location` |

**State transitions**: Not applicable, no persisted entity or backend state in this feature.

**API surface**: None. This feature calls no route handler; all data is local to the client component.

**Key invariants**:
- Match score color: green at 90% and above, blue from 80 to 89%, orange below 80%. This is purely a display rule for this feature's fixed 6 rows (94, 88, 96, 72, 91, 85); it is descriptive, not a generalized threshold function feature 11 needs to reuse (feature 11 defines its own High/Low Match semantics at a 70% cutoff, a different concern).
- Every control in this feature (inputs, dropdowns, pagination buttons) is a real, focusable, semantically correct element even though it has no behavior; "static" means no event handler changes page state, not that the element is decorative or inaccessible.

**Security model**: `/find-jobs` requires an authenticated session, enforced by the existing `proxy.ts` middleware pattern already used for `/dashboard` and `/profile`. No per row ownership check applies since all data is a shared static mock, not fetched per user.

**Configuration required**: None. No new environment variables, secrets, or third party credentials.

**Critical test scenarios**:
- Happy path: click Find Jobs, banner and all 6 mock rows appear with the correct score colors and SOURCE badges, verifies **AC-3**, **AC-4**, **AC-5**, **AC-6**
- Failure case: typing into the filter input or job title/location inputs, or clicking a pagination button, changes nothing else on the page (confirms no accidental partial wiring), verifies **AC-2**, **AC-7**, **AC-8**
- Auth/permission: an unauthenticated request to `/find-jobs` is redirected by `proxy.ts` before the page renders, verifies **AC-10**

## Build plan

1. [x] Add `lib/mock-jobs.ts`: the `MockJob` type and the 6 row mock dataset matching the design exactly, satisfies **AC-4**, **AC-6**
2. [x] Build the search controls card (JOB TITLE input, LOCATION input, Find Jobs button) as a client component, wired only to a local `hasSearched` boolean that gates the results area, satisfies **AC-1**, **AC-2**, **AC-3**
3. [x] Build the success banner (static string, shown once `hasSearched`), satisfies **AC-3**
4. [x] Build the filter bar (text input, native `<select>` All Matches dropdown, native `<select>` Match Score dropdown) with correct default values and no wired behavior, satisfies **AC-7**, **AC-9**
5. [x] Build the jobs table: COMPANY, ROLE, MATCH SCORE (color per the display rule), SALARY EST., SOURCE badge, DATE FOUND, wrapped in an `overflow-x-auto` container, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-11**
6. [x] Build the static pagination footer (results text, Previous/page numbers/Next, page 1 marked active), satisfies **AC-8**
7. [x] Add `focus-visible` styling to every new interactive element and confirm keyboard tab order end to end, satisfies **AC-9**
8. [x] Confirm `/find-jobs` is covered by the existing `proxy.ts` protected route matcher (add it if not already covered), satisfies **AC-10**
9. [x] Add tests covering the reveal on click, correct score colors/badges for all 6 rows, and that filter/dropdown/pagination interactions have no side effects, covering **AC-1** through **AC-9**

All 9 build tasks are done; typecheck, lint, unit tests (17 new, 169 total passing), and a production build are all clean. A manual browser pass (via a temporary, reverted preview route, since `/find-jobs` itself is auth gated) confirmed the rendered page visually matches `context/designs/find-jobs.png`, including the search card, the success banner, all 6 match score colors, source badges, and pagination, before and after clicking Find Jobs (code in `lib/mock-jobs.ts`, `app/find-jobs/page.tsx`, `components/find-jobs/FindJobsPage.tsx`). `/check verify` should still confirm AC-10 (the auth redirect) against a real session, since the manual pass above deliberately bypassed it to see the design.

## Consequences

**Positive**:
- The whole page can be demoed and reviewed against the design before any Adzuna or database work begins.
- No throwaway logic: because this feature builds no filter/sort/pagination behavior, feature 11 starts clean instead of reworking or discarding client side logic built here against the wrong semantics.
- The mock data shape mirrors the real `jobs` table (including fields this page doesn't render, like `location` and `externalApplyUrl`), so features 10 to 12 can reuse the same shape.
- No new dependencies; stays consistent with this project's existing custom built, no component library UI approach.

**Negative / tradeoffs**:
- The page is not meaningfully interactive when demoed; filter typing, dropdown changes, and pagination clicks visibly do nothing, which can read as unfinished to anyone not aware feature 11 is next.
- Only 6 mock rows exist (matching the design exactly), so this feature alone can't preview how the table looks with more realistic variety in score, source, or date; that's deferred to feature 11's real data.

**Neutral**:
- Introduces `lib/mock-jobs.ts` as a new pattern: a schema shaped, hand authored mock dataset file, colocated with other `lib/` helpers, that features 10 through 12 are all expected to eventually replace or extend.

## Follow-up

- [ ] Feature 11 (Filter + Sort + Pagination) wires this page's filter input, All Matches dropdown, Match Score dropdown, and pagination controls to real `jobs` table data, with its own semantics (All Matches / High Match `>= 70` / Low Match `< 70`, sort by Match Score / Newest / Oldest, 20 rows per page); it does not reuse any logic from this feature, only the static markup this feature builds.
- [ ] Feature 10 (Adzuna Job Discovery) and feature 12 (Job Details Page) are the features expected to actually consume the `location` and `externalApplyUrl` fields added to `MockJob` here for shape consistency; this feature itself does not render them.
