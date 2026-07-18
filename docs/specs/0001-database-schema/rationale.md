# Rationale: Database schema, row level security, and resume storage bucket

## Context

JobPilot has no data layer yet. Homepage, auth, and PostHog are built (features 01 through 03), but nothing has ever been written to InsForge's database, because the tables do not exist. Every feature from here on, profile saving, job discovery, company research, dashboard stats, needs somewhere real to read and write, and every one of those features was already designed in context/architecture.md against a specific set of columns. This spec's job is not to invent a new schema, it is to confirm the one already written down and get it actually created, with the access rules that keep one user's data away from another user's eyes.

This assumes InsForge Auth (feature 02) already provisions an auth.users table with a stable id per signed in user, since profiles.id references it directly. Auth is functionally working (OAuth login and session handling are built), even though context/progress-tracker.md still shows feature 02 as not fully checked off; that checkbox status does not block this schema from being created.

No regulated compliance scope applies here (no payments, no health data), but profiles does hold personal data (name, email, phone, location), so the account deletion question below is a light privacy consideration, not a formal compliance one.

## Options considered

### Option 1: One committed SQL migration file, applied through the InsForge CLI's migration workflow

Write a single SQL file with all four CREATE TABLE statements, foreign keys, indexes, and RLS policies, created with `npx @insforge/cli db migrations new` and applied with `npx @insforge/cli db migrations up --all`, the workflow the project's own installed insforge-cli skill documents for schema changes. Create the bucket with `npx @insforge/cli storage create-bucket`.

**Pros**:
- Versioned in git, so any future session or teammate can see exactly what schema exists and when it changed.
- No new dependency, uses the MCP tool the project's own AGENTS.md already points to for this exact job.

**Cons**:
- No automatic diffing. A future column change means writing and re-applying another SQL file by hand.

### Option 2: Create the tables manually through the InsForge dashboard

Click through InsForge's UI to add each table, column, and policy by hand.

**Pros**:
- No SQL to write, fastest for a single person working alone right now.

**Cons**:
- Leaves no record in git. A future session (or teammate) cannot see what was created or reason about it from the repository alone, which breaks this project's own rule of context files being the source of truth.

### Option 3: Add a schema and migration tool (for example Drizzle) to manage this in code

Install an ORM style migration tool, define the schema as TypeScript, and let the tool generate and apply migrations.

**Pros**:
- Type safe schema definitions, and automatic diffing for future changes.

**Cons**:
- Not on the approved dependency list in context/code-standards.md, and would be the project's first schema tool where today it has none. A new dependency for a four table schema that changes rarely is more machinery than the problem needs right now.

## Rationale

Option 1 wins because the project already names the right tool for this exact job (AGENTS.md's own guidance to use run-raw-sql and create-bucket for infrastructure), and because a committed SQL file is the only option of the three that leaves a readable trail in git. Option 2 is faster for one person today but fails this project's own standard of context files (and now the repo itself) being the source of truth; a future session reading this repo cold would have no way to know what schema exists. Option 3 solves a problem this project does not have yet, four tables that were fully designed once and will not change often, and it would add a dependency outside the approved list in context/code-standards.md for no clear present benefit.

The one real decision inside this spec that architecture.md left open is what happens on account deletion. The engineer chose cascade delete for profiles, agent_runs, and jobs, removing a user's data fully when their auth account is removed, rather than leaving orphaned rows behind. This matches ordinary privacy practice and keeps the schema simple, at the cost of that deletion being irreversible. agent_logs is the one exception: a log row is diagnostic history, not a user owned resource, so its job_id is set to null on job deletion instead of the whole log row disappearing, a log entry about a run can outlive the job it happened to mention.

## References

None. No new external tool is being evaluated in this decision, InsForge is already the project's backend end to end.
