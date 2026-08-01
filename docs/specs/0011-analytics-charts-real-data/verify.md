# Verify: analytics-charts-real-data · spec 0011 · updated 2026-07-31

_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in with a real session that has `jobs` rows spread across several of the last 30 days, visit `/dashboard` → Jobs Found Over Time shows 30 points (zero filled on days with no jobs, window is the 29 days before today plus today in UTC), x-axis labeled with short dates (e.g. "Jul 15") and ticks not overlapping → AC-1
- [ ] Same session, jobs with a mix of match scores across bands including at least one job scoring below 50 → Match Score Distribution shows the 5 bands with counts matching a manual count of that user's `jobs.match_score` values, any job with a null `match_score` is not counted in any band, and the sub 50 job is not counted in any band either → AC-2
- [ ] A session whose scored jobs are all below 50 (or all null) → Match Score Distribution's card shows the empty state even though other stat cards are nonzero (the documented AC-2/AC-4 tradeoff) → AC-2, AC-4
- [ ] Same session, some jobs with `company_research_completed_at` set within the last 7 days → Company Research Activity shows 7 bars (a rolling window ending today, each labeled with its own correct weekday), heights matching a manual count per day → AC-3
- [ ] A session with zero `jobs` rows (or all outside a given chart's window) → that chart's card shows the `bg-surface-secondary` / `role="status"` empty message instead of a flat zeroed chart, independently per chart → AC-4
- [ ] Confirm the three chart components' rendered markup (axes, colors, card surface) is otherwise identical to before this feature except `JobsFoundOverTimeChart`'s tick interval, only the data (and that one tick change) differs → AC-5
- [ ] Open browser devtools Network tab on `/dashboard` → confirm exactly one request to `jobs` (the extended `statsJobs` select) and no second query against `jobs` for these charts → AC-6
- [ ] Search the diff for this feature → confirm no PostHog Query API call, no `POSTHOG_PERSONAL_API_KEY` or project ID reference, no new PostHog import beyond the existing capture calls → AC-7
- [ ] Confirm `lib/mock-dashboard.ts` no longer exports `mockJobsFoundOverTime`, `mockMatchScoreDistribution`, or `mockCompanyResearchActivity`, and nothing in the codebase imports them → AC-8

## Commands

- [ ] `npx tsc --noEmit` → no type errors → all ACs
- [ ] `npm run lint` → no lint errors → all ACs
- [ ] `npm test` → all tests pass, including new coverage for `lib/dashboard-charts.ts`'s three compute functions (day bucketing, zero fill, band bucketing, null exclusion) → AC-1, AC-2, AC-3, AC-4
- [ ] `npm run build` → production build succeeds, `/dashboard` still listed as a route → all ACs

## Acceptance-criteria coverage

- AC-1 (Jobs Found Over Time, real data) → covered by manual step 1
- AC-2 (Match Score Distribution, real data) → covered by manual step 2
- AC-3 (Company Research Activity, real data) → covered by manual step 3
- AC-4 (per chart empty state) → covered by manual step 4
- AC-5 (chart components unchanged) → covered by manual step 5
- AC-6 (single extended query, no new query) → covered by manual step 6
- AC-7 (no PostHog query path) → covered by manual step 7
- AC-8 (mocks removed) → covered by manual step 8
