-- Feature 1a: privileged subscriptions read. Adds a non-negative CHECK
-- constraint on research_runs_used so a bug in the usage increment path
-- (feature 3) cannot silently write a negative count that would make the
-- free tier cap ineffective.
-- See docs/specs/0016-privileged-subscriptions-read.md.

-- Guarded: an earlier session applied this constraint out of band (via
-- db query, not migrations up), so the remote migration history never
-- recorded this file as applied even though the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_research_runs_non_negative'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_research_runs_non_negative
      CHECK (research_runs_used >= 0);
  END IF;
END;
$$;
