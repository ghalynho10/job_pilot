# 0002. Profile save logic

**Date**: 2026-07-23
**Status**: Accepted

## Summary

This decision wires the already built Profile page (feature 05, mock data only) to the real database. One Server Action saves everything at once: the form fields and, if a new resume was selected, the resume PDF too, all in a single save triggered by the Save Profile button. A single shared rule computes how complete a profile is. No database migration is needed. The trickiest part turned out to be storage: the resume bucket is private, so the app must store the file's key, not a URL, and fetch a short lived link only when it actually needs to show one.

## Requirements

**User stories**:
- As a signed in user, I want to edit my profile and have it actually save, so my information is there the next time I visit.
- As a signed in user, I want to see how complete my profile is and exactly what is missing, so I know what to fill in next.
- As a signed in user, I want my resume saved together with the rest of my profile when I click Save Profile, so there is one clear moment my information is actually stored.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: Saving the profile form persists every editable field to the signed in user's `profiles` row, scoped by row level security, and the saved values are still there after a page reload.
- **AC-2**: `job_titles_seeking` and `preferred_locations` round trip correctly between the form's comma separated text and the database's array columns (split, trim, drop empty entries on save; comma join on read back).
- **AC-3**: The completion percentage, the missing field labels, and the persisted `is_complete` flag are all computed from one shared rule, in one place, never duplicated between the save action and the page that renders the banner.
- **AC-4**: A resume PDF selected or dropped in the upload area is not uploaded right away. It is held and uploaded as part of the same save when Save Profile is clicked. The server enforces PDF only and a 5MB limit itself, not just through the file picker's filter. The key that comes back from storage (not an assumed fixed path) is written to `resume_pdf_url` in the same write as the rest of the profile, and a previous resume, if one existed, is removed from storage only after that write succeeds.
- **AC-5**: A brand new user with no `profiles` row yet sees an all empty form at 0% complete. Clicking Save Profile, with or without a newly selected resume, creates that row; there is no separate "create the row first" step.
- **AC-6**: The save action re-checks that the caller is actually signed in (never assumes the page level redirect already handled it), always returns a structured result (success plus the fields the caller needs, or success `false` plus a human readable error), and refreshes the profile page's data after a successful write.
- **AC-7**: The `profile_completed` analytics event fires exactly once, the moment a profile's `is_complete` flag flips from false to true, not on every later save of an already complete profile.
- **AC-8**: Selecting or dropping a resume without ever clicking Save Profile persists nothing. Leaving the page discards the selection, the same as any other unsaved form field.

## Decision

**Chosen option**: Option 1: One combined save action.

`actions/profile.ts` exports one Server Action, `saveProfile(profile, resumeFile)`, where `resumeFile` is the newly selected `File` if the user picked or dropped one in this session, or `null` if they did not. It saves the form fields and, when `resumeFile` is not null, uploads the resume, in one call, triggered only by the Save Profile button. Backed by two small shared pure helper modules for field mapping and completion. The upload itself is a plain internal function, not its own Server Action.

Storage does not overwrite an existing key; uploading to a key that already exists succeeds under a renamed key instead (confirmed directly against the live backend, see Rationale). Rather than lean on that undocumented renaming behavior, each resume upload targets a fresh, unique key, `${userId}/<a random id>.pdf`, never the fixed `${userId}/resume.pdf`. A unique key never collides, so there is nothing to rename and the response's key always equals the one requested; the app still stores whatever key the response actually returns, as a cheap safety net, not because it expects it to differ.

Before doing any of that, `saveProfile` first reads the caller's current `profiles` row (by `id`, the same row it is about to write). This one read serves two needs at once: it gives the previous `resume_pdf_url`, if any, to delete once the new upload and write both succeed, and it gives the previous `is_complete` value AC-7 needs to detect the false to true transition. Replacing a resume is therefore read old key, upload new file, write the new key to `resume_pdf_url`, then delete the old key. This order means a failed upload or a failed write never costs the user their existing resume.

Holding the selected resume until Save Profile is clicked means the file needs to live somewhere both `ResumeUpload` and `ProfileForm` can reach when the save fires, even though they are separate sibling components. A small client component, `ProfileEditor`, wraps both and owns the shared `resumeFile` state (see Feature design).

**Implementation skills**: `insforge` (`~/.agents/skills/insforge/`, its `storage/sdk-integration.md` and `storage/postgres-rls.md` files)

## Rationale

Reasoning and options considered: see `rationale.md`.

## Feature design

**Data model sketch**:

No migration. Reuses the existing `profiles` table from spec 0001 exactly as is. This feature's job is to populate these columns correctly, not to change any of them:

| Column | Written by | Note |
|---|---|---|
| `id`, `email` | `saveProfile` | always taken from the server side session, never trusted from client input |
| `full_name`, `phone`, `location`, `current_title`, `experience_level`, `years_experience`, `skills`, `industries`, `work_experience`, `education`, `job_titles_seeking`, `remote_preference`, `preferred_locations`, `salary_expectation`, `linkedin_url`, `portfolio_url`, `work_authorization` | `saveProfile` | |
| `resume_pdf_url` | `saveProfile`, only when `resumeFile` is not null | holds the storage object key, not a URL. Each upload targets a fresh unique key (`${userId}/<a random id>.pdf`), so this always matches the requested key; the code still reads it back from the response rather than assuming, as a cheap safety net (see Rationale). Left out of the write payload entirely when no new file was selected, so an unrelated save never touches the existing resume |
| `is_complete` | `saveProfile` | derived, see Key invariants |
| `cover_letter_tone` | never | out of scope for this feature by design |
| `created_at`, `updated_at` | never | database owned (default and trigger) |

**State transitions**: none. A profile has no lifecycle beyond "exists or does not yet exist" and "complete or not," both derived from its fields, not tracked as a separate state machine.

**API surface**:

| Action | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `saveProfile` | Server Action | the whole `Profile` object, plus `resumeFile: File \| null` | `{ success: true, isComplete, resumeKey?: string }`, `resumeKey` is the key storage actually assigned, not necessarily the requested path | signed in session, re-checked inside the action | not signed in, wrong file type, file over 5MB, empty file, database write failure, upload succeeded but the database write of the whole row failed (returned as its own distinct message so the user is not told to re-select a file that is already stored) |

**Key invariants**:
- `is_complete` and the completion percentage and missing field list are always computed by the same one function, fed the same data, so they can never disagree with each other.
- The ten fields that count toward completion are: full name, phone, location, current title, experience level, years of experience, at least one skill, at least one work experience entry, a chosen highest degree, and at least one job title being sought. `percentage = round((10 - number missing) / 10 * 100)`. This exact set was chosen because it reproduces the delivered design's own example precisely: with phone, location, and education missing, seven of ten checks pass, which is exactly the 70% shown in `context/designs/profile.png`.
- A work experience entry that was added but left entirely blank still counts as "at least one entry" under this rule. This is a known, accepted limitation of a simple presence check, not something to silently tighten later without a conscious decision.
- When `resumeFile` is null, `resume_pdf_url` is left out of the write payload entirely, not set to its current value and not cleared. An upsert with that key absent leaves the existing column untouched, so a normal profile edit can never accidentally wipe out an already stored resume.
- Selecting a resume only ever changes client side state (held in `ProfileEditor`, see Decision) until Save Profile is actually clicked. Nothing is written to storage or the database before that click.
- `saveProfile` reads the caller's current `profiles` row first, before making any change. This is what supplies the previous `resume_pdf_url` to delete on a replace, and the previous `is_complete` value AC-7's false to true transition check needs; the client never supplies either, since `Profile` deliberately carries neither field (see Feature design > Data model sketch above).
- Storage never overwrites an existing key; a second upload to the same path succeeds under a silently renamed key instead (confirmed directly against the live backend, see Rationale). Rather than depend on that behavior, each upload targets a fresh unique key, so there is nothing to collide with in the first place. Replacing a resume is therefore: read the old key (from the pre read above), validate and upload the new file to its own unique key, write that key to `resume_pdf_url`, then delete the old key. If that last delete fails, or if the upload succeeds but the row write fails, the newly uploaded object is simply left orphaned in storage; `resume_pdf_url` still correctly points at whichever resume is actually live, so neither failure ever produces a wrong or broken read, only unused storage. Cleaning up orphaned resume objects is out of scope for this feature (see Follow-up).

**Security model**: identical to every other authenticated page in this project. Row level security on `profiles` (spec 0001) already scopes every read and write to `id = auth.uid()`; nothing new is added here. `saveProfile` re-checks `auth.getCurrentUser()` itself rather than trusting that it is only ever reached from the already auth gated `/profile` page, because a Server Action is directly callable over its own endpoint regardless of which page rendered the button that triggers it.

**Configuration required**: none. No new environment variables, secrets, or third party credentials.

**Critical test scenarios**:
- Happy path: edit several fields, select a resume, click Save Profile once, reload the page, every field and the resume key are still there, verifies **AC-1**, **AC-2**, **AC-4**.
- Failure case: two users' data never leaks into each other's row (RLS proves this, not application code), and a save while not actually signed in is rejected with a clear error rather than crashing, verifies **AC-6**.
- Auth/permission: selecting a resume and leaving the page without clicking Save Profile leaves the database untouched, verifies **AC-8**.

## Build plan

1. Add `ProfileRow`, `ProfileWritePayload`, `ActionResult<T>`, and `ProfileCompletionInput` to `types/index.ts`, satisfies **AC-3**
2. Write `lib/profile-completion.ts` (`deriveProfileCompletion`, the ten check table), satisfies **AC-3**
3. Write `lib/profile-mapping.ts` (`mapProfileToRow`, `mapProfileRowToProfile`, `buildEmptyProfile`), satisfies **AC-2**, **AC-5**
4. Write `saveProfile(profile, resumeFile)` in `actions/profile.ts`: read the caller's current `profiles` row first (supplies the previous `resume_pdf_url` and `is_complete`); map fields; when `resumeFile` is not null, validate it (PDF, non empty, under 5MB) before touching storage, then upload it to a fresh unique key (a plain internal function, not its own Server Action); derive completion; build the write payload (including `resume_pdf_url` only when a file was uploaded); upsert; delete the previous resume key only after that write succeeds, if one existed and differs from the new key; fire `profile_completed` on the false to true transition using the pre read `is_complete`; revalidate. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-7**
5. Write `components/profile/ProfileEditor.tsx`, a client component wrapping `ResumeUpload` and `ProfileForm`, owning the `profile` state and the pending `resumeFile` state so one Save Profile click can reach both, satisfies **AC-8**
6. Wire `app/profile/page.tsx` to fetch the real row (`.select("*").eq("id", user.id).maybeSingle()`), replace the mock data, and render `ProfileEditor` in place of the two components it used to render directly, satisfies **AC-5**
7. Wire `ResumeUpload` to only stage the selected file into `ProfileEditor`'s state (idle / selected, no independent upload call, no independent success state), satisfies **AC-8**
8. Wire `ProfileForm`'s Save Profile button to call `saveProfile(profile, resumeFile)` through `ProfileEditor`, with a pending state that also prevents a double click from firing two saves at once, and clear the staged `resumeFile` on success, satisfies **AC-1**, **AC-4**
9. Update `context/progress-tracker.md` once `/check verify` and `/test` both pass

## Consequences

**Positive**:
- The profile page becomes fully real; no more mock data anywhere on it.
- One save, one mental model: nothing is ever persisted until Save Profile is clicked, for every field including the resume. There is no in between "half saved" server state to reason about.
- Completion logic lives in exactly one place, so the banner and the persisted flag can never quietly drift apart.
- No migration risk: this feature only ever populates columns that already exist and are already covered by row level security.

**Negative / tradeoffs**:
- A user who selects a large resume and then leaves the page without clicking Save Profile loses that selection, same as losing any other unsaved field. `ResumeUpload`'s current copy ("click to upload or drag and drop") reads slightly ahead of what actually happens now (select, not upload); worth a small copy pass during build, not a correctness issue.
- `resume_pdf_url` holds an object key rather than a working link, so any future feature that wants to actually show or link to the resume (not just know it exists) needs to mint a signed URL at the point it is needed, not read the column directly.
- Holding a `File` in React state across two sibling components (`ResumeUpload`, `ProfileForm`) needs a small new wrapper component, `ProfileEditor`, that did not exist in feature 05's design. It has to be built and imprinted like any other component, not just wired.
- Storage never overwrites a key, so replacing a resume is a read, upload, write, delete sequence, not a single call, and `saveProfile` needs its own row read before it writes anything. If the delete step fails after a successful replace, or the row write fails after a successful upload, one object is left orphaned in storage rather than actually removed; this never breaks correctness (the database always points at a real, live resume) but does mean each such failure leaves one small piece of unused storage behind, with no cleanup built into this feature.

**Neutral**:
- `context/library-docs.md`'s InsForge Storage example needs a correction after this spec is accepted (see Follow-up); this spec does not edit that file itself.

## Follow-up

- [x] `storage.upload()`'s behavior on re-uploading to an existing key: confirmed by testing directly against the live backend's `PUT /api/storage/buckets/:bucket/objects/:key` endpoint (the exact call the SDK's `upload()` makes) with a real duplicate upload. It does not overwrite or error; it silently succeeds under a renamed key (`resume.pdf` then `resume (1).pdf`, and so on), and the response's `key` field is the only reliable source of truth for what a file actually got saved as. The same test showed the returned `url` needs the caller's own auth to resolve (an anonymous fetch of it returned 401), consistent with the bucket being private; this design never persists that `url` at all, only the key, so its exact expiry was not further pinned down as it does not matter to this feature.
- [ ] After this spec is accepted, correct `context/library-docs.md`'s InsForge Storage section: `.upload()` takes no `{ contentType, upsert }` options object and never overwrites an existing key (it renames on collision instead), and `getPublicUrl()` only works for a public bucket; this project's `resumes` bucket is private, so a signed URL (`createSignedUrl`) is the correct pattern for actually reading a stored resume back, and a replace requires an explicit delete of the old key. This project has no `/sync` scope entry to route this through automatically; it needs a manual pass.
- [ ] Consider a periodic or manual cleanup pass for orphaned resume objects. Two distinct failure paths can leave one behind: the new upload succeeds but the row write fails (the newly uploaded object is never referenced by any row), or the row write succeeds but the following delete of the old key fails (the old object is never referenced anymore). Both are low priority: they cost storage space, never correctness, since `resume_pdf_url` always points at a real, live resume either way.
- [ ] Cover Letter Tone (`cover_letter_tone` column, mentioned in `context/build-plan.md`'s feature 06 text) is out of scope for this feature by decision; a future spec should decide whether to add its UI field or drop the column, rather than it staying unused indefinitely.
- [ ] `jobTitlesSeeking` and `preferredLocations` are stored as arrays but edited as single comma separated text fields. This is a reasonable trade for now; if either field ever needs real per item structure (matching, filtering, tag style editing like Skills already has), that is its own future decision, not something this spec resolves.
