# 0001. Database schema, row level security, and resume storage bucket

**Date**: 2026-07-18
**Status**: Accepted

## Summary

This spec creates the four InsForge (the project's backend platform) tables that every later feature reads from and writes to: profiles, agent_runs, jobs, agent_logs. It also creates the resumes storage bucket. Every table gets row level security so a user can only ever see or change their own rows. This must exist before feature 05 (Profile Page) can save anything real.

## Requirements

**User stories**:
- As a signed in user, I want my profile, job matches, and search history stored so I can return later and see my data.
- As a signed in user, I want my data isolated from every other user, so nobody else can read or change it, even by guessing an id.
- As the AI agent building features 05 through 17, I want a stable, typed schema to build against so I am not guessing column names mid feature.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: All four tables (profiles, agent_runs, jobs, agent_logs) exist in InsForge Postgres with exactly the columns, types, and nullability documented in context/architecture.md.
- **AC-2**: Row level security is enabled on all four tables, and every select, insert, and update is scoped so a user can only read, create, or change rows where the row's owning id (user_id, or id for profiles) matches their own authenticated user id. This includes blocking a write that tries to set someone else's id on a new or existing row, not only blocking reads.
- **AC-3**: The resumes storage bucket exists, requires authentication, and each user can only read or write objects under their own user id path (resumes then user_id then resume.pdf); one authenticated user can never read or overwrite another user's resume file.
- **AC-4**: Deleting an auth user cascades through profiles, agent_runs, and jobs with no orphaned rows left in any of the three; agent_logs rows tied to that user are also removed, and any agent_logs row referencing a deleted job has its job_id set to null instead of being removed (a log entry can outlive the job it mentioned).
- **AC-5**: The migration is captured in one versioned SQL file in the repo and applied successfully with no errors, confirmed against InsForge's own schema view.
- **AC-6**: A cross user check proves RLS actually blocks access both ways, an authenticated user can only select their own rows in all four tables, and any insert or update they attempt against another user's id is rejected, never silently allowed.

## Decision

**Chosen option**: Option 1: One committed SQL migration file, applied through the InsForge CLI's migration workflow

Create all four tables and the resumes bucket from one versioned SQL migration file, applied through the InsForge CLI's own migration commands (`db migrations new` then `db migrations up --all`), with row level security enabled on every table from the start.

**Implementation skills**: `insforge-cli` (`insforge/cli`, `.claude/skills/insforge-cli/`), the project's installed backend infrastructure skill; consulted directly for the exact migration and bucket creation commands below.

## Rationale

See rationale.md for the full reasoning and the case for cascade delete over keeping orphaned records after account deletion; the reasoning does not change what gets built.

## Feature design

**Data model sketch**:

| Table | Key columns | Nullable | Foreign keys | Cardinality |
|---|---|---|---|---|
| profiles | id (uuid, primary key) | | id references auth.users(id), on delete cascade | one auth user has one profile |
| profiles | full_name, email, phone, location, current_title, experience_level, years_experience, skills (text array), industries (text array), work_experience (jsonb), education (jsonb), job_titles_seeking (text array), remote_preference, preferred_locations (text array), salary_expectation, cover_letter_tone, linkedin_url, portfolio_url, work_authorization, resume_pdf_url | all nullable except id | | |
| profiles | is_complete (boolean), created_at, updated_at | not null, defaulted | | |
| agent_runs | id (uuid, primary key) | | | one profile has many agent_runs |
| agent_runs | user_id (uuid) | not null | user_id references profiles(id), on delete cascade | |
| agent_runs | status (text, check constraint restricts to running, completed, or failed), job_title_searched, location_searched, jobs_found, started_at, completed_at | status and started_at not null, rest nullable | | |
| jobs | id (uuid, primary key) | | | one agent_run has many jobs, one profile has many jobs |
| jobs | run_id (uuid) | nullable (a job can exist without a run once URL based import ships later) | run_id references agent_runs(id), on delete cascade | |
| jobs | user_id (uuid) | not null | user_id references profiles(id), on delete cascade | |
| jobs | source (text, check constraint restricts to search or url), source_url, external_apply_url, title, company, location, salary, job_type, about_role, responsibilities (text array), requirements (text array), nice_to_have (text array), benefits (text array), about_company, match_score, match_reason, matched_skills (text array), missing_skills (text array), company_research (jsonb), found_at | title, company, source, found_at not null, rest nullable | | |
| agent_logs | id (uuid, primary key) | | | one agent_run has many agent_logs |
| agent_logs | run_id (uuid) | not null | run_id references agent_runs(id), on delete cascade | |
| agent_logs | user_id (uuid) | not null | user_id references profiles(id), on delete cascade | |
| agent_logs | job_id (uuid) | nullable | job_id references jobs(id), on delete set null | a log entry can outlive the job it mentions |
| agent_logs | message, level (text, check constraint restricts to info, success, warning, or error), created_at | not null | | |

**Indexes** (beyond the primary keys, chosen to match how features 10, 11, 15, and 16 actually query, every real query in context/library-docs.md filters by user_id first, then sorts or filters by a second column, so the indexes are composite, not single column):
- agent_runs: composite index on (user_id, started_at descending)
- jobs: composite index on (user_id, match_score), composite index on (user_id, found_at descending), index on run_id
- agent_logs: composite index on (user_id, created_at descending), index on run_id

**State transitions**:
agent_runs.status moves running to completed, or running to failed. No other table has a state machine; jobs and agent_logs rows are written once and read many times, never transitioned through states.

**API surface**:
No new endpoints. This spec only creates the schema; features 06, 10, 11, 12, and 15 through 17 are the ones that read and write through it.

**Key invariants**:
- jobs.source is always search or url, agent_runs.status is always running, completed, or failed, agent_logs.level is always info, success, warning, or error. Each is enforced twice: application code per context/library-docs.md and context/code-standards.md, and now also a CHECK constraint at the database layer, so a missed application level guard still cannot write an invalid value.
- Every query against these four tables is scoped to the current user_id (or id, for profiles), enforced twice: once by application code per context/library-docs.md, and now also by the row level security policies themselves, so a missed application level filter still cannot leak another user's row.
- profiles.id always equals the InsForge auth user's own id, never a separate generated id.

**Security model**:
Row level security is enabled on all four tables. Every policy compares the row's owning column against the caller's own authenticated id (what InsForge exposes as the equivalent of auth.uid()):
- profiles: select, insert, and update allowed only where id equals the caller's own id. No user facing delete policy; the only way a profiles row disappears is the cascade from an auth user being deleted.
- agent_runs: select, insert, and update allowed only where user_id equals the caller's own id.
- jobs: select, insert, and update allowed only where user_id equals the caller's own id. No delete policy; dismissing or deleting a job is out of scope for this project.
- agent_logs: select and insert allowed only where user_id equals the caller's own id. No update or delete policy; log rows are append only.
- resumes storage bucket: created private via `storage create-bucket --private`, plus explicit path scoped row level security on the managed `storage.objects` table (InsForge's storage specific RLS model, confirmed against `.claude/skills/insforge/storage/postgres-rls.md`), so select, insert, update, and delete are only allowed where `bucket = 'resumes'` and the object key's first folder segment equals the caller's own id, read from `auth.jwt() ->> 'sub'` (storage policies use the JWT claim, not `auth.uid()`, that is the storage module's own convention, different from the application tables above).

No regulated compliance scope applies (no payments or health data), but profiles holds personal data (name, email, phone, location), so cascade delete on account removal follows ordinary privacy good practice, removing a user's data fully rather than leaving it behind ownerless.

**Configuration required**:
None. The migration is applied through the InsForge MCP connection already configured for this project, not through a new application runtime credential. No new environment variable is needed beyond what context/code-standards.md already lists.

**Critical test scenarios** (each maps to an acceptance criterion above):
- Happy path: apply the migration, then confirm all four tables exist with the documented columns and types, verifies **AC-1**, **AC-5**.
- Failure case, read: authenticate as user A, query jobs while a row exists for user B, confirm zero rows return, verifies **AC-2**, **AC-6**.
- Failure case, write: authenticate as user A, attempt to insert a jobs row with user_id set to user B, and attempt to update a jobs row that belongs to user B, confirm both are rejected, verifies **AC-2**, **AC-6**.
- Failure case, storage: authenticate as user A, attempt to read and attempt to overwrite the object at resumes/{user B's id}/resume.pdf, confirm both are rejected, verifies **AC-3**.
- Auth or permission: an unauthenticated request to any of the four tables, or to the resumes bucket, is rejected, verifies **AC-2**, **AC-3**.
- Cascade: delete a test auth user, confirm their profiles, agent_runs, and jobs rows are gone, and any agent_logs row that referenced one of their deleted jobs still exists with job_id set to null, verifies **AC-4**.

## Build plan

No scope tracker in docs/scope exists in this project; context/build-plan.md and context/progress-tracker.md play that role instead, and this plan mirrors feature 04 there. No UI is involved (this is pure backend infrastructure), so the project's usual UI first build order does not apply; the tasks below just run in the sequence the migration itself needs.

1. [x] Create the migration file with `npx @insforge/cli db migrations new create-core-tables`, then write the four CREATE TABLE statements with the confirmed columns, types, foreign keys, cascade rules, check constraints on source, status, and level, and indexes, satisfies **AC-1**. Built: `migrations/20260718170543_create-core-tables.sql`
2. [x] In the same migration file, enable row level security and add the select, insert, and update policies for all four tables, plus path scoped policies on the managed `storage.objects` table for the resumes bucket. Each insert and update policy sets both the using and the with check clause to the caller's own id, so a write cannot forge another user's id, satisfies **AC-2**, **AC-3**
3. [x] Create the resumes storage bucket with `npx @insforge/cli storage create-bucket resumes --private`, satisfies **AC-3**
4. [x] Apply the migration with `npx @insforge/cli db migrations up --all`, satisfies **AC-1**, **AC-2**, **AC-5**
5. [x] Verify the applied schema is live: all four tables and their exact columns confirmed via `db query` against `information_schema`, row level security confirmed enabled on all four tables plus `storage.objects`, every policy's using and with check clause confirmed by name and expression, every foreign key's cascade or set null rule confirmed, every check constraint confirmed present. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5** structurally. The behavioral half of AC-2, AC-4, and AC-6 (an actual cross user write attempt, an actual account deletion) is deliberately left to `/check verify`, see the emitted verify steps
6. [ ] Update context/progress-tracker.md once `/check verify` and `/test` pass, mark 04 Database Schema complete, set next to 05 Profile Page, Full UI (left unchecked here on purpose: `/develop` marks a feature in-progress, not done, until verify and test both pass)

## Consequences

**Positive**:
- Every later feature (05 through 17) has a stable, typed schema to build against instead of guessing column names mid feature.
- Row level security blocks cross user data leaks from day one, even if an application level filter is ever missed.
- The migration is versioned in git, so any future session can see exactly what schema exists and why.

**Negative / tradeoffs**:
- A hand written SQL file has no automatic diffing. Any future column change means writing and re-applying another SQL file by hand, there is no schema tool tracking drift.
- Cascade delete is irreversible. Deleting an auth user permanently removes their profile, jobs, and run history with no recovery path, so this must never be triggered accidentally. No feature in context/build-plan.md ever deletes an auth user, so this only fires through an administrative action outside the app (the InsForge dashboard or a support request), never through anything a signed in user can trigger themselves.

**Neutral**:
- No new environment variables.
- The exact InsForge storage bucket policy syntax is not fully documented anywhere in this repo yet, so it needs a quick check against the current InsForge skill or MCP tool at build time (see Follow-up).

## Follow-up

- [x] Confirmed at build time: `storage create-bucket --private` alone only fast paths anonymous rejection, it does not scope access per path. Explicit path scoped row level security on `storage.objects` was written and applied so a user can only touch objects under their own id; see Security model above and the applied migration
- [ ] Decide later whether agent_logs needs a retention or cleanup policy, none exists today and volume should stay small for a single user MVP, revisit if that changes
- [ ] If email ever becomes a lookup key beyond auth prefill, add a unique index on profiles.email at that time, not needed today
- [ ] jobs has no timestamp for when company research actually completed, only found_at (when the job was discovered). Feature 16 (Recent Activity) needs to show and sort "Researched [company], [time ago]" events, and context/build-plan.md's own wording for that feature already assumes a created_at style field on the research event that jobs does not have today. Resolve this when feature 13 (Company Research Agent) is spec'd, either by adding a company_research_completed_at column then, or by sourcing that activity entry from agent_logs.created_at instead of from jobs directly
