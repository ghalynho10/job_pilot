# Review, dashboard-page, 2026-07-31

**Reviewed by**: claude-opus-5 (author on a different model)
**Scope**: 16 files, branch vs `main` (merge base `f9188fd`)
**Verdict**: Changes requested

## Summary

This branch finishes wiring `/dashboard` to real per-user data across three feature slices: stat cards (15), recent activity (16), and the three analytics charts (17). The design is clean and consistent — pure, `now`-parameterized compute functions in `lib/dashboard-*.ts`, one user-scoped query, mocks deleted as they're superseded — and the UTC date math in the new `lib/dashboard-charts.ts` is genuinely correct (UTC-only arithmetic sidesteps DST, windows are always exactly N entries, buckets outside the window are correctly ignored rather than folded into an edge bucket). Two things should be fixed before merge: `lib/dashboard-charts.ts` has **no unit test at all** despite being the riskiest new logic in the diff and despite the project having a configured runner, and every database read on this page discards its `error`, so a failed query renders as "you have no data" rather than as a failure. The rest are minors: an axis that never labels today, a shared types module still named `mock-dashboard`, and a couple of semantic inconsistencies between the stat cards and the charts.

## Major

### 🟠 `lib/dashboard-charts.ts` has zero unit tests, `tests/` (no `dashboard-charts.test.mjs`)

**Problem**: `tests/dashboard-stats.test.mjs` (feature 15) and `tests/dashboard-activity.test.mjs` (feature 16) both test their compute module directly against the real import, with boundary cases. Feature 17's `lib/dashboard-charts.ts` — the most branch-heavy and highest-risk module of the three — has no equivalent. The only feature 17 test added (`tests/dashboard-page.test.mjs:78`) is a source-regex check that the page *imports and calls* the three functions; it asserts nothing about what they return. `tests/mock-dashboard.test.mjs` was deleted (correctly, its subjects are gone) with nothing replacing its value coverage.

**Why it matters**: Every behavior the spec calls a key invariant is currently unverified by any automated check: the 30/7 entry window widths, zero filling, the `[today-(N-1), today]` inclusive boundary in UTC, band edges (lower inclusive / upper exclusive, 100 inclusive on the top band), null `match_score` exclusion, and sub-50 exclusion. A future refactor of `computeZeroFilledWindow` — for example switching the day loop to local time, or an off-by-one on `offset` — passes typecheck, passes lint, passes the whole suite, and silently shifts every user's chart by a day. The `/check verify` browser pass proved these once against one seeded account at one instant; it is not a regression net.

**Suggested fix**: Add `tests/dashboard-charts.test.mjs` in the same style as `dashboard-activity.test.mjs` (real import, fixed `now`): assert exact lengths (30 and 7), the first and last labels for a known `now`, a timestamp exactly at the window's first UTC midnight (included) and one millisecond before it (excluded), a timestamp later today (bucketed into the last entry), each band boundary value (50, 59, 60, 89, 90, 100), a null `match_score`, and a sub-50 score. Route this through `/test`.

### 🟠 Every dashboard query swallows its `error`, so a backend failure is indistinguishable from an empty account, `app/dashboard/page.tsx:56,67,75`

**Problem**: All three data reads destructure only `data` and drop `error`, then fall back with `?? []`. If InsForge returns an error (RLS change, network blip, schema drift, a bad column name after a migration), `statsJobs` is `null`, `rows` becomes `[]`, and the page renders four zeroed stat cards plus all three charts in their brand-new empty states: "No jobs found in the last 30 days.", "No jobs scored 50% or higher yet.", "No companies researched in the last 7 days." Nothing is logged anywhere.

**Why it matters**: Feature 17's empty states make this materially worse than it was in feature 15. Previously a failure showed obviously wrong zeros; now it shows a confident, well-designed "you have no activity yet" message to a user who has hundreds of jobs. There is no server log, no error boundary, and no signal to anyone that the backend failed — this is the kind of thing that stays broken for weeks because it looks intentional. The `.select("... company_research_completed_at")` change in this very diff is exactly the class of edit that can start erroring against an environment where that migration hasn't been applied.

**Suggested fix**: Destructure `error` on each of the three reads and at minimum `console.error` with a route prefix (the project already does this — see the resume signed-url route's `try/catch` + prefixed logging convention). Better: distinguish a failed read from an empty read so the charts can show a "couldn't load" treatment instead of the empty state. Apply consistently to all three reads, not just the new one.

## Minor

### 🟡 `interval={4}` never labels today on the 30 day axis, `components/dashboard/JobsFoundOverTimeChart.tsx:47`

**Problem**: With 30 data points and a numeric `interval={4}`, Recharts renders ticks at indices 0, 5, 10, 15, 20, 25 — index 29 (today, the rightmost and most interesting point) gets no label, and neither do the four days before it. Supplying a numeric `interval` also forfeits Recharts' default `"preserveEnd"` behavior.

**Why it matters**: The axis visually appears to end roughly five days before it actually does; a user reading "Jul 6" as the last label misreads today's spike as belonging to a date almost a week old. The spec's AC-5 asked for tick reduction, not for dropping the endpoint.

**Suggested fix**: Use `interval="preserveStartEnd"` together with the thinning, or pass an explicit `ticks` array that includes index 29, so both the window start and today are always labeled.

### 🟡 An unparseable timestamp crashes the whole dashboard render, `lib/dashboard-charts.ts:11-14`

**Problem**: `utcDateKey` calls `.toISOString()` on `new Date(timestamp)`. For an invalid date this throws `RangeError: Invalid time value` rather than producing a sentinel. Since this runs inside an async server component with no `try/catch` and no error boundary in the diff, one malformed `found_at` or `company_research_completed_at` value 500s the entire `/dashboard` page — stat cards, activity, and all three charts.

**Why it matters**: `lib/dashboard-stats.ts:23` and `lib/dashboard-activity.ts:31` both use `getTime()`, which degrades to `NaN` and quietly drops the row instead of throwing. Feature 17 introduces the only date path on this page that can hard-fail, and it fails loudly and totally. Low likelihood with well-formed `timestamptz` values, but the blast radius is the whole page.

**Suggested fix**: Guard in `utcDateKey` (or in `computeZeroFilledWindow`'s loop): check `Number.isNaN(date.getTime())` and skip the row, matching how the sibling modules already handle unusable timestamps.

### 🟡 UTC day bucketing disagrees with the stat cards' rolling week and with the user's own clock, `lib/dashboard-charts.ts:16-18` vs `lib/dashboard-stats.ts:22-23`

**Problem**: The charts bucket by UTC calendar day and window on `[today-(N-1), today]` UTC. "Jobs This Week" windows on a rolling `now - 168h`. Both are on the same page, both describe "recent jobs", and they will routinely disagree.

**Why it matters**: A user in UTC-7 at 5pm local sees a chart whose last labeled/plotted day is tomorrow's date in their timezone, and a job they found at 6pm local yesterday lands in today's bucket. Summing the chart's last 7 points will not equal the "Jobs This Week" stat card sitting directly above it. Spec 0011 does explicitly choose UTC, so this is not a spec violation — but the spec never reconciled it against feature 15's rolling window, and the two sitting side by side on one screen is what makes it visible.

**Suggested fix**: Either accept and document it (a caption like "Last 30 days (UTC)"), or align the two windows. At minimum, note the divergence in `context/ui-registry.md` so the next person doesn't treat it as a bug.

### 🟡 "Companies Researched" and the research chart count different columns, `lib/dashboard-stats.ts:20` vs `lib/dashboard-charts.ts:74`

**Problem**: The stat card counts rows with a non-null `company_research` (the dossier JSON); the chart and the activity list count rows with a non-null `company_research_completed_at` (the timestamp added by the feature 13 migration). These are two representations of the same event.

**Why it matters**: Any row written before that migration, or by any future path that writes the dossier without the timestamp, is counted by the stat card and invisible to the chart — "Companies Researched: 12" above a chart reporting zero research activity. The feature 13 route currently writes both together, so this is latent rather than live, but it is an unenforced coupling.

**Suggested fix**: Pick one column as the canonical "was researched" signal (the timestamp is the better choice) and use it in both places, or add a comment at both sites recording that they must stay in lockstep.

### 🟡 `lib/mock-dashboard.ts` no longer contains any mocks but is still the source of every dashboard type, `lib/mock-dashboard.ts:1`

**Problem**: After AC-8, the file holds only `DashboardStat`, `DashboardActivityEntry`, `DashboardDayCount`, and `DashboardScoreBand`. Eight modules — including three real-data compute modules and all five dashboard components — now import their production types from a file named `mock-dashboard`.

**Why it matters**: The name actively misleads. A reader grepping for remaining mock data finds eight live imports and has to open the file to learn they're fine; someone cleaning up mocks could reasonably delete it. The project also already has `types/index.ts`, which this same diff extends with `AgentRunRow` — so there are now two conventions for where shared types live.

**Suggested fix**: Rename to `lib/dashboard-types.ts` (or fold into `types/index.ts`) and update the eight importers. Mechanical, and the point at which the last mock left the file is the natural moment to do it.

### 🟡 Three sequential round trips, one of them now redundant, `app/dashboard/page.tsx:56-81`

**Problem**: The `profiles`, `jobs` (stats+charts), `agent_runs`, and `jobs` (researched) reads are four serial `await`s with no data dependency between them. Additionally, now that `statsJobs` selects `company_research_completed_at`, the second `jobs` query overlaps it — adding `id, company` to the first select would make the second unnecessary.

**Why it matters**: Four serial round trips on a server-rendered page is a straight addition to TTFB, and the fourth query re-reads rows already in memory.

**Suggested fix**: `Promise.all` the independent reads. Consider folding the researched-jobs query into `statsJobs` (note that it currently carries `.limit(10)` and an ordering, so the merge is not free — sort and slice in `computeRecentActivity` instead).

### 🟡 `context/progress-tracker.md` still lists feature 17 as unbuilt and mislabeled, `context/progress-tracker.md:10-11,46`

**Problem**: Current Status reads "Last completed: 16 / Next: 17 Analytics Charts — PostHog Data" and the checklist leaves `[ ] 17` unchecked, even though the notes section below documents feature 17 as built and this diff ships it. The title "PostHog Data" also directly contradicts spec 0011's decision to query Postgres, and spec 0011's own follow-up to update `context/build-plan.md` is still open (that file is untouched in this diff). Spec 0011 remains `In Progress` after a passing verify run.

**Why it matters**: AGENTS.md makes updating `progress-tracker.md` after every feature a rule that never changes, and the next agent reading the tracker will be told to go build feature 17 against PostHog.

**Suggested fix**: Tick 17, rename it to "Analytics Charts — Real Data", advance Current Status, update `context/build-plan.md`'s feature 17 wording, and move spec 0011 to `Accepted` now that verify has passed.

## Nits

- ⚪ `lib/dashboard-charts.ts:94` — `computeMatchScoreDistribution` runs five full `filter` passes over the job array (one per band). A single pass with a lookup would be O(n); irrelevant at current volumes, worth knowing if the missing `.limit()` on `statsJobs` is ever addressed with a large cap.
- ⚪ `lib/dashboard-charts.ts:82-87` — band labels "50-60%" and "60-70%" both visually claim 60. The code is unambiguous (lower inclusive, upper exclusive); the labels aren't. Inherited from the mock design, so changing it is a design call.
- ⚪ `lib/dashboard-charts.ts:98-101` — scores above 100 or below 0 are silently dropped rather than flagged. Fine as defensive behavior; just note no path surfaces bad data if scoring ever regresses.
- ⚪ `app/dashboard/page.tsx:12-19` — the `dashboard-charts` import block sits before `dashboard-activity`, breaking the otherwise alphabetical ordering of the `@/lib/*` imports.
- ⚪ `app/dashboard/page.tsx:61` — `as (DashboardStatsJob & ChartsSourceJob)[]` casts an untyped result. `.select<...>()` typing at the query site (the pattern `maybeSingle<ProfileRow>()` already uses on line 36) would keep the assertion honest if the select string and the type ever drift apart.

## Strengths

- The UTC date math is right, which is the thing most likely to be wrong here. Doing all arithmetic on UTC midnights with a fixed `DAY_MS` avoids the DST hazard that a local-time or `setDate()` implementation would have hit twice a year, and bucketing by `YYYY-MM-DD` key rather than by index means out-of-window rows are simply absent rather than piling into the first bucket — a classic off-by-window bug that isn't present.
- `computeZeroFilledWindow` is a genuinely good factoring: the 30 day and 7 day charts differ only in width and label function, and the code says exactly that instead of duplicating the loop.
- Consistency with the established pattern is excellent — pure function, `now: Date = new Date()` for determinism, `Pick<JobRow, ...>` source types, mocks deleted the moment nothing imports them. `lib/dashboard-charts.ts` reads like it was written by whoever wrote `dashboard-stats.ts`, which is the goal.
- The empty states use the existing `FindJobsPage` treatment with `role="status"` and per-chart copy naming that chart's specific condition, rather than a generic "no data" — and the spec's decision to keep the five-band layout and accept the sub-50 consequence is documented rather than papered over.
- Every chart color remains a `var(--color-*)` token; no hex, no raw Tailwind color class, and a test enforces it.

## Test coverage

Suite passes: 304/304. Feature 16 is well covered — `tests/dashboard-activity.test.mjs` tests the real import with a fixed `now` and hits every `formatTimeAgo` branch, the merge/sort, the 8 entry cap, null exclusion for both sources, and the missing-data fallback.

Feature 17 is the gap. `lib/dashboard-charts.ts` has no test file (see the Major above): no assertion on window width, zero filling, the UTC "today" boundary, label formatting, band edges, null exclusion, or sub-50 exclusion. The additions to `tests/dashboard-page.test.mjs` are source-regex contract tests that confirm the wiring exists but exercise no logic — worth keeping, not a substitute. Also untested: the new empty-state branch in all three chart components (no test asserts the `role="status"` message renders when `total === 0`), though that is consistent with this project's no-DOM-rendering test convention and was covered by the `/check verify` pass.
