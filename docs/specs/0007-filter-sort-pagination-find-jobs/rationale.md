# Rationale: Filter, sort, and pagination on the Find Jobs page

## Context

Feature 10 (spec 0006) built the real search, saved every result to the `jobs` table, and deliberately left the filter box, match dropdown, sort dropdown, and pagination footer as visually complete but functionally inert placeholders, exactly matching the follow up note in spec 0005 (feature 09), which specifically avoided building throwaway client side logic against invented semantics. That note also fixed the exact rules this feature must implement: All Matches / High Match (70 or above) / Low Match (below 70), sort by Match Score / Newest / Oldest, and 20 rows per page.

Two forces shape the design: first, the existing page already fetches the caller's `jobs` rows in exactly one shape (`insforge.database.from("jobs").select("*").order("found_at", { ascending: false })`), which spec 0006 explicitly asked this feature to reuse rather than duplicate. Second, that same page currently never shows a user's jobs unless they search again in the current browser tab, even though every prior search's rows are already sitting in the database, which is a real, user visible gap this feature is well placed to close at the same time, since it already has to reason about "what jobs does the table show and when."

## Options considered

### Option 1: Client side filter, sort, and pagination over one full fetch

Fetch the user's whole `jobs` list once (on page load, and again after a new search), hold it in React state, and compute the filtered, sorted, paged view as a pure function of that state and the current filter/sort/page selections.

**Pros**:
- Reuses the exact query path spec 0006 asked for, no new endpoint, no new query shape.
- Every filter, sort, or page interaction is instant, synchronous, no loading spinner, no extra round trip.
- Simple to test: the core logic is pure functions with no network, database, or React involved.

**Cons**:
- Downloads and holds the user's entire job history in the browser, even the 19 rows on pages the user never visits. Wasteful at a large row count.
- No natural place to add server side query optimizations (indexes doing real work, `LIMIT`/`OFFSET`) later without reworking the fetch, not just the display logic.

### Option 2: Server side query per filter, sort, and page change

Re-query InsForge on every filter keystroke, dropdown change, or page click, building the matching `WHERE`, `ORDER BY`, and `LIMIT`/`OFFSET` clauses (a PostgREST style query, since InsForge's database layer is PostgREST, matching what `agent/adzuna.ts` and the existing refetch already use).

**Pros**:
- Scales to any row count; the browser never holds more than one page's worth of rows.
- The natural place to eventually add a database index on `(user_id, match_score)` or `(user_id, found_at)` if query performance ever actually matters.

**Cons**:
- A real text filter box on every keystroke needs debouncing (waiting for the user to pause typing before firing a query) to avoid a query per character, plus a loading state per interaction, both new complexity this page has never had.
- Meaningfully more code for a page whose realistic row count (a handful of searches, 10 rows each) does not need it yet; this project's own team size and stage do not call for the extra operational surface of query building and per interaction loading states.

## Rationale

Option 1 wins on the forces that actually apply here: the realistic scale (at most a few hundred rows for even a heavy user, given feature 10's own accepted lack of rate limiting) does not justify the added interaction complexity of Option 2, and Option 1 is the option spec 0006's own follow up note was written for (basis: `docs/specs/0006-adzuna-job-discovery/index.md`'s Follow up section: "Feature 11 ... should reuse the same `insforge.database.from("jobs")` query path this feature introduces on the client"). If the accepted scale assumption stops holding (the Follow up item on rate limiting or organic growth), Option 2 is the documented fallback, not a redesign from zero.

The "load jobs automatically on page visit" half of the decision (AC-1, AC-2) was not a live option contest, it is a straightforward gap fix that the client side design makes nearly free: the fetch that already happens after a search just also needs to happen once on page mount, server side, using the exact same pattern `app/find-jobs/page.tsx` already uses for the `profiles` row.

## References

**Project sources** (verifiable, in this repo):
- `docs/specs/0006-adzuna-job-discovery/index.md`, the Follow up item asking this feature to reuse the existing query path
- `docs/specs/0005-find-jobs-page-ui/index.md`, the Context note defining this feature's exact filter/sort/pagination semantics
- `context/progress-tracker.md`, confirming this project's own `MATCH_THRESHOLD = 70` invariant, currently only implemented as a private constant in `agent/adzuna.ts`
