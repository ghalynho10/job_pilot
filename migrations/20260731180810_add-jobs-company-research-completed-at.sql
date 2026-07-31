-- Feature 13: Company Research Agent.
-- Adds a research-completed timestamp to jobs, written only alongside a
-- successful company_research write, so dashboard activity can query
-- research timing without depending on found_at (job discovery time).
-- See docs/specs/0009-company-research-agent/index.md.

ALTER TABLE jobs
  ADD COLUMN company_research_completed_at timestamptz;
