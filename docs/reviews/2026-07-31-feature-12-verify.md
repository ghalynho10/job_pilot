# /check verify: Feature 12 job details page

Date: 2026-07-31
Spec: `docs/specs/0008-job-details-page/index.md`
Result: Blocked

## Evidence collected

- `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test --test-reporter=dot tests/*.test.mjs` exited 0 and ran the repository test suite in dot mode.
- `npx tsc --noEmit` exited 0.
- `npm run lint` exited 0.
- `npm run build` first failed in the sandbox because Next could not fetch Google Fonts. The same command rerun with network access exited 0 and listed `/find-jobs/[id]` as a dynamic route.
- Started the local app with `npm run dev -- -p 3013`.
- `curl -I http://127.0.0.1:3013/find-jobs/6f6d6c30-31ef-4f01-a0a1-17836e4d4db1` exited 0 and returned `HTTP/1.1 307 Temporary Redirect` with `location: http://localhost:3000/login?error=session`.
- `curl -I http://127.0.0.1:3013/find-jobs/not-a-uuid` exited 0 and returned `HTTP/1.1 307 Temporary Redirect` with `location: http://localhost:3000/login?error=session` for a signed-out visitor.
- `curl -I http://127.0.0.1:3013/dev-job-details-preview` exited 0 and returned `HTTP/1.1 404 Not Found`, confirming no temporary preview route is present.

## Acceptance Criteria

- AC-1: Partial. Runtime evidence proves signed-out detail visits redirect to `/login?error=session`; tests and source inspection prove the route scopes the job read by both `id` and `user_id`. Signed-in runtime access was not observed.
- AC-2: Partial. Tests prove malformed IDs call `notFound()` before database read and inaccessible rows call `notFound()` after the scoped read. A signed-in runtime not-found case was not observed.
- AC-3: Passed by tests/source contract. Find Jobs role cells link to `/find-jobs/${job.id}` with keyboard focus styling.
- AC-4: Partial. Tests/source contract prove the header elements and safe external URL resolver. Screenshot comparison against the real route was not completed.
- AC-5: Partial. Tests prove nullable formatting helpers. Desktop/mobile runtime layout proof was not completed.
- AC-6: Passed by tests/source contract. `match_reason` is rendered with an unavailable fallback.
- AC-7: Passed by tests/source contract. Skill arrays normalize empty values and empty groups have visible empty states.
- AC-8: Passed by tests/source contract. `about_role` renders as plain text and optional structured fields render only when normalized.
- AC-9: Passed by tests/source contract. Company research button is disabled and does not call a research API.
- AC-10: Passed by tests/source contract. Both external actions share the safe URL resolver and reject non-HTTP(S) URLs.
- AC-11: Passed by tests/source contract. Job details files avoid hardcoded hex values and raw Tailwind color classes.
- AC-12: Blocked. Command checks passed, but real saved-data desktop and mobile screenshots were not captured.

## Blocker

The spec requires proving the page with real saved data at desktop and mobile widths. No reusable authenticated browser session or test credentials were available. I attempted to use a disposable InsForge auth session for runtime proof, but that would mutate the remote backend by creating an account and was blocked by the approval reviewer. I did not work around that block.

## Verdict

Feature 12 cannot be marked verified yet. The code-level and build evidence is strong, and signed-out protection works at runtime, but `/check verify` should remain blocked until the signed-in real-data route is exercised and desktop/mobile screenshots are captured against `context/designs/job-details.png`.
