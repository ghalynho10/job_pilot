-- Feature 04: core tables (profiles, agent_runs, jobs, agent_logs), their row level
-- security policies, and the resumes storage bucket's path scoped access control.
-- See docs/specs/0001-database-schema/index.md for the full data model and rationale.

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  location text,
  current_title text,
  experience_level text,
  years_experience integer,
  skills text[],
  industries text[],
  work_experience jsonb,
  education jsonb,
  job_titles_seeking text[],
  remote_preference text,
  preferred_locations text[],
  salary_expectation text,
  cover_letter_tone text,
  linkedin_url text,
  portfolio_url text,
  work_authorization text,
  resume_pdf_url text,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  job_title_searched text,
  location_searched text,
  jobs_found integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX agent_runs_user_started_idx ON agent_runs (user_id, started_at DESC);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES agent_runs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('search', 'url')),
  source_url text,
  external_apply_url text,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  salary text,
  job_type text,
  about_role text,
  responsibilities text[],
  requirements text[],
  nice_to_have text[],
  benefits text[],
  about_company text,
  match_score integer,
  match_reason text,
  matched_skills text[],
  missing_skills text[],
  company_research jsonb,
  found_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_user_match_score_idx ON jobs (user_id, match_score);
CREATE INDEX jobs_user_found_at_idx ON jobs (user_id, found_at DESC);
CREATE INDEX jobs_run_id_idx ON jobs (run_id);

CREATE TABLE agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs (id) ON DELETE SET NULL,
  message text NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'success', 'warning', 'error')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_logs_user_created_idx ON agent_logs (user_id, created_at DESC);
CREATE INDEX agent_logs_run_id_idx ON agent_logs (run_id);

-- ============================================================================
-- updated_at maintenance (profiles is the only table with an updated_at column)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();

-- ============================================================================
-- Row level security: application tables (auth.uid() based, owner only)
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- profiles: select, insert, update only. No delete policy, a profile only
-- disappears through the auth.users cascade.
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- agent_runs: select, insert, update only. No delete, a run is history.
CREATE POLICY agent_runs_select ON agent_runs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY agent_runs_insert ON agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY agent_runs_update ON agent_runs
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON agent_runs TO authenticated;

-- jobs: select, insert, update only. No delete, dismissing a job is out of scope.
CREATE POLICY jobs_select ON jobs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY jobs_insert ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY jobs_update ON jobs
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON jobs TO authenticated;

-- agent_logs: select and insert only, append only history, never updated or deleted.
CREATE POLICY agent_logs_select ON agent_logs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY agent_logs_insert ON agent_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT ON agent_logs TO authenticated;

-- ============================================================================
-- Row level security: resumes storage bucket (path scoped, auth.jwt() based)
-- storage.objects is a managed table; its own product docs explicitly allow
-- policy changes here (see .claude/skills/insforge/storage/postgres-rls.md).
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Defensive: remove the platform's owner-only defaults if this project ever
-- had them auto-installed, so only the path scoped policies below apply.
DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;

CREATE POLICY storage_objects_resumes_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY storage_objects_resumes_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY storage_objects_resumes_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY storage_objects_resumes_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
