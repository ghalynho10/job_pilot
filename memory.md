# Memory — Feature 06 (Profile Save Logic), three revisions, now fully closed out

Last updated: 2026-07-28

## What was built

- `actions/profile.ts`: split into two Server Actions. `uploadResumeFile(file, previousUnsavedKey?)` uploads a resume to a fresh unique key immediately on select and best effort deletes a previous unsaved key. `saveProfile(profile, resumeKey)` no longer uploads anything, it only decides whether to write an already resolved key into `resume_pdf_url`.
- `components/profile/ProfileEditor.tsx`: rewritten twice this session. Final shape reads the staged, not yet saved `resumeKey`/`resumeFileName` live via `useSyncExternalStore` (not `useState`), backed by `sessionStorage`.
- `lib/staged-resume-storage.ts` (new): `sessionStorage` read/write/clear functions namespaced per user (`profile-staged-resume:${userId}`), plus a subscribe/notify pub sub layer for `useSyncExternalStore`.
- `components/profile/ResumeUpload.tsx`: presentational only, driven by `isUploading`/`uploadedFileName`/`uploadError` props; disables its dropzone and file input while an upload is in flight.
- `components/profile/ProfileForm.tsx`: gained a `saveDisabled` prop, separate from `isSaving`, so Save Profile can disable during a resume upload without its text wrongly reading "Saving…".
- `app/profile/page.tsx`: now threads a `userId` prop (`data.user.id`) to `ProfileEditor`; `Profile` itself still deliberately carries no `id` field.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit: "6mb"`, since Next's own 1MB default was silently rejecting real resumes over 1MB before the app's own 5MB check ever ran.
- `tests/staged-resume-storage.test.mjs` (new, 10 tests) and extensive updates to `tests/profile-contract.test.mjs`. Full suite: 93/93 passing.
- `docs/specs/0002-profile-save-logic/` (`index.md`, `rationale.md`, `verify.md`): spec 0002, now on its third revision, status `Accepted`. AC-1 through AC-10.
- Doc corrections along the way: `context/library-docs.md` (InsForge Storage/DB Queries examples), root `AGENTS.md` ("persist both url and key" line), `context/code-standards.md` (new rule: use `useSyncExternalStore`, never `useState`/`useEffect`, for a browser only value like `sessionStorage`), `context/ui-registry.md`, `context/progress-tracker.md`.

## Decisions made

- Resume uploads to storage immediately on file select (fast feedback on bad files), but `resume_pdf_url` in the database still only writes on Save Profile click. One deliberate save moment stays true for the whole profile record; only the resume's upload timing moved earlier.
- A staged, not yet saved resume now survives a page refresh, via `sessionStorage` (not `localStorage`), namespaced per user id. `sessionStorage` chosen specifically because it is tab scoped and clears on tab close, sidestepping cross tab staleness entirely rather than having to detect it.
- `useSyncExternalStore` instead of `useState` + `useEffect` for reading that `sessionStorage` value. Required, not stylistic: a `useState` initializer reading `sessionStorage` would cause a real SSR hydration mismatch (the component is server rendered first, where `sessionStorage` doesn't exist); a `useEffect` calling `setState` trips this project's own `react-hooks/set-state-in-effect` lint rule (from `eslint-config-next/core-web-vitals`, unmodified, not something to weaken). Now a documented project wide convention in `code-standards.md`.
- No server side verification that a rehydrated `sessionStorage` key still points at a real storage object. Deliberately accepted as a cheap risk: nothing in this app deletes resume objects yet, so the failure mode doesn't exist yet. If an orphan cleanup pass is ever built, it must not delete an object a live `sessionStorage` entry might reference.
- Two bugs found by actually driving the app (not by reading code) were fixed directly as mechanical corrections, same precedent as the earlier `insforge.database.from` fix: the Next.js body limit above, and a missing `.catch()` on `ProfileEditor`'s upload promise chain that left the UI stuck disabled forever on any unexpected upload failure.

## Problems solved

- A "resume fails at 2MB" issue found during `/debug` turned out to be a one off, not a real deterministic bug: retested 4 times against the identical file afterward, all succeeded. Correction was written back into the record rather than left as a false lead. If this resurfaces, don't assume it's the same root cause without retesting for determinism first.
- A Playwright script timeout during `/check verify` was a dev server cold start (Turbopack's first compile), not a bug. Confirmed by rerunning the identical script against a warm server.
- The real user's own actual account and resume data exist in the InsForge backend from their own testing (email `mghalynho@gmail.com`, user id starting `1c2b58a4`, 3 resume objects). Every verify session this run identified this account first and left it completely untouched; only throwaway test accounts/objects created within that same session were cleaned up.

## Current state

- Feature 06 (all three revisions) is done: spec 0002 `Accepted`, `/check verify` PASS multiple times with real evidence, `/test` 93/93, `tsc` and `lint` both clean.
- `context/progress-tracker.md`: Phase 2 (Profile Page) fully checked off through 06. Next listed: 07 AI Profile Extraction from Resume.
- Known follow ups, flagged twice now by `/sync`, still not acted on:
  - `context/build-plan.md` lines 109 and 152 still describe the old fixed path `resume.pdf` with `upsert: true` for features 06 and 08. Out of `/sync`'s boundary to fix (reads as forward looking feature planning content); needs a manual pass or should be caught when `/architect` designs feature 08.
  - No cleanup pass exists yet for orphaned resume storage objects (accepted low priority tradeoff, documented in spec 0002's own Follow-up).
  - The `Experience Level`, `Work Authorization`, and `Highest Degree` `<select>` elements (feature 05) still have no blank placeholder option; unresolved, priority undecided.
  - Cover Letter Tone: still undecided whether to add a UI field or drop the unused DB column.

## Next session starts with

Feature 07, AI Profile Extraction from Resume (per `context/build-plan.md`): an "Extract from Resume" button that reads the uploaded PDF's text (`pdf-parse`) and has GPT-4o auto-fill the profile form. Needs `/architect` first, real open decisions include the extraction prompt/schema, how extracted fields merge into `ProfileEditor`'s state without clobbering fields the user already filled in by hand, and the empty/short-text error path already described in `build-plan.md`.

## Open questions

- Whether to fix `context/build-plan.md`'s stale feature 08 text before or during `/architect`'s feature 08 design.
- When feature 13 (Company Research Agent) is spec'd: add a `company_research_completed_at` column, or source feature 16's activity feed from `agent_logs.created_at` instead.
- Whether to ever complete a real, human driven Google or GitHub login to close the last gap in feature 02's verification.
- Cover Letter Tone: add its UI field to match `build-plan.md`/the DB schema, or update those to drop it.
- The design's nav icons and active item underline aren't in the shared `Navbar` component, which instead follows `ui-rules.md`'s "no underline" rule; worth a deliberate decision on which one should actually govern.
- The three `<select>` elements with no blank placeholder option: fix now, or fold into a later polish pass.
