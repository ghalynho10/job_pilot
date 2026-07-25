# Memory — Feature 06 (Profile Save Logic) shipped and closed out

Last updated: 2026-07-24

## What was built

- `docs/specs/0002-profile-save-logic/` (`index.md`, `rationale.md`, `verify.md`): spec 0002, status `Accepted`.
- `types/index.ts`: added `ProfileRow`, `ProfileWritePayload`, `ActionResult<T>`, `ProfileCompletionInput`.
- `lib/profile-completion.ts`, `lib/profile-mapping.ts`: shared pure helpers (completion derivation, `Profile` ↔ DB row mapping).
- `actions/profile.ts`: one Server Action, `saveProfile(profile, resumeFile)`, saving the whole form and, when a new file was selected, the resume too, in a single call.
- `components/profile/ProfileEditor.tsx` (new): client wrapper owning `profile` and `resumeFile` state, wires `ResumeUpload` and `ProfileForm` together and calls `saveProfile`.
- `components/profile/ProfileForm.tsx`: now a fully controlled component (no more internal `useState<Profile>`); Save Profile button wired with pending/success/error states.
- `components/profile/ResumeUpload.tsx`: stages a validated file via `onFileSelected`, no longer inert, does not upload itself.
- `app/profile/page.tsx`: fetches the real `profiles` row and renders `ProfileEditor`; mock data fully gone.
- `components/profile/CompletionIndicator.tsx`: post-close bug fix, see Problems solved.
- Tests: `tests/profile-completion.test.mjs`, `tests/profile-mapping.test.mjs` (new, real unit tests on the pure functions), `tests/profile-contract.test.mjs` extended (source-contract style, this project's convention). Full suite: 78/78 passing.
- `context/progress-tracker.md` and `context/ui-registry.md` updated throughout.

## Decisions made

- One combined `saveProfile` action, not two independent ones. Originally designed as "upload the resume immediately on select, independent of Save Profile" (matching a literal read of the dropzone's copy); reversed after the engineer directly asked for the resume to save only when Save Profile is clicked, alongside everything else.
- Storage: every resume upload targets a fresh unique key (`${userId}/<uuid>.pdf`), never a fixed path. Reason: InsForge's `storage.upload()` never overwrites an existing key, it silently renames on collision instead — confirmed by testing the actual live endpoint directly, not assumed from docs.
- Resume replace sequence, in this exact order: read the current row first (also supplies the `profile_completed` transition check) → validate and upload the new file → write the new key to the DB → only after that write succeeds, delete the previous key if one existed and differed. Never delete-then-upload; a failed upload or write must never cost the user their existing resume.
- Profile completion (percentage + missing fields) is derived at read time from exactly 10 required fields, not persisted as new columns. That exact field set was chosen because it reproduces the delivered design mock's 70%/PHONE-LOCATION-EDUCATION example precisely.
- Cover Letter Tone stays out of scope for this feature (the design has no field for it, even though `build-plan.md` and the DB schema mention one).
- Job Titles Seeking / Preferred Locations: stay as plain comma-separated text inputs in the UI; split/trim/filter into arrays on save, comma-joined back on read.
- `insforge.database.from(table)` is the real accessor — `insforge.from(table)` does not exist on the SDK client. Found live while building, fixed directly as a mechanical correction (not routed back through `/architect`, since it isn't a design decision).

## Problems solved

- The storage overwrite/URL questions left open by the spec were resolved by direct live testing: traced the SDK's `upload()` to the real `PUT /api/storage/buckets/:bucket/objects/:key` endpoint (the CLI's own `storage upload` command hits a *different* endpoint and would have given a misleading answer), hit it twice with the same key, observed the silent rename. Also confirmed an unauthenticated fetch of the returned `url` gets 401 (private bucket), which is why only the object *key* is ever persisted, never that `url`.
- A cross-check on a different model (Opus) caught a real gap in the first storage revision: nothing said where "the previous key to delete" actually comes from. Fixed by adding an explicit row read at the start of `saveProfile`.
- `/check verify` used two real throwaway InsForge sessions (not a code bypass) to prove, live: the full save/reload persistence cycle, the comma-split/join round trip (including a double-comma edge case), completion going from a real 0% to a real 100% with `is_complete` flipping in the database, a resume upload and replace leaving exactly one live object in storage (confirmed via `storage list-objects`, the old one actually gone), and selecting a resume without saving leaving both the database and storage completely untouched. One item was genuinely blocked, not faked: confirming the `profile_completed` PostHog event was actually *received*, since this environment only has a write-only project key. The database-side trigger condition (the `is_complete` transition itself) was confirmed directly instead.
- Post-close bug, found by the engineer from a screenshot: `CompletionIndicator` had never actually reached a genuine complete state before (feature 05 only ever showed it against static 70% mock data), so once feature 06 made 100% real, it revealed the component always rendered the red "Profile needs attention" heading/icon/ring, even at 100%. Fixed with an `isComplete` branch driving heading text, icon (`CheckCircle`/`text-success` vs `AlertCircle`/`text-error`), body copy, and ring color together. Verified with an actual `react-dom/server` render (esbuild-transformed the component on the fly) for both a 100% and a 70% input before trusting the fix, not just by reading the code.
- All throwaway InsForge accounts and test storage objects created this session were deleted; `require_email_verification` confirmed restored to `true` every time it was toggled.

## Current state

- Feature 06 is fully done: spec 0002 `Accepted`, `/check verify` PASS, `/test` 78/78, `npx tsc --noEmit` and `npm run lint` both clean.
- `context/progress-tracker.md`: Phase 2 (Profile Page) fully checked off (05 + 06). Next listed: 07 AI Profile Extraction from Resume.
- Known follow-ups, not yet acted on:
  - `context/library-docs.md` needs corrections in two places: the InsForge Storage section (`.upload()` takes no options object, never overwrites, `getPublicUrl()` only works for public buckets) and the DB Queries section (`insforge.database.from`, not `insforge.from`). Queued for `/sync`, not yet run.
  - The `Experience Level`, `Work Authorization`, and `Highest Degree` `<select>` elements (built in feature 05) have no blank placeholder option, so they visually show their first option even when genuinely unset, while the completion banner correctly lists them as missing. Found during `/check verify`'s screenshots, not yet fixed, not this feature's scope.
  - `.env.local` still has the old `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` name instead of `NEXT_PUBLIC_POSTHOG_KEY` (carried over from earlier sessions, still unresolved).

## Next session starts with

Feature 07, AI Profile Extraction from Resume (per `context/build-plan.md`): an "Extract from Resume" button that reads the uploaded PDF's text (via `pdf-parse`) and has GPT-4o auto-fill the profile form fields. This needs an `/architect` spec first — real open decisions include the extraction prompt/schema, how extracted fields map back into `ProfileEditor`'s state without clobbering fields the user already filled in by hand, and the empty/short-text error path already described in `build-plan.md`. Before starting, consider whether to knock out the two small known-good follow-ups first (the `library-docs.md` corrections via `/sync`, and/or the select-placeholder UX fix), since both are small, unblocked, and independent of feature 07.

## Open questions

- When feature 13 (Company Research Agent) is spec'd, decide whether to add a `company_research_completed_at` column to `jobs` or source feature 16's activity feed from `agent_logs.created_at` instead.
- Whether to ever complete a real, human driven Google or GitHub login to close the one remaining gap in feature 02's verification.
- Cover Letter Tone: add it to the Profile page UI to match `build-plan.md`/DB schema, or update those to drop it since the design doesn't show it?
- The design's nav icons + active-item underline aren't in the shared `Navbar` component, which instead follows `ui-rules.md`'s "no underline" rule — worth a deliberate decision (via `/architect` or `/sync`) on which one should actually govern.
- The three `<select>` elements with no blank placeholder option (see Current state) — worth deciding priority: fix now, or fold into a later polish pass.
