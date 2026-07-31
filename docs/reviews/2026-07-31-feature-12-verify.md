# /check verify: Feature 12 job details page

Date: 2026-07-31
Spec: `docs/specs/0008-job-details-page/index.md`
Result: Passed

## Evidence collected

- `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test --test-reporter=dot tests/*.test.mjs` exited 0 and ran the repository test suite in dot mode.
- `npx tsc --noEmit` exited 0.
- `npm run lint` exited 0.
- `npm run build` first failed in the sandbox because Next could not fetch Google Fonts. The same command rerun with network access exited 0 and listed `/find-jobs/[id]` as a dynamic route.
- Started the local app with `npm run dev -- -p 3013`.
- `curl -I http://127.0.0.1:3013/find-jobs/6f6d6c30-31ef-4f01-a0a1-17836e4d4db1` exited 0 and returned `HTTP/1.1 307 Temporary Redirect` with `location: http://localhost:3000/login?error=session`.
- `curl -I http://127.0.0.1:3013/find-jobs/not-a-uuid` exited 0 and returned `HTTP/1.1 307 Temporary Redirect` with `location: http://localhost:3000/login?error=session` for a signed-out visitor.
- `curl -I http://127.0.0.1:3013/dev-job-details-preview` exited 0 and returned `HTTP/1.1 404 Not Found`, confirming no temporary preview route is present.
- The engineer signed in with an existing account and opened a real saved job detail row.
- Desktop screenshot evidence: `/Users/ghaly/Desktop/feature12-job-details-desktop.png`. It shows the signed in job details page with Navbar, Back to Jobs, header, company icon placeholder, title, company, match score badge, View Job Post, four info cards, AI Match Reasoning, skills card, and Job Description.
- Mobile screenshot evidence: `/Users/ghaly/Downloads/feature12-job-details-mobile.png`. It shows the signed in job details page stacked cleanly with header, info cards, AI Match Reasoning, skills, Job Description, disabled Company Research empty state, and bottom Apply Now button.
- Final command gates after review fixes: `npm test` exited 0 with 251 passed and 0 failed, `npx tsc --noEmit` exited 0, `npm run lint` exited 0, and `npm run build` exited 0 with network access for the Google Fonts fetch.

## Acceptance Criteria

- AC-1: Passed. Runtime evidence proves signed-out detail visits redirect to `/login?error=session`; tests prove the route scopes the job read by both `id` and `user_id`; uploaded screenshots prove signed-in access to a real saved job detail row.
- AC-2: Passed with automated coverage. Tests prove malformed IDs call `notFound()` before auth or database work and inaccessible rows call `notFound()` after the scoped read.
- AC-3: Passed by tests/source contract. Find Jobs role cells link to `/find-jobs/${job.id}` with keyboard focus styling.
- AC-4: Passed. Tests prove the header elements and safe external URL resolver; the desktop and mobile screenshots show the real route header and View Job Post surface.
- AC-5: Passed. Tests prove nullable formatting helpers and wrapped info card values; the screenshots show desktop and mobile info cards with no overlap.
- AC-6: Passed by tests/source contract. `match_reason` is rendered with an unavailable fallback.
- AC-7: Passed by tests/source contract. Skill arrays normalize empty values and empty groups have visible empty states.
- AC-8: Passed by tests/source contract. `about_role` renders as plain text and optional structured fields render only when normalized. Malformed legacy list entries are ignored safely.
- AC-9: Passed. Tests prove the Company Research button is disabled and does not call a research API; the mobile screenshot shows the disabled empty state.
- AC-10: Passed. Both external actions share the safe URL resolver and reject non-HTTP(S) URLs. The screenshots show View Job Post and Apply Now surfaces.
- AC-11: Passed. Job details files avoid hardcoded hex values and raw Tailwind color classes. The screenshots show the existing Navbar shell and responsive tokenized UI.
- AC-12: Passed. Command checks passed, and real saved data desktop and mobile screenshots were captured and inspected.

## Remaining Limits

- I did not personally drive a signed-in invalid or cross-user job id in the browser. That behavior is covered by route tests and source contract checks.

## Verdict

Feature 12 is verified. The real signed-in saved job detail page was shown in desktop and mobile screenshots, signed-out protection worked at runtime, and the final test, typecheck, lint, and build gates passed.
