# 0011. Analytics charts, real data

**Date**: 2026-07-31
**Status**: Accepted

## Summary

This decision covers feature 17: wiring the dashboard's three charts (Jobs Found Over Time, Match Score Distribution, Company Research Activity) to the signed in user's real data instead of the mock arrays in `lib/mock-dashboard.ts`. The data comes straight from the app's own `jobs` table in InsForge (Postgres), not from querying PostHog back out, since the needed columns (`found_at`, `match_score`, `company_research_completed_at`) already exist and are already fetched on this page. No new database column, API route, or secret is introduced.

## Requirements

**User stories**:
- As a signed in user, I want the dashboard's charts to reflect my own real job search activity, so the numbers I see match what I actually did.
- As a signed in user who is new to the product, I want each chart to show a clear empty state instead of a broken or misleading zeroed chart, so I understand there is simply no activity yet.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The Jobs Found Over Time chart renders the current user's real job counts from `jobs.found_at`, one data point per UTC calendar day for a 30 day window (the 29 days before today plus today, all in UTC, "today" taken from the server's `now` at render time), zero filled (every day appears even with 0 jobs), x-axis labeled with a short date (e.g. "Jul 15"), replacing `mockJobsFoundOverTime`.
- **AC-2**: The Match Score Distribution chart renders the current user's real job counts from `jobs.match_score`, bucketed into the five bands 50 to 60%, 60 to 70%, 70 to 80%, 80 to 90%, and 90 to 100% (lower bound inclusive, upper bound exclusive except the top band which includes 100), across all time (no date window), excluding jobs whose `match_score` is null. A job scoring below 50 is intentionally not counted in any band, matching the 5 band layout `context/designs/dashboard.png` already fixed in spec 0010; this means a user whose scored jobs are all below 50 sees this chart's total as 0 (triggering AC-4's empty state) even though their other stats are nonzero, an accepted, documented tradeoff of keeping the original 5 band design rather than adding a 6th "below 50%" band. Replaces `mockMatchScoreDistribution`.
- **AC-3**: The Company Research Activity chart renders the current user's real research counts from `jobs.company_research_completed_at`, one bar per UTC calendar day for a rolling 7 day window (the 6 days before today plus today), zero filled, each bar labeled with its own weekday abbreviation in chronological (oldest to newest) order; this is a rolling window, not a fixed Monday to Sunday calendar week, so the specific weekday the window starts on depends on today's date. Replaces `mockCompanyResearchActivity`.
- **AC-4**: When a chart's total count across its window is 0 (every bucket zero filled to 0), the chart's card shows this project's existing empty state treatment (the `rounded-lg bg-surface-secondary px-4 py-3 text-sm font-medium text-text-secondary` message box with `role="status"`, as used by `FindJobsPage`) in place of the chart, with copy naming that specific chart's empty condition.
- **AC-5**: `JobsFoundOverTimeChart`, `MatchScoreDistributionChart`, and `CompanyResearchActivityChart` are unchanged apart from the empty state addition in AC-4 and one necessary axis tuning: `JobsFoundOverTimeChart`'s `XAxis` gains an `interval`/tick reduction (e.g. showing roughly every 4th to 5th label) so its 30 short date ticks do not collide, since the mock version only ever rendered 7. `MatchScoreDistributionChart` and `CompanyResearchActivityChart` (5 and 7 ticks respectively) need no such change. All three keep receiving the same `DashboardDayCount[]` / `DashboardScoreBand[]` prop shapes; only the data source and this one axis tuning change.
- **AC-6**: `app/dashboard/page.tsx`'s existing `statsJobs` query (already `select("match_score, company_research, found_at").eq("user_id", ...)`) is extended to also select `company_research_completed_at`; no second query against `jobs` and no new table is introduced for these charts.
- **AC-7**: No PostHog Query API call, personal API key, project ID, or other new secret is introduced by this feature. `lib/posthog-server.ts` and `lib/posthog-client.ts` are used for capture only, exactly as `library-docs.md` already documents; this feature adds no new PostHog code path.
- **AC-8**: `mockJobsFoundOverTime`, `mockMatchScoreDistribution`, and `mockCompanyResearchActivity` are removed from `lib/mock-dashboard.ts` once nothing imports them; the `DashboardDayCount` and `DashboardScoreBand` types stay, now produced by real compute functions instead of mock constants.

## Decision

**Chosen option**: Option 1: Query InsForge (Postgres) directly

All three dashboard charts read from the `jobs` table already queried by `app/dashboard/page.tsx`, computed by new pure functions in `lib/dashboard-charts.ts`. No PostHog read path is introduced.

## Rationale

Reasoning and options considered: see `rationale.md`.

## Feature design

**Data model sketch**:

No new persistence. Reuses three existing `jobs` columns, all already present:
- `found_at` (timestamptz) — Jobs Found Over Time
- `match_score` (integer, nullable) — Match Score Distribution
- `company_research_completed_at` (timestamptz, nullable, added by migration `20260731180810_add-jobs-company-research-completed-at.sql`) — Company Research Activity

`app/dashboard/page.tsx`'s existing `statsJobs` select grows from `"match_score, company_research, found_at"` to also include `company_research_completed_at`; still one query, still `.eq("user_id", data.user.id)`.

**State transitions**: none, this is a read only render.

**API surface**:

None new. `app/dashboard/page.tsx` keeps its existing server side `createInsforgeServer()` / `insforge.database.from("jobs")` pattern; the only change is one more selected column.

**Key invariants**:
- Every chart's rows come from the same per user scoped `jobs` query already on this page; no chart ever reads another user's data.
- A day bucket key is always the UTC calendar date (`YYYY-MM-DD`) derived from the row's timestamp, `.toISOString().slice(0, 10)` or equivalent; the window is always `[today - (N-1) days, today]` inclusive in UTC, where `today` is the UTC date of the `now: Date` argument (defaulting to `new Date()`, matching `computeDashboardStats`'s existing testable signature) and `N` is 30 or 7. This makes both windows always exactly `N` entries wide, always zero filled: `computeJobsFoundOverTime` always returns 30 entries, `computeCompanyResearchActivity` always returns 7, regardless of how much (or how little) activity the user has.
- `computeMatchScoreDistribution` never counts a job whose `match_score` is null; it excludes, never coerces to a fake band. A job scoring below 50 is also never counted in any band (see AC-2).
- Band boundaries are inclusive on the lower edge, exclusive on the upper, except the last band (90 to 100%) which includes 100.

**Security model**:
Identical to the rest of this page (spec 0010): a valid session is required (`proxy.ts` middleware plus the page's own redirect), and every row read is scoped to the current user's `id` via `insforge.database.from("jobs").eq("user_id", data.user.id)`. No new data exposure; this feature reads columns that were already being fetched on this same page (feature 15) or a sibling one (feature 16).

**Configuration required**:
None. No new environment variable, credential, or PostHog key.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):
- Happy path: a user with `jobs` rows spread across several days and several match score bands sees a 30 point Jobs Found line (zero filled, short date labels), a 5 bar Match Score Distribution (all time, nulls and sub 50 scores excluded), and a 7 bar Company Research Activity (zero filled, rolling weekday labels), verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**.
- Failure/edge case: a user with zero `jobs` rows, or rows entirely outside a chart's window, or all scored below 50, sees that chart's card replaced by the existing empty state message instead of a flat zeroed chart, verifies **AC-2**, **AC-4**.
- Regression check (not a new AC in this spec): unchanged from spec 0010, an unauthenticated visit still redirects to `/login?error=session` before any query runs, so no chart computation ever happens for a signed out visitor.

## Build plan

`context/build-plan.md` and `AGENTS.md` record no explicit project wide build approach; following the pattern features 15 and 16 already set for this same page (extend the existing scoped query, add a pure `lib/dashboard-*.ts` compute module, wire the page, then delete the mock), this is naturally a single end to end slice given how small the remaining surface is; no earlier partial slice makes sense here.

1. Extend `app/dashboard/page.tsx`'s existing `statsJobs` select to also fetch `company_research_completed_at` (still one query, still scoped to `user_id`), satisfies **AC-6**.
2. Add `lib/dashboard-charts.ts` with three pure functions, `computeJobsFoundOverTime`, `computeMatchScoreDistribution`, `computeCompanyResearchActivity`, taking the `statsJobs` rows and a `now: Date` (mirroring `computeDashboardStats`'s testable signature), returning `DashboardDayCount[]` / `DashboardScoreBand[]`, with no PostHog import anywhere in the module, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-7**.
3. Wire `app/dashboard/page.tsx` to call the three new functions and pass their output to `JobsFoundOverTimeChart`, `MatchScoreDistributionChart`, `CompanyResearchActivityChart`, removing the `mockJobsFoundOverTime` / `mockMatchScoreDistribution` / `mockCompanyResearchActivity` imports, and add the `XAxis` `interval` tuning to `JobsFoundOverTimeChart` for its 30 tick case, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**.
4. Add the shared empty state treatment (the `FindJobsPage` `bg-surface-secondary` / `role="status"` pattern) to each of the three chart components, shown when the computed data set totals zero, satisfies **AC-4**.
5. Remove `mockJobsFoundOverTime`, `mockMatchScoreDistribution`, and `mockCompanyResearchActivity` from `lib/mock-dashboard.ts`, keeping the `DashboardDayCount` and `DashboardScoreBand` type exports, satisfies **AC-8**.

## Consequences

**Positive**:
- Closes out the dashboard's real data wiring (features 15, 16, 17); every number on `/dashboard` now reflects the signed in user's actual activity.
- No new secret, credential, or undocumented query surface added to the project.
- The three new compute functions are plain, synchronous, easily unit tested TypeScript, consistent with `lib/dashboard-stats.ts` and `lib/dashboard-activity.ts`.

**Negative / tradeoffs**:
- Supersedes `context/build-plan.md`'s original "query PostHog" wording for feature 17; that file should be updated to match this decision once this ships.
- PostHog continues capturing `job_found` and `company_researched` events that this feature never reads back; if a future feature genuinely needs cross user or aggregate analytics (not just one user's own dashboard), PostHog querying may be worth revisiting then.

**Neutral**:
- `jobs.company_research_completed_at`, added for feature 16, turns out to double as this feature's third data source; no coincidence to design around, just a column that already existed.

## Follow-up

- [ ] Update `context/build-plan.md`'s feature 17 description to match this decision (Postgres, not PostHog events), so the build plan and the shipped implementation agree.
- [ ] `context/library-docs.md`'s PostHog section stays capture only; no change needed there since this feature adds no PostHog read path.
- [ ] Pre-existing, not introduced by this feature: the `statsJobs` query in `app/dashboard/page.tsx` has no `.limit()`, so InsForge/PostgREST's default row cap could silently truncate `Match Score Distribution`'s all time count for a very heavy user; this already affects feature 15's stat cards today. Worth a dedicated look (pagination or a server side aggregate) if a real user ever approaches that row count.
- [ ] Pre-existing, not introduced by this feature: `agent/adzuna.ts` inserts a `jobs` row per Adzuna result with no dedupe against a prior run, so a job appearing across multiple search runs is counted more than once by every chart and stat card that reads `jobs`; consistent with how `Total Jobs Found` already counts today, not a new inconsistency, but worth a dedicated look if it ever confuses users.
