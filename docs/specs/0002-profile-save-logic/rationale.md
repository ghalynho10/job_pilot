# Rationale: 0002. Profile save logic

Decision record for `index.md`. Not read during a build; kept here for whoever revisits this decision later.

## Context

Feature 05 shipped the full Profile page UI (needs attention banner, resume dropzone, and a large form covering personal, professional, work history, education, and job preference fields) with mock data only, following this project's stated approach of building the UI shell first and wiring logic afterward. Right now the Save Profile button and the resume dropzone are both inert.

The `profiles` table this feature writes to already exists (spec 0001, accepted), including row level security scoped to the signed in user and a private `resumes` storage bucket with path scoped access. Nothing about the data model needs to change.

Two forces shaped this design. First, three fields in the already built `Profile` type do not line up cleanly with their database columns: `jobTitlesSeeking` and `preferredLocations` are single comma separated strings in the UI but `text[]` arrays in the database, and the database has three columns (`cover_letter_tone`, `resume_pdf_url`, `is_complete`) with no matching field in the `Profile` type at all. Second, "how complete is this profile" needs to show up in two different UI elements (a percentage ring and a set of missing field labels) that must never drift out of sync with each other or with the one persisted `is_complete` flag other features will query later (the dashboard's incomplete profile banner, feature 14).

No premise concern. The topic is a single, well scoped wiring decision (connect an already built, already confirmed UI to an already accepted data model); it does not span multiple independent decisions, it does not touch regulated data beyond the row level security already in force, and it has no missing prerequisite (auth and the data model are both already specced and built).

## Options considered

> Revision note: this decision originally chose Option 2 below, based on reading the delivered design's dropzone as an "upload now" affordance. The engineer then asked directly for the opposite: the resume should only save when Save Profile is clicked. That is a genuine product preference, not a technical inevitability either way, so it stands as stated. The options below are kept as originally written, with the chosen option updated to match.

### Option 1: One combined save action (recommended)

A single Server Action takes the whole form plus an optional file, saves everything together, only when Save Profile is clicked.

**Pros**:
- One action to write and reason about, one round trip. One simple mental model: nothing is ever persisted until Save Profile is clicked, for any field, including the resume.

**Cons**:
- A user who selects a resume and then closes the tab without clicking Save Profile loses that selection. Under this decision that is accepted, intended behavior, the same as losing any other unsaved field, not a defect to design around.

### Option 2: Two independent Server Actions, save and upload

`saveProfile` handles the text and array fields. `uploadResume` handles the file, firing the moment a file is chosen or dropped. Each action's write only ever touches the columns it owns.

**Pros**:
- Matches the delivered design's dropzone copy read literally (upload now, save the rest whenever). Because each action's payload only includes its own columns, an upsert from one can never overwrite what the other just wrote, even if both happen to fire close together.

**Cons**:
- Two things to test and reason about instead of one; the "resume uploaded but the rest of the profile is still empty" state is real and has to be an accepted, not confusing, state in the UI. Not chosen: the engineer preferred the simpler single save model over this one.

### Option 3: Client side direct upload, server only for text fields

The browser uploads the file straight to storage using a browser session, and only the text fields go through a Server Action.

**Pros**:
- Skips proxying file bytes through a Server Action.

**Cons**:
- Server Actions in this stack already accept `FormData` with a real `File` natively, so proxying costs nothing extra here. Going client direct would mean re implementing the PDF and size checks in two places (the client actually enforcing them, since nothing server side would ever see the file) rather than treating the server check as the one real boundary, which this project's own standards call for everywhere else.

## Rationale

Option 1 is chosen on the engineer's direct instruction: the resume should only save when Save Profile is clicked, alongside everything else, not the moment a file is selected. This gives the feature one save action and one mental model for the whole form: nothing reaches the database or storage until that one click. `ResumeUpload` and `ProfileForm` are separate sibling components, so making this work means the selected `File` has to live somewhere both can reach; a small wrapper component, `ProfileEditor`, owns that shared state (see `index.md`'s Decision). Option 3 was rejected because this stack already has a native way to send a file through a Server Action, and this project's own standard (every server side write is the one real validation boundary, never the client) applies just as much to a file as to a text field; a client direct upload would create a second, weaker path around that standard.

The storage design itself does not depend on which of Option 1 or Option 2 was chosen, and turned out to be necessary once the actual InsForge storage behavior for this bucket was checked, not assumed. `context/library-docs.md`'s cached example shows `.upload(path, buffer, { contentType, upsert })` followed by `getPublicUrl()`. The installed SDK's own type definitions show `upload()` takes no such options object, and `getPublicUrl()`'s own doc comment states it only resolves for a public bucket. A direct check of this project's actual bucket (`npx @insforge/cli storage buckets`) confirms `resumes` is `"public": false`. So `resume_pdf_url` in this design stores a fresh object key (`${userId}/<a random id>.pdf`), not a URL; anywhere the app later needs an actual link, it mints a short lived one with `createSignedUrl` at render time instead of trusting a persisted URL that may not stay valid. This is flagged in `index.md`'s Follow-up as a correction owed to `context/library-docs.md` itself, so the next feature that touches storage does not repeat the same wrong assumption.

On why `is_complete` is persisted at all, when this project's own expert defaults say not to store derived values: `is_complete` is not a new decision this spec introduces, it already exists as a column in the accepted spec 0001 schema, put there for exactly the cross page use case `project-overview.md` describes (the dashboard's incomplete profile banner, feature 14, needs a cheap boolean without fetching and recomputing the whole profile row from a different page). This spec's job is to populate that column correctly, not to decide whether it should exist. The percentage and the missing field list, which have no such external consumer, are correctly computed at read time per that same default, avoiding any schema change for them.

## Evidence: the InsForge storage findings, checked directly

Three sources were checked directly, not assumed from `context/library-docs.md` alone, per that file's own stated order of authority (MCP or skill first, this file's cached snippets last):

**The installed SDK's own type definitions** (`node_modules/@insforge/sdk/dist/client-Dh7GOydb.d.ts`):
```ts
upload(path: string, file: File | Blob): Promise<StorageResponse<StorageFileSchema>>;
// ...
/**
 * ...if the bucket is public; for private objects use {@link createSignedUrl}.
 */
getPublicUrl(path: string): StorageResponse<{ ... }>;
createSignedUrl(path: string, expiresIn?: number): Promise<StorageResponse<{ ... }>>;
```
No options parameter on `upload()`. `getPublicUrl()`'s own doc comment names its limitation.

**`StorageFileSchema`** (`node_modules/@insforge/shared-schemas/dist/storage.schema.d.ts`) always includes a required `url: string` field on the object `upload()` returns, even for a private bucket.

**The live backend** (`npx @insforge/cli storage buckets --json`):
```json
[{ "name": "resumes", "public": false, "createdAt": "2026-07-18T17:06:17.664Z" }]
```
Confirms `resumes` is genuinely private, not a documentation ambiguity.

**The `insforge` skill's own storage docs** (`~/.agents/skills/insforge/storage/sdk-integration.md`, `~/.agents/skills/insforge/storage/postgres-rls.md`) were read in full. Neither documents what happens when `upload()` targets a key that already exists. The postgres-rls.md file's path scoped bucket pattern matches exactly what spec 0001 already implemented for `resumes`, which is why this spec reuses that pattern rather than proposing a new one.

## Evidence: the upload conflict and URL behavior, resolved by direct test (during /develop)

The two questions the Follow-up list originally left open were resolved by testing directly against the live backend, on the exact endpoint the SDK's `upload()` method calls (traced in `node_modules/@insforge/sdk/dist/index.js`: `PUT /api/storage/buckets/:bucket/objects/:key`, multipart `FormData` with a `file` field), not the CLI's own `storage upload` command, which turned out to hit a different endpoint (`POST .../objects`, the auto generated key path) and would have given a misleading answer.

**Overwrite vs conflict.** Two `PUT` requests to the identical key `__devtest__/put-overwrite-check.pdf`, the first with one file, the second with different content:
```
1st PUT -> { "key": "__devtest__/put-overwrite-check.pdf", "size": 20, ... }
2nd PUT -> { "key": "__devtest__/put-overwrite-check (1).pdf", "size": 55, ... }
```
Confirmed by `list-objects`: both objects exist. The platform never overwrites; it silently renames on any key collision, and the second response's `key` is the only place that new name is disclosed. Both throwaway objects were deleted immediately after the test.

**URL usability.** An unauthenticated `curl` of the first response's `url` returned `401`. The `url` `upload()` returns is not a public or durable link even momentarily; it requires the caller's own auth to resolve. This design already never persists that `url` (only the key), so exactly how long it would stay valid for an authenticated caller was not further pinned down, since it does not affect this feature's design.

This is why the Decision and Feature design sections now describe an explicit upload then delete replace sequence, and why `resume_pdf_url` is documented as holding whatever key the response actually returns rather than the requested path.

## Cross check (a different model, read only) and the fixes it prompted

A read only critique pass on a different model (Opus) was requested by the engineer after this storage revision. It found the replace sequence's safety reasoning sound, but caught one real gap and one worthwhile simplification, both applied:

**The missing pre read.** The original revision said "delete the previous key if one existed and differs from the new one" without ever saying where that previous key comes from. It cannot come from the client: `Profile` deliberately has no `resume_pdf_url` field (see Context, the Profile/database field mismatch), the same reason it also has no `is_complete` field that AC-7's transition check needs. Fixed by adding an explicit first step to `saveProfile`: read the caller's current `profiles` row before writing anything, which supplies both values from one query.

**Depending on undocumented rename behavior was avoidable.** The original revision still uploaded to the fixed `${userId}/resume.pdf` path and leaned on the platform's rename on collision behavior (confirmed above) to get a distinct key back on a replace. The critique pointed out a simpler, more robust alternative: give every upload its own fresh unique key (`${userId}/<a random id>.pdf`) so it never collides with anything, meaning the returned key always equals the requested one and the whole "the key might come back renamed" case never arises. Adopted: `index.md`'s Decision and Feature design now describe unique per upload keys, not a fixed path. The app still reads the key back from the response rather than assuming it, but only as a cheap safety net, not because the design depends on it.

Two smaller items were also applied: the Follow-up item about orphaned storage objects was broadened, since the upload-succeeds-but-row-write-fails path leaves one behind exactly as much as the delete-fails-after-success path does, and `index.md`'s AC-6 wording was loosened from a literal `{ success, error? }` shape to match what the API surface table actually specifies (`isComplete`, `resumeKey` on success).

Not applied: the critique also asked whether two browser tabs saving concurrently is accounted for. It is, generically: this project already treats a profile save as ordinary last write wins (no optimistic concurrency anywhere in this feature), and a concurrent save orphaning one just uploaded resume object is a specific case of the same already accepted, already documented tradeoff, not a new one worth a separate callout.

## Second revision (2026-07-25): resume uploads on select again

> Revision note: this decision's first revision (above) deliberately moved away from uploading on select, on the engineer's direct request, in favor of one save moment for everything. The engineer has now asked to move the resume upload back to firing on select, this time knowingly trading away the second half of that benefit (one shared save moment) to get faster feedback on the file itself. This section records that second, narrower reversal; the original Option 1 vs Option 2 choice above (one combined action vs two fully independent ones) is not what is being reopened; the choice this time is about *when the file's bytes leave the browser*, not about whether the profile row's fields still share one save action.

### Option A: upload on select, defer only the database write (chosen)

`uploadResumeFile` uploads the file the moment it is selected and returns a key. `saveProfile` still only writes `resume_pdf_url` when Save Profile is clicked, exactly as every other field.

**Pros**:
- Keeps one save moment for the actual persisted record; a person can never end up with a resume attached to a profile they otherwise never saved a single field of.
- Bad files (wrong type, too large, a failed upload) surface immediately, not after the person has also filled in the rest of a long form.

**Cons**:
- Two moments to explain instead of one: the file itself leaves the browser on select, but is not "part of the profile" until Save Profile. Orphaned, never saved uploads become the common case, not the rare one (see Consequences in `index.md`).

### Option B: upload and save both fire on select

`uploadResumeFile` uploads the file and writes `resume_pdf_url` to the row in the same call, independent of `saveProfile` and the Save Profile button entirely.

**Pros**:
- Genuinely nothing left to do once a file is picked; matches a fully literal reading of "upload immediately."
- No client side "which key is still unsaved" bookkeeping needed at all.

**Cons**:
- Breaks the one deliberate save moment for the record itself, the exact property the first revision was chosen for. A person could pick a resume, close the tab having touched nothing else, and come back to find their profile's resume field already changed, while every other field they may have half filled in is gone. Rejected: the engineer confirmed the resume should still wait for Save Profile at the database layer, only the upload itself should move earlier.

### Rationale (second revision)

Option A is chosen because it isolates exactly what the engineer asked to change (upload timing) without also reopening what they did not ask to change (one save moment for the persisted record). Deferring only the database write keeps `saveProfile`'s existing replace sequence, its `is_complete` transition check, and its RLS backed row read all untouched; the only thing removed from it is the upload block itself, which becomes `uploadResumeFile`.

The follow on question, what happens to a resume that was uploaded but never saved, was resolved the same way: best effort delete the previous unsaved upload when a person replaces their selection before saving (a `previousUnsavedKey` param on `uploadResumeFile`, cleaned up server side, never left to the client to enforce), and accept, as a known and now more frequent tradeoff, that a person who selects once and simply abandons the page leaves that one object behind. A stronger guarantee here (say, a scheduled sweep of unreferenced objects, or requiring the client to call a cleanup endpoint on unmount) was considered and rejected as disproportionate: the cost of an occasional orphaned PDF is storage space, not correctness or user visible behavior, and this project's own standard for this exact tradeoff was already set in the first revision (see Follow-up in `index.md`).

The resume's interaction with profile completion needed a direct answer too, since it was an open question when this revision started: there is none. The ten fields `deriveProfileCompletion` checks (full name, phone, location, current title, experience level, years of experience, at least one skill, at least one work experience entry, a chosen highest degree, at least one job title sought) never included the resume in either revision. Moving the upload earlier changes nothing about when a profile crosses into 100% complete or when `profile_completed` fires.

## Cross check (a different model, read only) and the fix it prompted

A read only critique pass on a different model (Opus) was requested by the engineer for this second revision, the same practice already used for the storage design in the first revision above. It found the storage reasoning (unique keys, deferred database write, read before write, key not URL) internally consistent, and confirmed the "uploaded, then a long edit, then finally save" concern is already handled, since the key is stored and read back at save time regardless of how much time passed in between. It also caught one real correctness gap and flagged two things worth naming explicitly, all applied:

**The missing reselect lock.** As first written, nothing stopped a person from picking a second file while the first upload was still in flight. AC-9 only disabled Save Profile, not the resume control itself. Two concrete failures follow from that: the first upload's key might not exist in `ProfileEditor` state yet when the second one fires, so it could never be passed to `previousUnsavedKey` and would leak; or, if the two uploads settle out of order, the older one could end up as the `resumeKey` that Save Profile actually persists, silently saving the wrong resume. Fixed by widening AC-9 and the Decision: `ResumeUpload`'s file input and dropzone are now disabled for the entire time an upload is in flight, not only Save Profile. This guarantees at most one `uploadResumeFile` call is ever outstanding, which is also what makes `previousUnsavedKey` reliable in the first place.

**The lost response case was a real, unnamed orphan path.** `uploadResumeFile` can succeed on the server while its response never reaches the client (a dropped connection, a closed tab mid request). The object exists, but `ProfileEditor` never learns its key, so it can never reach `previousUnsavedKey` and the UI correctly, if misleadingly, shows the selection as failed. This is not a new class of problem, it is the same accepted "orphan without a corresponding save" tradeoff already named above, just triggered by the network instead of the person. Added as its own explicit bullet in `index.md`'s Key invariants rather than left implicit, since it does not go through the same cleanup path as a normal reselect.

**A stale sentence, left over from the first revision.** `index.md`'s first user story still read "I want my resume saved together with the rest of my profile when I click Save Profile, so there is one clear moment my information is actually stored," directly contradicting the two moment model this revision describes. Fixed by rewriting it to match the resume specific story (fast feedback on selection) that this revision is actually about.

Not applied: a suggestion to add a timeout or cancel affordance for an upload that never settles. Noted instead as a Follow-up in `index.md`; there is no evidence yet that uploads to this bucket hang, and adding cancellation now would be solving a problem this feature has not actually observed.

## Third revision (2026-07-28): the staged upload survives a refresh

> Revision note: the engineer found the second revision's tradeoff surprising in practice, not wrong: selecting a resume and then refreshing the page (by habit, or by accident) made the file look like it had vanished, even though it was already sitting in storage. This section records a narrow addition, not a reversal: nothing about when the database is written changes, AC-4 and AC-8's database side guarantees are untouched. The only thing that changes is whether the browser remembers a staged, not yet saved upload across a reload of the same tab.

### Option A: mirror the staged key into sessionStorage, namespaced per user (chosen)

`ProfileEditor` writes `resumeKey`/`resumeFileName` into `sessionStorage`, under a key that includes the signed in user's id, every time an upload resolves, and clears that entry the moment `saveProfile` succeeds. On mount, it reads that entry once to initialize state instead of always starting empty.

**Pros**:
- Tab scoped by construction (`sessionStorage` is never shared across tabs, and is cleared when a tab closes), which sidesteps the two hardest questions this could have raised: two tabs racing each other, and a stale entry outliving the session. Neither can happen.
- No new server surface at all. `saveProfile` and `uploadResumeFile` are both completely unaware this exists; a rehydrated key is just a string, identical to one resolved moments ago.

**Cons**:
- One more place (`sessionStorage`) that has to be kept in sync with the React state, even though it only has two write points and one read point, so the actual risk of drift is low.
- Cannot detect that the staged object was deleted out from under it (nothing does that yet) or, in principle, that a stale namespaced entry from a very old tab session still lingers; accepted, covered in Follow-up.

### Option B: write resume_pdf_url to the database immediately on upload

Persist the key to the `profiles` row the moment `uploadResumeFile` succeeds, the same option already considered and rejected in the second revision, revisited here because it would also solve "survives a refresh" for free, the row itself becomes the source of truth.

**Cons**:
- Rejected again, for the same reason as before: it breaks the one deliberate save moment for the persisted record. A person could refresh, see their resume already attached, and reasonably but wrongly assume the rest of their edits were saved too. Solving a refresh annoyance is not worth reopening a guarantee the engineer specifically asked to keep.

### Option C: localStorage instead of sessionStorage

Same mechanism as Option A, but with `localStorage`, so the staged upload would also survive closing and reopening the tab, or the whole browser.

**Cons**:
- Not what was asked (the engineer described refreshing the page, not reopening the browser days later), and it reopens exactly the questions Option A avoids for free: a stale key from a browser session long past could now collide with a resume someone else saved from a different tab in between, this becomes a real staleness problem to solve rather than a structurally avoided one. Rejected as solving a bigger problem than the one that exists, at a real cost in correctness risk.

### Rationale (third revision)

Option A is chosen because `sessionStorage`'s own scoping rules do the hard work: tab scoped and clear on tab close are exactly the two properties that make "no cross tab staleness to reason about" true by construction, not by anything this app has to check. Namespacing by user id was the one addition needed on top of that, so a second person signing in on the same tab never sees the first person's staged file; no explicit sign out handling was needed once the namespace itself decides what is readable, one less thing to get wrong.

The harder question, "what if the staged key no longer points at a real object," was deliberately not solved with a verification round trip. Nothing in this project deletes a resume object today (the orphan cleanup Follow-up item was never built), so the failure mode this would guard against does not exist yet; adding a check for it now would be solving a problem that is still hypothetical, at the cost of a network round trip on every page load just to render the dropzone. If the cleanup pass is ever built, it inherits a concrete constraint instead: do not delete an object a live `sessionStorage` entry might reference, a grace period on anything recently uploaded is enough (see Follow-up in `index.md`).

## Cross check (a different model, read only) and the fixes it prompted

A read only critique pass on a different model (Opus) was requested by the engineer for this third revision, the same practice used for the first two. It found no way for this design to cause the wrong resume to get saved, confirmed the cross account namespacing holds, and confirmed the `sessionStorage` unavailable fallback is sufficient. It caught one real implementation hazard and two documentation gaps, all applied:

**The mount read, as first written, would have caused a hydration mismatch.** `ProfileEditor` is a Client Component that Next.js still renders on the server first, where `sessionStorage` does not exist at all. The original wording, "read that namespaced entry once and initialize `resumeKey`/`resumeFileName` from it" without saying where, reads naturally as doing that read inside the `useState` call itself. That would make the client's very first render disagree with the server rendered HTML the instant something is actually staged, a real hydration mismatch, not a stylistic nitpick. Fixed by making the timing explicit in both the Decision and the Build plan: state initializes at `null`, matching the server render, and the rehydration read happens in a `useEffect` that runs once after mount, at the cost of one frame showing the idle state before it flips to uploaded.

**Whether `ResumeUpload` needed a new concept to display a rehydrated resume was never stated.** It does not: `ResumeUpload` already renders purely from `isUploading`, `uploadedFileName`, and `uploadError`, and the rehydrated `resumeFileName` flows into `uploadedFileName` through the exact same prop it already receives for a same session upload. Added as an explicit Key invariant so `/develop` does not invent a redundant status field.

**AC-8 and AC-10 read as contradictory at the acceptance criteria level.** AC-8 said leaving the page after selecting a resume always orphans the upload; AC-10 now says a refresh recovers it. The Consequences section already reconciled this in prose, but the two ACs themselves did not point at each other. Fixed with one added sentence on AC-8: a refresh of the same tab is not "leaving the page" for this purpose.

Not applied: the critique's note that many different users signing into the same tab over time could leave many namespaced `sessionStorage` entries behind. Confirmed as not a real concern: `sessionStorage` is cleared the moment a tab closes, so this can only ever accumulate within one still open tab across however many sign ins happened in it, bounded and cheap, not the kind of unbounded growth worth engineering around.
