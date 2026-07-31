# 0009. Company research agent

**Date**: 2026-07-31
**Status**: Accepted

## Summary

This decision builds feature 13, the company research agent, as the real interaction that replaces the disabled Company Research card on the job details page (feature 12). A signed in user presses Research Company, the app opens one Browserbase session driven by Stagehand, extracts company signals from the employer's public website, and asks GPT-4o to synthesize a nine field dossier grounded in that research, the saved job, and the user's profile. The dossier is written to the existing `jobs.company_research` column, `jobs.company_research_completed_at` is stamped for later dashboard activity, and the page reloads to show the saved dossier. If a dossier already exists for a job, the card renders it directly with no refresh action in this slice.

## Requirements

**User stories**:
- As a job seeker, I want to research a company for a saved job so that I understand what they do, their stack, and their culture before I apply.
- As a job seeker, I want the research to connect back to my own skills and gaps so that I know my edge and what to address for this specific role.
- As a job seeker, I want smart questions and interview prep drawn from real research so that I sound informed when I talk to this company.
- As a job seeker, once research is saved, I want to see it every time I return to this job without re-running it.

**Acceptance criteria**:
- **AC-1**: `POST /api/agent/research` requires a signed in session (`createInsforgeServer().auth.getCurrentUser()`). An unauthenticated request returns `401` with a generic message and performs no research or write.
- **AC-2**: The route accepts `{ jobId: string }`. A missing, non string, or malformed `jobId` returns `400` before any database or agent work.
- **AC-3**: The route reads exactly one `jobs` row scoped by both `id` and the signed in `user_id`. A job that does not exist or belongs to another user returns a generic not found style failure; it must not leak whether the row exists for someone else.
- **AC-4**: The route reads the signed in user's `profiles` row and passes profile fields into synthesis alongside the job row. A missing profile does not crash the route; synthesis proceeds with whatever profile data exists.
- **AC-5**: `agent/research.ts` derives a candidate company homepage URL from the job's saved external URL where one resolves to a real employer domain, and falls back to a constructed `https://www.{company}.com` guess when it cannot, matching the derivation already described in `context/build-plan.md`'s Feature 13 section.
- **AC-6**: Research opens exactly one Browserbase session per request, extracts the homepage with the documented Zod schema, then extracts at most 3 internal sub pages (preferring about, blog, engineering, product over careers) with the documented Zod schema. The Stagehand/Browserbase session is always closed in a `finally` block, including when extraction throws.
- **AC-7**: If homepage extraction yields no meaningful content (`oneLiner` and `productSummary` both empty), or the browsing step throws, the route still returns a complete dossier synthesized from the job description and profile alone. Research never fails silently and never returns a partially empty or invented dossier.
- **AC-8**: GPT-4o synthesis returns a JSON object validated against a Zod schema for exactly these nine fields: `companyOverview`, `techStack`, `culture`, `whyThisRole`, `yourEdge`, `gapsToAddress`, `smartQuestions`, `interviewPrep`, `sources`. A response that fails validation is treated as a synthesis failure, not saved, and reported through the route's generic error path.
- **AC-9**: On success, the route writes `company_research` (the validated dossier) and `company_research_completed_at` (current timestamp) to the scoped `jobs` row, fires the `company_researched` PostHog event with `{ userId, jobId, company }`, and calls `revalidatePath(`/find-jobs/${jobId}`)` (the job's own resolved path — Next.js silently no-ops on the bare dynamic segment literal `"/find-jobs/[id]"` without a second `type` argument) before returning `{ success: true, data: <dossier> }`.
- **AC-10**: `types/index.ts` defines a named `CompanyResearchDossier` type for the nine fields above and `JobRow.company_research` is typed `CompanyResearchDossier | null`, replacing the feature 12 placeholder `Record<string, unknown> | null`. No `any` is introduced.
- **AC-11**: `CompanyResearchCard` becomes a client component. With no saved dossier, it renders the existing empty state and an enabled Research Company button. Pressing it disables the button, shows a loading state, and on success reloads the page data so the saved dossier renders; on failure it shows an inline error state with the button re-enabled for retry. With a saved dossier already on the job row, the card renders all nine fields directly and shows no Research Company button or empty state in this slice.
- **AC-12**: The card continues to use only existing token classes (`context/ui-tokens.md`) and the project's focus visible rules. No raw hex colors or raw Tailwind color classes are introduced.
- **AC-13**: Verification proves a real signed in run at desktop and mobile widths: one successful Research Company click that ends with a rendered dossier, and one reload of a job that already has a saved dossier, plus the standard command checks (tests, typecheck, lint, build).

## Decision

**Chosen option**: One Browserbase/Stagehand session per request, extract then synthesize, write to the existing `jobs.company_research` jsonb column

`POST /api/agent/research` is a single request/response route, not a background job. It owns the full lifecycle for one job: derive a homepage URL, run one bounded Stagehand session (homepage plus up to 3 sub pages), close the session, then call GPT-4o once to synthesize the dossier from research plus job plus profile data. The dossier is persisted directly on the `jobs` row that was already being read for the job details page, so no new table is introduced. The UI button blocks on this one round trip and reloads the page on success, matching the plan's recommended assumption over a background job with polling.

**Implementation skills**: `architect` (`project-local`, `.agents/skills/architect/`) · `tailwind` (`project-local`, `.agents/skills/tailwind-css/`) · recommended before implementation: `browserbase/skills@browser` and `browserbase/skills@browser-use-to-stagehand`, if available to this agent, for current Stagehand/Browserbase API usage.

## Feature design

**Data model sketch**:

Migration adds one column to the existing `jobs` table (see `migrations/`):

| Field | Requirement for this feature |
|---|---|
| `jobs.company_research` | Existing nullable `jsonb` column. This feature is the first to write it, using the `CompanyResearchDossier` shape. |
| `jobs.company_research_completed_at` | New nullable `timestamptz` column, written only when research completes successfully. Lets a later dashboard feature query research timing without depending on `found_at` (job discovery time) or scanning `agent_logs`. |

`types/index.ts` adds:

```typescript
export type CompanyResearchDossier = {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};
```

`JobRow.company_research: CompanyResearchDossier | null` and a new `JobRow.company_research_completed_at: string | null`.

**State transitions**:

A job's research state has two values in this slice: no dossier (`company_research` is `null`) and dossier saved (`company_research` is set, `company_research_completed_at` is set). There is no in-between persisted state; the route either completes with a full dossier or returns an error and leaves the row untouched. There is no re-research action in this slice.

**API surface**:

| Call | Where | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `POST /api/agent/research` | `app/api/agent/research/route.ts` | `{ jobId }` | `{ success: true, data: CompanyResearchDossier }` | signed in user only | `401` unauthenticated, `400` invalid `jobId`, generic `500` for not found/cross user/agent/database failures |
| `runCompanyResearch(job, profile)` | `agent/research.ts` | job fields (title, company, description, matched/missing skills, external url), profile fields | `{ success: true, data: CompanyResearchDossier } \| { success: false; error: string }` | none (server-only module, caller is already authenticated) | never throws to its caller; internal Stagehand/OpenAI failures are caught and mapped to the fallback synthesis path or a `success: false` result |

**Key invariants**:
- Every research write is scoped by both `id` and `user_id`, matching the feature 12 read pattern.
- At most one Browserbase session is opened per request, and it is always closed, even on error, via `finally`.
- At most 3 sub pages are extracted beyond the homepage.
- The dossier is never invented from nothing: it is grounded in the job's saved fields and profile, plus whatever real browsing succeeded. If browsing fails entirely, synthesis still runs from job and profile data, and the route still returns a complete, valid dossier rather than a partial or empty one.
- The saved dossier is validated against the `CompanyResearchDossier` Zod schema before it is written; an invalid GPT-4o response is a failure, not a partially saved row.
- `company_research_completed_at` is only ever set together with a successful `company_research` write, never independently.
- All styling uses tokens from `context/ui-tokens.md` and patterns from `context/ui-registry.md`.

**Security model**:

The route is private to the signed in user and scoped the same way the feature 12 read is: `id` and `user_id` together. No new public endpoint, no new externally exposed secret. `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` are server-only environment variables, never exposed to the client, following the same pattern as `OPENAI_API_KEY` and `ADZUNA_APP_KEY`.

**Configuration required**:
- `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` — new, added to `.env.example` as placeholders.
- `OPENAI_API_KEY` — already configured, reused as-is for GPT-4o synthesis (no new AI provider key).

**Critical test scenarios**:
- Happy path: a signed in user with no saved research presses Research Company, the button shows a loading state, the request succeeds, and the page reloads with a rendered nine field dossier, verifies **AC-6** through **AC-13**.
- Already researched: a signed in user opens a job that already has `company_research` saved and sees the dossier immediately, with no button and no request made, verifies **AC-11**.
- Failure case: an unauthenticated request to the route returns `401` and writes nothing, verifies **AC-1**.
- Failure case: a malformed or missing `jobId` returns `400` before any database or agent call, verifies **AC-2**.
- Failure case: a `jobId` that does not belong to the signed in user is treated the same as not found, verifies **AC-3**.
- Edge case: Stagehand extraction throws or returns thin homepage content; the route still returns a complete, valid dossier synthesized from job and profile data alone, and the Browserbase session is still closed, verifies **AC-6**, **AC-7**.
- Edge case: GPT-4o returns content that fails the dossier Zod schema; the route reports a generic failure and writes nothing, verifies **AC-8**, **AC-9**.
- Visual check: desktop and mobile screenshots of both the loading/error interaction and a rendered saved dossier, verifies **AC-11**, **AC-12**, **AC-13**.

## Build plan

This project is tracking features through `context/build-plan.md` and `context/progress-tracker.md`, with no `docs/scope/` directory. `context/build-plan.md`'s Feature 13 section already documents the exact Stagehand extraction schemas, the GPT-4o system prompt, and the dossier shape; this build plan implements that content rather than re-deriving it.

1. Add a migration for `jobs.company_research_completed_at timestamptz`, apply it to the linked InsForge project, satisfies **AC-9**
2. Add `CompanyResearchDossier` to `types/index.ts`, update `JobRow.company_research` and add `JobRow.company_research_completed_at`, satisfies **AC-10**
3. Add `@browserbasehq/sdk` and `@browserbasehq/stagehand` dependencies and add `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID` placeholders to `.env.example`, satisfies **AC-6**
4. Build `agent/research.ts`: homepage URL derivation, one bounded Stagehand session (homepage plus up to 3 sub pages) with the documented Zod schemas, `finally`-guaranteed session close, GPT-4o synthesis with Zod validated output, and the thin-content/failure fallback to job+profile-only synthesis, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**
5. Add `app/api/agent/research/route.ts`: auth check, `jobId` validation, scoped job read, profile read, call into `agent/research.ts`, write `company_research` and `company_research_completed_at`, fire `company_researched`, `revalidatePath`, generic error responses, satisfies **AC-1** through **AC-4**, **AC-9**
6. Rebuild `components/job-details/CompanyResearchCard.tsx` as a client component with idle/loading/error/saved states, wired to the route, using existing tokens and focus visible rules, satisfies **AC-11**, **AC-12**
7. Add focused tests: `agent/research.ts` contract tests (homepage derivation, sub page cap, fallback synthesis, `finally` close, schema validation), route tests (auth, validation, scoping, write order, generic errors), and `CompanyResearchCard` UI contract tests (states, tokens, no DB logic in the component), satisfies **AC-1** through **AC-12**
8. Verify a real signed in job details page at desktop and mobile widths, including one successful research run and one saved dossier reload, satisfies **AC-13**
9. Update `context/progress-tracker.md` and `context/ui-registry.md` after the feature is built, per root project rules

## Consequences

**Positive**:
- Completes the job details experience feature 12 deliberately deferred, turning the disabled empty state into the real research action.
- Reuses the existing `jobs` row and read pattern instead of introducing a new table or endpoint shape.
- `company_research_completed_at` unblocks the Recent Activity and Company Research Activity work already flagged as open in `docs/specs/0001-database-schema/index.md`'s follow-up list, without having to revisit this feature again.

**Negative / tradeoffs**:
- The button blocks synchronously on a full Browserbase session plus a GPT-4o call, so a slow or unreachable company site makes the user wait through the fallback path rather than getting instant feedback. Accepted for this first slice per the plan's recommended assumption; a background job with polling is a candidate follow-up if this proves too slow in practice.
- No refresh action in this slice means a stale or thin dossier cannot be regenerated without direct database intervention.
- Homepage URL derivation from a job board redirect is inherently best effort; some companies will get the constructed guess instead of their real domain, and research quality will vary accordingly.

**Neutral**:
- No new database table; one new nullable column plus a jsonb column this feature is first to populate.
- Introduces the project's first non-InsForge, non-OpenAI, non-Adzuna external dependency (Browserbase), scoped entirely to `agent/research.ts`.

## Follow-up

- [ ] A refresh/re-research action, and a way to show research age using `company_research_completed_at`, are natural extensions once this slice ships.
- [ ] Feature 15/16 (Dashboard stats and Recent Activity) should read `company_research_completed_at` for research timing rather than `found_at` or `agent_logs`, per `docs/specs/0001-database-schema/index.md`'s open item.
- [ ] If homepage derivation proves unreliable in practice, consider letting the user confirm or correct the detected company URL before research runs.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
