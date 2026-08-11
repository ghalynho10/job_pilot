# JobPilot

An AI-powered job hunting assistant. Set up your profile, upload your resume, and the agent finds jobs, scores them against your profile, researches each company, and tracks everything on a dashboard — so you walk into every application informed.

Live at [job-pilot-blond.vercel.app](https://job-pilot-blond.vercel.app).

![Dashboard screenshot](./public/screenshot-dashboard.png)
*Dashboard — stats, recent activity, and match-score analytics*

The free tier caps monthly job searches and company research runs. Upgrade through Stripe Checkout to remove the cap.

## Why I built this

A deliberate skill-building project, and a practical one — I wanted to get better at building AI-native products while actually job hunting, so I built the tool I needed for the search I was already doing.

## What it does

- **Job discovery** — searches [Adzuna](https://www.adzuna.com) by title and location (IT jobs only). GPT-4o scores every result 0–100 against your profile and explains each match.
- **Company research** — a single [Browserbase](https://www.browserbase.com) session with [Stagehand](https://www.stagehand.dev) browses the company's public pages. GPT-4o produces a dossier: overview, tech stack, culture, why the role exists, and interview prep. Falls back to a best-effort dossier from the company name and job description when the site is unreachable.
- **Billing** — Stripe Checkout with webhook-driven subscription activation. Free tier caps reset each billing cycle; the paid plan has no caps.
- **Resume tools** — upload a PDF and optionally auto-fill your profile with GPT-4o, including project extraction. Or generate a clean resume PDF from your current profile data.
- **Dashboard** — stats bar, activity feed, and PostHog-powered charts (jobs found over time, match score distribution, company research activity).
- **Auth** — Google and GitHub OAuth via InsForge, with PKCE cookies owned server-side.

JobPilot never auto-submits applications. Applying is always an explicit, one-click handoff to the employer's posting.

Full user flow and feature scope: [context/project-overview.md](./context/project-overview.md).

## A few engineering decisions worth explaining

**Billing can't double-activate a subscription, by construction.** Stripe fulfillment isn't a Next.js route — it's a Postgres trigger function (`fulfill_stripe_subscription()`, in `migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql`) that InsForge's managed Stripe integration invokes on each event. It writes with `INSERT ... ON CONFLICT (user_id) DO UPDATE`, keyed on a unique `user_id`. Stripe can retry the same event as many times as it wants — it always hits the same row, and a guard on `last_stripe_event_at` means an out-of-order retry can't even overwrite newer state with stale data. There's no code path that creates a second subscription for one user; it's not handled by application logic, it's enforced by the schema.

**InsForge over Supabase or Firebase, for two reasons.** Cost at the scale I needed, and InsForge is built agentic-development-first — which mattered because I was building this entirely spec-driven, with an agent doing the implementation against written specs rather than me hand-coding it. A backend designed around that workflow was a better fit than retrofitting one that wasn't.

**Company research runs on a single 2-minute Browserbase session** (`lib/browserbase.ts`), not an unbounded crawl. It visits 3–4 pages sequentially and closes the session when done. Longer sessions cost more and don't reliably produce a better dossier — most public company sites don't have much more than a homepage and an about/careers page worth reading — so the session is capped rather than left open-ended.

**The company homepage is guessed, not searched.** `agent/research.ts` strips legal suffixes (`Inc.`, `LLC`, `Corp.`) off the company name and constructs `https://www.{name}.com` directly, skipping a search-engine lookup. That's a real tradeoff: it's fast and free, but it misses companies whose domain doesn't match their legal name. When the guess is wrong or the page is unreachable, the research agent doesn't fail — it falls back to a dossier synthesized from just the company name and job description, so the feature always returns *something* rather than an empty state. See the `Invariants` section of [context/architecture.md](./context/architecture.md#invariants).

**Access is gated below the database privilege layer, not just in the UI.** InsForge grants `SELECT/INSERT/UPDATE` on public tables to `anon`/`authenticated` by default — even with no matching RLS policy. `user_access` (`migrations/20260801120001_create-user-access.sql`) explicitly revokes those default grants and hands back only `SELECT`; there's no insert/update/delete policy at all, so approving a user is an admin-only SQL operation, not something application code — or a bug in it — could ever do. Worth knowing about if you're evaluating InsForge for anything security-sensitive.

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
| Styling | Tailwind CSS + shadcn/ui |
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
| `ENABLE_AGENT_RUNS` | Kill switch for agent routes (find, research) |

`NEXT_PUBLIC_` variables inline into the client bundle at build time. Never put a secret behind that prefix. See [context/code-standards.md](./context/code-standards.md#environment-variables).

### Tests

```bash
npm test
```

Runs 350+ source-contract tests (`node:test`) on `tests/*.test.mjs`.

## Project structure

```
app/            Pages and API routes — no business logic
agent/          Agent logic (Adzuna, matching, research, extraction) — never touches React
actions/        Server Actions for UI mutations (profile save, job status)
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

**Shipped:** auth, profile and resume tools (including project extraction and AI-generated resumes with anti-fabrication numeral validation), job discovery and matching, company research, dashboard analytics, and Stripe billing (Checkout, webhooks, free-tier usage caps).

**Next:** per-job application status tracking with a status-filtered view. Needs a design spec before work begins.

## Deployment

Hosted on Vercel (Hobby plan). Pushes to `main` deploy automatically. Production configuration (OAuth callbacks, env vars, `maxDuration` on the research route): [docs/specs/0013-deploy-target-production-config](./docs/specs/0013-deploy-target-production-config/index.md).

## License

MIT — see [LICENSE](./LICENSE).
