# 0014. Optional projects capture in resume extraction

**Date**: 2026-08-01
**Status**: Accepted

## Summary

Extend the existing resume extraction flow to also pull personal or portfolio projects when a resume lists them. Store projects as a jsonb column on the profiles table. A resume with no projects section leaves the field empty with no error. The extraction happens inside the same GPT-4o call the existing extraction already makes, so there is zero extra cost or latency. A new Projects section on the profile form lets the user review, edit, add, or remove them after extraction. This feature does not touch resume generation or add any project matching or scoring logic.

## Context

The resume extraction feature (spec 0003, feature 07) parses a resume PDF and fills the profile form with structured fields: full name, phone, location, skills, work experience, education, and so on. It does not extract projects.

Many technical resumes include a Projects section listing personal or portfolio work with names, descriptions, URLs, and technologies used. This is valuable context for the user to have on their profile, and capturing it from the same resume that already feeds the extraction costs nothing extra because the extraction is one GPT-4o call that already returns a JSON schema. Adding a projects array to that schema adds no new API call, no new latency, and a negligible token increase.

The scope row (0b in `docs/scope/scope.md`) places this feature before billing because it has no billing dependency. It is small and self contained.

## Requirements

**User stories**:
- As a user uploading my resume, I want my personal and portfolio projects to be extracted and saved to my profile so I do not have to type them in by hand.
- As a user with no projects on my resume, I want extraction to work the same as before with no error, empty field, or extra step.

**Acceptance criteria**:
- **AC-1**: A resume containing a Projects section has its projects extracted and saved to the profile as a structured list. Each project carries at minimum a name; description, url, and technologies are saved when the resume states them.
- **AC-2**: A resume with no Projects section leaves the projects field null or empty on the profile with no error message and no change to the extraction result for any other field.
- **AC-3**: Every existing extracted field (fullName, phone, location, skills, workExperience, education, etc.) behaves exactly as it did before this feature. No field is added, removed, or changed.
- **AC-4**: The extraction caps at 5 projects. If the resume lists more, only the first 5 most prominent ones are kept.
- **AC-5**: The profile form shows a Projects section below Work Experience, using the same inline editable card pattern. The user can edit any project field, add a new project, or remove one.
- **AC-6**: Saving the profile persists projects alongside all other fields in a single save call. The save action, profile mapping, and profile completion logic all handle the new field without breaking.
- **AC-7**: Generating a resume from the profile does NOT include projects. The resume generator is deliberately untouched, as stated in the scope.
- **AC-8**: A migration adds a nullable `projects jsonb` column to the `profiles` table. A user whose row was created before the migration has a null projects column and nothing breaks.
- **AC-9**: `npx tsc --noEmit`, `npm run lint`, and `npm test` all pass. The test suite covers the new zod schema field, the profile mapping round trip with projects, and the extraction route's handling of a projects result.

## Options considered

### Option 1: Extend the existing GPT-4o call (chosen)

Add a `projects` field to the existing zod schema and system prompt in `agent/resume-extractor.ts`. The same GPT-4o call that extracts name, skills, and work experience also extracts projects. Zero extra API calls, zero extra latency, negligible token increase (roughly 100 extra output tokens when projects are present).

### Option 2: Separate GPT-4o call for projects only

A dedicated second extraction call that only asks for projects. Allows a different model or prompt but doubles the cost and adds latency for every extraction. Overkill for an optional field that many resumes will not have.

### Option 3: Regex or keyword based extraction

Parse the resume text for a "Projects" heading and extract lines underneath with simple heuristics. No API cost but unreliable across different resume formats, languages, and heading variants. Fails silently on nonstandard formatting and produces noise.

## Decision

**Chosen option**: Option 1: Extend the existing GPT-4o call

Add a `projects` array to the existing extraction zod schema and system prompt. No new API call, no new cost, no new latency.

**Implementation skills**: `insforge` (`.agents/skills/insforge/`) for the database write and profile read patterns · `insforge-cli` (`.agents/skills/insforge-cli/`) for applying the migration

## Rationale

Option 1 is the natural extension. The extraction already makes one GPT-4o call that returns a JSON object with every field; adding a `projects` key to that object costs roughly 100 extra output tokens when projects are present and zero when they are not. The system prompt already instructs GPT-4o to extract only what is stated and return empty for missing fields, which covers the no projects case exactly.

Option 2 adds real cost (a second API call for every extraction, roughly doubling the per extraction spend) for no benefit: the first call already processes the entire resume text, so splitting projects into a separate call is redundant work.

Option 3 is fragile and would need constant maintenance. A regex that works for "Projects" fails for "Personal Projects", "Portfolio", "Side Projects", "Open Source", or any non English heading. The extraction already uses GPT-4o for every other field precisely because regex is unreliable across resume formats.

## Feature design

**Data model sketch**:

New column on `profiles`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `projects` | `jsonb` | `null` | Nullable. An array of project objects, or null when no extraction has run yet or no projects were found. |

Project object shape:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string` | Yes | The project name. The only required field. |
| `description` | `string` | No | A short description of what the project is or does. |
| `url` | `string` | No | A URL to the project (GitHub, portfolio, live site). |
| `technologies` | `string[]` | No | Technologies or tools used in the project. |

`types/index.ts` additions:

```typescript
export type Project = {
  name: string;
  description?: string;
  url?: string;
  technologies?: string[];
};
```

`Profile` gains `projects: Project[] | null`. `ProfileWritePayload` gains `projects`. `ExtractedProfileFields` gains `projects`. `ProfileRow` maps the jsonb column to `Project[] | null`.

**API surface**:

No new HTTP endpoint. The existing extraction route and save action handle the new field.

| Call | Where | What changes |
|---|---|---|
| `extractProfileFromResumeText` | `agent/resume-extractor.ts` | zod schema gains `projects` field, system prompt gains a Projects instruction |
| `POST /api/resume/extract` | `app/api/resume/extract/route.ts` | merge logic includes `projects` in the returned `ExtractedProfileFields` |
| `saveProfile` | `actions/profile.ts` | writes `projects` to the row, same pattern as `workExperience` |
| `GET /profile` | `app/profile/page.tsx` | reads `projects` from the row, passes to `ProfileEditor` |
| Profile form | `components/profile/` | new `ProjectsSection` component (inline editable cards), wired into `ProfileEditor` |

**Key invariants**:
- Extraction caps at 5 projects via `.transform((p) => p.slice(0, 5))` in the zod schema, same pattern as the existing 3 entry cap on `workExperience`.
- A missing, empty, or unparseable projects array in the GPT-4o response defaults to `[]` via `.catch([])` in the zod schema.
- The profile completion logic (`lib/profile-completion.ts`) does NOT consider projects a required field. A profile can be 100% complete with no projects.
- The resume generator (`agent/resume-generator.ts`, `POST /api/resume/generate`) is deliberately untouched. No code in that path reads or writes projects.
- The migration adds a nullable column with no default, so existing rows stay null and nothing breaks on deploy.
- Every schema coercion uses the existing `.catch()` pattern so a bad value from GPT-4o for any single project field never fails the whole extraction.

**Critical test scenarios**:
- Happy path: a resume with a Projects section → extraction returns `projects` array, profile form shows them, save persists them, reload confirms they round trip → verifies **AC-1**, **AC-5**, **AC-6**
- Empty case: a resume with no Projects section → extraction returns `projects: []` or `null`, no error, all other fields unchanged → verifies **AC-2**, **AC-3**
- Cap: a resume listing 8 projects → only 5 saved to the profile → verifies **AC-4**
- Resume generation: generate a resume from a profile that has projects → the generated PDF does not include a projects section → verifies **AC-7**
- Backward compat: a user whose profile row predates the migration opens the profile page → no crash, null projects treated as empty → verifies **AC-8**
- Commands: `tsc`, `lint`, `test` all pass → verifies **AC-9**

## Build plan

Build approach: Skateboard. The thinnest usable whole is the extraction itself (task 1 to 3). The profile form section (task 4) grows it into a decent user experience on top.

1. **Migration**. Add `projects jsonb` column to `profiles`, nullable, no default. Apply to the linked InsForge project. Satisfies **AC-8**.
2. **Types**. Add `Project` type to `types/index.ts`, add `projects` to `Profile`, `ProfileRow`, `ProfileWritePayload`, and `ExtractedProfileFields`. Satisfies **AC-1**, **AC-2** data shape.
3. **Extraction agent**. Add `projects` field to the zod schema in `agent/resume-extractor.ts` with the 5 entry cap and `.catch([])` fallback. Add a Projects instruction to the system prompt. Satisfies **AC-1**, **AC-2**, **AC-4**.
4. **Extraction route**. Wire `projects` into the merge result in `app/api/resume/extract/route.ts`. The existing merge logic (object spread) already handles a new field automatically; confirm it works as is. Satisfies **AC-1**, **AC-3**.
5. **Profile form**. Add a `ProjectsSection` component following the same inline editable card pattern as Work Experience: each project is a card with name (required), description, url, and technology tags. Add and remove buttons. Wire into `ProfileEditor` and thread through `app/profile/page.tsx`. Satisfies **AC-5**.
6. **Save action**. Confirm `actions/profile.ts`'s `saveProfile` already writes `projects` through the existing `profile` spread onto the row. The `profile-mapping.ts` round trip needs a `projects` entry. Satisfies **AC-6**.
7. **Profile completion**. Confirm `lib/profile-completion.ts` does NOT add projects to the required fields list. No change needed; document the intentional omission. Satisfies **AC-2**.
8. **Tests**. Extend existing tests: add projects assertions to `tests/resume-extractor.test.mjs`, `tests/resume-extract-route.test.mjs`, `tests/profile-mapping.test.mjs`, and `tests/profile-contract.test.mjs`. Add a regression guard that `agent/resume-generator.ts` does not import or reference `projects`. Satisfies **AC-3**, **AC-4**, **AC-7**, **AC-9**.

## Consequences

**Positive**:
- Users with project heavy resumes get that context captured automatically with zero extra cost or latency.
- The code change is small: one zod field, one prompt line, one migration, one new component. The existing extraction, save, and form patterns are reused exactly.
- Excluding projects from resume generation keeps the two features decoupled, matching the scope's deliberate boundary.

**Negative / tradeoffs**:
- The profile form gains another section, increasing page height. Accepted because projects are optional and many users will have none.
- The extraction prompt grows by roughly one sentence and one JSON key. The token increase is negligible (under 100 tokens) and GPT-4o handles the extra field reliably.

**Neutral**:
- One new nullable jsonb column. No new table, no new index, no new RLS policy.
- No new dependency, no new provider, no new env var.

## Follow-up

- [ ] When feature 4 (resume generation quality) is built, consider whether projects should appear in generated resumes. That decision belongs to feature 4, not this one.
- [ ] When feature 5 (job application status tracking) or a later matching improvement is built, consider whether projects should influence match scores. Explicitly out of scope here.

## References

- `docs/specs/0003-ai-profile-extraction-from-resume/` — the existing extraction feature this extends
- `docs/scope/scope.md` row 0b — the scope entry that prompted this spec
