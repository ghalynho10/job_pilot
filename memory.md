# Memory — Feature 08 shipped and merged (Phase 2 complete)

Last updated: 2026-07-30 05:15 EDT

## What was built

Feature 08, Resume PDF Generation from Profile, designed, built, verified, tested, synced, reviewed, and merged this session, start to finish.

- `/architect` produced spec `docs/specs/0004-resume-pdf-generation-from-profile/` (index.md + rationale.md), status ended `Accepted`. Decision: one `POST /api/resume/generate` route handler does the whole thing (read profile, call GPT-4o, render PDF, upload, write DB, delete old file), no background job. Two decisions confirmed with the user before building: the button gates on full name + at least one work experience entry (client hint plus an independent server side re-check against the DB row), and a successful generation shows an inline "View resume" control that mints a fresh signed URL only on click, never cached.
- `/develop` built: `agent/resume-generator.ts` (`generateResumeContent`, GPT-4o `temperature: 0.55`/`max_tokens: 1400`, a zod schema plus manual reconciliation that maps bullets back onto `profile.workExperience` by index with a per-role fallback so nothing is fabricated or left empty); `app/api/resume/generate/ResumePdfDocument.tsx` (co-located inside the route folder, not `components/`, since it needs JSX but the route itself must stay `route.ts`); `app/api/resume/generate/route.ts`; `app/api/resume/signed-url/route.ts` (new, no equivalent existed before, mints a signed link to the caller's own resume on demand); wired the previously dead "Generate Resume from Profile" button in `components/profile/ResumeUpload.tsx` and `components/profile/ProfileEditor.tsx`. Installed `@react-pdf/renderer` (pre-approved, wasn't installed yet).
- `/check verify` drove the real app with real throwaway InsForge accounts (signup via direct API calls, cookie injected into a Playwright session, `require_email_verification` temporarily disabled and restored afterward). Confirmed for real: a generated PDF's text traces exactly to the seeded profile data (no fabrication), the completeness gate rejects both client side and server side, regeneration actually deletes the old storage object (confirmed via `storage list-objects`, not just a signed URL check, since a CDN can serve a stale 200 for a deleted object for a while), and unauthenticated requests to both routes get clean 401s. All throwaway accounts/profiles/storage objects were deleted afterward.
- `/test` added AC-N tags to the whole suite for traceability and two new tests (a `ResumePdfDocument` conditional-rendering check, a cross-account isolation check on the generate route). 148 tests passing at that point.
- `/sync` corrected two stale patterns in `context/library-docs.md` (InsForge storage's `.upload()` only accepts `File | Blob`, not a raw `Buffer`; the `@react-pdf/renderer` example showed JSX called directly, but a route handler must stay `.ts` and can't contain JSX, needs `createElement` from a co-located `.tsx` file) and added the same JSX-in-route-handler rule to `context/code-standards.md`.
- `/imprint` updated `ui-registry.md`'s `ResumeUpload`/`ProfileEditor` entries for the new Generate/View resume states, and found + fixed a real miss: the new "View resume" button was built without the project wide `focus-visible` ring every other interactive element carries. Fixed and locked in with a regression test.
- `/check review` (opus reviewing sonnet's code) returned "Approve with nits": 4 minors, 3 nits, no blockers/majors. All 4 minors and 2 of 3 nits were fixed: capped `workExperience` sent to GPT-4o at 3 entries (defense in depth against response truncation on a large profile, mirroring feature 07's extractor cap), capped the fallback bullet path the same way, added an "unsaved changes" hint in `ProfileEditor` (`canGenerate` used live form state while the server correctly used the saved DB row, causing a confusing enabled-then-rejected or stale-PDF case), gave the completeness gate and AI-failure responses explicit status codes (400/500) instead of an implicit 200, and documented the react-pdf hardcoded-hex carve-out in `library-docs.md`. Left the third nit alone (spec typo `signed_url` vs shipped `signed-url` — spec content, `/architect`'s job not mine). 151 tests passing at the end.
- `/document pr` wrote and opened **[PR #4](https://github.com/ghalynho10/job_pilot/pull/4)**, "Add resume PDF generation from profile". User merged it (squash merge, same convention as #2/#3).
- Post merge: user did `git checkout main` + `git pull` themselves; I deleted the `resume-generator` branch both locally and on `origin`.

## Decisions made

- Generating a resume overwrites the same `profiles.resume_pdf_url` column the upload flow (feature 06) also writes — an accepted, already-decided consequence, not a bug. A user's originally uploaded resume is gone once they generate one.
- Server side is always the source of truth for what gets generated (reads the saved DB row, never trusts client React state) — this is why the client "unsaved changes" hint was added as a UX nicety, not a correctness fix.

## Problems solved

- Next.js Route Handlers must be named `route.ts` (never `.tsx`), so a route needing JSX (the PDF `<Document>`) has to co-locate that piece in its own `.tsx` file and call it via `React.createElement` from the route.
- InsForge SDK's `storage.upload()` is typed `File | Blob` only — a raw Node `Buffer` (from `renderToBuffer`) must be wrapped in `new Blob([new Uint8Array(buffer)], { type: "application/pdf" })` first, or it fails typecheck.
- A deleted storage object's previously minted signed URL can still return a stale `200` from a CDN edge cache for a while after the origin object is actually gone — verified real deletion via `storage list-objects` directly against the origin, not by re-fetching the old signed URL.
- `npx --package=playwright -- node script.mjs` fails on ESM `import` (module resolution doesn't consult the npx temp cache); fixed by finding the npx cache's `node_modules` path and setting `NODE_PATH` for a CommonJS (`.cjs`) script instead.

## Current state

- Phase 2 (Profile Page) is fully complete: features 05 through 08 all done, verified, tested, and merged.
- `main` is up to date with the squash merge (`fe19163`), working tree clean, no local feature branches left over.
- `context/progress-tracker.md` marks feature 08 done and points to Phase 3 — Find Jobs Page as next, starting with feature 09 (Find Jobs Page — Full UI).

## Next session starts with

Feature 09, Find Jobs Page — Full UI, the first feature in Phase 3. No spec exists for it yet, so start with `/architect`, then `/develop`. Create a new feature branch off the current `main` before building (don't build directly on `main`).

## Open questions

- Carried over, still not blocking anything: orphan cleanup for staged-but-never-saved resume uploads (a future storage-maintenance item), and whether to ever complete a real human-driven Google/GitHub login to close the feature 02 verification gap.
