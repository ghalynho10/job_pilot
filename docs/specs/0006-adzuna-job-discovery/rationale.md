# 0006. Adzuna job discovery, rationale

## Context

Feature 09 shipped the Find Jobs page as a fully static shell: the search form does not read its own inputs, and the button just reveals six fixed sample rows from `lib/mock-jobs.ts`. That was deliberate, feature 09's own spec scoped it to the visual layer only, and named this feature, Adzuna job discovery, as the one that would make the search real.

The shape of this feature is already unusually well documented before any design conversation happened: `context/build-plan.md` lays out the exact request flow (call Adzuna, score with GPT-4o, save every result, update the run record), `context/architecture.md` gives the concrete file map and the exact Adzuna query parameters, and `context/library-docs.md` gives the exact fetch call and the exact mapping from an Adzuna result to a `jobs` row. This is closer to formalizing an already settled design than inventing one from a blank page, so this spec's job is mostly reconciliation (the two documents disagree slightly on one Adzuna parameter, `category=it-jobs`, resolved below) and closing three real gaps those documents left open: how to detect a country from free text, what to do when there is no structured place to log an agent error, and how the page should get the freshly saved jobs back onto the screen.

The two existing tables this feature writes to, `agent_runs` and `jobs`, already exist with every column this feature needs; no new migration is part of this decision. The forces at play are mostly about keeping this feature's surface area small: it should not silently absorb work that belongs to feature 11 (filtering, sorting, pagination is explicitly out of scope here), and it should not invent infrastructure (a new error log table, a geocoding service) the rest of the codebase does not already have a reason to need.

## Options considered

### Option 1: One request, then a client side refetch (recommended)

The search endpoint runs the whole search and save, then returns only a short summary (how many jobs were found, how many were strong matches). The page then asks the database directly for the saved rows and renders those.

**Pros**:
- The endpoint stays focused on one job, run the search and save the results, rather than also having to shape a response that matches exactly what the table displays.
- The follow up read is the same kind of query feature 11 (filter, sort, pagination) will need to write anyway, so this feature builds a small piece of that path instead of a one off shape that gets thrown away.

**Cons**:
- Two network round trips instead of one, a small extra delay before the table appears.

### Option 2: One request, jobs included in the response

The search endpoint returns the full saved job rows directly in its response, so the page can render immediately with no second call.

**Pros**:
- Only one round trip, slightly faster to first render.

**Cons**:
- Ties the endpoint's response shape to exactly what the table needs to show today, so the two have to be kept in sync whenever the table's display needs change.
- Feature 11 still has to write its own database query for filtering, sorting, and pagination later, so this response shape is not reused, it is thrown away once the real query exists.

### Option 3: Poll for job completion

The endpoint kicks off the search in the background and returns right away; the page polls a status endpoint until the run finishes.

**Pros**:
- Would let the search run past a typical request timeout if it ever grew slow.

**Cons**:
- Adds a polling loop, a status endpoint, and more states to the page for a search that normally finishes in a few seconds (ten jobs, one GPT-4o call each); this is complexity the current scale does not call for.

## Rationale

The engineer confirmed the choice directly: since feature 11 will need a real database query against the `jobs` table for filtering, sorting, and pagination regardless, building the client side refetch now means this feature contributes toward that path instead of producing a response shape that would only be thrown away later. Polling (option 3) solves a problem this feature does not have, a single Adzuna search plus up to ten GPT-4o scoring calls finishes well inside a normal request timeout, so there is no need for a background job and a status endpoint.

Two smaller decisions were also settled directly with the engineer this session, both recorded as invariants and consequences in `index.md` rather than as their own options list, since each had one clearly right answer for this project's current stage rather than a genuine tradeoff:

- **Error logging**: `context/library-docs.md`'s Stagehand section references a `logAgentError` helper and, by implication, an `agent_logs` table, but neither exists anywhere in the repository, only the reference does. Building that table and helper now would be scope creep for a feature that does not otherwise need it; every existing agent file (`agent/resume-generator.ts`, `agent/resume-extractor.ts`) logs failures with a plain `console.error`, so this feature follows the same convention until a feature that actually needs structured agent error history (most likely the Stagehand company research feature) is the one to introduce it.
- **Country detection**: Adzuna's endpoint takes a country code, but the location field is free text. `context/library-docs.md` says to support `gb`, `au`, `ca` as alternatives without specifying how to detect them. A full geocoding integration is disproportionate to a feature whose location field is optional and, most of the time, will be a US city or left blank; a short, explicit keyword list keeps the behavior easy to read and easy to extend later, and anything unmatched safely defaults to `us`.

One parameter conflict between the two source documents needed resolving: `context/build-plan.md`'s Adzuna call listing omits `category=it-jobs`, while `context/architecture.md` states explicitly, "Adzuna API always includes `category=it-jobs`, never search without this filter." Architecture.md is the more detailed and more explicit of the two on this exact point, and `context/project-overview.md` independently confirms the product intent ("searches by title and location, category filtered to IT jobs"), so `category=it-jobs` is treated as a required parameter, not an omission to preserve.
