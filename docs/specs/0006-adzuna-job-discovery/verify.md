# Verify: adzuna-job-discovery · spec 0006 · updated 2026-07-30

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these once the feature is built; `/test` locks the durable ones. Not yet run, the feature has not been built._

## UI / manual

- [ ] Sign in with a real session (a profile with skills recorded), visit `/find-jobs`, type a real job title and location, click Find Jobs → the button and both inputs disable while the search is in flight → AC-8
- [ ] After the search completes → the success banner shows the real found and saved counts (not the old hardcoded "Found 8 jobs and saved 4 strong matches"), and the table shows real rows, not the six fixed sample rows → AC-1
- [ ] Query the database directly after a search → an `agent_runs` row exists with `status: completed`, correct `job_title_searched`/`location_searched`, and `jobs_found` matching the number of `jobs` rows written with that `run_id` → AC-2
- [ ] Query the `jobs` rows written by the search → every row has `source: 'search'`, the correct `run_id`, and populated `match_score`/`match_reason`/`matched_skills`/`missing_skills` (or `match_score: null` only if scoring genuinely failed for that one job) → AC-1
- [ ] Sign in with a profile that has no skills recorded, attempt a search → the request is blocked client side (confirm via network tab that no request fires), and a message points to completing the profile → AC-3
- [ ] Search a job title unlikely to return any Adzuna results → the page shows the distinct empty state message, not the standard success banner, and no table → AC-4
- [ ] Simulate an Adzuna failure (temporarily invalid `ADZUNA_APP_KEY`, or a network block) and search → the `agent_runs` row is marked `failed`, the page shows the generic error banner, no retry happens automatically → AC-5
- [ ] In a private/incognito window (no session), call `POST /api/agent/find` directly → 401, no `agent_runs` or `jobs` row written → AC-6
- [ ] Trigger a real search while watching PostHog live events (or the debug skill) → `job_search_started` fires exactly once with `userId`/`jobTitle`/`location`; `job_found` fires once per job actually saved, each with `userId`/`source: 'search'`/`matchScore` → AC-7

## Commands

- [ ] `npm test` → all tests pass, including new tests for `lib/adzuna.ts`, `agent/matcher.ts`, and `app/api/agent/find/route.ts` → AC-1 through AC-8
- [ ] `npx tsc --noEmit -p .` → no type errors → all ACs
- [ ] `npx eslint lib/adzuna.ts agent/matcher.ts agent/adzuna.ts app/api/agent/find/route.ts components/find-jobs/FindJobsPage.tsx` → no lint errors → all ACs
- [ ] `npm run build` → production build succeeds, `/api/agent/find` listed as a route → all ACs

## Acceptance-criteria coverage

- AC-1 (real search, score, save every job) → covered by manual steps 2 to 4
- AC-2 (agent_runs lifecycle) → covered by manual step 3
- AC-3 (blocked when profile has no skills) → covered by manual step 5
- AC-4 (zero results empty state) → covered by manual step 6
- AC-5 (Adzuna failure, no retry) → covered by manual step 7
- AC-6 (auth required) → covered by manual step 8
- AC-7 (PostHog events) → covered by manual step 9
- AC-8 (loading state prevents double submit) → covered by manual step 1
