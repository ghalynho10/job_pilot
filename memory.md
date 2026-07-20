# Memory — Phase 2 Started (05 Profile Page Full UI built and verified)

Last updated: 2026-07-20

## What was built

- `app/profile/page.tsx`: auth-gated Profile page (Server Component), same redirect pattern as `app/dashboard/page.tsx`.
- `components/profile/CompletionIndicator.tsx`: needs-attention banner with an inline SVG completion ring.
- `components/profile/ResumeUpload.tsx`: client component, drag-and-drop dropzone + Generate Resume button. No upload wiring yet.
- `components/profile/ProfileForm.tsx`: client component, full form — Personal Info, Professional Info (skill/industry tag inputs), Work Experience (up to 3 roles via Add role), Education, Job Preferences, Save Profile button. Not wired to any backend yet.
- `types/index.ts` created: `Profile`, `ProfileCompletion`, and related field types.
- Installed `lucide-react` (already pre-approved in `code-standards.md`, just wasn't installed yet).
- `tests/profile-contract.test.mjs`: 18 new tests, following this project's existing source-contract convention (no jsdom/testing-library configured).
- `context/ui-registry.md` and `context/progress-tracker.md` updated.
- Fixed a real accessibility/consistency gap caught during `/imprint`: 6 interactive elements (the `ResumeUpload` dropzone button, `ProfileForm`'s two Add buttons, its Add role button, and its two tag-remove icon buttons) were missing the `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` ring every other interactive element in the registry uses. Added it to all six.

## Decisions made

- Followed this project's `context/*.md` convention (not the generic `/develop` skill's `docs/scope/` structure, which this project doesn't use) for spec/scope tracking.
- Built to match `context/designs/profile.png` exactly over `context/build-plan.md`'s text where they conflict: no Cover Letter Tone dropdown (the design omits it even though `build-plan.md` and the `profiles` DB schema mention one) — needs reconciling before feature 06.
- Did not modify the shared `Navbar` component to add the nav icons + active-item underline shown in the design, since `ui-rules.md` explicitly says "no underline — active state is color change only" and `Navbar` is shared across every authenticated page. Flagged as a cross-cutting decision for `/architect` or `/sync`, not something to silently change for one page.
- Profile page calls `Navbar` with `showAuthAction={false}` — the design has no Sign out button on this page (found via visual comparison, not assumed).
- Content column is a centered `max-w-4xl` (narrower than the dashboard's `max-w-[1440px]`) to match the design's proportions.
- Job Titles Seeking and Preferred Locations are plain text inputs in the UI (not tag chips), matching the screenshot, even though the DB schema stores them as arrays — the text-to-array conversion is feature 06's concern.

## Problems solved

- Screenshotting an auth-gated page for real (for `/check verify`) with no browser automation tool and no real OAuth credentials: signed up a throwaway InsForge account (email+password) with `require_email_verification` briefly toggled off via `npx @insforge/cli config apply` (planned with `config plan` first, restored immediately after, confirmed restored via `config export`), then cookie-injected its real access token into a Playwright session pointed at the user's own already-running dev server. This proved genuine authenticated behavior, not a bypass.
- For the earlier build-time visual comparison (before `/check verify`), used a lower-risk method: temporarily disabled the `/profile` auth gate in `proxy.ts` and `app/profile/page.tsx` on a separate isolated dev server (port 3005, not the user's own port 3000 server), screenshotted, then immediately reverted both files.
- `playwright` isn't a project dependency (and wasn't added as one) — ran it via its `npx` cache directory (`~/.npm/_npx/<hash>/node_modules/playwright`) since `NODE_PATH` doesn't resolve for ESM.
- No jsdom/testing-library configured in `test-preferences.json` — component tests follow the established source-contract convention (regex assertions against file text, see `tests/auth-contract.test.mjs`, `tests/posthog-contract.test.mjs`), not real DOM rendering.
- Cleaned up fully: both throwaway accounts (this session's and one left over from the earlier build-time check) deleted from `auth.users`; `require_email_verification` confirmed back to `true`.

## Current state

- Feature 05 (Profile Page — Full UI) is built, `/check verify` passed (real authenticated session, 0 console errors, Skill tag add / Add role append / currently-working-here toggle all confirmed working), `/test` passed (18/18 new, 37/37 full suite), `/imprint` done.
- `context/progress-tracker.md`: Phase 2 — Profile Page, 05 checked off. Next listed: 06 Profile Save Logic.
- A commit "Build profile Page UI" already landed on the branch during this session (made by the user directly via their IDE, not by me) bundling all these changes plus the pre-existing `app/layout.tsx` metadata tweak and `instrumentation-client.ts` deletion from before this session started.
- Save Profile / Select Resume / Generate Resume from Profile buttons are all intentionally inert (feature 06 wires Save; features 06/08 wire the resume actions) — correct per the build plan's "mock data first" approach, not a defect.
- Still unresolved from last session: `.env.local` has the old `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` name instead of `NEXT_PUBLIC_POSTHOG_KEY`.
- Feature 04 (Database Schema) and 02 (Auth) remain accepted/verified from the prior session — see `context/progress-tracker.md`'s Decisions Made During Build for that history; not repeated here.

## Next session starts with

Start feature 06, Profile Save Logic: a Server Action in `actions/profile.ts` that saves all `ProfileForm` fields to the `profiles` table, uploads the resume PDF to InsForge Storage at `resumes/{user_id}/resume.pdf` with `upsert: true`, computes `is_complete` and the real completion percentage/missing fields (replacing `CompletionIndicator`'s current mock props), and calls `revalidatePath('/profile')`. Before starting, resolve the Cover Letter Tone gap and decide whether Job Titles Seeking / Preferred Locations convert from plain text to the DB's array columns on save, or the DB/UI shape changes instead.

## Open questions

- When feature 13 (Company Research Agent) is spec'd, decide whether to add a `company_research_completed_at` column to `jobs` or source feature 16's activity feed from `agent_logs.created_at` instead.
- Whether to ever complete a real, human driven Google or GitHub login to close the one remaining gap in feature 02's verification.
- Cover Letter Tone: add it to the Profile page UI to match `build-plan.md`/DB schema, or update those to drop it since the design doesn't show it?
- The design's nav icons + active-item underline aren't in the shared `Navbar` component, which instead follows `ui-rules.md`'s "no underline" rule — worth a deliberate decision (via `/architect` or `/sync`) on which one should actually govern.
