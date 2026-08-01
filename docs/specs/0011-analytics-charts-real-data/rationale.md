## Context

Feature 14 (`docs/specs/0010-dashboard-page-ui`) built all three chart components against mock data and explicitly deferred real data wiring to feature 17. `context/build-plan.md` originally described feature 17 as querying PostHog for `job_found` and `company_researched` events, since PostHog is where this project's analytics events are captured (`lib/posthog-server.ts`, `lib/posthog-client.ts`).

Two things change that plan. First, `.env.local` only holds `NEXT_PUBLIC_POSTHOG_KEY`, the client side capture key; reading data back out of PostHog needs a separate personal API key and project ID, neither of which exist yet, plus a query pattern (HogQL or the Trends API) this project has never used and `context/library-docs.md` never documents (its PostHog section only covers `posthog.capture()`, never a read). Second, the `jobs` table already carries everything these three charts need: `found_at` and `match_score` were always there, and `company_research_completed_at` (a nullable timestamptz, set by `app/api/agent/research/route.ts` when research finishes) was added for feature 16's Recent Activity card and already sits in the exact same per user query `app/dashboard/page.tsx` runs for the stat cards.

The forces at play: avoid provisioning a new credential and a brand new, undocumented query surface for data the app's own database already has; keep this page's one existing per user `jobs` select as the single source, consistent with every other query in this project (`library-docs.md`'s DB Queries section: always scope to `user_id`, always use `insforge.database.from()`); and keep PostHog doing exactly what it already does well, event capture, without turning it into a second system of record for numbers the database can answer more directly and more cheaply.

## Options considered

### Option 1: Query InsForge (Postgres) directly

Compute all three charts server side in `app/dashboard/page.tsx` from the `jobs` rows already fetched for the stat cards, extended with one more selected column.

**Pros**:
- Every column needed (`found_at`, `match_score`, `company_research_completed_at`) already exists and is already fetched in this exact page, scoped to `user_id` the same way every other query in this project is.
- No new secret, no new query pattern, no new network round trip; the compute functions are plain, easily unit tested TypeScript, matching the `lib/dashboard-stats.ts` / `lib/dashboard-activity.ts` pattern features 15 and 16 already established.
- The database is always exactly consistent with what a user actually did; there is no dependency on an analytics event having successfully reached PostHog.

**Cons**:
- Diverges from `context/build-plan.md`'s original wording ("query PostHog for job_found events"), which this spec supersedes for feature 17.

### Option 2: Query the PostHog Query API for all three charts

Read `job_found` and `company_researched` events back from PostHog using its HogQL/Trends query endpoint, matching the original build plan literally.

**Pros**:
- Matches the original build plan's wording exactly.
- If this project ever wants a general purpose analytics/BI surface beyond these three charts, the query pattern would already exist.

**Cons**:
- Needs a new `POSTHOG_PERSONAL_API_KEY` and project ID provisioned and kept secret; not currently configured anywhere in this project.
- No existing skill, MCP server, or `library-docs.md` pattern covers reading PostHog data back out; this would be new, undocumented ground for the project.
- An extra network round trip to PostHog on every dashboard load, for data the app's own database already has.
- Introduces a second source of truth: if a `job_found` or `company_researched` capture call ever silently failed (network blip, ad blocker on the client capture path), the chart would under report relative to what actually happened in the database.

### Option 3: Hybrid, Postgres for two charts, PostHog for Company Research Activity

Use `jobs.found_at` / `jobs.match_score` directly, but query PostHog's `company_researched` events for the third chart only, on the assumption the database has no timestamp for research completion.

**Pros**:
- Would avoid a new DB column, if one had actually been needed.

**Cons**:
- Moot: `jobs.company_research_completed_at` already exists (added for feature 16), so there is nothing left for PostHog to uniquely provide here.
- Leaves three sibling charts on two different data fetch mechanisms for no remaining benefit, plus still needs the new PostHog secret for one of them.

## Rationale

Option 1 wins on every force from Context: the columns already exist, are already fetched on this exact page, and are already scoped to `user_id` the same way every other query in this project is written. Option 2 would spend a new secret and an undocumented query surface to re-derive numbers the database already has more reliably (an event capture failure would silently under report a chart, where a DB row cannot go missing the same way). Option 3 was only worth considering under the assumption the database lacked a research timestamp; once `company_research_completed_at` turned out to already exist (added for feature 16), the hybrid's one advantage disappeared and it became strictly worse than Option 1, two data fetch mechanisms for the same three sibling charts, with no upside left. `context/build-plan.md`'s original PostHog wording is superseded by this decision (tracked in `## Follow-up`).
