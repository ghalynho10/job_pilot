# 0003. AI Profile Extraction from Resume — Rationale

## Context

The profile page (features 05 and 06) already lets a user type every field by hand and upload a resume PDF, saved on select to InsForge Storage. Most of what a profile form asks for (name, contact details, current title, skills, work history, education) is already written down on the person's resume. Making the user retype it is unnecessary friction, and the project already has the pieces this needs: a staged, already uploaded PDF, an OpenAI GPT-4o integration pattern used elsewhere in the plan (job matching, company research), and a `pdf-parse` text extraction pattern already documented in `context/library-docs.md`.

The open question is not whether to build this (it is feature 07 in `context/build-plan.md`, next in `context/progress-tracker.md`), but exactly how it behaves: what happens to fields the user already filled in by hand, whether the AI should guess at fields a resume does not actually state (job preferences), and how the request is wired given the resume is already sitting in storage before this feature runs. Left undecided, these become guesses made mid build rather than a recorded contract `/develop` and `/check verify` can build and test against.

No new regulated data category is introduced. The resume already lives in a private, authenticated only storage bucket (feature 04); this feature only reads it back, briefly, server side.

## Options considered

### Option 1: Client uploads the resume file directly to a one shot extract endpoint

The Extract button sends the raw PDF file (multipart) straight to the extract route, independent of whatever is already in storage.

**Pros**:
- Works even if the currently staged resume somehow is not the one the user wants extracted.
- No dependency on a signed URL round trip at extraction time.

**Cons**:
- Re-uploads bytes the user already uploaded a moment earlier (feature 06 uploads on select), duplicating network transfer and validation logic that `uploadResumeFile` already does.
- Two different code paths end up validating "is this a real, small enough PDF", one on upload, one on extract, with real risk of the two drifting apart over time.

### Option 2: Reuse the already staged resume key (chosen)

The Extract button carries no file; it sends the `resumeKey` already sitting in `ProfileEditor`'s state (from the existing upload on select flow). The server mints a short lived signed URL, fetches the bytes, and runs extraction from there.

**Pros**:
- No duplicate upload; a single source of truth for "what resume is currently active" (the same key `saveProfile` will persist).
- Matches the signed URL at point of use rule already established in `context/library-docs.md`'s Storage section.

**Cons**:
- Extraction cannot run before a resume has finished staging (button stays hidden until then); this is acceptable since extraction without an uploaded resume has no input anyway.
- Adds one storage read (signed URL mint plus fetch) on the extraction path that Option 1 would not need.

### Option 3: Extract and store raw PDF text at upload time, run GPT-4o only on Extract click

`uploadResumeFile` would also run `pdf-parse` and stash the raw text somewhere (new column, or alongside the staged key in `sessionStorage`), so the Extract click only does the GPT-4o call.

**Pros**:
- Saves re-running `pdf-parse` if the user clicks Extract more than once on the same upload.

**Cons**:
- Adds a new persistence surface (a raw text blob) with no measured performance problem to justify it; `pdf-parse` on a resume sized PDF is fast, this is optimizing a cost that was never shown to matter.
- The stashed text goes stale the moment a different resume is uploaded, another state to keep in sync for no real benefit.

## Rationale

Option 2 wins because this project already committed, in feature 06's second and third revisions, to "upload happens once, on select, and the resulting key is the single source of truth until Save Profile." Option 1 would quietly reintroduce a second upload path the moment a user wants AI help, undermining that decision for no real gain. Option 3 trades a cheap, already fast operation (`pdf-parse` on a resume sized file) for a new piece of state to keep consistent, which the project's own principle against storing derived values without a measured need argues against directly. Option 2 also costs nothing new: the signed URL pattern it relies on is already documented and already used elsewhere in this codebase.
