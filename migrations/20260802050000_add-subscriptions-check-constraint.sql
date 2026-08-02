-- Feature 1a: privileged subscriptions read. Adds a non-negative CHECK
-- constraint on research_runs_used so a bug in the usage increment path
-- (feature 3) cannot silently write a negative count that would make the
-- free tier cap ineffective.
-- See docs/specs/0016-privileged-subscriptions-read.md.

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_research_runs_non_negative
  CHECK (research_runs_used >= 0);
