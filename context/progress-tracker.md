# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — Profile Page
**Last completed:** 05 Profile Page — Full UI
**In progress:** none
**Next:** Start 06 Profile Save Logic

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [ ] 06 Profile Save Logic
- [ ] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- Auth uses `@insforge/sdk/ssr` with server owned PKCE cookies.
- Next.js 16 route protection lives in `proxy.ts`.
- OAuth callbacks exchange the InsForge code at `/callback`, then redirect to `/dashboard`.
- The current dashboard page is the authenticated landing shell required to verify the auth redirect. Feature 14 replaces it with the full dashboard UI.
- PostHog initializes through a root client provider and only the four approved product events should be captured by future feature slices.
- Database schema, row level security, and the resumes storage bucket for feature 04 are built, verified, and tested per `docs/specs/0001-database-schema/` (spec 0001, status Accepted) and `docs/specs/0001-database-schema/verify.md`. The migration lives at `migrations/20260718170543_create-core-tables.sql`. `/check verify` proved cross user isolation and account deletion cascade for real, using two throwaway signed in test accounts (created and fully deleted during the run). `/test` extended `tests/posthog-contract.test.mjs` to lock in this session's other change (PostHog event cleanup); feature 04 itself has no application code surface to test, its correctness lives entirely in the verify evidence.
- `/check verify` ran against 02 Auth (no formal spec exists for it, this project's build plan served as the checklist instead): confirmed for real, via direct HTTP against the running dev server, that the login page renders both provider buttons, clicking each one redirects to the real Google or GitHub OAuth authorize URL with the correct client id and scopes, the PKCE verifier cookie is set correctly, all four private routes are middleware protected, and the callback route fails closed (no crash, no leaked internals) on a missing, fake, or tampered code or verifier. The one thing left unverified: actually completing a real third party login end to end, since no browser automation tool is configured in this environment and that requires live Google or GitHub test credentials. Checked off on that basis; if a real login is ever completed and watched by a person, that closes the last gap.
- 05 Profile Page built as `app/profile/page.tsx` (auth-gated, same pattern as `app/dashboard/page.tsx`) composing three new components: `components/profile/CompletionIndicator.tsx` (needs-attention banner with an inline SVG completion ring), `components/profile/ResumeUpload.tsx` (client, drag-and-drop dropzone + Generate Resume button, no upload wiring yet), and `components/profile/ProfileForm.tsx` (client, single `Profile` state object covering Personal Info, Professional Info with tag inputs for skills/industries, Work Experience up to 3 entries, Education, and Job Preferences; Save Profile button not yet wired). Added `types/index.ts` (`Profile`, `ProfileCompletion`, and related field types) and the `lucide-react` dependency (already pre-approved in `code-standards.md`, just not installed yet). Mock data only, matching `context/designs/profile.png`; no save logic (feature 06).
- Visually verified against `context/designs/profile.png` using a Playwright screenshot: launched an isolated dev server on port 3005 (left the user's own port 3000 server untouched), briefly disabled the `/profile` auth gate in `proxy.ts` and `app/profile/page.tsx` for that isolated server only, screenshotted, then immediately reverted both files (confirmed via `git diff`) and tore down the port 3005 server. No console errors. The rendered page matches the design closely. Fixed one real gap found this way: the design's navbar has no Sign out button on the profile page, so `Navbar` is now called with `showAuthAction={false}` there. Two things intentionally NOT changed because they're outside this feature's scope: the design shows small icons and an underlined active state on nav items, but the shared `Navbar` component (used by every authenticated page) has neither, and `ui-rules.md` explicitly says "No underline — active state is color change only" — reconciling that is a cross-cutting `Navbar`/`ui-rules.md` decision, not a Profile-page one. Also, the design has no Cover Letter Tone field under Job Preferences even though `build-plan.md` and the `profiles` DB schema mention one — built to match the screenshot per the design-is-source-of-truth rule; flag this when the field is actually needed (feature 06 or later).

---

## Notes

- Add `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INSFORGE_URL`, and `NEXT_PUBLIC_INSFORGE_ANON_KEY` to `.env.local` before testing OAuth.
- Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.local` before testing analytics.
- Production build verification is pending because the sandbox could not fetch Inter from Google Fonts. Auth tests, TypeScript, and ESLint pass.
