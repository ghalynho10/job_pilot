# 0003. AI Profile Extraction from Resume

**Date**: 2026-07-29
**Status**: Accepted

## Summary

This decision lets a user auto fill their profile form from a resume PDF they already uploaded, using GPT-4o (OpenAI's language model) to read the extracted text and return structured fields. The user clicks Extract from Resume, the fields fill in, and they review and edit before saving, nothing is written to the database until they click Save Profile. Job Preferences fields and email are never touched by extraction, since a resume does not state them.

## Requirements

**User stories**:
- As a job seeker with an existing resume, I want my profile form to fill itself in from that resume, so I do not have to retype my work history, skills, and education by hand.
- As a job seeker who has already customized parts of my profile, I want a clear moment to review the AI extracted fields before anything saves, so I never accidentally lose a correct manual edit without noticing.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The Extract from Resume button appears in the Resume card only once a resume is currently staged (an uploaded key exists); it is hidden otherwise.
- **AC-2**: Clicking it shows a loading state; the button and the resume dropzone/file input are both disabled while extraction is in flight.
- **AC-3**: On success, Personal Info, Professional Info, Work Experience (capped at the form's existing 3 role limit), and Education fields are overwritten with GPT-4o's extracted values. Email and every Job Preferences field (Job Titles Seeking, Remote Preference, Salary Expectation, Preferred Locations) are left exactly as they were.
- **AC-4**: If the PDF yields empty or too short extracted text, the user sees exactly: "Could not extract text from this PDF. Please try a different file." and no field changes.
- **AC-5**: Any other extraction failure (signed URL fetch, PDF parsing, the GPT-4o call, or a malformed JSON response) shows a generic, human readable error and changes no fields. Nothing is written to the database at any point in this flow, success or failure.
- **AC-6**: A user cannot trigger extraction against a resume key that is not their own; the server checks ownership before reading storage.
- **AC-7**: Save Profile is disabled while an extraction is in flight, the same guard already in place during a resume upload.
- **AC-8**: Extraction can be re-run any number of times (after picking a different resume, or after manually editing fields) and always re-overwrites the extractable fields from whichever resume key is currently staged.

## Decision

**Chosen option**: Option 2: Reuse the already staged resume key.

Extraction reads whatever resume key `ProfileEditor` already holds from the existing upload on select flow, fetches it server side through a fresh signed URL, and never asks the client to send the file a second time.

**Implementation skills**: `insforge` (`insforge-dev/insforge`, `.claude/skills/insforge/`)

## Rationale

Reasoning and options: see `rationale.md`.

## Feature design

**Data model sketch**:
No new database entities, columns, or tables. Extraction is entirely transient: it reads a `resumes` bucket object that already exists (feature 06) and returns structured fields to the client, which only exist in local React state until the user clicks Save Profile (feature 06's existing `saveProfile` action, unchanged). One new TypeScript type only:

```typescript
export type ExtractedProfileFields = Pick<
  Profile,
  | "fullName" | "phone" | "location" | "linkedinUrl" | "portfolioUrl"
  | "workAuthorization" | "currentTitle" | "experienceLevel" | "yearsExperience"
  | "skills" | "industries" | "workExperience" | "education"
>;
```

This deliberately excludes `email` (owned by auth, not editable in the form) and the four Job Preferences fields (`jobTitlesSeeking`, `remotePreference`, `salaryExpectation`, `preferredLocations`), so the response schema has no slot for them at all, not just an empty one.

**State transitions**:
None. This is a single request/response operation, not a lifecycle.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/resume/extract | POST | resumeKey: string (req) | success: boolean, data: ExtractedProfileFields (on success) | signed in session (cookie) | 401 equivalent if signed out, error if resumeKey does not belong to the caller, error if extracted text is empty or too short, error if the GPT-4o call or its JSON parsing fails |

**Key invariants**:
- Extraction never writes to the database, under any outcome.
- The response schema never includes `email` or a Job Preferences field; GPT-4o is never given a slot to fill them in.
- The `resumeKey` ownership check (must start with the caller's `userId` plus `/`) always runs before any storage read.
- A signed URL is minted fresh per request and never cached, stored, or reused, matching the existing project rule for reading private storage objects.

**Security model**:
Only the authenticated owner of a given resume key may extract it. The resumes bucket is already private (feature 04); this feature adds a second layer, the explicit key prefix check server side, so one signed in user can never trigger extraction against a key that happens to belong to someone else, even if guessed or replayed. No new regulated data category; the resume already lives under this project's existing private, per user storage model.

**Configuration required**:
- `OPENAI_API_KEY`: already present in `.env.local` (confirmed by the engineer this session); used by `agent/resume-extractor.ts`'s GPT-4o call, the same variable `context/code-standards.md` already lists for `agent/` functions generally.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: a real, well formatted resume PDF is extracted and the applicable form fields populate correctly, Job Preferences and email untouched, verifies **AC-3**
- Failure case: a scanned/image only PDF yields empty extracted text and shows the exact specified error with no field changes, verifies **AC-4**
- Auth/permission: a request carrying a resume key belonging to a different user is rejected before any storage read happens, verifies **AC-6**

## Build plan

No delivery approach is recorded in `AGENTS.md` or a scope header for this project; `context/build-plan.md`'s stated Core Principle (full UI first with mock data, then logic wired in step by step) is itself a Facade style default, but the UI it would apply to (the profile page) already shipped in features 05 and 06. For this feature specifically, defaulting to a thin, end to end slice (build the extraction path bottom up, one small piece at a time, each independently testable) is the Staff engineering judgment call here; noting this as the assumption.

1. [x] Add `openai`, `pdf-parse`, and `zod` to `package.json` (all three already pre-approved in `context/code-standards.md`, none currently installed), satisfies **AC-3**, **AC-4**, **AC-5**
2. [x] Add the `ExtractedProfileFields` type to `types/index.ts`, satisfies **AC-3**
3. [x] Build `agent/resume-extractor.ts`: `extractProfileFromResumeText(text)`, the GPT-4o call (model `gpt-4o`, `response_format: { type: 'json_object' }`, `temperature: 0.3`, `max_tokens: 800`, per the existing entry in `context/library-docs.md`) plus `zod` validation with per field coercion for out of range enum values, satisfies **AC-3**, **AC-4**, **AC-5**
4. [x] Build `app/api/resume/extract/route.ts`: auth check, request body validation, the `resumeKey` ownership check, signed URL mint plus fetch, the empty/short text guard, then calling the agent function, satisfies **AC-4**, **AC-5**, **AC-6**
5. [x] Update `components/profile/ResumeUpload.tsx`: new `isExtracting`, `onExtract`, `extractError`, `canExtract` props, the Extract from Resume button, and extending the dropzone/input disabled condition to cover extraction too, satisfies **AC-1**, **AC-2**
6. [x] Update `components/profile/ProfileEditor.tsx`: new `isExtracting`/`extractError` state, the `fetch` call to the new route, merging the returned fields into `profile` state by object spread (the overwrite policy), and extending `saveDisabled` to include `isExtracting`, satisfies **AC-2**, **AC-3**, **AC-7**, **AC-8**
7. [x] Add tests for the `zod` coercion behavior in `agent/resume-extractor.ts` and the ownership check in the route, following this project's existing `*-contract.test.mjs` style; manually verify on the running dev server with a real resume PDF and with a scanned/image only PDF, satisfies all of the above

All 7 tasks are built and typecheck/lint/unit-test clean (code in `agent/resume-extractor.ts`, `app/api/resume/extract/route.ts`, `types/index.ts`, `components/profile/ResumeUpload.tsx`, `components/profile/ProfileEditor.tsx`). Task 7's manual, real-PDF portion (a genuine resume extracting correctly, the empty-text error path against a real scanned PDF) is left to `/check verify`; only a live unauthenticated smoke test of the route ran during the build.

## Consequences

**Positive**:
- Meaningfully speeds up profile completion for anyone who already has a resume, the majority of this product's users.
- Adds no new persistence surface and no new database migration; reuses the storage and upload path feature 06 already built and tested.

**Negative / tradeoffs**:
- Three new dependencies (`openai`, `pdf-parse`, `zod`) join the bundle; each is already on the project's pre-approved list, so this is expected cost, not scope creep.
- Every extraction click costs one GPT-4o call; a user who clicks Extract repeatedly out of habit pays that cost repeatedly, there is no caching of results in this design (matching the deliberate choice not to persist raw resume text, see Option 3 in `rationale.md`).
- Because the merge policy is overwrite, a second extraction (for example after selecting a different resume) will silently discard any manual edits made since the first extraction, unless the user notices before clicking it again. This is an accepted tradeoff for keeping the UX simple (extract, review, save), not a gap.

**Neutral**:
- This is the project's first `agent/` function calling OpenAI's chat completions API directly, rather than through Stagehand (used for company research). Future `agent/` GPT-4o functions (job matching, company research synthesis) can follow the same shape: a plain async function, try/catch, `{ success, error }` return, `zod` validated JSON response.

## Follow-up

- [ ] No new PostHog event was added. `context/build-plan.md`'s feature 07 section does not name one, unlike features 06/10/13 which explicitly list events, and `context/code-standards.md` currently caps the event list at 4 named events. Revisit only if product wants extraction usage tracked, and update `code-standards.md`'s list first.
- [ ] `context/build-plan.md`'s feature 07 section currently reads "GPT-4o reads extracted text and returns structured JSON matching all profile field names," which is now superseded by this spec's Job Preferences skip and email exclusion decisions; worth a small correction pass so the two documents agree.
- [ ] Whether resume extraction failures should ever feed a future, unified agent activity log is left open; not needed now since this operation has no `run_id`/`agent_runs` context the way Adzuna search or company research do.
- [ ] `context/library-docs.md`'s `pdf-parse` section documents the old v1 API (`require('pdf-parse')(buffer)`); the installed version is v2, whose real API is `new PDFParse({ data: buffer })`, `await parser.getText()`, `await parser.destroy()`. Used the real v2 API when building (confirmed against the installed package's own README, not assumed); `/sync` should correct `library-docs.md` to match.
