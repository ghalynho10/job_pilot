# Verify: dashboard-page-ui · spec 0010 · updated 2026-07-31

_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

_A build time self audit already ran a real signed in throwaway InsForge account (created and fully deleted during this `/develop` session) through both the incomplete profile and complete profile states, at desktop (1440px) and mobile (390px) widths, and confirmed the render against `context/designs/dashboard.png` before this report. `/check verify` should still run the full pass below independently._

## UI / manual

- [ ] Sign in with a real session, visit `/dashboard` → four stat cards render (Total Jobs Found 284 "+12% vs last week", Avg. Match Rate 82% "+3% vs last week", Companies Researched 35 "Total researched", Jobs This Week 28 "New this week") matching `context/designs/dashboard.png` → AC-1
- [ ] Confirm the Recent Activity card shows exactly 5 entries in order (Found 8 jobs for Frontend Engineer/10 mins ago, Researched Stripe/1 hour ago, Found 12 jobs for React Developer/2 hours ago, Researched Vercel/Yesterday, Found 10 jobs for Full Stack Engineer/Yesterday), each with a colored dot → AC-2
- [ ] Confirm the Company Research Activity bar chart shows 7 bars (Mon to Sun) with heights matching 2, 5, 3, 8, 12, 4, 1 → AC-3
- [ ] Confirm the Jobs Found Over Time chart shows a filled area/line across Mon to Sun with a dip after Tue and a peak around Fri, matching the design's shape → AC-4
- [ ] Confirm the Match Score Distribution bar chart shows 5 bars for 50-60%, 60-70%, 70-80%, 80-90%, 90-100% matching the design's relative heights → AC-5
- [ ] With a signed in account that has no `profiles` row (or one failing `isProfileComplete`), confirm the incomplete profile banner renders at the top linking to `/profile` → AC-6
- [ ] With a `profiles` row that passes every `isProfileComplete` check, confirm the banner does not render → AC-6
- [ ] Confirm the old placeholder content (welcome header, paragraph, "Complete profile"/"Find jobs" CTA card) is gone, and the skip to content link, Navbar, and PostHog identify call are all still present → AC-7
- [ ] In a private/incognito window (no session), visit `/dashboard` directly → confirm a redirect to `/login?error=session` before any dashboard content renders → AC-7
- [ ] Resize the browser to a mobile width (375 to 390px) → confirm the stat cards, the Recent Activity/Company Research Activity pair, and the Jobs Found Over Time/Match Score Distribution pair each stack to a single column with no horizontal overflow → AC-8
- [ ] Confirm every stat card, the Recent Activity card, and all three chart cards share the same `rounded-xl border border-border bg-surface p-6 shadow-sm` surface as `ProfilePage`/`FindJobsPage`/`JobDetailsPage` → AC-9
- [ ] Open browser devtools Network tab while on `/dashboard` → confirm no request fires to any new API route or InsForge table beyond the existing `profiles` read already used for `isProfileComplete` → AC-10

## Commands

- [ ] `npx tsc --noEmit` → no type errors → all ACs
- [ ] `npm run lint` → no lint errors → all ACs
- [ ] `npm test` → all tests pass (276/276 at the time of this build, none of which yet cover the new dashboard components directly; `/test` should add that coverage) → all ACs
- [ ] `npm run build` → production build succeeds, `/dashboard` listed as a route → all ACs

## Acceptance-criteria coverage

- AC-1 (stat cards) → covered by manual step 1
- AC-2 (Recent Activity) → covered by manual step 2
- AC-3 (Company Research Activity chart) → covered by manual step 3
- AC-4 (Jobs Found Over Time chart) → covered by manual step 4
- AC-5 (Match Score Distribution chart) → covered by manual step 5
- AC-6 (incomplete profile banner, both states) → covered by manual steps 6 to 7 (already exercised once live during `/develop`'s self audit against a real throwaway account)
- AC-7 (placeholder removed, auth redirect intact) → covered by manual steps 8 to 9
- AC-8 (responsive stacking) → covered by manual step 10 (already exercised once live during `/develop`'s self audit at 390px)
- AC-9 (shared card surface) → covered by manual step 11
- AC-10 (no new backend surface) → covered by manual step 12
