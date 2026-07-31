# Review, job-details-page, 2026-07-31

**Reviewed by**: Codex GPT 5, author unknown
**Scope**: 24 files, job-details-page vs main
**Verdict**: Changes requested

## Summary
This change adds a protected saved job detail route, links it from Find Jobs, scopes job reads to the current user, and builds the feature 12 details UI. The route ownership check and safe external link resolver are sound. The structured list normalizer can still fail the whole page on malformed saved data, which directly conflicts with the feature requirement to ignore malformed legacy values.

## Major
### 🟠 Malformed list data crashes the detail page, `lib/job-details.ts:34`
**Problem**: `normalizeStringList` confirms only that a value is an array, then calls `trim()` on every member. A saved array containing a non string value throws a `TypeError` before the details components can render their empty states.
**Why it matters**: AC 8 requires structured fields to render only when they are non empty and well typed, without rendering malformed legacy values. This affects responsibilities, requirements, benefits, and both skill groups, so one bad stored element makes an otherwise readable saved job unavailable.
**Suggested fix**: Filter members with `typeof item === "string"` before trimming them. Add regression cases with a number, object, and null member and assert that only valid non blank strings reach the UI.

## Minor
### 🟡 Long job facts are clipped, `components/job-details/JobInfoCards.tsx:39`
**Problem**: Each real fact value uses `truncate`, so a long salary, location, or job type is hidden instead of wrapping inside the responsive card.
**Why it matters**: AC 5 requires the real saved values to stack without text clipping. This makes valid saved job data incomplete on both narrow cards and ordinary desktop widths.
**Suggested fix**: Let values wrap or break within the card while keeping the icon column stable. Add a render or browser check with a long location and salary value.

### 🟡 Required signed in visual proof is still absent, `docs/reviews/2026-07-31-feature-12-verify.md:31`
**Problem**: The feature verification record remains blocked because it has no signed in saved data run or desktop and mobile screenshots. The new tests mainly inspect source text and do not render the route with a saved row.
**Why it matters**: AC 12 explicitly requires real desktop and mobile visual proof. The missing check leaves responsive layout, focus visibility, and the user owned data path unproven.
**Suggested fix**: Run the detail route with deterministic owned job fixtures, capture the required desktop and mobile screenshots, and record the completed verification evidence.

## Strengths
The detail query validates the route id and scopes the row by both id and current user id, preserving the intended not found behavior for other users.

Both external actions share one resolver that rejects unsafe schemes and use `noopener noreferrer` for new tabs.

The Company Research card stays a true disabled empty state with no premature API or database behavior.

## Test coverage
`npm test` passed with 250 tests. `npx tsc --noEmit`, `npm run lint`, and `npm run build` also passed. The helper tests cover valid list normalization and safe links, but they do not cover malformed list members. The verification record confirms that signed in desktop and mobile evidence has not yet been captured.
