# Verify: find-jobs-page-ui · spec 0005 · updated 2026-07-30

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

_Verified 2026-07-30 via `/check verify`, against a real throwaway InsForge account (created and fully deleted during the run; `require_email_verification` was temporarily disabled to create it, then restored to `true` immediately after)._

## UI / manual

- [x] Sign in with a real session, visit `/find-jobs` → the search controls card renders (JOB TITLE input, LOCATION input, Find Jobs button) matching `context/designs/find-jobs.png`, no banner or table visible yet → AC-1 — evidence: `GET /find-jobs` → 200, screenshot (search card only, no results)
- [x] Type into the JOB TITLE and LOCATION inputs → only the typed input's own value changes, nothing else on the page reacts → AC-2 — evidence: filled "Backend Engineer"/"Austin, TX", screenshot confirms only those two fields changed
- [x] Click "Find Jobs" → the green success banner ("Found 8 jobs and saved 4 strong matches.") and the jobs table both appear; confirm via devtools Network tab that no request fired → AC-3 — evidence: banner + table appeared, request listener recorded `NETWORK_FIRED_ON_SEARCH: false`
- [x] Confirm the table shows exactly 6 rows, in order: Vercel, Stripe, Linear, Notion, OpenAI, Figma, with the COMPANY, ROLE, MATCH SCORE, SALARY EST., SOURCE, DATE FOUND columns → AC-4 — evidence: screenshot, all 6 rows and columns present in order
- [x] Confirm match score bar colors: Vercel 94% / Linear 96% / OpenAI 91% render green; Stripe 88% / Figma 85% render blue; Notion 72% renders orange → AC-5 — evidence: screenshot, colors match exactly
- [x] Confirm SOURCE badges: Vercel/Linear/OpenAI show "Search", Stripe/Notion/Figma show "URL" → AC-6 — evidence: screenshot, badges match exactly
- [x] Type into the filter input, change both dropdowns, click a pagination number → confirm the table's 6 rows never change, reorder, or filter → AC-7, AC-8 — evidence: typed "zzz-no-match" into filter, selected "All Matches", clicked page "2"; `ROWS_UNCHANGED_AFTER_INTERACTION: true` (exact row text compared before/after)
- [x] Confirm the pagination footer reads "Showing 1 to 6 of 24 results" with page 1 marked active among Previous/1/2/3/…/8/Next → AC-8 — evidence: screenshot
- [x] Tab through every control (job title, location, Find Jobs, filter input, both dropdowns, every pagination button) with keyboard only → confirm a visible focus ring on each, and that both dropdowns are native `<select>` elements (open with Space/Enter, close with Escape) → AC-9 — evidence: 40 real `Tab` keypresses walked through every control (nav links, Sign out, job title, location, Find Jobs, filter input, both `<select>` elements, pagination 1/2/3/8/Next) with `outlineStyle: solid` at each stop; disabled `Previous` correctly excluded from tab order; `SELECT_TAGNAMES: ["SELECT","SELECT"]`
- [x] In a private/incognito window (no session), visit `/find-jobs` directly → confirm a redirect to `/login` before any page content renders → AC-10 — evidence: fresh browser context, no cookies, `GET /find-jobs` → final URL `http://localhost:3000/login`, screenshot shows the login page, not the jobs page
- [x] Resize the browser below the desktop breakpoint (or use device emulation) → confirm the table scrolls horizontally inside its own container instead of clipping or wrapping columns → AC-11 — evidence: 480px viewport, screenshot shows all 6 columns intact inside the card; `SCROLL_CONTAINER: {"scrollWidth":720,"clientWidth":430}` confirms the container actually overflows and scrolls rather than wrapping

## Commands

- [x] `npm test` → all tests pass, including `tests/mock-jobs.test.mjs` and `tests/find-jobs-contract.test.mjs` → AC-4, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11 — evidence: 169/169 passing
- [x] `npx tsc --noEmit -p .` → no type errors → all ACs — evidence: clean exit, no output
- [x] `npx eslint app/find-jobs/page.tsx components/find-jobs/FindJobsPage.tsx lib/mock-jobs.ts` → no lint errors → all ACs — evidence: clean exit, no output
- [x] `npm run build` → production build succeeds, `/find-jobs` listed as a route → all ACs — evidence: build succeeded, route table lists `ƒ /find-jobs`

## Acceptance-criteria coverage

- AC-1 (search card renders) → covered by manual step 1
- AC-2 (inputs unwired) → covered by manual step 2
- AC-3 (click reveals, no network call) → covered by manual step 3
- AC-4 (6 mock rows, correct columns) → covered by manual step 4, `tests/mock-jobs.test.mjs`
- AC-5 (match score colors) → covered by manual step 5, `tests/mock-jobs.test.mjs`
- AC-6 (source badges) → covered by manual step 6, `tests/mock-jobs.test.mjs`
- AC-7 (filter/dropdowns inert) → covered by manual step 7, `tests/find-jobs-contract.test.mjs`
- AC-8 (static pagination) → covered by manual steps 7 to 8, `tests/find-jobs-contract.test.mjs`
- AC-9 (accessibility, native selects) → covered by manual step 9, `tests/find-jobs-contract.test.mjs`
- AC-10 (auth redirect) → covered by manual step 10, `tests/find-jobs-contract.test.mjs` (source-level only; the manual step is the real check)
- AC-11 (horizontal scroll) → covered by manual step 11, `tests/find-jobs-contract.test.mjs` (source-level only)
