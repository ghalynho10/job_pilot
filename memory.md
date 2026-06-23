# Memory — Homepage (Feature 01)

Last updated: 2026-06-22

## What was built

**Feature 01 — Homepage** is complete.

Files created or modified:

- `app/layout.tsx` — replaced Geist fonts with Inter via `next/font/google`, updated metadata title/description
- `app/page.tsx` — assembles Navbar + Hero + Features + Testimonial + BottomCta + Footer
- `components/layout/Navbar.tsx` — client component, logo (`/public/logo.png`), three nav links with active state via `usePathname`, "Start for free" CTA
- `components/layout/Footer.tsx` — server component, logo, nav links, copyright
- `components/homepage/Hero.tsx` — badge, 56px headline with accent span, subtitle, two CTAs, dashboard screenshot (`/images/dashboard-demo.png`) in borderless card
- `components/homepage/Features.tsx` — three two-column feature blocks alternating text/image; uses `/images/jobs-lists.png` and `/images/agnet-log.png`
- `components/homepage/Testimonial.tsx` — centered pull quote, avatar from `/images/user-icon.png`
- `components/homepage/BottomCta.tsx` — purple gradient CTA section, two buttons
- `context/progress-tracker.md` — Feature 01 marked complete
- `context/ui-registry.md` — all six new components documented with exact classes

**Dependency installed:** `lucide-react` (icons: Sparkles, ArrowRight, BrainCircuit, Building2, LayoutDashboard)

## Decisions made

- **Logo:** `/public/logo.png` is the full lockup (mark + "JobPilot" text). Used as a single `next/image` in Navbar (width=130) and Footer (width=120). Do not recreate the logo in CSS.
- **BottomCta gradient:** Uses inline `style` prop — Tailwind v4 `@theme` does not support gradient token definitions, so the gradient is written directly with design token hex values.
- **Feature 3 image:** Reuses `jobs-lists.png` as a placeholder for the match score view. A dedicated screenshot should replace it when available.
- **Tailwind v4 canonical classes:** `max-w-300` = 1200px. IDE warned on `max-w-[1200px]` — use the canonical form.
- **No shadcn/ui on homepage** — not needed; built with plain Tailwind + lucide-react only.

## Problems solved

- **Geist vs Inter:** Default Next.js scaffold used Geist fonts. Replaced entirely with Inter (`variable: "--font-sans"`) to match the `--font-sans` token in `globals.css`. Applied on `<html>` element.
- **`font-600` is invalid Tailwind** — corrected to `font-semibold` in `Features.tsx`.
- **Dev server conflict:** A server was already running on port 3000 from a prior session. New `npm run dev` picked up port 3001 — the existing server on 3000 handles the live app.

## Current state

- Homepage renders correctly at `http://localhost:3000` — returns HTTP 200, TypeScript passes with zero errors.
- All 6 homepage components are built and wired.
- Feature 01 (Homepage) is the only completed feature. Features 02–17 are untouched.

## Next session starts with

**Feature 02 — Auth.** Build the login page at `app/(auth)/login/page.tsx` with Google and GitHub OAuth via InsForge. Then the OAuth callback handler at `app/(auth)/callback/page.tsx`. Then `middleware.ts` to protect `/dashboard`, `/profile`, `/find-jobs`, and `/find-jobs/[id]`. After login → redirect to `/dashboard`.

Read `context/architecture.md` InsForge Auth section and `context/library-docs.md` InsForge section before writing any auth code.

## Open questions

- The design reference (`context/designs/landing-page.png`) was used for Feature 01. Are there design files for the other pages (login, dashboard, profile, find-jobs, job details)?
- Feature 3 image in Features.tsx reuses `jobs-lists.png` — should a dedicated match-score screenshot be added to `public/images/`?
