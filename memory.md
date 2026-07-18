# Memory — Phase 1 Foundation Complete (04 Database Schema + 02 Auth verified)

Last updated: 2026-07-18 18:10 UTC

## What was built

- `docs/specs/0001-database-schema/index.md`, `rationale.md`, `verify.md`: feature 04's build spec, decision record, and verify checklist. Status: Accepted (fully done).
- `migrations/20260718170543_create-core-tables.sql`: applied migration creating `profiles`, `agent_runs`, `jobs`, `agent_logs`, with CHECK constraints, composite indexes, an `updated_at` trigger on `profiles`, row level security on all four tables (`auth.uid()`), and path scoped row level security on the managed `storage.objects` table for the `resumes` bucket (`auth.jwt() ->> 'sub'`).
- InsForge CLI and skills (`insforge`, `insforge-cli`, `insforge-debug`, `insforge-integrations`, `find-skills`) installed and this repo linked to the InsForge project `JSM_JobPilot`. `AGENTS.md` now has an `<!-- INSFORGE:START -->` section.
- `tests/posthog-contract.test.mjs` extended with 4 tests locking in this session's PostHog event cleanup (auth callback and dashboard/OAuth components no longer capture unapproved events, Navbar still resets identity on sign out, the server client is named `createPostHogServer`).
- `context/progress-tracker.md`: Phase 1 (Homepage, Auth, PostHog, Database Schema) is now fully checked off.

## Decisions made

- Schema is created and versioned through the InsForge CLI's own migration workflow (`db migrations new` / `db migrations up --all`), not a manual dashboard or a new ORM.
- Account deletion cascades fully through profiles, agent_runs, and jobs. `agent_logs.job_id` is set to null (not cascaded) when a job is deleted, so a log entry can outlive the job it mentioned. No feature in the build plan ever deletes an auth user; only an administrative action does.
- Storage access control uses InsForge's path scoped RLS pattern on `storage.objects` (bucket plus the object key's first folder segment must equal the caller's JWT `sub`), not just the bucket's private and public flag, which only gates anonymous access.
- Feature 02 (Auth) has no formal `/architect` spec; it predates that workflow in this project. `context/build-plan.md`'s stated requirements served as the verify checklist instead.

## Problems solved

- The real InsForge schema mechanism (confirmed by installing and reading the `insforge-cli` skill) is `db migrations new` / `db migrations up --all`, not the generic "run-raw-sql" wording in the top level docs.
- Storage bucket privacy (`--private`) only fast paths anonymous rejection; real per user path isolation needed explicit `storage.objects` policies, found in the `insforge` skill's `storage/postgres-rls.md`, which also revealed storage policies key off `auth.jwt() ->> 'sub'`, not `auth.uid()` like application tables.
- Proving RLS behaviorally (not just that policies exist) needed two real signed in sessions. This project requires email verification with no test inbox available. Solved by briefly toggling `requireEmailVerification` off via the InsForge auth config admin endpoint, running the full cross user and cascade test with two throwaway accounts, then restoring the setting and deleting both accounts plus their storage objects and confirming the restore.
- Verifying 02 Auth without a browser automation tool: the login page's React 19 server action forms are progressively enhanced plain HTML forms (`$ACTION_ID_...` hidden field, POST, multipart form data), so clicking each OAuth button was reproduced with a direct `curl` POST. This proved real redirects to `accounts.google.com` and `github.com` with correct client ids, scopes, and PKCE cookies, without needing a browser.
- Found and left alone: a dev server was already running on port 3000 from an earlier session (the user's own). A redundant duplicate this run spawned on port 3001 was killed; the original was untouched.

## Current state

- Phase 1 (Foundation) is fully done: 01 Homepage, 02 Auth, 03 PostHog Initialization, 04 Database Schema all checked off in `context/progress-tracker.md`.
- Feature 04: spec Accepted, `/check verify` and `/test` both passed with real evidence (cross user RLS isolation, account deletion cascade, job deletion leaving a log with `job_id` null, all proven against the live database with real throwaway accounts).
- Feature 02: verified as far as possible without a browser automation tool or real third party test credentials. Confirmed for real: login page renders both providers, both OAuth buttons redirect to the real provider authorize URL with correct parameters, the PKCE cookie is set correctly, all four private routes are middleware protected, and the callback fails closed (no crash, nothing leaked) on missing, fake, or tampered credentials. Not verified: an actual third party login completing end to end and landing on `/dashboard`. Checked off on that basis.
- Three non blocking Follow-up items remain in the feature 04 spec: whether `agent_logs` needs a retention policy, whether `profiles.email` needs a unique index later, and a schema gap for feature 16 (no timestamp yet for when company research completes, to resolve when feature 13 is spec'd).
- Noticed but not fixed: `.env.local` still has the old `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` variable name rather than the current `NEXT_PUBLIC_POSTHOG_KEY` the code now reads. Local PostHog capture may be silently no-op-ing until that's renamed.

## Next session starts with

Start feature 05, Profile Page, Full UI (mock data, no save logic yet, per `context/build-plan.md`). Before that, consider fixing the `.env.local` PostHog key name mismatch noted above so local analytics actually fire.

## Open questions

- When feature 13 (Company Research Agent) is spec'd, decide whether to add a `company_research_completed_at` column to `jobs` or source feature 16's activity feed from `agent_logs.created_at` instead.
- Whether to ever complete a real, human driven Google or GitHub login to close the one remaining gap in feature 02's verification.
