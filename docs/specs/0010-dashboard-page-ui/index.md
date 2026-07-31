# 0010. Dashboard page UI

**Date**: 2026-07-31
**Status**: Accepted

## Summary

This decision covers the full dashboard page UI (feature 14): four stat cards, a recent activity list, and three charts, all built from mock data. It replaces the current placeholder dashboard shell. Real data wiring is deliberately out of scope; that is features 15 to 17. The design comes straight from `context/designs/dashboard.png`, and Recharts is chosen as the charting library since none exists in the project yet.

## Requirements

**User stories**:
- As a signed in user, I want to land on a dashboard that shows my job search activity at a glance, so I know the product is working for me even before I read a single job listing.
- As a signed in user with an incomplete profile, I want a clear prompt to finish it, so I understand why my stats or matches might look thin.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: Visiting `/dashboard` while signed in renders four stat cards, Total Jobs Found (284, "+12% vs last week"), Avg. Match Rate (82%, "+3% vs last week"), Companies Researched (35, "Total researched"), and Jobs This Week (28, "New this week"), matching `context/designs/dashboard.png` exactly, sourced from `lib/mock-dashboard.ts`.
- **AC-2**: A Recent Activity card renders exactly the five mock entries shown in the design, in order, each with a colored dot, a title line, and a relative timestamp ("10 mins ago", "1 hour ago", "2 hours ago", "Yesterday", "Yesterday").
- **AC-3**: A Company Research Activity bar chart renders seven bars (Mon to Sun) with the mock values shown in the design (2, 5, 3, 8, 12, 4, 1).
- **AC-4**: A Jobs Found Over Time chart renders a smoothed line with a filled area beneath it across Mon to Sun, using mock values that reproduce the design's shape (a dip after Tue, a peak around Fri).
- **AC-5**: A Match Score Distribution bar chart renders five bars for the bands 50 to 60%, 60 to 70%, 70 to 80%, 80 to 90%, and 90 to 100%, with mock values matching the design (roughly 2, 12, 45, 85, 32).
- **AC-6**: When the signed in user's real profile is incomplete (`isProfileComplete` from `lib/profile-completion.ts` returns false), a banner renders at the top of the page prompting the user to finish their profile, linking to `/profile`. When the profile is complete, no banner renders, matching the design's complete state.
- **AC-7**: The placeholder content in the current `app/dashboard/page.tsx` (the welcome header, the descriptive paragraph, and the "Complete profile" / "Find jobs" CTA card) is fully removed and replaced by the new layout. The auth check (redirect to `/login?error=session` when signed out), the skip to content link, the authenticated `Navbar`, and `DashboardIdentity` (PostHog identify) are all kept unchanged.
- **AC-8**: On narrow viewports, the four stat cards, the Recent Activity and Company Research Activity pair, and the Jobs Found Over Time and Match Score Distribution pair each stack to a single column instead of clipping or overflowing.
- **AC-9**: Every stat card, the Recent Activity card, and all three chart cards use this project's established card surface (`rounded-xl border border-border bg-surface p-6 shadow-sm`), consistent with `ProfilePage`, `FindJobsPage`, and `JobDetailsPage`.
- **AC-10**: No new database queries, InsForge calls, or API routes are introduced by this feature. All content besides the profile completeness check is mock data owned by `lib/mock-dashboard.ts`; features 15, 16, and 17 replace it with real data later.

## Decision

**Chosen option**: Option 1: Recharts

Recharts is added as the project's charting library, used for the Company Research Activity and Match Score Distribution bar charts and the Jobs Found Over Time area chart.

## Rationale

Reasoning and options considered: see `rationale.md`.

## Feature design

**Data model sketch**:

No new persistence for this feature. `lib/mock-dashboard.ts` exports typed, in memory mock structures only (not database backed):

- `mockStats`: four entries, each `{ label: string; value: string; trend?: { direction: "up"; label: string }; caption?: string }`.
- `mockActivity`: five entries, each `{ id: string; dotColor: "accent" | "info" | "success"; title: string; timestamp: string }`, colors hardcoded per entry to match the design exactly (feature 16 defines the real type to color mapping later).
- `mockCompanyResearchActivity`: seven `{ day: string; count: number }` entries (Mon to Sun).
- `mockJobsFoundOverTime`: seven `{ day: string; count: number }` entries (Mon to Sun), shaped to reproduce the design's dip and peak.
- `mockMatchScoreDistribution`: five `{ band: string; count: number }` entries (the five score bands).

The one real read in this feature is the current user's `profiles` row, already fetched server side by `app/dashboard/page.tsx` for `isProfileComplete`; no new table or column.

**State transitions**: none, this page has no lifecycle beyond rendering.

**API surface**:

None. No new API route. `app/dashboard/page.tsx` keeps the existing server side pattern (`createInsforgeServer`, `insforge.auth.getCurrentUser()`, redirect to `/login?error=session` on no session), and additionally reads the caller's `profiles` row (already the pattern `FindJobsPage` uses for `hasSkills`) to compute `isProfileComplete` for the banner. Everything else renders from the static mock module, no request involved.

**Key invariants**:
- The banner in AC-6 is the one piece of real data on this page; it must never be driven by mock data, so a genuinely incomplete profile is never hidden behind a hardcoded "complete" mock state.
- Mock numeric values in `lib/mock-dashboard.ts` are the single source of truth for every stat card, activity entry, and chart; no component hardcodes a duplicate copy of the same numbers.

**Security model**:
Identical to every other authenticated page in this project: `/dashboard` requires a valid session, enforced by `proxy.ts` middleware and the page's own server side redirect. No new data exposure since the only real read (profile completeness) is already scoped to the current user by `createInsforgeServer`.

**Configuration required**:
None. Recharts is a code dependency added to `package.json`, not a credential or environment variable.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):
- Happy path: an authenticated visit to `/dashboard` renders all four stat cards, the five activity entries, and all three charts with the exact mock values from `context/designs/dashboard.png`, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-9**.
- Failure case (edge case, no external calls to fail): a mock profile that is incomplete shows the banner, a complete one hides it, verifies **AC-6**.
- Auth/permission: an unauthenticated visit to `/dashboard` redirects to `/login?error=session`, exactly as the current placeholder page already does, verifies **AC-7**.

## Build plan

This project has no explicit recorded build approach; following the pattern already set by features 05 and 09 (UI shell built on mock data first, real data wired in a later feature), this spec treats the approach as a Facade style slice (UI shell first, backend wired later) and orders the plan accordingly, noting the assumption here.

1. [x] Add the `recharts` dependency to `package.json`, satisfies **AC-3**, **AC-4**, **AC-5**.
2. [x] Create `lib/mock-dashboard.ts` with the typed mock stats, activity, and three chart data sets, matching `context/designs/dashboard.png` exactly, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.
3. [x] Build `components/dashboard/StatCard.tsx` (label, value, optional trend pill or caption), satisfies **AC-1**, **AC-9**.
4. [x] Build `components/dashboard/RecentActivityCard.tsx` (dot colored list of activity entries), satisfies **AC-2**, **AC-9**.
5. [x] Build the three chart components, `components/dashboard/CompanyResearchActivityChart.tsx` (Recharts bar), `components/dashboard/JobsFoundOverTimeChart.tsx` (Recharts area), and `components/dashboard/MatchScoreDistributionChart.tsx` (Recharts bar), each colored from the existing CSS variable tokens, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-9**.
6. [x] Build `components/dashboard/IncompleteProfileBanner.tsx`, reusing the warning banner pattern already established by `FindJobsPage`'s no-skills banner (`rounded-lg bg-warning`, `AlertCircle` icon), with a "Complete profile" link to `/profile`, satisfies **AC-6**.
7. [x] Rewrite `app/dashboard/page.tsx`: remove the placeholder header, paragraph, and CTA card (and its `DashboardActions` import); read the current user's profile to compute `isProfileComplete`; compose the new layout (conditional banner, four stat cards in a responsive grid, Recent Activity paired with Company Research Activity, Jobs Found Over Time paired with Match Score Distribution); keep the auth check, skip link, `Navbar`, and `DashboardIdentity` unchanged, satisfies **AC-7**, **AC-8**, **AC-9**.
8. [x] Delete `components/dashboard/DashboardActions.tsx` once nothing references it, satisfies **AC-7**.

## Consequences

**Positive**:
- The dashboard finally shows the product's core value (job discovery, matching, research activity) instead of an empty placeholder shell.
- Establishes the chart component set and Recharts wiring that features 15 to 17 reuse when they swap in real data, so those features change data sources, not chart markup.

**Negative / tradeoffs**:
- Every number on the page except the profile completeness banner is fake until features 15 to 17 ship; a user could see stats that do not reflect their real activity in the meantime.
- Adds a new runtime dependency (`recharts`) to the project.

**Neutral**:
- `components/dashboard/DashboardActions.tsx` is removed as part of this feature since the design has no equivalent CTA card; its "Complete profile" and "Find jobs" links are effectively superseded by the new incomplete-profile banner and the dashboard's own navigation.

## Follow-up

- [ ] Feature 15 (Stats Bar, Real Data) replaces `mockStats` with real InsForge queries; feature 16 (Recent Activity, Real Data) replaces `mockActivity`; feature 17 (Analytics Charts, PostHog Data) replaces the three chart data sets. Each should keep the same component props so only the data source changes.
- [ ] `mockActivity`'s dot colors are hardcoded per entry to match the design exactly, not derived from entry type; feature 16 should confirm its own type-to-color rule ("info blue, success green" per `context/build-plan.md`) explicitly rather than assuming this feature's mock colors were the rule.
