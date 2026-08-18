# JobPilot

An AI job-hunting assistant. You set up a profile and upload a resume; it finds jobs, scores each one against your profile, researches the company behind it, and tracks the whole search on a dashboard.

Live at [job-pilot-blond.vercel.app](https://job-pilot-blond.vercel.app). Sign in with Google or GitHub and the full loop is open: search jobs, read match scores and their reasoning, run company research, generate a resume. Free accounts get 10 searches and 3 research runs per 30 days. The Upgrade button is behind an allowlist and Stripe is in test mode, so nothing bills.

<!-- SCREENSHOT: replace this with a real capture of the job list showing match scores
     plus one job's score reasoning. Not the dashboard, and not a mockup. -->

## Why I built this

I was job hunting and wanted to get better at building AI-native products, so I built the thing I needed for the search I was already doing.

Then a bug in my own usage gate locked me out of it for two weeks. That story is [further down](#the-outage), and it's the most useful thing in this README.

## What it does

- **Job discovery.** Searches [Adzuna](https://www.adzuna.com) by title and location, IT roles only. GPT-4o scores every result 0–100 against your profile and writes out why it fits and what you're missing.
- **Company research.** One [Browserbase](https://www.browserbase.com) session driven by [Stagehand](https://www.stagehand.dev) reads the company's public pages, then GPT-4o writes a dossier: overview, tech stack, culture, why the role exists, interview prep. If the site is unreachable it still returns a dossier built from the company name and job description, and says so.
- **Resume tools.** Upload a PDF and optionally auto-fill your profile from it, projects included. Or generate a clean resume PDF from the profile you already have.
- **Dashboard.** Stats, activity feed, and charts built from your own Postgres rows in `lib/dashboard-charts.ts`. PostHog is for product analytics and doesn't feed these charts.
- **Billing.** Stripe Checkout with webhook-driven activation. Currently test mode only: `actions/billing.ts` requests a `"test"` session and the fulfillment trigger filters on `environment = 'test'`. Both flip together at launch.
- **Auth.** Google and GitHub OAuth through InsForge, PKCE cookies held server-side.

JobPilot never auto-submits an application. Applying is always an explicit one-click handoff to the employer's posting.

Full flow and scope: [context/project-overview.md](./context/project-overview.md).

## What a run costs

Worth knowing before you read the caps, because the caps are sized around it.

A **job search** is one Adzuna call plus one GPT-4o call per job, run sequentially, with `results_per_page: "10"`. Jobs you've already seen are skipped, so a repeat search costs less than a first one. Roughly **$0.05** at 10 new jobs.

A **research run** is 2–5 GPT-4o calls, not one. Stagehand is configured with `gpt-4o`, so every `extract` is itself a model call: one on the homepage, zero to three on sub-pages, then one synthesis call. Resolving the homepage URL is a plain `fetch`, not a model call. Roughly **$0.05–0.10** plus Browserbase session time.

So a free account that exhausts both caps costs me well under a dollar a month in model spend. (Estimates from list prices and typical prompt sizes, not metered — replace with real numbers if you fork this.)

## Engineering decisions

**Billing can't double-activate a subscription, because the schema won't let it.** Fulfillment isn't a Next.js route. It's a Postgres trigger, `fulfill_stripe_subscription()` in `migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql`, that InsForge's managed Stripe integration fires per event. It writes `INSERT ... ON CONFLICT (user_id) DO UPDATE` against a unique `user_id`, so every Stripe retry lands on the same row, and a `last_stripe_event_at` guard stops an out-of-order retry from overwriting newer state. There is no application code path that could create a second subscription for one user.

**Access is revoked at the privilege layer, not just the UI.** InsForge grants `SELECT/INSERT/UPDATE` on public tables to `anon` and `authenticated` by default. Writing no RLS policy therefore does not leave a table closed, which is the opposite of what most people assume. Two tables take that default away. `user_access` ([migration](./migrations/20260801120001_create-user-access.sql)) revokes the grants and hands back only `SELECT`, so approving an account is an admin-only SQL operation that app code couldn't perform even with a bug in it. `subscriptions` ([migration](./migrations/20260802033103_create-subscriptions.sql)) grants nothing back at all and has no RLS policies, reachable only through the service-role client in `lib/insforge-service.ts`. Worth knowing if you're evaluating InsForge for anything security-sensitive.

**Company research is capped at one bounded session, not a crawl.** `agent/research.ts` reads the homepage, ranks the internal links it finds by a fixed order (about, engineering, blog, product, team, other, careers), visits at most `MAX_SUB_PAGES = 3`, and closes the session in a `finally`. Longer crawls cost more without producing better dossiers, because most company sites don't have much past a homepage and an about page worth reading.

**The homepage is resolved first and guessed second.** `agent/research.ts` follows the job's `external_apply_url` with `redirect: "follow"` and, when the final hostname isn't Adzuna's, strips it to its last two labels. Only if that fails does it guess `https://www.{name}.com` from the company name with non-alphanumerics removed. That fallback is weak: it doesn't strip legal suffixes, so "Acme Inc." becomes `acmeinc.com`, and it misses any company whose domain doesn't match its name. When both paths fail the run still returns a dossier synthesized from the name and job description, instructed to say so in `companyOverview`. See the invariants in [context/architecture.md](./context/architecture.md#invariants).

**Adzuna rate limits aren't retried.** `lib/adzuna.ts` throws on any non-2xx, treating a 429 and a 500 identically. `agent/adzuna.ts` catches once, marks the run failed, and returns one generic message with no backoff. Fine at current usage, worth fixing before it isn't.

## The outage

`npm test` runs around 500 assertions across roughly 30 files, but only seven of them execute code (`dashboard-stats`, `dashboard-activity`, `find-jobs-filters`, `match-score`, `adzuna-client`, `access`, `job-signature`). The other twenty read implementation files and assert regexes against the source text, which pins how the code *reads* rather than what it does. Nothing calls a real external dependency. That gap cost me two weeks in production.

The spec was right. [`0018-free-tier-usage-gating.md`](./docs/specs/0018-free-tier-usage-gating.md) defines the usage RPC as returning "exactly one row," and asks for a concurrency test driven straight at the RPC over two connections, reasoning that "the RPC boundary is where the guarantee actually lives." Both correct. `check_and_increment_usage` is declared `RETURNS TABLE(...)`, so PostgREST sends that one row as a one-element array. The client read `.allowed` off the array itself, got `undefined`, and `undefined` denied. Every metered action was refused for every account, free users under the cap and Pro users alike, from 3 to 17 August.

The test the spec asked for would have caught it on the first run. It got written against a mock returning a bare object, so it encoded the same assumption as the code it was checking. And this is the one billing feature with no entry in [docs/reviews/](./docs/reviews/): the two before it were reviewed, this one shipped in the same commit as its own spec. The process didn't fail here. I stopped running it.

Fixed in [#11](https://github.com/ghalynho10/job_pilot/pull/11). Next step is replacing the source-contract tests with executing ones, starting at the RPC boundary where this bug lived.

## Stack

| Layer | Tool |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Auth, DB, storage | [InsForge](https://insforge.dev) |
| Job discovery | Adzuna API |
| AI | OpenAI GPT-4o |
| Company research | Browserbase + Stagehand |
| Analytics | PostHog |
| Billing | Stripe via InsForge's managed integration (no `stripe` dependency; fulfillment is a Postgres trigger) |
| PDF | `@react-pdf/renderer` |
| Styling | Tailwind CSS v4, hand-written |
| Hosting | Vercel |

Architecture, folder structure, data flow, invariants: [context/architecture.md](./context/architecture.md).

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | OAuth callback base URL |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anon key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog public key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host |
| `OPENAI_API_KEY` | Matching, resume extraction and generation, research synthesis, and Stagehand's own `extract` calls |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Job discovery |
| `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` | Company research |
| `ENABLE_AGENT_RUNS` | Kill switch for the find and research routes. Only the exact string `false` disables. |
| `SERVICE_ROLE_KEY` | Service-role InsForge client. Reads `subscriptions`, invokes the usage RPC, bypasses RLS. Server-only, never `NEXT_PUBLIC_`. |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for Pro monthly |

`NEXT_PUBLIC_` variables are inlined into the client bundle at build time, so never put a secret behind that prefix. See [context/code-standards.md](./context/code-standards.md#environment-variables).

## Project structure

```text
app/            Pages and API routes — no business logic
agent/          Agent logic (Adzuna, matching, research, extraction) — never touches React
actions/        Server Actions for UI mutations (auth, profile save, checkout)
components/     UI only — no data fetching, no direct database calls
lib/            Client initialization and shared utilities
types/          Shared TypeScript types
context/        Agent context docs — read before any change
docs/scope/     Living feature scope
docs/specs/     Per-feature design specs and verification
docs/reviews/   Point-in-time code reviews
migrations/     Versioned InsForge SQL migrations
```

Full breakdown: [context/architecture.md](./context/architecture.md#folder-structure).

## How this was built

I built this spec-first rather than by ad hoc prompting. Every non-trivial feature gets a design spec in `docs/specs/` before implementation, an agent implements against that spec plus a fixed set of context docs, and the result goes through a review pass recorded in `docs/reviews/`. The workflow skills are pinned unmodified from [`JavaScript-Mastery-Pro/skills`](https://github.com/JavaScript-Mastery-Pro/skills) in `skills-lock.json`, alongside third-party skills from Browserbase and Stripe. The tooling isn't mine; the specs and the architecture decisions are, and spec 0018 is a fair sample — it reasons about read-committed semantics under concurrent requests and rejects two alternatives on cost grounds.

The honest assessment of how well that held up is [above](#the-outage).

Build approach is skateboard: ship the thinnest usable whole, then grow it. Current status: [docs/scope/scope.md](./docs/scope/scope.md). Workflow and doc order: [AGENTS.md](./AGENTS.md).

## Roadmap

**Shipped.** Auth, profile and resume tools (project extraction, AI-generated resumes with anti-fabrication numeral validation), job discovery and matching, company research, dashboard analytics, free-tier usage caps.

**Partly shipped.** Stripe billing. Checkout and trigger-based fulfillment work end to end, but in test mode, and Upgrade is still behind the `user_access` allowlist. Going live means flipping the checkout call and the trigger's environment filter, then dropping the allowlist.

**Known gaps.** `/api/resume/extract` and `/api/resume/generate` reach GPT-4o with no cap and no kill switch, the only uncapped spend path. Five `jobs` columns (`responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`) and the `agent_logs` table are read or created but never written, so the structured sections of the job details page never render.

**Next.** Per-job application status tracking with a status-filtered view. Needs a spec first.

## Deployment

Vercel Hobby. Pushes to `main` deploy automatically. Production config (OAuth callbacks, env vars, `maxDuration` on the research route): [docs/specs/0013-deploy-target-production-config](./docs/specs/0013-deploy-target-production-config/index.md).

## License

MIT — see [LICENSE](./LICENSE).
