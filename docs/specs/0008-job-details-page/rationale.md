# Rationale for 0008. Job details page

## Context

Feature 12 is the first saved job detail screen. Features 10 and 11 already created real job search, scoring, saved job rows, list filtering, sorting, and pagination. The next user problem is review: after finding a promising role, the user needs one focused page that shows the role, why it matches, what skills are covered or missing, and how to apply.

The project already planned `/find-jobs/[id]` as an auth protected route and the `jobs` table already contains the fields needed for this slice. The detail page should not create a second data source or call Adzuna again. It should read the saved row the user already owns and show that row clearly.

The screenshot in `context/designs/job-details.png` is the visual source of truth for this feature. It shows company research as a call to action plus empty state, not a completed dossier. Feature 13 owns the browsing agent and the saved research result, so feature 12 must avoid faking that content or wiring a partial research action.

One important existing risk surfaced during discovery: the current `/find-jobs` page fetches `jobs` ordered by `found_at` without an explicit `.eq("user_id", data.user.id)` filter. Row level security should still protect the data, but the app convention in `context/architecture.md` and `context/library-docs.md` says every user scoped query should explicitly filter by the current user. Feature 12 should fix that read path while adding the detail route.

## Options considered

### Option 1: Server rendered route over the saved row

Create `/find-jobs/[id]` as a Server Component route. It authenticates the user, queries one `jobs` row by `id` and `user_id`, and renders the detail UI from that row.

**Pros**:
- Smallest moving parts. No new API route, no duplicate client fetch, no extra state management.
- Keeps private data on the server render path and follows the project's existing authenticated page pattern.
- Directly matches the saved job data model already established by prior specs.

**Cons**:
- Client side interactions on the page stay limited. Any future research action will need a client component boundary.

### Option 2: Client rendered detail page with an API route

Create `/find-jobs/[id]` as a client page that calls a new `GET /api/jobs/[id]` endpoint. The endpoint owns auth and row lookup.

**Pros**:
- Sets up a reusable API surface that could later serve live refreshes or richer client interactions.
- Keeps page rendering logic separate from the data access route.

**Cons**:
- Adds an endpoint before the product needs one.
- Duplicates auth and error response behavior that the existing server page pattern already handles.
- Introduces loading and error states that are unnecessary for the first render.

### Option 3: Pass selected job data from the list page into a client detail view

Keep all job data in the Find Jobs client state and navigate to a client side detail surface using the row already loaded in the table.

**Pros**:
- Very fast when navigating from the list because the row is already in memory.
- Avoids one extra database read after clicking a row.

**Cons**:
- Direct visits, refreshes, and shared URLs break unless a second fallback fetch is added.
- Risks showing stale or incomplete data if the list row shape stays narrower than the detail row shape.
- Makes ownership checks depend on the list page path rather than the detail route itself.

## Rationale

Option 1 is the right fit. This is a private saved data page in a Next app that already defaults to server components and server side InsForge reads for protected pages. Reading one scoped row on the server is simpler, safer, and easier to verify than adding an API route or relying on client state.

Option 2 would become attractive if multiple clients needed the same job detail payload, or if the page required live refresh before render. Neither is true for feature 12. Option 3 optimizes away one database read at the cost of breaking the normal web expectation that a detail URL can be opened directly. That is the wrong tradeoff for a route the project overview already names as `/find-jobs/[id]`.

The company research split is deliberate. The UI should show the user's next action, because that is visible in the design, but it should not start background browser work or render guessed research. Keeping the empty state in feature 12 gives feature 13 a clean place to attach the real Stagehand flow.

The detail page also needs a few small guardrails because saved jobs contain third party text and links. External links are only usable when they parse as `http:` or `https:`, and job descriptions render as text, never injected HTML. Invalid route ids and inaccessible rows return not found, while unexpected database errors should remain real errors so they can be noticed and fixed.
