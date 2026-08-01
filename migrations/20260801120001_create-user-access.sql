-- Feature 0: portfolio private access gate. One row per user recording whether
-- that account may use the paid parts of the app. Read by lib/access.ts and
-- written by nobody: only the project owner grants access, through admin SQL.
-- See docs/specs/0012-portfolio-private-access-gate/index.md.

-- ============================================================================
-- Table
-- ============================================================================

-- user_id references auth.users rather than profiles on purpose: access is an
-- account fact, not a profile fact, so it must survive a user who has signed in
-- but never filled in a profile.
CREATE TABLE user_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Row level security: select own row, and nothing else, ever
-- ============================================================================

ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_access_select ON user_access
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No insert, update, or delete policy exists, and that omission is the whole
-- point of this table. Approval lives here rather than on profiles because
-- profiles carries profiles_update, which lets a user update their own row, so
-- an approval flag there would be self grantable straight through PostgREST.
--
-- The REVOKE below is load bearing and must not be removed. InsForge grants
-- broad data privileges on public tables to anon and authenticated by default,
-- so leaving the write grants unwritten does NOT leave the user without them.
-- Row level security would still deny the write (no policy permits it), but the
-- privilege layer is the intended second line of defence, and it only exists if
-- the broad default is explicitly taken away first.
--
-- Every other table in this project grants broadly and leans on row level
-- security alone. user_access is the first one where the narrower surface is
-- deliberate, so a later migration must not undo it with a blanket grant.
REVOKE ALL ON user_access FROM anon, authenticated;
GRANT SELECT ON user_access TO authenticated;
