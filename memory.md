# Memory — Feature 17, Analytics Charts — Real Data, complete and pushed

Last updated: 2026-07-31

## What was built

Feature 17, Analytics Charts — Real Data, the **last of the 17 planned features**. The build plan is now complete. This session also closed the outstanding `/check verify` for feature 16.

- `lib/dashboard-charts.ts` (new), three pure functions taking rows plus `now: Date` (same testable shape as `dashboard-stats.ts` / `dashboard-activity.ts`): `computeJobsFoundOverTime` (30 day UTC window, zero filled, short date labels), `computeMatchScoreDistribution` (all time, five bands, lower bound inclusive and upper exclusive except the top band which includes 100, nulls and sub 50 scores excluded), `computeCompanyResearchActivity` (rolling 7 day UTC window, zero filled, weekday labels). A shared `computeZeroFilledWindow` backs the two day bucketed charts.
- `app/dashboard/page.tsx`, the existing `statsJobs` select grew one column (`company_research_completed_at`) and now feeds the stat cards **and** all three charts. No second query was added. All four database reads now destructure `error` and log it with the `[app/dashboard]` prefix.
- The three chart components each gained the shared empty state (the `FindJobsPage` `role="status"` box) shown in place of the chart when its own window totals zero, with copy naming that chart's condition.
- `lib/mock-dashboard.ts`, the three chart mocks removed; the file now holds **only** the four shared types.
- `tests/dashboard-charts.test.mjs` (new, 16 tests), `tests/dashboard-page.test.mjs` extended (+8), `tests/mock-dashboard.test.mjs` deleted with its subjects. Suite 298 → **327**.
- Docs: `docs/specs/0011-analytics-charts-real-data/` (index, rationale, verify), `docs/reviews/2026-07-31-dashboard-page.md`, plus corrections to `context/build-plan.md`, `context/progress-tracker.md`, `context/ui-registry.md`.

## Decisions made

- **Chart data comes from Postgres, not PostHog.** This reverses what `context/build-plan.md` originally said. The three needed columns already live on the `jobs` rows the page fetches, so querying PostHog back out would have added a personal API key and project ID (a new secret), a second data source, and a network call on render for no benefit. Recorded in spec 0011; the build plan has been corrected so nothing points at the old design any more.
- Day buckets are **UTC calendar days**, windows are `[today-(N-1), today]` inclusive. Chosen deliberately, but note it disagrees with feature 15's rolling 168 hour "Jobs This Week" card sitting on the same screen.
- Kept the design's **five bands**, so a job scoring below 50 lands in no band. A user whose scored jobs are all below 50 sees an empty distribution chart while other stats are non zero. Documented tradeoff, not a bug.
- Axis thinning uses `interval="preserveStartEnd"`, never a fixed number. A fixed step both drops the final tick and fails to adapt to card width.
- A malformed row timestamp drops **that row only** (`rowDateKey`), matching how the two sibling compute modules already degrade, rather than throwing.

## Problems solved

- **Recharts tick labels in the DOM**: they are `.recharts-cartesian-axis-tick-value`, *not* nested under `.recharts-xAxis` the way you would expect. Tell x from y by the parent's `recharts-xAxis-tick-labels` / `recharts-yAxis-tick-labels` class. Also, SVG text needs `textContent`; Playwright's `allInnerTexts()` returns `[null]` on these.
- **A Recharts display fix cannot be verified without a real browser.** `ResponsiveContainer` measures real layout, so server rendering produces no ticks at all. Source assertions cannot prove tick behaviour.
- **Source contract tests can pass vacuously.** Check every new assertion against the real pre change code (`git show HEAD:<path>`) to confirm it actually fails there. Five did; one apparent gap turned out to be an equivalent mutant (removing the null guard in the band filter changes nothing, because `null >= 50` is already `false` in JavaScript).
- **`UID` is a reserved shell variable in zsh.** Using it for a seeded user id silently broke a script with a "bad math expression" error. Use any other name.
- **InsForge signup** authenticates with `Authorization: Bearer <anon key>`, not an `apikey` header.
- **There is no `DELETE /api/auth/users/:id` endpoint.** Remove throwaway accounts with `npx @insforge/cli db query` against `auth.users`.
- **`jobs.user_id` has a foreign key to `profiles(id)`, not `auth.users`.** A profiles row must be inserted before any jobs can be seeded for a throwaway account.
- **Check `lsof -i :3000` before starting a dev server** (carried forward from last session, and it applied again). The user usually has one running; reuse it.

## Current state

- Branch `dashboard-page`, **2 commits ahead of `origin/main`, 0 behind, pushed**. Head is `2471158 Feature 17 completed`.
- **2 uncommitted files**: `context/progress-tracker.md` and `context/ui-registry.md`, holding the feature 16 verify record written after that commit. Everything else is committed.
- All green: 327/327 tests, `tsc`, lint, and `npm run build` (`/dashboard` still dynamic).
- Spec 0011 is `Accepted`. Progress tracker shows all 17 features ticked, Phase 5 complete.
- Both features verified live against throwaway InsForge accounts, all deleted afterward and `insforge.toml` restored to zero diff. Feature 17 passed all 8 acceptance criteria including both window boundaries and every empty state. Feature 16 was verified with its two data sources deliberately interleaved in time, which is what proves they are genuinely merged and sorted rather than concatenated.
- `/check review` ran on Opus (author was Sonnet): 0 blockers, 2 majors (both fixed), 7 minors, 5 nits. Findings in `docs/reviews/2026-07-31-dashboard-page.md`.
- A PR title and body were drafted but **the PR was not created**. The draft lived in the session scratchpad, which will be gone next session; regenerate with `/document pr` if needed.

## Next session starts with

1. Commit the two doc files above (they contain the feature 16 verify record).
2. Create the PR: `/document pr` to regenerate the body, then `gh pr create`. `gh` 2.96.0 is installed, remote is `origin`, and no PR exists yet for this branch.
3. Merge into `main`.

## Open questions

- **Four other unmerged branches** (`Profile_save_logic`, `adzuna-job-search`, `job-details-page`, `add-workflow-skills`) — still unconfirmed whether they need merging or are stale. Carried forward from the last two sessions; worth just asking.
- **Open review findings, all deliberate, none blocking.** The two worth actually considering are semantic: the "Companies Researched" stat card counts `company_research` (the dossier) while the charts and activity feed count `company_research_completed_at` (the timestamp), so the numbers can disagree — this was seen live during the feature 16 verify, so it is reproducible, not theoretical; and the UTC chart windows versus the rolling 168 hour stat card. The rest are cleanup: renaming `lib/mock-dashboard.ts` now that it holds no mocks (eight modules import production types from a misleadingly named file), `Promise.all` on the four serial reads, and five nits.
- **Pre existing, not introduced by this work**: `statsJobs` has no `.limit()`, so PostgREST's default row cap could silently truncate a heavy user's stats and charts. Also `agent/adzuna.ts` inserts a jobs row per result with no dedupe across runs, so repeat searches double count.
- **`memory.md` is tracked in git**, so this scratch file appears in every PR diff, including the current one. Consider `.gitignore` plus `git rm --cached memory.md`. Offered but not done.
