# Verify: Resume PDF Generation from Profile · spec 0004 · updated 2026-07-30

_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Sign in with a saved profile missing a work experience entry → the Generate Resume from Profile button is disabled and shows the hint text → AC-2
- [x] Save a profile with a full name and at least one work experience entry, click Generate Resume from Profile → a success message appears and View resume opens a real, correctly laid out one page PDF (summary, skills, experience with bullets, education if present) → AC-1, AC-5
- [x] Inspect the generated PDF's wording against the profile's own entries → no employer, title, date, or accomplishment appears that wasn't in the profile → AC-3
- [x] Click Generate a second time → the previous storage object is actually deleted at the origin (confirmed via `storage list-objects`, not just a signed URL check, since a CDN edge cache can still serve a stale 200 for a deleted object's old signed URL for a while) → AC-4
- [x] Sign out, then call `POST /api/resume/generate` directly → a clear 401 and no profile row or storage object is touched → AC-6
- [x] Attempt `GET /api/resume/signed-url` for an account with no `resume_pdf_url` set → a clear 404 style `{success:false}`, no crash → AC-5
- [x] Confirm the generate and signed url endpoints never accept or use a client supplied resume key or user id → AC-7
- [x] Attempt `POST /api/resume/generate` for a signed in account whose saved profile has no full name / work experience → a clear, generic error, no crash, no OpenAI/PDF/storage work attempted → AC-2, AC-8

## Commands

- [x] `npx tsc --noEmit` → passes clean → AC-1..AC-8
- [x] `npm run lint` → passes clean → AC-1..AC-8
- [x] `npm test` → 146/146 passing → AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8

## Acceptance-criteria coverage

- AC-1 (generate produces a correct one page PDF) … met: real generation against a seeded profile produced a valid PDF (`%PDF-` magic bytes, 200 status), extracted text showed all four sections correctly
- AC-2 (gate disabled client and server side) … met: button disabled with hint on an incomplete profile (client), and the same account's direct `POST` call returned the gate error (server)
- AC-3 (never fabricates facts) … met: extracted PDF text traced exactly to the seeded profile's own company, title, dates, responsibilities, skills, and education, nothing invented
- AC-4 (new key written, old deleted only after) … met: DB row's `resume_pdf_url` pointed at the new key, and `storage list-objects` confirmed only the new key exists at the origin after a second generation
- AC-5 (View resume mints a fresh, never cached link) … met: the signed URL response is minted per request, resolved to a real PDF; no key or URL ever appears in the generate route's own response
- AC-6 (signed out rejected cleanly) … met: unauthenticated `POST`/`GET` on both routes returned clean 401s, no crash
- AC-7 (no cross account access) … met: neither route accepts a client supplied id; each only ever reads/writes the caller's own row (confirmed by route source and by the signed url route never returning another account's file)
- AC-8 (every failure path is clear, never a crash) … met: the gate failure, the unauthenticated failure, and the missing resume failure each returned a clear, generic `{success:false}` message with no crash
