# Memory — Feature 09 (Find Jobs Page — Full UI) shipped, uncommitted

Last updated: 2026-07-30

## What was built

Feature 09, Find Jobs Page — Full UI, designed, built, verified, and tested this session, start to finish (not yet committed or PR'd).

- `/architect` produced spec `docs/specs/0005-find-jobs-page-ui/` (index.md + rationale.md + verify.md), status ended `Accepted`. Decision: a fully static UI matching `context/designs/find-jobs.png` exactly, backed by 6 fixed mock rows (Vercel, Stripe, Linear, Notion, OpenAI, Figma) in `lib/mock-jobs.ts`, shaped to mirror the real `jobs` table. The "Find Jobs" button reveals a results area (banner + table) via a single `hasSearched` boolean. The filter input, both dropdowns, and pagination render exactly per the design but are functionally inert; a separate, already-planned feature 11 owns all real interactivity later.
- `/develop` built: `lib/mock-jobs.ts` (the `MockJob` type plus `getMatchScoreTier`), `app/find-jobs/page.tsx` (server auth shell matching the `dashboard`/`profile` pattern exactly), `components/find-jobs/FindJobsPage.tsx` (the whole interactive client component: search form, success banner, filter bar, table with a color coded match score bar and source badges, static pagination footer).
- `/check verify` drove the real, authenticated `/find-jobs` page with a real throwaway InsForge account (this app has no email/password UI, OAuth only, so a temporary sign in route plus injected session cookies were used to reach it as a real signed in user). Confirmed every acceptance criterion with real evidence: screenshots, DOM row counts, a real keyboard Tab walk through every control confirming visible focus rings, and a cookie less browser context confirming the unauthenticated redirect to `/login`. All throwaway infrastructure (account, temp routes, an `insforge.toml` config override) was fully cleaned up afterward. Verdict: PASS.
- `/test` extended (never duplicated) the two test files `/develop` already wrote: `tests/mock-jobs.test.mjs` (+3 tests: schema completeness, salary format, URL validity) and `tests/find-jobs-contract.test.mjs` (+11 tests: match score/source badge mapping correctness, exact pagination text and `aria-current`, the disabled Previous button, the `hasSearched` gating invariant, label/aria-label accessibility, table header semantics, the skip link target). 183/183 tests passing.
- `context/progress-tracker.md` and `context/ui-registry.md` updated; feature 09 marked `[x]` done, "Next" points to feature 10.
- `/debug` ran once on a user report ("no mock data visible"). Reproduced and confirmed it is the confirmed-by-design behavior (results stay hidden until the Find Jobs click), not a bug. Offered to flip it via `/architect`; the user explicitly said to leave it as is.

## Decisions made

- Feature 09 stays strictly UI only, per `context/build-plan.md`'s own phase split: filter, sort, and pagination are visually complete but functionally inert. Feature 11 (already planned, not yet built) owns all real interactivity against real `jobs` table data, with its own semantics (High/Low Match at 70%, 20 rows per page, sort by Match Score/Newest/Oldest). An earlier draft of the spec had made these controls fully interactive with invented, wrong semantics; a cross model check caught this during `/architect` and it was fixed before building, not after.
- The Find Jobs button gates the mock results behind a click (`hasSearched` state) rather than showing them statically on page load. This was `/architect`'s recommendation, confirmed by the engineer at design time, then re-surfaced by `/debug` as a real UX mismatch against the design screenshot (which depicts the already-populated end state, not the empty starting state). The engineer explicitly chose to leave this as is rather than revisit it.
- The SOURCE column is kept (per `build-plan.md`'s text) even though the actual `find-jobs.png` screenshot doesn't show one; this was the engineer's explicit call when the spec's two sources of truth conflicted. Mock `source` values (`search`/`url`) mirror the real `jobs.source` check constraint exactly.
- The match score color bands (green ≥90%, blue 80 to 89%, orange below 80%) are a display rule specific to this page's 6 fixed mock values only, deliberately not a shared threshold function; this is a different concern from feature 11's own Match Score semantics (a 70% cutoff), called out explicitly in `ui-registry.md` so the two are never conflated later.

## Problems solved

- This app has no email/password UI (Google/GitHub OAuth only), so verifying any auth gated page for real requires a throwaway InsForge account created via direct REST calls (temporarily flipping `require_email_verification` off with `npx @insforge/cli config apply`, restoring it right after) plus a temporary, since deleted Next.js route calling `createAuthActions().signInWithPassword()` to mint real session cookies for Playwright. This is now a proven, reusable pattern for verifying any other auth gated page in this project.
- Folder names starting with a leading underscore (e.g. `app/__dev-preview__`, `app/api/__verify_signin__`) are treated by Next.js App Router as private, unrouted folders and 404 silently. Any future throwaway preview or test route must avoid a leading underscore in its folder name.
- `npx --package=playwright -- node script.mjs` fails on ESM `import` (module resolution doesn't consult the npx temp cache); fix is finding the npx cache's `node_modules` path (`~/.npm/_npx/<hash>/node_modules`) and setting `NODE_PATH` for a CommonJS (`.cjs`) script instead. Same fix as a prior feature's session, now used twice, a durable pattern worth remembering directly.
- Playwright's `.focus()` (programmatic) does not trigger the same `:focus-visible` outline a real keyboard Tab press does; must use `page.keyboard.press("Tab")` to accurately test focus-visible styling, never `element.focus()`.
- A stray `sed` backup file (`page.tsx.bak2`) was left in the repo by an earlier temporary edit during `/develop` and only caught by `/test`'s git-status scope check. Worth double checking `git status` for stray `.bak` files after any `sed`-based temporary edit.

## Current state

- Feature 09 is fully done: Design, Build, Verify, and Test all complete. `context/progress-tracker.md` marks it `[x]`, "Next" points to feature 10 (Adzuna Job Discovery). Spec 0005's status is `Accepted`.
- Nothing from this session has been committed or opened as a PR yet (unlike features 06 to 08, which were committed and merged). Current branch is `find-jobs`, not yet merged into `main`. Uncommitted working tree changes: `context/progress-tracker.md`, `context/ui-registry.md` (modified), plus new `app/find-jobs/`, `components/find-jobs/`, `docs/specs/0005-find-jobs-page-ui/`, `lib/mock-jobs.ts`, `tests/find-jobs-contract.test.mjs`, `tests/mock-jobs.test.mjs`.
- All test/debug/verify throwaway infrastructure (accounts, temp routes, the `insforge.toml` override) is fully cleaned up; `require_email_verification` confirmed back to `true`.

## Next session starts with

Decide whether to commit and open a PR for feature 09's changes (still fully uncommitted), matching this project's established squash merge convention, before starting feature 10. Then start feature 10, Adzuna Job Discovery: no spec exists yet, start with `/architect`, then `/develop`, on a fresh feature branch off `main`.

## Open questions

- Whether to ever revisit "results hidden until Find Jobs click": the engineer said leave it as is, but the design screenshot shows the populated state as the default look, so a future review might reconsider this.
- Carried over, still not blocking: orphan cleanup for staged-but-never-saved resume uploads, and whether to ever complete a real human-driven Google/GitHub login to close the feature 02 verification gap.
