# Memory — Feature 07 AI Profile Extraction from Resume

Last updated: 2026-07-30 00:50 EDT

## What was built

- `docs/specs/0003-ai-profile-extraction-from-resume/` (directory spec: `index.md`, `rationale.md`, `verify.md`), designed via `/architect`, status `Accepted`.
- `types/index.ts`: added `ExtractedProfileFields` (a `Pick<Profile, ...>` covering only the fields a resume actually states; deliberately excludes `email` and the four Job Preferences fields).
- `agent/resume-extractor.ts` (new file, new `agent/` directory): `extractProfileFromResumeText(text)`, this project's first `agent/` function calling OpenAI's chat completions API directly (not through Stagehand). `gpt-4o`, `temperature: 0.3`, `max_tokens: 800`. Exports `extractedProfileSchema`, a `zod` schema with per-field `.catch()` coercion (one bad enum value from GPT-4o doesn't waste the whole extraction) and `workExperience` capped to the first 3 entries via `.transform(...slice(0, 3))` (not `.max(3)`, which would have wiped the whole array on a 4th entry instead of truncating it).
- `app/api/resume/extract/route.ts` (new file, new `app/api/resume/` directory): POST handler — auth check, `resumeKey` ownership check (`${userId}/` prefix) before any storage read, mints a signed URL, fetches the PDF, extracts text via `pdf-parse`, guards on empty/short text, calls the agent function. Never writes to the database.
- `components/profile/ResumeUpload.tsx`: new `canExtract`/`isExtracting`/`onExtract`/`extractError` props; an Extract from Resume button shown only once a resume is staged; the dropzone/file input/Extract button disabled condition is now a combined `isBusy = isUploading || isExtracting`.
- `components/profile/ProfileEditor.tsx`: new `isExtracting`/`extractError` state; `handleExtract` posts to the new route with the staged `resumeKey`, merges a successful result onto `profile` via object spread (full overwrite of the extractable fields), handles both a `{success:false}` response and an outright fetch rejection. `ProfileForm`'s `saveDisabled` now covers `isUploading || isExtracting`.
- New dependencies: `openai`, `pdf-parse` (v2, a completely different API from v1), `zod`.
- Tests: `tests/resume-extractor.test.mjs` (9 tests, schema coercion + error-branch source-contract checks), `tests/resume-extract-route.test.mjs` (10 tests, auth/ownership/DB-never-written/error-copy/worker-import-order), plus 6 new/updated tests in `tests/profile-contract.test.mjs` for the new wiring. Full suite: 119/119 passing. `tsc`/`lint` clean.

## Decisions made

- Merge policy: **overwrite**. Every extraction run replaces the extractable fields in the form, even ones the user already edited by hand. Confirmed directly with the engineer; the tradeoff (a second extraction can silently discard a manual edit made since the first) is accepted, not a gap.
- Job Preferences scope: **skip entirely**. Extraction never touches Job Titles Seeking, Remote Preference, Salary Expectation, Preferred Locations, or Email — the response schema has no slot for them at all, not just an empty one, so GPT-4o can't invent them.
- Extraction reuses the resume already staged from feature 06's upload-on-select flow (server mints a fresh signed URL and reads it) rather than re-uploading the file to a separate one-shot endpoint.
- No new PostHog event added for extraction (build-plan.md doesn't specify one for this feature, and `code-standards.md` caps the event list at 4).
- This project has no `docs/scope/`; `context/progress-tracker.md` + `context/build-plan.md` remain its tracker of record. Confirmed explicitly with the engineer during `/architect` rather than introducing `docs/scope/` for one feature.

## Problems solved

- **Real bug found by `/check verify` and fixed by `/debug`**: `pdf-parse` v2 wraps `pdfjs-dist`, which needs its worker module registered as a real import, not a bundler-resolved chunk, or every call fails under Next.js's server bundler with `Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'`. A plain `node --experimental-strip-types` script parsing the same PDF worked fine during `/develop` (masked the bug, since that path bypasses Next.js's bundler entirely) — this is why it only surfaced once actually driven through the real app. Fixed per the library's own troubleshooting docs (fetched directly, not guessed): `app/api/resume/extract/route.ts` now does `import "pdf-parse/worker"` before `import { PDFParse } from "pdf-parse"`, and `next.config.ts` gained `serverExternalPackages: ["pdf-parse"]`. Reproduced deterministically before and after the fix; regression test added and confirmed it fails without the fix.
- **Verification technique for a Google/GitHub-OAuth-only app with no browser MCP**: signed up a throwaway account directly against InsForge's REST API (`POST /api/auth/users?client_type=server` with the anon key as bearer auth, after temporarily setting `require_email_verification: false` via `npx @insforge/cli config apply`, planned then applied then restored), then cookie-injected the returned `insforge_access_token`/`insforge_refresh_token` (found in the SDK's own `dist/ssr.js`: `DEFAULT_ACCESS_TOKEN_COOKIE`/`DEFAULT_REFRESH_TOKEN_COOKIE`, plain JWT string values, no JSON wrapping) into a real Playwright browser context. Playwright itself was run via `npx --package=playwright -- node script.cjs` with `NODE_PATH` pointed at the npx cache's `node_modules` (CJS `require`, not ESM `import`, since ESM ignores `NODE_PATH` for bare specifiers) — no dependency was added to the project. Test PDF fixtures were generated with macOS's built-in `cupsfilter` (`cupsfilter file.txt > file.pdf`), not a hand-rolled PDF or a new library. A second `next dev` instance on a different port refuses to start if the engineer's own dev server is already running in the same project directory (Next.js detects a project-level lock) — hit the existing server directly instead.
- **Found, not caused**: deleting a throwaway InsForge auth account does NOT cascade-delete its storage objects (only DB rows do); objects uploaded directly (not through the app's own upload flow) must be deleted explicitly via `DELETE /api/storage/buckets/:bucket/objects/:key`. Corrected a prior progress-tracker.md note that could be read as claiming full cascade.
- A transient `InsForgeError: Presigned upload failed` was hit once mid-verification; retried 4/4 successfully right after. Consistent with this project's own prior documented finding (feature 06) that this is an occasional InsForge hiccup, not a deterministic bug — didn't chase it further.

## Current state

- Feature 07 is fully done: spec 0003 `Accepted`, `/check verify` PASS (all 8 ACs met with cited evidence from a real run), `/test` 119/119, `context/progress-tracker.md` marks it complete.
- Three stale doc corrections identified during this session's verify/debug/sync passes were fixed by hand afterward (no skill owns `context/*.md`, confirmed by `/sync`, which only touches `AGENTS.md`/spec-status/scope): `context/library-docs.md`'s `pdf-parse` section now shows the real v2 API; `context/build-plan.md`'s feature 07 section now states the Job-Preferences-skip/email-exclusion scope; `context/progress-tracker.md`'s feature 04 note now clarifies the account-deletion cascade is DB-row-only, not storage.
- Current branch is `resume-extraction`, everything still uncommitted (no commits made this session; the user hasn't asked to commit).

## Next session starts with

`context/progress-tracker.md` names 08 Resume PDF Generation from Profile as next (Phase 2's last feature). It will need `/architect` first (no spec exists yet) — `context/build-plan.md`'s feature 08 sketch: `POST /api/resume/generate`, GPT-4o generates polished resume content from the profile, `@react-pdf/renderer` renders it to a PDF buffer via `renderToBuffer()`, uploaded to a fresh unique storage key, previous key deleted only after the new key is written to `profiles`. `@react-pdf/renderer` is not yet installed (pre-approved in `code-standards.md`, same pattern as this session's `pdf-parse`/`openai`/`zod`).

## Open questions

- Whether to commit the `resume-extraction` branch's work (nothing committed yet this session).
- Orphan cleanup for staged-but-never-saved resume uploads (feature 06 era) is still an open future storage-maintenance item, unrelated to feature 07.
- Whether to ever complete a real human-driven Google/GitHub login to close the last remaining feature 02 verification gap (long-standing, not touched this session).
