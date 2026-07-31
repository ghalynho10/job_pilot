# Memory — Feature 16, Recent Activity — Real Data, complete (uncommitted)

Last updated: 2026-07-31

## What was built

Feature 16, Recent Activity — Real Data, is complete: built and verified live. Not yet committed or merged. No new spec was needed, same shape as feature 15 — `context/build-plan.md`'s existing logic section (merge two scoped queries by timestamp, format, color-code) was already fully specified, no architectural decision to invent.

Main code added or changed (all currently uncommitted, on branch `dashboard-page`, which is the same commit as `main` right now since feature 15 was already merged and pushed):

- `lib/dashboard-activity.ts` (new), pure `computeRecentActivity(agentRuns, researchedJobs, now?)`: merges completed `agent_runs` and researched `jobs` into `DashboardActivityEntry[]`, sorted by timestamp descending, capped to the newest 8. An agent run becomes `"Found {jobsFound} jobs for {jobTitleSearched}"` with a `success` (green) dot; a researched job becomes `"Researched {company}"` with an `info` (blue) dot — `accent` (the type's third color) stays unused by real data, matching feature 15's precedent of leaving `StatCard`'s trend branch unused. Also exports `formatTimeAgo(timestamp, now?)` reproducing the mock's exact phrasing ("Just now", "N min(s) ago", "N hour(s) ago", "Yesterday", "N days ago").
- `app/dashboard/page.tsx`, now also reads the current user's completed `agent_runs` (`id, job_title_searched, jobs_found, completed_at`, `.eq("status","completed")`) and `jobs` rows with non-null `company_research_completed_at` (`id, company, company_research_completed_at`, `.not(...)`), both scoped by `user_id`, ordered newest first, capped at 10 rows each, then renders `computeRecentActivity(...)` instead of `mockActivity`.
- `lib/mock-dashboard.ts`, `mockActivity` removed as superseded (its `DashboardActivityEntry` type stays, still shared by the real data path and `RecentActivityCard`, which is unchanged).
- `types/index.ts`, new `AgentRunRow` type.
- `tests/dashboard-activity.test.mjs` (new, 10 tests), `tests/dashboard-page.test.mjs` and `tests/mock-dashboard.test.mjs` updated. Full suite: 306/306 passing. `tsc`, lint, `npm run build` all clean.
- `context/progress-tracker.md` and `context/ui-registry.md` updated (feature 16 checked off, DashboardPage entry rewritten).

## Decisions made

- Merged activity list capped at 8 entries (within the build plan's stated 5-to-10 range), a specific implementation choice, not re-litigated with the user.
- Agent runs are filtered to `status = "completed"` only (a `running` or `failed` run is excluded from the activity feed, since "Found X jobs for..." only makes sense for a completed search).
- Color mapping: job-search activity is `success` (green), company-research activity is `info` (blue), per the build plan's explicit "info blue, success green" instruction. `accent` is a supported token on the shared type but no real entry uses it.

## Problems solved

None — this feature had no real implementation snags; the query pattern followed feature 15's precedent.

## Current state

- `/check verify` ran live against two real throwaway InsForge accounts (email/password signup, `require_email_verification` temporarily disabled via `insforge.toml` / `config apply` then restored, session cookie injected into a real Playwright browser). Account A had 5 seeded `agent_runs` (3 completed at different ages, 1 running, 1 failed) and 4 seeded `jobs` (3 researched at different ages, 1 unresearched); the rendered activity list exactly matched hand-computed expectations in order, title, timestamp text, and dot color, and correctly excluded the running run, failed run, and unresearched job. Account B (no activity) rendered an empty list with no crash and no console errors. Unauthenticated `/dashboard` still redirects (307 to `/login`). Both throwaway accounts and all their rows (including `auth.users`, via direct `db query`) were deleted afterward.
- Note for next session: a second `npm run dev` I started during verify conflicted with the user's own already-running dev server on port 3000 (Next.js detected the lock and exited without binding anything) — used the user's existing server instead, no orphan process left behind. Worth remembering: check `lsof -i :3000` before assuming you need to start your own server.
- No `/test` pass needed separately — tests were written during `/develop` and confirmed accurate by the verify run.
- Nothing committed yet this session. `git status` shows the feature 16 files as modified/untracked on branch `dashboard-page` (currently identical to `main`, since feature 15 already merged and pushed).

## Next session starts with

Commit and merge feature 16 (same flow as feature 15: commit on `dashboard-page`, merge into `main` via VS Code Source Control or `git merge`, push), then start Feature 17, Analytics Charts — PostHog Data (per `context/progress-tracker.md` and `context/build-plan.md`'s Phase 5, the last feature in Phase 5).

Feature 17's logic per the build plan: query PostHog for `job_found` and `company_researched` events (not the `jobs`/`agent_runs` tables like 15/16), group into day-buckets or score-bands, wire all three dashboard charts (`JobsFoundOverTimeChart`, `MatchScoreDistributionChart`, `CompanyResearchActivityChart`) to real data, with an empty state per chart when no data exists yet. This is a different data source (PostHog query API, not InsForge DB) — check whether `/develop` can still skip `/architect` here, or whether querying PostHog (auth, query shape, empty-state handling) counts as a decision owed. Feature 10's memory noted PostHog write access was confirmed working; query/read access for analytics has not been exercised yet in this project — worth checking early whether a query-capable PostHog key is even available in this environment before assuming feature 17 can be built and verified the same way as 15/16.

## Open questions

- Whether the other unmerged branches (`Profile_save_logic`, `adzuna-job-search`, `job-details-page`, `add-workflow-skills`) still need merging into `main`, or are stale/superseded, is still unconfirmed from last session — worth asking the user before touching them.
- Feature 17 may need a query-capable PostHog API key; prior sessions (feature 10) only had a write-only key available. If that's still the case, feature 17's `/check verify` may hit the same kind of block feature 10's did for the `job_found` event.
