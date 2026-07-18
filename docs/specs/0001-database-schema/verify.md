# Verify: 04 Database Schema · spec 0001 · updated 2026-07-18

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands (structural, run at build time)

- [x] `npx @insforge/cli db query "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('profiles','agent_runs','jobs','agent_logs') ORDER BY table_name, ordinal_position"` → all 62 documented columns present with the documented types and nullability → AC-1
- [x] `npx @insforge/cli db query "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('profiles','agent_runs','jobs','agent_logs','objects')"` → `relrowsecurity = true` on all five → AC-2, AC-3
- [x] `npx @insforge/cli db query "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public'"` → 11 policies present → AC-2
- [x] `npx @insforge/cli db query "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects'"` → 4 path scoped policies present → AC-3
- [x] Foreign key and check constraint query → all cascade/set null rules and all three check constraints confirmed present → AC-1, AC-4
- [x] `npx @insforge/cli db migrations list` (implicit in the successful `up --all` apply) → `20260718170543_create-core-tables.sql` applied → AC-5

## Behavioral, run 2026-07-18 via `/check verify` with two real throwaway signed in sessions

Method: created two real InsForge auth users (`verify-test-a-*@example.com`, `verify-test-b-*@example.com`) via `POST /api/auth/users?client_type=server`, obtained real access tokens, exercised the database and storage REST APIs as each user, then deleted both accounts and all their objects. `requireEmailVerification` was briefly toggled off to allow immediate sessions with no inbox access, then restored to `true` immediately after (confirmed restored).

- [x] A inserts own `profiles`, `agent_runs`, `jobs`, `agent_logs` rows (each scoped to her own id) → all `201` → AC-2
- [x] A cannot insert a `profiles` row claiming B's id → `403`, `"new row violates row-level security policy for table \"profiles\""` → AC-2
- [x] A selects `jobs` → sees only her own row (1 row, `user_id` matches A) → AC-2, AC-6
- [x] A attempts to insert a `jobs` row with `user_id` set to B's id → `403`, `"new row violates row-level security policy for table \"jobs\""` → AC-2, AC-6
- [x] A attempts to update B's `jobs` row → `200` with zero rows affected (`with check`/`using` clause silently excludes it, PostgREST returns an empty array rather than an error) → AC-2, AC-6
- [x] A uploads to `resumes/<A's id>/resume.pdf` → `201`. B uploads to `resumes/<B's id>/resume.pdf` → `201` → AC-3
- [x] A attempts to overwrite `resumes/<B's id>/resume.pdf` → `403`, `"new row violates row-level security policy for table \"objects\""` → AC-3
- [x] A attempts to read `resumes/<B's id>/resume.pdf` (a file that genuinely exists) → `404` → AC-3
- [x] Unauthenticated (anon key) request to `jobs` → `200` with zero rows (RLS grants nothing to `anon`, default deny) → AC-2, AC-3
- [x] Admin deletes A's `jobs` row directly → the `agent_logs` row that referenced it still exists afterward, with `job_id` now `null` → AC-4
- [x] Admin deletes auth user B → B's `profiles` and `jobs` rows are both gone (0 remaining) → AC-4
- [x] Cleanup: both throwaway auth users deleted, all four tables confirmed empty (`count = 0`), the two throwaway storage objects deleted, `requireEmailVerification` confirmed restored to `true`

## Acceptance-criteria coverage

- AC-1: met, structural column/type/nullability check
- AC-2: met, RLS enabled + policies present (structural) and real cross user select/insert/update isolation (behavioral, both directions: forged writes rejected, own writes allowed)
- AC-3: met, storage RLS enabled + path scoped policies present (structural) and real cross user storage read/write isolation (behavioral)
- AC-4: met, FK cascade/set null rules present (structural) and both real behaviors proven: a deleted job leaves its log row intact with `job_id` null, and a deleted auth user cascades through profiles and jobs
- AC-5: met, migration applied and confirmed live
- AC-6: met, covered by the same cross user checks as AC-2/AC-3
