# Verify: 06 Profile Save Logic · spec 0002 · updated 2026-07-24

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in as a user with no `profiles` row yet, visit `/profile` → form renders all empty, completion ring shows 0%, all ten fields listed as missing → AC-5
- [ ] Edit several fields (full name, phone, add a skill), click Save Profile, reload the page → edited values are still there → AC-1
- [ ] Set Job Titles Seeking to `Engineer, , Product Manager` (extra comma and whitespace), save, reload → field reads back as `Engineer, Product Manager` → AC-2
- [ ] Fill all ten required fields, save → completion ring shows 100%, no missing field pills → AC-3
- [ ] Select a PDF resume in the dropzone, do **not** click Save Profile, navigate away and back → nothing was uploaded (no new object in the `resumes` bucket, `resume_pdf_url` unchanged) → AC-8
- [ ] Select a PDF resume, click Save Profile → `resume_pdf_url` updated to a new key, the object exists in the `resumes` bucket at that key → AC-4
- [ ] Replace an already saved resume with a new PDF, save again → new key stored, the previous object is no longer listed in the bucket → AC-4
- [ ] Select a non PDF file, or one over 5MB → rejected client side immediately; also confirm the server itself enforces this (e.g. call `saveProfile` directly bypassing the client check) → AC-4
- [ ] Complete a profile for the first time (fill the last missing required field and save) → exactly one `profile_completed` PostHog event fires; save again while still complete → no additional event → AC-7
- [ ] Call `saveProfile` without a valid session (expired or missing cookie) → returns a clear `{ success: false, error }` result, never throws → AC-6

## Commands

- [ ] `npx tsc --noEmit` → passes
- [ ] `npm run lint` → passes
- [ ] Query the live `profiles` table after a save → row's columns match exactly what was entered, `cover_letter_tone` untouched → AC-1, AC-2, AC-3

## Acceptance-criteria coverage

- AC-1: covered by the edit/save/reload step and the DB query step
- AC-2: covered by the comma split/join step
- AC-3: covered by the 100% completion step and the DB query step
- AC-4: covered by the select-then-save, replace, and invalid-file steps
- AC-5: covered by the brand new user step
- AC-6: covered by the no-session step
- AC-7: covered by the first-completion step
- AC-8: covered by the select-without-save step
