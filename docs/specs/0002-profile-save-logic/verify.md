# Verify: 06 Profile Save Logic · spec 0002 · updated 2026-07-28

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in as a user with no `profiles` row yet, visit `/profile` → form renders all empty, completion ring shows 0%, all ten fields listed as missing → AC-5
- [ ] Edit several fields (full name, phone, add a skill), click Save Profile, reload the page → edited values are still there → AC-1
- [ ] Set Job Titles Seeking to `Engineer, , Product Manager` (extra comma and whitespace), save, reload → field reads back as `Engineer, Product Manager` → AC-2
- [ ] Fill all ten required fields, save → completion ring shows 100%, no missing field pills → AC-3
- [ ] Select a PDF resume in the dropzone → an object appears in the `resumes` bucket immediately, before Save Profile is ever clicked → AC-4
- [ ] While that upload is in flight, confirm both the Save Profile button and the resume dropzone/file input are disabled, so a second file cannot be picked yet → AC-9
- [ ] After the upload above finishes, do **not** click Save Profile, navigate away and back → `resume_pdf_url` is still unchanged, even though the object from the step above still exists in the bucket, unreferenced → AC-8
- [ ] Select a PDF resume, **wait for that upload to finish**, then before clicking Save Profile select a different PDF → the first upload's object is no longer listed in the bucket; only the second one remains → AC-8, AC-9
- [ ] After a resume has uploaded, click Save Profile → `resume_pdf_url` updates to that upload's key, the object still exists in the `resumes` bucket at that key → AC-4
- [ ] Replace an already saved resume with a new PDF (upload, then Save Profile), save again → new key stored, the previous saved object is no longer listed in the bucket → AC-4
- [ ] Select a non PDF file, or one over 5MB → rejected client side immediately; also confirm the server itself enforces this (e.g. call `uploadResumeFile` directly bypassing the client check) → AC-4
- [ ] Complete a profile for the first time (fill the last missing required field and save, with or without a resume selected) → exactly one `profile_completed` PostHog event fires; save again while still complete → no additional event → AC-7
- [ ] Call `uploadResumeFile` and `saveProfile` without a valid session (expired or missing cookie) → both return a clear `{ success: false, error }` result, never throw → AC-6
- [ ] Select a resume, wait for it to finish uploading, reload the same tab (not a new tab) → dropzone still shows it uploaded and ready to save, no second object appears in the bucket, `resume_pdf_url` is still unchanged → AC-10
- [ ] After the reload above, click Save Profile → the row saves with the rehydrated key, matching the object already in the bucket → AC-10
- [ ] Select a resume, wait for it to finish uploading, open `/profile` in a second, separately signed in tab or session (or sign out and back in on the same tab) → the second session shows nothing selected, not the first session's staged file → AC-10

## Commands

- [ ] `npx tsc --noEmit` → passes
- [ ] `npm run lint` → passes
- [ ] Query the live `profiles` table after a save → row's columns match exactly what was entered, `cover_letter_tone` untouched → AC-1, AC-2, AC-3

## Acceptance-criteria coverage

- AC-1: covered by the edit/save/reload step and the DB query step
- AC-2: covered by the comma split/join step
- AC-3: covered by the 100% completion step and the DB query step
- AC-4: covered by the upload-on-select, select-then-save, replace, and invalid-file steps
- AC-5: covered by the brand new user step
- AC-6: covered by the no-session step
- AC-7: covered by the first-completion step
- AC-8: covered by the select-without-save and replace-before-save steps
- AC-9: covered by the Save Profile disabled during upload step
- AC-10: covered by the same-tab reload, reload-then-save, and second-session steps
