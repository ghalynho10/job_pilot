# JobPilot

An AI-powered job hunting assistant. Set up your profile, upload your resume, and the agent finds jobs, scores them against your profile, researches each company, and tracks everything on a dashboard — so you walk into every application informed.

Live at [job-pilot-blond.vercel.app](https://job-pilot-blond.vercel.app).

![Dashboard screenshot](./public/screenshot-dashboard.png)
*Dashboard — stats, recent activity, and match-score analytics*

The free tier caps job searches and company research runs over a rolling 30-day window (10 searches, 3 research runs). Upgrade through Stripe Checkout to remove the cap.

## Why I built this

A deliberate skill-building project, and a practical one — I wanted to get better at building AI-native products while actually job hunting, so I built the tool I needed for the search I was already doing.

## What it does

- **Job discovery** — searches [Adzuna](https://www.adzuna.com) by title and location (IT jobs only). GPT-4o scores every result 0–100 against your profile and explains each match.
- **Company research** — a single [Browserbase](https://www.browserbase.com) session with [Stagehand](https://www.stagehand.dev) browses the company's public pages. GPT-4o produces a dossier: overview, tech stack, culture, why the role exists, and interview prep. Falls back to a best-effort dossier from the company name and job description when the site is unreachable.
- **Billing** — Stripe Checkout with webhook-driven subscription activation. Free tier caps run on a rolling 30-day window per account, reset by the first metered action after the window expires; the paid plan has no caps. **Currently wired to Stripe test mode only** — `actions/billing.ts` requests a `"test"` checkout session and the fulfillment trigger filters on `environment = 'test'`. The two flip together at live launch.
- **Resume tools** — upload a PDF and optionally auto-fill your profile with GPT-4o, including project extraction. Or generate a clean resume PDF from your current profile data.
- **Dashboard** — stats bar, activity feed, and charts computed from the user's own Postgres rows in `lib/dashboard-charts.ts` (jobs found over time, match score distribution, company research activity). PostHog is used for product analytics, not to drive these charts.
- **Auth** — Google and GitHub OAuth via InsForge, with PKCE cookies owned server-side.

JobPilot never auto-submits applications. Applying is always an explicit, one-click handoff to the employer's posting.

Full user flow and feature scope: [context/project-overview.md](./context/project-overview.md).

## A few engineering decisions worth explaining

**Billing can't double-activate a subscription, by construction.** Stripe fulfillment isn't a Next.js route — it's a Postgres trigger function (`fulfill_stripe_subscription()`, in `migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql`) that InsForge's managed Stripe integration invokes on each event. It writes with `INSERT ... ON CONFLICT (user_id) DO UPDATE`, keyed on a unique `user_id`. Stripe can retry the same event as many times as it wants — it always hits the same row, and a guard on `last_stripe_event_at` means an out-of-order retry can't even overwrite newer state with stale data. There's no code path that creates a second subscription for one user; it's not handled by application logic, it's enforced by the schema.

**InsForge over Supabase or Firebase, for two reasons.** Cost at the scale I needed, and InsForge is built agentic-development-first — which mattered because I was building this entirely spec-driven, with an agent doing the implementation against written specs rather than me hand-coding it. A backend designed around that workflow was a better fit than retrofitting one that wasn't.

**Company research runs on a single bounded Browserbase session** (`agent/research.ts`), not an unbounded crawl. It reads the homepage, ranks the internal links it found by a fixed preference order (about, engineering, blog, product, team, other, careers), visits at most `MAX_SUB_PAGES = 3` of them sequentially, and closes the session in a `finally` block. Longer crawls cost more and don't reliably produce a better dossier — most public company sites don't have much more than a homepage and an about/careers page worth reading — so the page count is capped. Note the cost shape: Stagehand is configured with `gpt-4o`, so each `extract` is itself a model call, making one research run 3–5 GPT-4o calls, not one.

**The company homepage is resolved first, guessed second.** `agent/research.ts` follows the job's `external_apply_url` with `redirect: "follow"` and, if the final hostname isn't Adzuna's, strips it to its last two labels. Only when that fails does it fall back to guessing `https://www.{name}.com`, where `{name}` is the company name with every non-alphanumeric character removed (so "Acme Inc." becomes `acmeinc.com` — the fallback does *not* strip legal suffixes, and misses companies whose domain doesn't match their name). When both paths fail or the page is unreachable, the research agent doesn't fail: it falls back to a dossier synthesized from the company name and job description alone, and is instructed to say so in `companyOverview`, so the feature always returns *something* rather than an empty state. See the `Invariants` section of [context/architecture.md](./context/architecture.md#invariants).

**Access is gated below the database privilege layer, not just in the UI.** InsForge grants `SELECT/INSERT/UPDATE` on public tables to `anon`/`authenticated` by default — even with no matching RLS policy, so *not* writing a policy does not leave a table closed. Two tables take that default away explicitly. `user_access` (`migrations/20260801120001_create-user-access.sql`) revokes the default grants and hands back only `SELECT`, so approving an account is an admin-only SQL operation that application code — or a bug in it — could never perform. `subscriptions` (`migrations/20260802033103_create-subscriptions.sql`) goes further and grants nothing back at all: it has no RLS policies whatsoever and is reachable only through a service-role client on the server (`lib/insforge-service.ts`). Worth knowing about if you're evaluating InsForge for anything security-sensitive.

**A known gap: Adzuna rate limits aren't retried.** `lib/adzuna.ts` throws on any non-2xx response — a 429 and a 500 are handled identically — and `agent/adzuna.ts` catches that once, marks the run failed, and returns a single generic message ("Something went wrong searching for jobs. Please try again.") with no backoff or retry. Fine at current usage; worth fixing before it isn't. Noted here rather than glossed over.

## Stack

| Layer | Tool |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Auth, DB, Storage, Realtime | [InsForge](https://insforge.dev) |
| Job discovery | Adzuna API |
| AI | OpenAI GPT-4o |
| Company research | Browserbase + Stagehand |
| Analytics | PostHog |
| Billing | Stripe (Checkout, webhooks) |
| PDF generation | `@react-pdf/renderer` |
| Styling | Tailwind CSS v4, hand-written (no component library) |
| Hosting | Vercel |

Full architecture, folder structure, data flow, and invariants: [context/architecture.md](./context/architecture.md).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | OAuth callback base URL |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anon key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog public key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host |
| `OPENAI_API_KEY` | GPT-4o: matching, resume extraction, research synthesis |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Job discovery |
| `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` | Company research |
| `ENABLE_AGENT_RUNS` | Kill switch for agent routes (find, research). Only the exact string `false` disables. |
| `SERVICE_ROLE_KEY` | Service-role InsForge client. Reads `subscriptions` and invokes the usage RPC; bypasses RLS, so it is server-only and must never carry a `NEXT_PUBLIC_` prefix. |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for the Pro monthly plan |

`NEXT_PUBLIC_` variables inline into the client bundle at build time. Never put a secret behind that prefix. See [context/code-standards.md](./context/code-standards.md#environment-variables).

### Tests

```bash
npm test
```

Runs 482 tests (`node:test`) on `tests/*.test.mjs`.

Most of these are **source-contract** tests: they read the implementation file and assert regexes against its text, pinning that the code still *reads* a certain way. Only about six files import and execute code (`dashboard-stats`, `dashboard-activity`, `find-jobs-filters`, `match-score`, `adzuna-client`, `access`). There is no integration test that calls a real external dependency, and that gap has bitten once, expensively.

`check_and_increment_usage` is declared `RETURNS TABLE(...)`, so PostgREST returns an array of rows. The client cast that array to a single object and read `.allowed` off it, which is always `undefined`, and `undefined` read as "denied" downstream. Every metered action was refused for every account — free users under the cap and Pro users alike — for two weeks. All six test mocks returned a bare object, encoding the same wrong assumption as the implementation, so the suite passed against a shape that never occurs on the wire. Mocks written from the same assumption as the code under test are not coverage.

## Project structure

```
app/            Pages and API routes — no business logic
agent/          Agent logic (Adzuna, matching, research, extraction) — never touches React
actions/        Server Actions for UI mutations (auth, profile save, checkout)
components/     UI only — no data fetching, no direct database calls
lib/            Client initialization and shared utilities
types/          Shared TypeScript types
context/        Agent context docs — read these before any change
docs/scope/     Living feature scope
docs/specs/     Per-feature design specs, rationale, and verification
docs/reviews/   Point-in-time code reviews
migrations/     Versioned InsForge SQL migrations
```

Full breakdown: [context/architecture.md](./context/architecture.md#folder-structure).

## Working on this project

Most of this codebase was built through a structured spec → build → verify → test cycle rather than ad hoc prompting, using a personal fork of an Agent Skills pipeline — the agent reads a fixed set of context docs (architecture, UI conventions, code standards) before touching any code, and every non-trivial feature has a design spec under `docs/specs/` before implementation starts. Full workflow, doc order, and available commands: [AGENTS.md](./AGENTS.md).

Build approach is **skateboard**: ship the thinnest usable whole first, then grow it. Current scope and status: [docs/scope/scope.md](./docs/scope/scope.md).

### InsForge backend

This project uses [InsForge](https://insforge.dev) for database, auth, storage, and edge functions. Credentials live in `.env.local` (app) and `.insforge/project.json` (CLI). Never commit them. See [AGENTS.md](./AGENTS.md) for available skills.

## Roadmap

**Shipped:** auth, profile and resume tools (including project extraction and AI-generated resumes with anti-fabrication numeral validation), job discovery and matching, company research, dashboard analytics, and free-tier usage caps.

**Partly shipped:** Stripe billing. Checkout and trigger-based webhook fulfillment are built and tested end to end, but against Stripe **test mode**, and the Upgrade button is still behind the `user_access` allowlist. Going live means flipping both the checkout call and the trigger's environment filter, then dropping the allowlist.

**Known gaps:** `/api/resume/extract` and `/api/resume/generate` reach GPT-4o with no usage cap and no kill switch — the only uncapped spend path. Five `jobs` columns (`responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`) and the `agent_logs` table are read or created but never written, so the structured sections of the job details page never render.

**Next:** per-job application status tracking with a status-filtered view. Needs a design spec before work begins.

## Deployment

Hosted on Vercel (Hobby plan). Pushes to `main` deploy automatically. Production configuration (OAuth callbacks, env vars, `maxDuration` on the research route): [docs/specs/0013-deploy-target-production-config](./docs/specs/0013-deploy-target-production-config/index.md).

## License

MIT — see [LICENSE](./LICENSE).
