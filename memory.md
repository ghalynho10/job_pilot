# Memory - InsForge Auth Implementation

Last updated: 2026-07-17 22:56 EDT

## What was built

- Implemented Google and GitHub OAuth with InsForge in `actions/auth.ts`, `app/(auth)/callback/route.ts`, and the server/client helpers under `lib/`.
- Added the login experience in `app/(auth)/login/page.tsx` and `components/auth/OAuthButton.tsx`.
- Added session refresh and protected-route handling through `app/api/auth/refresh/route.ts` and Next.js 16 `proxy.ts`.
- Added an authenticated landing shell at `app/dashboard/page.tsx` and updated `components/layout/Navbar.tsx` with authenticated actions.
- Added Auth routing and contract coverage in `tests/auth-routing.test.mjs` and `tests/auth-contract.test.mjs`.
- Updated the architecture, library guidance, progress tracker, and UI registry. The registry now records reusable Navbar, OAuth button, login shell, and dashboard empty-state patterns.

## Decisions made

- Auth uses `@insforge/sdk/ssr` with a server-owned PKCE verifier stored in an HTTP-only cookie.
- OAuth callbacks use the configured application origin, exchange the InsForge code at `/callback`, and redirect successful sessions to `/dashboard`.
- Route protection uses `proxy.ts`, matching Next.js 16 conventions.
- The current dashboard is only the authenticated verification shell; Phase 14 will replace it with the complete dashboard UI.

## Problems solved

- OAuth startup and callback failures now return controlled login error states instead of throwing into the UI.
- Application-origin handling is centralized and validated; production requires an explicit HTTP or HTTPS application URL.
- PKCE verifier cleanup is handled on callback success and failure.
- Auth UI patterns were reconciled into `context/ui-registry.md` after implementation.

## Current state

- Commit `085267f` (`implemented auth with InsForge`) is on `main` and `origin/main`; the worktree is clean.
- Auth contract and routing tests pass. TypeScript and ESLint also pass.
- `context/progress-tracker.md` correctly marks `02 Auth` in progress with Auth verification next.
- Live Google and GitHub OAuth have not yet been verified end to end against the configured InsForge project.
- Production build verification remains pending because the sandbox could not fetch Inter from Google Fonts. This was an environment/network limitation, not an Auth compile failure.
- Required local environment variables are configured outside source control. No credential values are stored here.

## Next session starts with

Run `/remember restore`, then verify both OAuth providers in the real app: unauthenticated protected-route redirect, Google login, GitHub login, callback to `/dashboard`, session persistence, sign out, and blocked access after sign out. If all pass, mark `02 Auth` complete in `context/progress-tracker.md` and advance to `03 PostHog Initialization`.

## Open questions

- Does the deployed InsForge project have both provider callback URLs configured exactly for the current application origin?
- Should the Google Fonts dependency be made build-independent, or should production build verification be rerun in a network-enabled environment?
