# Verify: 07 AI Profile Extraction from Resume · spec 0003 · updated 2026-07-29

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in, go to `/profile` with no resume staged → Extract from Resume is not visible in the Resume card → AC-1
- [ ] Select a resume PDF (uploads on select, per feature 06) → Extract from Resume appears → AC-1
- [ ] Click Extract from Resume → button reads "Extracting…", the button, dropzone, and file input are all disabled until it resolves → AC-2
- [ ] Upload a real, well formatted multi section resume PDF and extract it → Personal Info, Professional Info, Work Experience (at most 3 roles), and Education fields populate with values that match the resume → AC-3
- [ ] After that same extraction, confirm Email is untouched (still the signed in account's email) and Job Titles Seeking, Remote Preference, Salary Expectation, and Preferred Locations are all exactly what they were before → AC-3
- [ ] Manually type a value into a field the extraction would also fill (e.g. Current Job Title), then click Extract again → the manually typed value is overwritten by the new extraction (confirms the overwrite merge policy, not a silent skip) → AC-3, AC-8
- [ ] Upload a scanned or image only PDF (no extractable text) and click Extract → sees exactly: "Could not extract text from this PDF. Please try a different file." and no field changes → AC-4
- [ ] Click Extract, then immediately click Save Profile → Save Profile is disabled and does not fire while extraction is in flight → AC-7
- [ ] After a successful extraction, edit a few fields, then extract again from the same or a newly selected resume → fields update again, no errors, repeatable any number of times → AC-8

## Commands

- [ ] `npx tsc --noEmit` → no errors → supports AC-1 through AC-8 (build correctness)
- [ ] `npm run lint` → no errors → supports AC-1 through AC-8 (build correctness)
- [ ] `npm test` → all tests pass, including `tests/resume-extractor.test.mjs` and `tests/resume-extract-route.test.mjs` → AC-3, AC-4, AC-5, AC-6
- [ ] `curl -X POST http://localhost:<dev-port>/api/resume/extract -H "Content-Type: application/json" -d '{"resumeKey":"<a real key belonging to a different signed in user>"}'` while signed in as a different user, using a real session cookie → rejected before any storage read (the ownership check), never a resume from another account → AC-6
- [ ] `curl -X POST http://localhost:<dev-port>/api/resume/extract` with no session cookie at all → `401` with `"You must be signed in to extract a resume."`, no crash → supports AC-6 (already confirmed live during the build; re-run to close the loop)
- [ ] After any extraction attempt (success, empty-text, or malformed-response failure), query the `profiles` table directly for that user → no row change from the extraction call itself (only a subsequent Save Profile click writes) → AC-5

## Acceptance-criteria coverage

- AC-1 (button visibility) covered by the two UI steps above
- AC-2 (loading state, combined disable) covered by the Extract click UI step
- AC-3 (overwrite policy, scope excludes email/job preferences) covered by the real-PDF extraction, the untouched-fields check, and the overwrite-a-manual-edit check, plus the `resume-extractor.test.mjs`/`resume-extract-route.test.mjs` suites
- AC-4 (empty/short text error) covered by the scanned-PDF UI step and the route's exact-copy test
- AC-5 (generic failure, never writes to DB) covered by the DB-read-after-failure step and the "never touches `insforge.database`" route test
- AC-6 (ownership check) covered by the cross-user curl step and the route's ownership-order test
- AC-7 (Save disabled during extraction) covered by the Save-Profile-during-extraction UI step and the `saveDisabled` contract test
- AC-8 (repeatable extraction) covered by the re-extract UI step
