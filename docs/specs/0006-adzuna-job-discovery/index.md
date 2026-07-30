# 0006. Adzuna job discovery

**Date**: 2026-07-30
**Status**: Accepted

## Summary

This decision replaces the placeholder Find Jobs button (built in feature 09, which just showed six fixed sample rows) with a real search. When the user submits a job title and location, the app calls the Adzuna jobs API, scores every result against the user's profile with GPT-4o, and saves every job to the database, whether it is a strong match or not. Filtering, sorting, and pagination of the saved jobs are a separate, already planned feature and are not built here.

## Requirements

**User stories**:
- As a job seeker, I want to search for real jobs by title and location so that I see actual openings instead of sample data.
- As a job seeker, I want each job automatically scored against my profile so that I can tell at a glance how good a fit it is.
- As a job seeker, I want to be told clearly when a search finds nothing, or fails, so that I am not left guessing.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: Submitting the search form with a job title (and optional location) calls the Adzuna API, scores every returned job against the caller's profile with GPT-4o, and saves every job to the `jobs` table (not just the strong matches), each row carrying the correct `run_id`, `source`, and scoring fields.
- **AC-2**: An `agent_runs` row is created before the search starts (`status: running`) and updated afterward to `completed` (with `jobs_found`, `completed_at` set) or `failed`.
- **AC-3**: If the caller's profile has no skills recorded, the search is blocked before any API call is made, and the page shows a message directing them to complete their profile first.
- **AC-4**: If Adzuna returns zero results, the page shows a distinct empty state message ("no jobs found, try a different title or location"), not the standard found and saved count banner, and no table.
- **AC-5**: If the Adzuna API call itself fails (bad credentials, network error, rate limit), the `agent_runs` row is marked `failed`, and the page shows a generic error banner with no automatic retry.
- **AC-6**: An unauthenticated request to the search endpoint is rejected; every `jobs` and `agent_runs` row written belongs to the authenticated caller only (existing row level security already enforces this at the database layer, this criterion covers the route's own auth check).
- **AC-7**: The `job_search_started` PostHog event fires exactly once per submitted search with `userId`, `jobTitle`, `location`; the `job_found` event fires exactly once per job actually saved, with `userId`, `source`, `matchScore`.
- **AC-8**: While a search is in flight, the search button and inputs are disabled so the same search cannot be submitted twice in a row.

## Decision

**Chosen option**: One request, then a client side refetch

The search endpoint (`POST /api/agent/find`) runs the Adzuna search, scores and saves every job, and returns a short summary; the page then reads the saved jobs straight from the database to render the table. Full options considered and rationale: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No new migration. Feature 10 writes to two tables that already exist (`migrations/20260718170543_create-core-tables.sql`):

- `agent_runs` (one row per search): `id`, `user_id` (required, references `profiles`), `status` (`running` | `completed` | `failed`, required), `job_title_searched`, `location_searched`, `jobs_found`, `started_at` (default now), `completed_at` (nullable, set when the run ends).
- `jobs` (one row per Adzuna result, many per run): `id`, `run_id` (references `agent_runs`, set for every row this feature writes), `user_id` (required), `source` (required, always `'search'` for this feature), `source_url`, `external_apply_url`, `title` (required), `company` (required), `location`, `salary`, `job_type`, `about_role` (the Adzuna description snippet), `match_score` (nullable integer, null only if GPT-4o scoring itself failed for that one job), `match_reason`, `matched_skills`, `missing_skills`, `found_at` (default now).

Relationship: `agent_runs` 1 to N `jobs`, cascade delete. Feature 10 leaves `responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`, and `company_research` null; those belong to a later feature (job details or company research).

**State transitions**:

`agent_runs.status`: `running` (created at search start) → `completed` (Adzuna call succeeded, all jobs processed, `jobs_found` and `completed_at` set) or `failed` (Adzuna call itself failed; `completed_at` set, `jobs_found` left null). A per job scoring failure does not fail the run, it only leaves that job's `match_score` null; every returned job is still saved.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/agent/find | POST | jobTitle:string (required, non empty), location:string (optional) | jobsFound:number, strongMatches:number, message:string | session cookie, authenticated user only | 401 not signed in, 400 missing jobTitle, 422 profile has no skills recorded, 500 search failed |

**Key invariants**:
- `jobs.source` is always `'search'` for rows this feature writes, never any other value (matches the existing database check constraint).
- Every job Adzuna returns is saved, regardless of `match_score`; scoring never filters out a result.
- `jobs.run_id` is set for every row this feature writes and always points to that search's `agent_runs` row.
- `agent_runs.jobs_found` equals the number of `jobs` rows actually written for that run.

**Security model**:
- The route requires a signed in session (`createInsforgeServer()` plus `getCurrentUser()`); an unauthenticated request gets 401.
- Every write sets `user_id` to the authenticated caller; row level security already scopes all `select`, `insert`, and `update` on both tables to `user_id = auth.uid()` (no delete policy on either table), so a caller can never read or write another user's search history or jobs.
- No new compliance scope; the same skills and work history data already covered by the existing `profiles` table's security model, not new sensitive data.

**Configuration required**:
- `ADZUNA_APP_ID`: Adzuna API application id (already present in `.env.local`, missing from `.env.example`).
- `ADZUNA_APP_KEY`: Adzuna API application key (already present in `.env.local`, missing from `.env.example`).
- `OPENAI_API_KEY`: already used by the existing resume features, reused here for scoring (already present in `.env.local`, missing from `.env.example`).

**Critical test scenarios**:
- Happy path: submit a job title, Adzuna returns several jobs, each is scored and saved, the page shows the real found and saved count and a table of real rows, verifies **AC-1**, **AC-2**, **AC-7**.
- Failure case: Adzuna call fails (simulated bad credentials or network error), the run is marked `failed`, the page shows the generic error banner, no rows are half written, verifies **AC-5**.
- Edge case: profile has no skills recorded, submitting is blocked client side with a message to complete the profile, no request reaches the endpoint, verifies **AC-3**.
- Edge case: Adzuna returns zero results, the page shows the distinct empty message, not the standard success banner, verifies **AC-4**.
- Auth/permission: an unauthenticated request to `/api/agent/find` receives 401 and no `agent_runs` or `jobs` row is written, verifies **AC-6**.

## Build plan

This project's build approach is not recorded in `AGENTS.md` or a scope header (this project tracks features through `context/build-plan.md` and `context/progress-tracker.md` rather than `docs/scope/`). Defaulting to end to end slices for production work, matching how the prior features (06 through 09) each shipped one complete vertical slice per feature: this plan builds the backend chain first (Adzuna client to scoring to orchestrator to route), since none of it is usable without all four pieces working together, then wires the page to it last, so the whole path is real and testable end to end as soon as the page changes land, rather than landing partial pieces that can't be exercised on their own.

1. [x] `lib/adzuna.ts`: the Adzuna HTTP client (`searchJobs`) and the `detectCountry` keyword lookup, no database or AI involved, satisfies **AC-1**
2. [x] `agent/matcher.ts`: `scoreJobMatch`, the GPT-4o scoring call and its response validation, satisfies **AC-1**
3. [x] `agent/adzuna.ts`: `runJobSearch`, the orchestrator that owns the `agent_runs` lifecycle, the search and score loop, the `jobs` writes, and the per job `job_found` PostHog event, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-7**
4. [x] `app/api/agent/find/route.ts`: the route, auth check, request validation, the profile skills check, calling the orchestrator, and shaping the summary response, satisfies **AC-3**, **AC-6**
5. [x] `components/find-jobs/FindJobsPage.tsx`: controlled inputs, the loading and error and empty states, the real fetch call, the client side refetch of saved jobs, the `job_search_started` event, and the profile completeness check before allowing a submit, satisfies **AC-3**, **AC-4**, **AC-7**, **AC-8**
6. [x] `.env.example`: add the three missing placeholder entries (`OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`)
7. [x] Tests for `lib/adzuna.ts` (country detection, request building), `agent/matcher.ts` (schema fallback behavior on a malformed model response), and the route (auth gate, validation, success and error response shapes)

## Consequences

**Positive**:
- The Find Jobs page shows real, current job listings instead of static sample data, the core value of the product.
- The refetch pattern built here is the same query shape feature 11 will extend with filtering, sorting, and pagination.

**Negative / tradeoffs**:
- Every search costs one Adzuna API call plus up to ten GPT-4o calls; there is no rate limiting, so a user who searches repeatedly drives real API cost with no cap (accepted deliberately for this feature, revisit if it becomes a real problem).
- Country detection is a small hardcoded keyword list, not a real geocoder; anything not on that list defaults to `us`, an accepted simplification, not a bug.
- No structured agent error logging (`agent_logs` table) exists yet, errors go to `console.error` only, matching every other agent file in the project today; this is a known, deliberate gap.

**Neutral**:
- No new database migration; both tables this feature writes to already exist.
- Introduces a new `app/api/agent/` route folder, alongside the existing `app/api/resume/` one.

## Follow-up

- [ ] Feature 11 (filter, sort, pagination) should reuse the same `insforge.database.from("jobs")` query path this feature introduces on the client, rather than writing a second one from scratch.
- [ ] If a later feature (Stagehand company research, per `context/library-docs.md`) needs structured agent error logging, that is the point to add an `agent_logs` table and a `logAgentError` helper; this feature intentionally does not build it.
- [ ] Consider rate limiting job searches if API cost from repeated searches becomes a real problem; explicitly out of scope for this feature.

## Rationale

Full reasoning, the options considered, and the sourcing behind this decision are in [rationale.md](rationale.md).
