-- agent/adzuna.ts inserts one jobs row per Adzuna search result with no dedupe
-- across separate searches, so repeating the same search re-inserts jobs the
-- user already has. Adds Adzuna's own job id so a search can skip rows it has
-- already saved for this user. Nullable: existing rows and any future
-- non-Adzuna ("url") sourced job never have one.
-- A unique index (not a plain index) makes the guarantee real even under a
-- race between two concurrent searches for the same user, not just when the
-- app remembers to check first; partial (WHERE external_id IS NOT NULL) so
-- multiple NULLs (every pre-migration row) don't collide with each other.

ALTER TABLE jobs
  ADD COLUMN external_id text;

CREATE UNIQUE INDEX jobs_user_id_external_id_key
  ON jobs (user_id, external_id)
  WHERE external_id IS NOT NULL;
