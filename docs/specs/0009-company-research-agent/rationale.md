# Rationale for 0009. Company research agent

## Context

Feature 12 shipped the job details page with the Company Research card intentionally left as a disabled empty state, because the browsing and dossier generation work was explicitly deferred to feature 13. `context/build-plan.md` already carries a detailed, previously agreed design for this feature: the exact Stagehand extraction schemas for the homepage and sub pages, the GPT-4o system prompt, the nine field dossier shape, and the `company_researched` PostHog event. This spec exists to record the remaining load bearing decisions that build plan leaves open — synchronous vs background execution, refresh behavior, and the missing research timestamp column — and to give feature 13 a spec file of its own, consistent with how features 1 through 12 are tracked.

Three design panels were left unanswered when this spec was drafted and were resolved using the recommended default for each, rather than blocking the build on further discovery:

1. Should the Research Company button block on the request, or kick off background work the user polls for?
2. Should a job that already has saved research offer a refresh action, or only display the saved dossier?
3. Is there a database gap that should be closed alongside this feature, given `docs/specs/0001-database-schema/index.md`'s own follow-up note about missing research timing?

## Options considered

### Panel 1: Synchronous button vs background job with polling

**Option A — Synchronous request/response (chosen)**: The button click calls `POST /api/agent/research` and awaits the full result; the UI shows a loading state for the duration, then reloads to show the saved dossier.

- **Pros**: No new job queue, status table, or polling endpoint. Matches the one-shot pattern already used by `POST /api/agent/find` for job search. Simple to test and to verify against.
- **Cons**: The user waits through the full Browserbase session plus GPT-4o call in one request. Slow or unreachable company sites make the wait longer, bounded by the fallback path rather than cut short.

**Option B — Background job with client polling**: The route enqueues research and returns immediately; the client polls a status endpoint until the dossier is ready.

- **Pros**: Better perceived responsiveness; the user is not blocked on one long request.
- **Cons**: Requires a job/status model that does not exist anywhere else in this project (`agent_runs` is the closest precedent, built for job search, not company research). Adds a new endpoint, new status states, and new failure surfaces for a first slice. No product signal yet that research is slow enough in practice to justify that cost.

**Decision**: Option A, per the plan's recommended assumption. Revisit if real usage shows the synchronous wait is a problem.

### Panel 2: Refresh action vs saved-dossier-only

**Option A — Saved dossier only, no refresh (chosen)**: Once `company_research` is set, the card always renders the saved dossier. No button, no re-research path, in this slice.

- **Pros**: Smallest UI surface for the first slice. Avoids deciding staleness rules, re-research cost, or confirmation UX before there is a real need.
- **Cons**: A bad or stale dossier can only be fixed by direct database intervention until a refresh action ships later.

**Option B — Refresh button available**: The card always shows a way to re-run research, even when a dossier exists.

- **Pros**: User control over staleness immediately.
- **Cons**: Introduces overwrite semantics (is the old dossier discarded immediately, or only on success?) and a second interaction state that the build plan's UI section does not describe. Adds scope not requested by the source design.

**Decision**: Option A, per the plan's recommended assumption. Recorded as follow-up work once this slice is live.

### Panel 3: Add `company_research_completed_at` now vs defer to the dashboard feature

**Option A — Add the column now (chosen)**: Add `jobs.company_research_completed_at timestamptz`, written only alongside a successful `company_research` write.

- **Pros**: Closes the exact gap `docs/specs/0001-database-schema/index.md` already flagged: `context/build-plan.md`'s Recent Activity feature (16) assumes a research-completed timestamp that does not exist on `jobs` today. Adding it while building the feature that produces the write is the natural point to do it — the alternative is retrofitting a migration once feature 16 discovers the gap.
- **Cons**: One more nullable column on `jobs` before the feature that consumes it (dashboard activity) is built.

**Option B — Defer, and let feature 16 source research timing from `agent_logs` or `found_at` instead**: Leave `jobs` as-is; the dashboard feature works around the missing column later.

- **Pros**: No schema change in this feature.
- **Cons**: `found_at` measures job discovery, not research completion, so it is not a correct substitute. Sourcing from `agent_logs` would require every research completion to also write a log row, which the current design does not otherwise need. This just moves the same decision one feature later, at higher cost, since feature 13 is precisely where the successful-write moment already exists.

**Decision**: Option A, per the plan's recommended assumption and per `docs/specs/0001-database-schema/index.md`'s own suggestion to resolve this exact question when feature 13 is spec'd.

## Rationale

All three panels favor the smallest slice that still leaves the door open for the deferred behavior (background execution, refresh, richer activity queries) without inventing UI or schema the current design does not call for. The synchronous button and saved-dossier-only choices keep this feature's surface area matched to what `context/build-plan.md` already describes; the new timestamp column is the one piece of schema this feature is uniquely positioned to add cheaply, because it is the feature that performs the write the column is meant to record.
