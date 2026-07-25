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

The storage design itself does not depend on which of Option 1 or Option 2 was chosen, and turned out to be necessary once the actual InsForge storage behavior for this bucket was checked, not assumed. `context/library-docs.md`'s cached example shows `.upload(path, buffer, { contentType, upsert })` followed by `getPublicUrl()`. The installed SDK's own type definitions show `upload()` takes no such options object, and `getPublicUrl()`'s own doc comment states it only resolves for a public bucket. A direct check of this project's actual bucket (`npx @insforge/cli storage buckets`) confirms `resumes` is `"public": false`. So `resume_pdf_url` in this design stores the deterministic object key (`${userId}/resume.pdf`), not a URL; anywhere the app later needs an actual link, it mints a short lived one with `createSignedUrl` at render time instead of trusting a persisted URL that may not stay valid. This is flagged in `index.md`'s Follow-up as a correction owed to `context/library-docs.md` itself, so the next feature that touches storage does not repeat the same wrong assumption.

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
