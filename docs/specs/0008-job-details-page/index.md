# 0008. Job details page

**Date**: 2026-07-31
**Status**: Accepted

## Summary

This decision builds feature 12, the real job details page for a saved job. It uses the existing `jobs` table, scoped to the signed in user, and renders the page shown in `context/designs/job-details.png`. Company research stays as an empty state in this feature, because the browsing and dossier generation work belongs to feature 13.

## Requirements

**User stories**:
- As a job seeker, I want to open a saved job from Find Jobs so that I can review the full role, match reasoning, skills fit, and apply link in one place.
- As a job seeker, I want the details page to use my saved job data so that what I see matches the job search results already stored for me.
- As a job seeker, I want company research to be clearly available but not faked so that I know the next action without seeing placeholder dossier content.

**Acceptance criteria**:
- **AC-1**: `/find-jobs/[id]` exists as an authenticated route. A signed out visitor is redirected to `/login?error=session`; a signed in visitor can only load a job row whose `user_id` matches their user id.
- **AC-2**: A missing job id, malformed id, or a job owned by another user returns the app's not found state. It must not reveal whether another user's job exists.
- **AC-3**: The Find Jobs table provides a keyboard accessible path to the details page for each visible row, preserving the existing table layout, filters, sorting, and pagination behavior.
- **AC-4**: The details page header matches `context/designs/job-details.png`: Back to Jobs link, company icon placeholder, title, company, match score badge, and View Job Post button linking to a safe external job url resolved from `external_apply_url` first, then `source_url` if no external apply url exists.
- **AC-5**: The info card row renders the real saved values for Salary Est., Location, Job Type, and Date Found, with stable fallbacks for missing nullable values. The layout stacks cleanly on mobile without overlap or text clipping.
- **AC-6**: The AI Match Reasoning card renders `match_reason` from the saved job row. If `match_reason` is null, it shows a short unavailable state rather than an empty card.
- **AC-7**: The Required Skills vs Your Profile card renders `matched_skills` as positive badges and `missing_skills` as gap badges, using project tokens for success and warning or accent states. Empty arrays or null values render a clear empty state for that group, with no empty headings followed by blank space.
- **AC-8**: The Job Description card renders the saved Adzuna description content from `about_role` as plain text. If any structured detail fields already exist on the row (`responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`), the page may render them as additional sections only when non empty and well typed; it must not invent content or render malformed legacy values.
- **AC-9**: The Company Research card matches the screenshot for feature 12: it shows the Research Company button and the empty state. The button is disabled with accessible disabled semantics and does not call a research API, start a Stagehand session, mutate the database, or render a dossier in this feature.
- **AC-10**: The bottom Apply Now button opens the same safe external job url as View Job Post in a new tab when a url exists. A safe external job url must parse as `http:` or `https:`. If no safe url exists, both external actions render an unavailable state instead of a broken link.
- **AC-11**: The page uses the project's existing Navbar, auth shell, spacing, card, typography, tokenized colors, icons, and focus visible rules. No raw hex colors or raw Tailwind color classes are introduced.
- **AC-12**: Verification proves the page with real saved data at desktop and mobile widths, including screenshots against `context/designs/job-details.png`, plus command checks for tests, typecheck, and build.

## Decision

**Chosen option**: Server rendered detail route over the existing `jobs` row

Build `/find-jobs/[id]` as a Server Component route that authenticates the user, reads one scoped job row from InsForge, and passes it into focused job details UI components. The Find Jobs list links to this route, and all displayed content comes from the saved row.

**Implementation skills**: `architect` (`project-local`, `.agents/skills/architect/`) · `tailwind` (`project-local`, `.agents/skills/tailwind-css/`)

## Feature design

**Data model sketch**:

No migration is required. The feature reads the existing `jobs` table.

| Field | Requirement for this feature |
|---|---|
| `id` | Required route param, UUID stored by InsForge |
| `user_id` | Required ownership filter, must match the signed in user |
| `title`, `company` | Required header fields |
| `location`, `salary`, `job_type` | Nullable info card fields |
| `source_url`, `external_apply_url` | Nullable string external links, resolve `external_apply_url` first, use only parsed `http:` or `https:` urls |
| `about_role` | Nullable job description text |
| `responsibilities`, `requirements`, `nice_to_have`, `benefits` | Nullable string arrays if present in the saved schema. Render only arrays whose entries are non empty strings |
| `about_company` | Nullable string if present in the saved schema. Render only when it is a non empty string |
| `match_score`, `match_reason`, `matched_skills`, `missing_skills` | Nullable match display fields |
| `company_research` | Nullable future dossier object. Type as `Record<string, unknown> | null` or a named object type if the repo already defines one, but do not use `any`. Do not render it as a dossier in feature 12 |
| `found_at` | Required timestamp rendered as Date Found using the app's normal locale date behavior |

`types/index.ts` should be extended so `JobRow` covers every `jobs` field the detail page reads. Do not use `any` or untyped JSON shapes for `company_research`.

**State transitions**: Not applicable. This feature has no persisted state transition and writes no data.

**API surface**:

No new route handler. The page uses the existing server InsForge client.

| Call | Where | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createInsforgeServer().auth.getCurrentUser()` | `app/find-jobs/[id]/page.tsx` | session cookie | current user | session cookie | redirect to `/login?error=session` |
| `insforge.database.from("jobs").select("*").eq("id", id).eq("user_id", user.id).maybeSingle()` | `app/find-jobs/[id]/page.tsx` | validated UUID job id, user id | one `JobRow` or null | signed in user only | not found for invalid UUID, null result, or cross user result; throw for unexpected database errors so the app error boundary handles them |

**Key invariants**:
- Every job details read is scoped by both a validated UUID `id` and `user_id`.
- The page never fetches all jobs to find one job.
- External job links use a single resolver: `external_apply_url ?? source_url`, parsed through `URL`, and accepted only for `http:` or `https:`.
- External links that open in a new tab include `target="_blank"` and `rel="noopener noreferrer"`.
- `about_role` renders as text content, never injected HTML.
- Missing nullable fields get deliberate UI fallbacks. They never render raw `null`, `undefined`, `NaN`, or an empty card.
- Company research is visibly available as the next action, but no research content or research behavior ships in this feature.
- All styling uses tokens from `context/ui-tokens.md` and patterns from `context/ui-registry.md`.

**Security model**:

The route is private to the signed in user. A user can read only their own saved job rows. Cross user access and missing rows both use `notFound()` so ownership details are not leaked. The feature adds no write path, no public endpoint, no new secret, and no new compliance scope.

**Configuration required**: None. No new environment variables, secrets, credentials, or third party services are needed.

**Critical test scenarios**:
- Happy path: a signed in user opens a saved job from `/find-jobs`, lands on `/find-jobs/[id]`, sees real header, info cards, match reasoning, skills, description, company research empty state, and apply actions, verifies **AC-3** through **AC-11**.
- Failure case: a signed in user requests an invalid UUID or an id that does not map to one of their jobs and receives not found, verifies **AC-2**.
- Failure case: InsForge returns an unexpected database error and the route throws to the app error boundary rather than disguising it as not found, verifies **AC-2**.
- Edge case: a job row with null salary, location, job type, score, reason, skills, and external urls still renders clean fallbacks and no broken links, verifies **AC-5**, **AC-6**, **AC-7**, **AC-10**, **AC-11**.
- Auth/permission: a signed out visitor to `/find-jobs/[id]` redirects to `/login?error=session`, verifies **AC-1**.
- Visual check: desktop and mobile screenshots line up with `context/designs/job-details.png` in structure, spacing, and tokenized styling, verifies **AC-4**, **AC-5**, **AC-9**, **AC-11**, **AC-12**.

## Build plan

This project is tracking features through `context/build-plan.md` and `context/progress-tracker.md`, with no `docs/scope/` directory. Treat this as an end to end feature slice: first tighten the data contract, then add the protected route, then wire navigation, then build and verify the UI.

1. Extend the shared job type to include all detail fields read from `jobs`, with typed nullable string arrays for structured sections and a non `any` type for `company_research`, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
2. Update the Find Jobs server read to stay scoped to the current user when loading saved jobs, preserving feature 11 behavior, satisfies **AC-1**
3. Add `app/find-jobs/[id]/page.tsx` as an authenticated Server Component route with async Next params, scoped InsForge read, redirect on signed out, and `notFound()` on missing or inaccessible rows, satisfies **AC-1**, **AC-2**
4. Build job details UI components under `components/job-details/` using existing Navbar shell, card patterns, lucide icons, tokenized colors, focus visible rules, and responsive constraints from the screenshot, satisfies **AC-4** through **AC-11**
5. Add a shared helper for resolving safe external job urls, formatting nullable display values, normalizing optional structured arrays, and rendering `about_role` as plain text, satisfies **AC-4**, **AC-5**, **AC-8**, **AC-10**
6. Link each visible Find Jobs row or role cell to `/find-jobs/[id]` with accessible text and focus styling, without breaking filtering, sorting, pagination, or table scanability, satisfies **AC-3**, **AC-11**
7. Add focused tests for the route behavior, link generation, url fallback, nullable field rendering, and company research empty state. Add or update manual verification notes for real browser screenshots, satisfies **AC-1** through **AC-12**
8. Update `context/progress-tracker.md` and `context/ui-registry.md` after the feature is built, per root project rules, satisfies **AC-11**, **AC-12**

## Consequences

**Positive**:
- The user can move from search results to a real decision page without leaving the app.
- The route reuses the existing saved job data and keeps the next feature, company research, cleanly separated.
- Server side auth and ownership checks keep private job rows protected by default.

**Negative / tradeoffs**:
- The Research Company button is visible before it works. That matches the feature split, but it needs careful styling or disabled semantics so it does not feel broken.
- Rendering optional structured description sections means the UI must handle several sparse data shapes, because earlier Adzuna rows may only have `about_role`.
- Adding row links inside a dense table increases the accessibility surface, so keyboard focus and click targets need verification.

**Neutral**:
- No database migration, no new endpoint, and no new external service are introduced.
- This creates the `components/job-details/` UI area for feature 13 to extend.

## Follow-up

- [x] Feature 13 replaced the company research empty state with the real Stagehand research action and saved dossier rendering. See [spec 0009](../0009-company-research-agent/index.md).
- [x] Resolved by feature 13's own design: `company_research` is written and rendered only through the new research flow; no legacy or manual rows existed to special case.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
