# Memory — Feature 13, Company Research Agent, complete

Last updated: 2026-07-31

## What was built

Feature 13, Company Research Agent, is complete: designed, built, verified live, tested, and synced.

Main code added or changed:

- `docs/specs/0009-company-research-agent/index.md` and `rationale.md`, Feature 13 spec, Status Accepted.
- `migrations/20260731180810_add-jobs-company-research-completed-at.sql`, adds `jobs.company_research_completed_at timestamptz`, applied to the live project.
- `agent/research.ts`, the research agent: `deriveCompanyHomepageUrl`, `runCompanyResearch`. One bounded Stagehand v3 session (homepage extract plus up to 3 sub pages, capped and prioritized by link kind, always closed in `finally`), then GPT-4o synthesis into a 9 field dossier, with a guaranteed fallback (job plus profile data only) when browsing fails or is thin.
- `app/api/agent/research/route.ts`, `POST /api/agent/research`: auth check, `jobId` validation, scoped `id`+`user_id` job read, profile read with an empty-profile fallback, writes `company_research` and `company_research_completed_at` together only on success, fires `company_researched`, revalidates the specific job's page.
- `components/job-details/CompanyResearchCard.tsx`, now a client component with idle, loading, error, and saved-dossier states, replacing Feature 12's disabled placeholder.
- `components/job-details/JobDetailsPage.tsx`, passes `jobId` and `dossier` through.
- `types/index.ts`, new `CompanyResearchDossier` type; `JobRow.company_research` typed to it; new `company_research_completed_at` field.
- `.env.example`, `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` placeholders.
- `package.json`/`package-lock.json`, new deps `@browserbasehq/sdk`, `@browserbasehq/stagehand`.
- `tests/research-agent.test.mjs` and `tests/agent-research-route.test.mjs` (new), `tests/job-details.test.mjs` (extended). Full suite: 276/276 passing.
- `AGENTS.md`, new "Agent skills" section recording two installed Browserbase skills (`browser`, `browser-use-to-stagehand`); `skills-lock.json` updated.
- `context/progress-tracker.md` and `context/ui-registry.md`, Feature 13 marked complete, Phase advanced to Phase 5.
- `docs/specs/0008-job-details-page/index.md`, Status corrected to Accepted (was stuck on "In Progress" despite Feature 12 being done) and both Follow-up items ticked, since Feature 13 is what they were waiting on.
- `insforge.toml`, committed for the first time (pre-existing file, content unchanged, no secrets in it).

All of the above landed in 7 separate commits on branch `browserbase` (not pushed to origin): feature code+deps+migration, tests, spec 0009, spec 0008 status fix, progress-tracker/ui-registry, agent skills tooling, insforge.toml.

## Decisions made

- The Research Company button is synchronous: it awaits the request, then calls `router.refresh()`. No background job in this slice.
- No refresh/re-research action once a dossier exists; the card just shows the saved dossier.
- Homepage URL derivation follows the saved job's redirect via `fetch(url, { redirect: "follow" })`, strips to the root domain; falls back to a `https://www.{company}.com` guess if that fails or lands on an Adzuna domain.
- Stagehand's real installed API (v3, `@browserbasehq/stagehand@3.7.1`) differs from the object-form `stagehand.extract({ instruction, schema })` example that was in `context/build-plan.md`: the real signature is positional, `stagehand.extract(instruction: string, schema: ZodSchema, options?)`. Implemented against the real `.d.ts`, not the plan's snippet.
- `revalidatePath` bug found live during `/check verify`: the original call, `revalidatePath("/find-jobs/[id]")`, is a silent no-op in Next.js without a `type` argument. Fixed to `revalidatePath(\`/find-jobs/${jobId}\`)` (the job's own resolved path). Spec 0009's AC-9 wording and the route test were both updated to match.

## Problems solved

- First live research run only ever hit the fallback path (never real browsing), because `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` in `.env.local` were set to the identical value, a copy-paste mistake, not a code bug. User fixed the key; re-ran and confirmed via server logs that a real Browserbase session opens and extraction completes.
- A stray, never-committed edit to `context/build-plan.md` (unrelated to Feature 13, about Feature 07's resume extraction) falsely claimed GPT-4o extraction returns "all profile field names." Verified against `ExtractedProfileFields` (in `types/index.ts`) and `agent/resume-extractor.ts`'s own system prompt, both of which explicitly exclude email and job-preference fields. Reverted to the accurate, originally-committed wording. Origin of that stray edit is unknown; it predated this session and was never committed.

## Current state

- Feature 13 fully verified live: real signed-in flow proven via throwaway InsForge accounts (email/password signup, session cookie injected into real Playwright browser requests), since this sandbox has no OAuth test credentials. Confirmed: auth gating, cross-user scoping (no leak), input validation, the idle/loading/error/saved-dossier UI states at desktop and mobile, a real research run with real Browserbase browsing, and DB persistence.
- `npm test` (276/276), `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
- Spec 0009: Accepted. Spec 0008: Accepted (corrected this session).
- `context/progress-tracker.md`: Feature 13 checked off, Phase 5 next.
- Two Browserbase Agent Skills installed: `browserbase/skills@browser`, `browserbase/skills@browser-use-to-stagehand`.
- `context/build-plan.md` is back to its clean, committed state.
- Nothing pushed to `origin` this session; all 7 commits are local on `browserbase`.

## Next session starts with

Start Feature 14, Dashboard Page — Full UI (per `context/progress-tracker.md` and `context/build-plan.md`'s Phase 5).

Recommended first command:

```text
/architect feature 14
```

`context/build-plan.md` already has a fairly complete description of the dashboard (mock data first, four stat cards, recent activity, charts); confirm whether that's detailed enough to skip straight to `/develop`, matching the precedent set for Feature 13.

## Open questions

- Three throwaway InsForge accounts created during verification (`jobpilot-verify*@example.com` pattern) still exist. Their `profiles`/`jobs` rows were deleted, but the `auth.users` rows themselves have no available delete path via CLI/REST/SDK (no admin endpoint exposed). Need manual deletion from the InsForge dashboard if desired.
- Whether to push the 7 local commits on `browserbase` to origin, or open a PR, is undecided.
- Feature 15/16 (Stats Bar, Recent Activity) should read `jobs.company_research_completed_at` for research timing, per spec 0009's own follow-up note — worth confirming when those are built.
