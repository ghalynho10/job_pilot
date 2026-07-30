# 0004. Generate a resume PDF from profile data

**Date**: 2026-07-30
**Status**: Accepted

## Summary

This feature lets a user turn their saved profile into a polished, one page PDF resume with a single click, no upload needed. GPT-4o (an AI language model) writes a short professional summary and turns each job's raw notes into clean bullet points, then the app lays that content into a PDF and stores it. The user can view the result right away, and generating again safely replaces the old file.

## Requirements

**User stories**:
- As a job seeker, I want to generate a resume PDF straight from my saved profile so that I do not have to write or format one by hand.
- As a job seeker, I want to see a clear reason when I cannot generate yet, so that I know what to fill in first.
- As a job seeker, I want to view the resume I just generated right away, so that I can check it before using it.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: Clicking Generate Resume from Profile with a saved profile that has a full name and at least one work experience entry produces a one page PDF containing a written summary, the person's skills, each work experience entry with rewritten bullet points, and education if present.
- **AC-2**: The button is disabled with a plain explanation when the saved profile is missing a full name or has no work experience entries. The same check also runs on the server, independent of whatever the browser currently shows, so a user cannot bypass it by calling the endpoint directly with stale or unsaved data.
- **AC-3**: Generated content never introduces a fact (employer, title, date, or accomplishment) that is not present in the user's own profile; the model only rephrases and elevates the language of what was already entered.
- **AC-4**: After a successful generation, `profiles.resume_pdf_url` points at the new file, and the previous file (whether uploaded or generated) is deleted only after the new one is durably written, never before.
- **AC-5**: After generating, the user can click a "View resume" control that opens a working, freshly minted link to the new PDF; the link is never cached or stored in the browser or the database, only minted at the moment it is needed.
- **AC-6**: A user who is not signed in gets a clear sign in required error and no data is read or written.
- **AC-7**: A user cannot trigger generation using someone else's session in a way that reads or writes another account's profile or storage objects; the endpoint only ever reads and writes the caller's own row, never a client supplied identifier for someone else's data.
- **AC-8**: Every failure point (the AI call, the PDF rendering step, the storage upload, the database write) fails with a clear, generic message to the user and a logged error on the server, never a raw crash or a silent no op.

## Decision

**Chosen option**: Generate on demand through a route handler.

Build one endpoint that does the read, the AI call, the render, and the storage and database write in a single request, following the same shape as the existing extraction endpoint (feature 07).

## Feature design

**Data model sketch**:
No new tables or columns. This feature only ever reads the existing `profiles` row (all fields already defined by spec 0001's schema and spec 0003's extraction feature) and writes a single existing column, `resume_pdf_url` (text, nullable, already used by the upload flow from feature 06). No new entity is introduced.

**State transitions**:
Not applicable. `resume_pdf_url` simply points at whichever file (uploaded or generated) is most recently written; there is no separate state machine for it.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/resume/generate | POST | none (reads the caller's own saved profile) | success flag only, no key or link returned | signed in session, own data only | 401 not signed in, plain `{success:false}` when the profile is missing a full name or work experience, 500 on AI, render, upload, or database failure |
| /api/resume/signed_url | GET | none (reads the caller's own `resume_pdf_url`) | a freshly minted, short lived link | signed in session, own data only | 401 not signed in, plain `{success:false}` when no resume exists yet |

**Key invariants**:
- `resume_pdf_url` always names a real, currently existing object in the resumes bucket, or is empty; it never points at a deleted file.
- A resume file is uploaded under a brand new, random key every time; an existing key is never reused or overwritten.
- The previous file named by `resume_pdf_url` is only ever deleted after the new key has been durably written to the database, never before, so a failure partway through never leaves the user with no resume at all.
- Generated content never states a company, title, date range, or accomplishment absent from the profile it was generated from.

**Security model**:
The resumes bucket is private. The generate endpoint and the signed link endpoint both read and write only the row belonging to the signed in caller; neither accepts a client supplied identifier for whose profile or whose file to act on, so there is no path by which one account can reach another account's resume. No regulated data category applies here beyond this project's existing personal data handling.

**Configuration required**:
None beyond the `OPENAI_API_KEY` this project already configures for feature 07's extraction flow; this feature reuses it, it does not introduce a new credential.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: a saved profile with a full name and one work experience entry produces a working one page PDF reachable through View resume, verifies **AC-1**, **AC-5**.
- Failure case: a saved profile missing work experience is rejected with a plain explanation, both from the button state and from calling the endpoint directly, verifies **AC-2**.
- Auth/permission: a request with no signed in session is rejected before anything is read or written, verifies **AC-6**, **AC-7**.

## Build plan

Ordering follows this project's usual approach of standing up one thin, real, working path end to end first, then improving quality (this matches how feature 07's extraction flow was actually built, and no project wide delivery approach note says otherwise).

1. [x] Add the `@react-pdf/renderer` package (already pre approved in this project's standards, not yet installed), satisfies **AC-1**.
2. [x] Add the small generated content shape (a written summary plus one set of bullet points per work experience entry) to the shared types file, satisfies **AC-1**.
3. [x] Build the function that calls GPT-4o for the written content, validates its shape, and, critically, reconciles the returned bullet points against the profile's actual work experience entries by position, so a dropped or reordered entry from the model never produces an empty or wrong role, satisfies **AC-1**, **AC-3**.
4. [x] Build the PDF layout (name, contact, summary, skills, every work experience entry with its bullet points, and education when present), satisfies **AC-1**.
5. [x] Build the generate endpoint: check sign in, read the caller's saved profile, run the server side completeness check, call the content function, render the PDF, upload it under a new key, write the new key to the profile, and only then remove the previous key if one existed, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-6**, **AC-7**, **AC-8**.
6. [x] Build the signed link endpoint used only by View resume, satisfies **AC-5**.
7. [x] Wire the button and its states (disabled with explanation, working, success with a View resume control, or a plain error) into the profile page, satisfies **AC-2**, **AC-5**, **AC-8**.
8. [x] Add source level tests covering the ordering rules above (check before generation, upload before the database write, the database write before deleting the old file, no key or link ever appearing in the generate response), satisfies **AC-2**, **AC-4**, **AC-7**.
9. [x] Manual verification pass: the disabled state and its explanation, a full generate and view cycle against a real signed in session, and a second generation correctly replacing the first file.

All build tasks are done, typecheck/lint/unit test clean, and `/check verify` has confirmed the feature end to end against real, throwaway InsForge accounts (code in `agent/resume-generator.ts`, `app/api/resume/generate/route.ts`, `app/api/resume/generate/ResumePdfDocument.tsx`, `app/api/resume/signed-url/route.ts`, `types/index.ts`, `components/profile/ResumeUpload.tsx`, `components/profile/ProfileEditor.tsx`).

## Consequences

**Positive**:
- Completes the Profile Page phase; a user can now produce a usable resume from profile data alone, with no file of their own required.
- Reuses every storage, signed link, and error handling convention already established by earlier features, so nothing new has to be learned to maintain it.

**Negative / tradeoffs**:
- Generating overwrites the same field used by the uploaded resume flow from feature 06; a user's originally uploaded file is not kept once they generate one, since only one "current resume" pointer exists. If a user wants to go back to their original upload after generating, they have to upload it again.
- A single request holds the AI call, the render, and the upload together; a slow AI response makes the whole click feel slow, with no partial progress shown meanwhile.

**Neutral**:
- No new environment variables or third party accounts are needed.
- No new background infrastructure (queues, workers) is introduced.

## Follow-up

- [ ] Consider, in a later feature, whether the original uploaded resume should be kept separately from a generated one, if users ask to get back to their original file after generating.
- [ ] `context/build-plan.md`'s feature 08 section describes only the Logic side of this feature (no UI subsection like features 05 through 07 have); once built, `context/progress-tracker.md` and `ui-registry.md` should record the new button states the way earlier features did.

## Rationale

Reasoning and options considered: see `rationale.md`.
