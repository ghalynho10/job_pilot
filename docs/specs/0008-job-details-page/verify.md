# Verify: 12 Job Details Page · spec 0008 · proposed 2026-07-31

_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these after `/develop`; `/test` should lock the durable ones._

## UI / manual

- [ ] As a signed in user with at least one saved `jobs` row, open `/find-jobs` and activate a job row or role link. The browser lands on `/find-jobs/[id]`, and filtering, sorting, pagination, and the existing table layout still work when returning to the list. Covers AC-3.
- [ ] On the detail page, compare desktop rendering at 1440 by 1600 to `context/designs/job-details.png`: Back to Jobs, header card, company placeholder icon, title, company, match badge, View Job Post button, four info cards, AI Match Reasoning, skills card, Job Description, disabled Company Research empty state, and bottom Apply Now button are present and aligned. The main content width, card order, spacing rhythm, and tokenized colors should visually match the screenshot, allowing only normal text differences from real data. Covers AC-4 through AC-11.
- [ ] Repeat at 390 by 1200 and 768 by 1200. Cards stack cleanly, no text overlaps, no button text clips, and every interactive element has visible keyboard focus. Covers AC-5, AC-10, AC-11, AC-12.
- [ ] Confirm the values come from the saved job row: title, company, salary, location, job type, found date, match score, match reason, matched skills, missing skills, description, and external links. Covers AC-4 through AC-8, AC-10.
- [ ] Open a job row where nullable fields are missing. The page shows deliberate fallbacks, no raw `null`, `undefined`, `NaN`, blank headings, or broken links. Covers AC-5, AC-6, AC-7, AC-10.
- [ ] Click View Job Post and Apply Now when `external_apply_url` exists. Both point to that url, open in a new tab, and include `rel="noopener noreferrer"`. Repeat with only `source_url`. Repeat with unsafe or malformed urls and confirm both actions render unavailable. Covers AC-4, AC-10.
- [ ] Confirm the Research Company button is disabled and does not call a research API, start a browser automation session, update `jobs.company_research`, or render a dossier. Covers AC-9.
- [ ] Visit `/find-jobs/[id]` while signed out. The app redirects to `/login?error=session`. Covers AC-1.
- [ ] Visit `/find-jobs/[id]` with an invalid UUID, a missing id, or an id for another user's job. The app shows not found and does not reveal ownership details. Covers AC-2.

## Commands

- [ ] `npm test` passes, including focused tests for route behavior, safe link generation, nullable rendering, structured field normalization, plain text description rendering, and company research empty state. Covers AC-1 through AC-12.
- [ ] `npx tsc --noEmit` passes with the extended `JobRow` type and no `any` for detail fields. Covers AC-5 through AC-11.
- [ ] `npx next build` succeeds and includes `/find-jobs/[id]`. Covers AC-1, AC-3, AC-12.
- [ ] A visual browser pass uses deterministic fixture rows for happy path, nullable fields, unsafe urls, and cross user access, then captures desktop and mobile screenshots for the detail page and compares them against `context/designs/job-details.png`. Covers AC-2, AC-4, AC-5, AC-9, AC-10, AC-11, AC-12.

## Acceptance criteria coverage

- AC-1 covered by signed out redirect and signed in route access.
- AC-2 covered by missing, malformed, and cross user not found cases.
- AC-3 covered by Find Jobs table navigation and regression checks.
- AC-4 covered by header visual and external View Job Post link.
- AC-5 covered by info cards, fallbacks, and responsive checks.
- AC-6 covered by match reasoning content and fallback.
- AC-7 covered by matched and missing skills rendering.
- AC-8 covered by Adzuna description and optional structured section behavior.
- AC-9 covered by Company Research empty state and no mutation or API call.
- AC-10 covered by bottom Apply Now and external url fallback.
- AC-11 covered by tokenized UI, Navbar shell, and focus visible checks.
- AC-12 covered by screenshots plus test, typecheck, and build commands.
