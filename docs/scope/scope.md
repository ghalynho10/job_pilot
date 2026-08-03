# Scope: JobPilot

Full stack AI powered job hunting assistant: the agent discovers jobs, scores them against the user's profile, researches companies, and tracks it all on a dashboard.

**Build approach:** Skateboard (ship the thinnest usable whole first, then grow it).
**Weight profile:** mostly existing/lean-medium; the new billing slice is full weight (payments).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Homepage | Existing | existing |
| B | Auth (Google + GitHub OAuth) | Existing | existing |
| C | PostHog initialization | Existing | existing |
| D | Database schema | Existing | existing |
| E | Profile page UI | Existing | existing |
| F | Profile save logic | Existing | existing |
| G | AI profile extraction from resume | Existing | existing |
| H | Resume PDF generation from profile | Existing | existing |
| I | Find Jobs page UI | Existing | existing |
| J | Adzuna job discovery | Existing | existing |
| K | Filter + sort + pagination | Existing | existing |
| L | Job details page UI | Existing | existing |
| M | Company research agent | Existing | existing |
| N | Dashboard page UI | Existing | existing |
| O | Stats bar (real data) | Existing | existing |
| P | Recent activity (real data) | Existing | existing |
| Q | Analytics charts (real data) | Existing | existing |
| 0 | Portfolio private access gate | Foundation (Access gate) | done |
| 0a | Deploy target and production config | Foundation (Access gate) | done |
| 0b | Optional projects capture in resume extraction | Foundation (Profile) | done |
| 1 | Billing foundation: subscription data model & Stripe setup | Foundation (Billing) | done |
| 1a | Privileged subscriptions read | Foundation (Billing) | done |
| 2 | Checkout & subscribe | Slice 1: Monetization | done |
| 3 | Free tier usage gating | Slice 1: Monetization | done |
| 4 | Resume generation quality (ATS domain knowledge) | Slice 2: Resume Quality | planned |
| 5 | Job application status tracking | Slice 3: Application Tracking | planned |

## Existing

### A. Homepage · existing
Marketing landing page: hero, features, testimonial, CTAs. Redirects logged in users to the dashboard, logged out users to login.
code in `app/page.tsx`

### B. Auth (Google + GitHub OAuth) · existing
InsForge auth with server owned PKCE cookies. OAuth callback, session refresh, route protection on the authenticated pages.
code in `app/(auth)/`, `proxy.ts`, `app/api/auth/refresh/route.ts`, `actions/auth.ts`

### C. PostHog initialization · existing
Browser and server PostHog clients, identify on login, reset on logout.
code in `lib/posthog-client.ts`, `lib/posthog-server.ts`, `app/PostHogProvider.tsx`

### D. Database schema · existing
`profiles`, `agent_runs`, `jobs`, `agent_logs` tables, `resumes` storage bucket, row level security on all four tables.
code in InsForge migrations

### E. Profile page UI · existing
Full profile form: personal info, professional info, work experience, education, job preferences, resume upload.
code in `app/profile/page.tsx`

### F. Profile save logic · existing
Server action persists the form to `profiles`, uploads the resume PDF to storage at a fresh key, computes completion percentage.
code in `actions/profile.ts`

### G. AI profile extraction from resume · existing
GPT-4o reads the uploaded PDF and auto-fills the profile form fields for the user to review.
code in `app/api/resume/extract/route.ts`, `agent/resume-extractor.ts`

### H. Resume PDF generation from profile · existing
GPT-4o drafts resume content from the current profile, rendered to a clean PDF via `@react-pdf/renderer`.
code in `app/api/resume/generate/route.ts`, `agent/resume-generator.ts`

### I. Find Jobs page UI · existing
Search controls, filter bar, and the paginated jobs table.
code in `app/find-jobs/page.tsx`

### J. Adzuna job discovery · existing
Agent calls the Adzuna API, GPT-4o scores each result against the user's profile, saves matches to `jobs`.
code in `app/api/agent/find/route.ts`, `agent/adzuna.ts`, `agent/matcher.ts`

### K. Filter + sort + pagination · existing
Client side filtering, sorting, and pagination of the Find Jobs list.
code in `lib/find-jobs-filters.ts`

### L. Job details page UI · existing
Full job info, match score breakdown, matched/missing skills, apply button.
code in `app/find-jobs/[id]/page.tsx`, `lib/job-details.ts`

### M. Company research agent · existing
Browserbase + Stagehand browses the company's public pages, GPT-4o synthesizes a structured dossier.
code in `app/api/agent/research/route.ts`, `agent/research.ts`

### N. Dashboard page UI · existing
Stats bar, recent activity feed, and analytics chart shells.
code in `app/dashboard/page.tsx`

### O. Stats bar (real data) · existing
Total jobs found, avg. match rate, companies researched, jobs this week.
code in `lib/dashboard-stats.ts`

### P. Recent activity (real data) · existing
Last 5 to 10 user actions pulled from the database.
code in `lib/dashboard-activity.ts`

### Q. Analytics charts (real data) · existing
Jobs found over time, match score distribution, company research activity, from real Postgres rows.
code in `lib/dashboard-charts.ts`

## Foundation (Access gate)

### 0. Portfolio private access gate · done · medium
A temporary approval gate so the app can be deployed and linked from the portfolio without any signed in visitor being able to run up the Adzuna, Browserbase, or OpenAI bill. Public homepage and login stay open, unapproved users get a private beta screen, and all four paid routes re-check approval server side, plus an `ENABLE_AGENT_RUNS` kill switch for the two agent routes. Superseded by billing (features 1 to 3) when that lands.
**Done when:** an unapproved signed in user is redirected to `/private-beta` from every protected page and gets `403` from all four paid routes with no provider call made; an approved user's experience is unchanged; `ENABLE_AGENT_RUNS=false` pauses both agent routes; and `user_access` is select only so no user can approve themself.
- [x] Design it (spec): [0012-portfolio-private-access-gate](../specs/0012-portfolio-private-access-gate/index.md)
- [x] Build it: `/develop portfolio private access gate`
  - [x] Access state and shared helper: `user_access` migration with select only RLS, `UserAccessRow` type, `lib/access.ts`
  - [x] Route gate: `guardPaidRoute` in both agent routes and both resume routes, above body parsing
  - [x] Page gate: `requireApprovedPage` called in the four protected pages plus the `/private-beta` screen
code in `lib/access.ts`, `lib/access-rules.ts`, `app/private-beta/page.tsx`, `migrations/20260801120001_create-user-access.sql`
- [x] Verify it: `/check verify portfolio private access gate`
- [x] Test it: `/test`

### 0a. Deploy target and production config · done · small
Surfaced by spec 0012. The access gate exists so JobPilot can be deployed and linked from the portfolio, but nothing has decided where it deploys or how production is configured. `insforge.toml` currently lists `allowed_redirect_urls = ["http://localhost:3000/callback"]`, localhost only, so Google and GitHub sign in will fail on the deployed origin and no visitor gets far enough to meet the gate at all. `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are also read in code but missing from `.env.example`.
**Done when:** a host and origin are chosen, that origin is in `allowed_redirect_urls`, Google and GitHub sign in both work on the deployed site, every environment variable the app reads is present in `.env.example` and set in production, and the deployed app serves the access gate as specced.
- [x] Design it (spec): [0013-deploy-target-production-config](../specs/0013-deploy-target-production-config/index.md)
- [x] Build it: `/develop deploy target and production config`
  - [x] Create the Vercel project (production branch `main`) and set the production environment variables, including the two PostHog public vars (AC-1, AC-4)
  - [x] Add the production origin to `insforge.toml` `allowed_redirect_urls` and the production callback URL to the Google and GitHub OAuth apps, keeping localhost (AC-2, AC-3)
  - [x] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` (AC-4)
  - [x] Add `maxDuration` and `force-dynamic` to the research route and correct the early-return note in `context/library-docs.md` (AC-6)
code in `app/api/agent/research/route.ts`, `.env.example`
- [x] Verify it: `/check verify deploy target and production config`
- [ ] Test it: `/test deploy target and production config`

## Foundation (Profile)

### 0b. Optional projects capture in resume extraction · needs a decision · medium · spec [0014](specs/0014-optional-projects-capture-in-resume-extraction.md)
When resume extraction runs (feature G), also extract personal or portfolio projects if the resume lists any, and store them on the profile. Optional field: many users, especially outside tech, will have none, and an empty list is a fine outcome, not an error. Extends the existing resume extraction path only; does not touch resume generation (feature H, tracked separately as feature 4) or add any project specific matching or scoring logic. Small and self contained, placed before the billing work since it does not depend on it.
**Done when:** a resume containing projects gets them extracted and saved to the profile in a structured, reviewable form; a resume with no projects section leaves the field empty with no error; existing extraction behavior for every other field is unchanged.
- [x] Design it (spec): `/architect optional projects capture in resume extraction`

## Foundation (Billing)

### 1. Billing foundation: subscription data model & Stripe setup · full
Decide how subscription state is tracked (plan, status, Stripe customer/subscription ids, a monthly usage counter) and set up the Stripe product and price every later billing feature depends on.
**Done when:** account records carry plan, status, Stripe ids, and a resettable usage counter; a Stripe product and price exist for the paid plan; the migration is applied and typed.
- [x] Design it (spec): [0015](../specs/0015-billing-foundation/index.md)
- [x] Build it: `/develop billing foundation`
  - [x] Migration: create `subscriptions` (plan, status, Stripe ids, usage counter), RLS with no client grant, `updated_at` trigger (AC-1, AC-2)
  - [x] Provision the Stripe test product "Pro" and its $9/month price through InsForge payments (AC-4); the concrete catalog IDs live in environment/provider configuration, not public source
  - [x] Add the typed `Subscription` shape and the server-only `getSubscription()` accessor near `lib/access-rules.ts`, defaulting a missing row to free/zero usage (AC-3)
code in `migrations/20260802033103_create-subscriptions.sql`, `lib/access-rules.ts`, `types/index.ts`
- [x] Verify it: `/check verify billing foundation`
- [x] Test it: `/test billing foundation`

### 1a. Privileged subscriptions read · done (from spec 0016)
Fix the inert `getSubscription()` accessor: it queries the `subscriptions` table with an `authenticated` scoped client, but the table is revoked from that role. Add a service role client factory and a discriminated union return type so callers can tell a failed read from a genuine free user.
**Done when:** `getSubscription()` can read a real subscriptions row, returns a discriminated result, the service role key is never in the browser, and a non-negative usage CHECK constraint exists.
- [x] Design it (spec): [0016](../specs/0016-privileged-subscriptions-read.md)
- [x] Build it: `/develop privileged subscriptions read`
  - [x] Add `SERVICE_ROLE_KEY` to env and create `lib/insforge-service.ts` with the service role client factory (AC-1)
  - [x] Add the non-negative usage CHECK constraint migration (AC-5)
  - [x] Change `getSubscription()` to use the service role client and return a discriminated union (AC-2, AC-3)
  - [x] Re-export `getSubscription` from `lib/access.ts` (AC-4)
  - [x] Update tests and verify the existing suite still passes (AC-6)
code in `lib/insforge-service.ts`, `lib/access-rules.ts`, `lib/access.ts`, `migrations/20260802050000_add-subscriptions-check-constraint.sql`, `.env.example`
- [x] Verify it: `/check verify privileged subscriptions read`
- [x] Test it: `/test privileged subscriptions read`

## Slice 1: Monetization

### 2. Checkout & subscribe · full
A signed in user upgrades to the paid plan through Stripe Checkout, and the subscription activates off the webhook, no manual portal or self-serve management yet.
**Done when:** a user clicks Upgrade, completes Stripe Checkout, the webhook marks their account paid, and the UI reflects the new plan.
- [x] Design it (spec): [0017](../specs/0017-checkout-and-subscribe.md)
- [x] Build it: `/develop checkout & subscribe`
  - [x] Migration: `last_stripe_event_at` column + RLS on `payments.stripe_checkout_sessions` (AC-2, AC-5)
  - [x] Migration: `SECURITY DEFINER` fulfillment trigger on `payments.webhook_events` (AC-3, AC-5)
  - [x] Server Action `startCheckout` in `actions/billing.ts` (AC-1, AC-2, AC-4)
  - [x] UI: upgrade card on `/profile`, success banner on `/dashboard` (AC-1, AC-3, AC-4, AC-6)
code in `migrations/20260802201242_add-checkout-session-rls.sql`, `migrations/20260802201305_add-stripe-subscription-fulfillment.sql`, `actions/billing.ts`, `components/profile/UpgradeCard.tsx`, `components/profile/UpgradeButton.tsx`, `components/dashboard/UpgradeSuccessBanner.tsx`, `app/profile/page.tsx`, `app/dashboard/page.tsx`
- [x] Verify it: `/check verify checkout & subscribe`
- [x] Test it: `/test checkout & subscribe`

### 3. Free tier usage gating · done
Cap monthly Adzuna searches and company research runs for free tier accounts; block and prompt to upgrade once the cap is hit. Paid accounts are uncapped (or a much higher cap).
**Done when:** a free user hitting the monthly cap sees an upgrade prompt instead of the agent running, a paid user is not capped, and counts reset each billing cycle.
- [x] Design it (spec): [0018](../specs/0018-free-tier-usage-gating.md)
- [x] Build it: `/develop free tier usage gating`
  - [x] Migration: `adzuna_searches_used` column + `check_and_increment_usage` atomic RPC (AC-1, AC-3, AC-4, AC-5)
  - [x] `lib/access-rules.ts` / `lib/access.ts`: `checkAndIncrementUsage`, `remainingUsage`, `enforceUsageCap`; remove `isUserApproved` (AC-1, AC-2, AC-3, AC-4, AC-7)
  - [x] Wire company research then job search end to end (route + UI banner + remaining count) (AC-1, AC-2, AC-6, AC-8)
  - [x] Remove the old private beta gate: `/private-beta`, `requireApprovedPage` call sites, proxy matcher entry (AC-7)
code in `migrations/20260802220000_add-adzuna-searches-usage-gating.sql`, `lib/access-rules.ts`, `lib/access.ts`, `app/api/agent/find/route.ts`, `app/api/agent/research/route.ts`, `components/find-jobs/FindJobsPage.tsx`, `components/job-details/CompanyResearchCard.tsx`, `types/index.ts`
- [x] Verify it: `/check verify free tier usage gating`
- [x] Test it: `/test free tier usage gating`

## Slice 2: Resume Quality

### 4. Resume generation quality (ATS domain knowledge) · needs a decision
Raise the quality of output from the existing resume generation path (feature H) by enriching its generation prompt with ATS and resume writing domain knowledge: bullet structure (the XYZ formula), parser safe formatting rules, keyword placement weighting, seniority calibration, and a trimming priority order. Quality of output only, no new capability; cover letter generation and per job resume tailoring stay out of scope per `context/project-overview.md`. Source material already in the repo: `docs/reference/resume-domain-knowledge.md`. Lowest priority of anything currently planned; comes after the three billing features.
**Done when:** generated resumes consistently apply the XYZ bullet formula, use parser safe formatting, place keywords per the documented weighting, calibrate detail and tone to seniority, and trim in the documented priority order when content must be cut, all checked against `docs/reference/resume-domain-knowledge.md`.
- [ ] Design it (spec): `/architect resume generation quality`

## Slice 3: Application Tracking

### 5. Job application status tracking · needs a decision · medium
Today JobPilot has no way to know if a user applied to a job. Apply Now just opens the external apply URL, and `jobs` has no status column. Add a status a user sets by hand (for example not applied, applied, interviewing, rejected, offer), plus a view to see jobs by status, likely in find jobs and or a dedicated tracking view. Status is user set, not auto detected. JobPilot cannot know whether an external application actually happened, keeping this consistent with the existing no auto apply boundary in `context/project-overview.md`. Comes after billing (features 1 to 3); order against feature 4 (resume generation quality) is not yet decided, both sit in the post billing backlog.
**Done when:** a user can set and change a job's status from a fixed set of values, the status persists and is visible on the job, and a view lets the user see jobs grouped or filtered by status.
- [ ] Design it (spec): `/architect job application status tracking`

## Deferred
Out of scope for this pass, kept so the plan stays honest.
- **Billing portal**: self-serve manage/cancel subscription via Stripe Billing Portal · needs a decision
- **Legal pages**: Terms of Service, Privacy Policy · needs a decision
- **Multiple pricing tiers**: beyond the single paid plan · needs a decision
- **Payment failure / dunning handling**: failed renewal, past due state, retry emails · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Every other box is an execution box; `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones rolled up from the spec; `Verify it` + `Test it` boxes |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | `/test`, then `/sync` | all boxes ticked; `/sync` captures the slice's conventions into `AGENTS.md` |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; the tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Weight tag** `· full` = a fresh-model `/check review` warranted; `lean`/`medium` get no tag.
- **Pointer line** (`code in <path>`): the code path added once it exists.
