# JobPilot

A full stack AI-powered job hunting assistant. Set up your profile once, upload your resume, and the agent discovers relevant jobs, scores them against your profile, researches each company, and tracks everything on a dashboard — so you arrive at every application fully informed.

Live at [job-pilot-blond.vercel.app](https://job-pilot-blond.vercel.app).

## What it does

- **Job discovery** — searches [Adzuna](https://www.adzuna.com) by title and location (IT jobs only), scores every result 0–100 against your profile with GPT-4o, and explains the match
- **Company research** — a single [Browserbase](https://www.browserbase.com) session driven by [Stagehand](https://www.stagehand.dev) browses a company's public pages; GPT-4o synthesizes a dossier (overview, tech stack, culture, why the role exists, interview prep). Falls back to a best-effort dossier from the company name and job description if the site can't be found
- **Resume tools** — upload a resume PDF and optionally auto-fill your profile with GPT-4o, or generate a clean resume PDF from your current profile data
- **Dashboard** — stats bar, recent activity feed, and PostHog-powered analytics charts (jobs found over time, match score distribution, company research activity)
- **Auth** — Google and GitHub OAuth via InsForge, PKCE cookies owned server-side

See [context/project-overview.md](context/project-overview.md) for the full user flow and feature scope.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Auth + DB + Storage + Realtime | [InsForge](https://insforge.dev) |
| Job discovery | Adzuna API |
| AI model | OpenAI GPT-4o |
| Company research | Browserbase + Stagehand |
| Analytics | PostHog |
| PDF generation | `@react-pdf/renderer` |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |

Full architecture, folder structure, data flow, and invariants: [context/architecture.md](context/architecture.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Used in OAuth callback URLs |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anon key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog public key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host |
| `OPENAI_API_KEY` | GPT-4o matching, extraction, research synthesis |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Job discovery |
| `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` | Company research sessions |
| `ENABLE_AGENT_RUNS` | Kill switch for the two agent routes (find, research) |

`NEXT_PUBLIC_` variables are inlined into the client bundle at build time — never put a secret behind that prefix. Full reference: [context/code-standards.md](context/code-standards.md#environment-variables).

### Testing

```bash
npm test
```

Runs `node:test` against `tests/*.test.mjs`.

## Project structure

```text
app/            Pages and API routes only — no business logic
agent/          All agent logic (Adzuna discovery, matching, research, extraction) — never touches React
actions/        Server Actions for UI-triggered mutations (profile save, job status)
components/     UI only — no data fetching, no direct DB calls
lib/            Third party client init and shared utilities
types/          Shared TypeScript types
context/        AI agent context docs — read before implementing anything (see below)
docs/scope/     Living feature scope
docs/specs/     Per-feature design specs, rationale, and verification
docs/reviews/   Point-in-time code reviews
migrations/     Versioned InsForge SQL migrations
```

Full folder breakdown and system boundaries: [context/architecture.md](context/architecture.md#folder-structure).

## Working on this project

This repo is built with an AI-agent-driven workflow described in [AGENTS.md](AGENTS.md). Before implementing anything, the agent reads, in order:

1. [context/project-overview.md](context/project-overview.md) — what JobPilot is, the user flow, in/out of scope
2. [context/architecture.md](context/architecture.md) — stack, folder structure, data flow, DB schema, invariants
3. [context/ui-tokens.md](context/ui-tokens.md) — design tokens
4. [context/ui-rules.md](context/ui-rules.md) — UI conventions
5. [context/ui-registry.md](context/ui-registry.md) — component patterns already established
6. [context/code-standards.md](context/code-standards.md) — TypeScript, Next.js, naming, error handling, and PostHog event conventions
7. [context/library-docs.md](context/library-docs.md) — project-specific notes for third party libraries
8. [context/build-plan.md](context/build-plan.md)
9. [context/progress-tracker.md](context/progress-tracker.md)

The build follows a **skateboard approach**: ship the thinnest usable whole first, then grow it. Current scope and status live in [docs/scope/scope.md](docs/scope/scope.md); each feature there links to a design spec under `docs/specs/`.

Slash-command workflow (see [AGENTS.md](AGENTS.md) for the full skill list):

- `/architect` — design a feature before building it
- `/develop` — build from an approved spec
- `/check verify` / `/check review` — confirm behavior against spec / code review
- `/test` — write tests for what changed
- `/sync` — reconcile scope and AGENTS.md after a change
- `/imprint` — capture new UI patterns into the registry
- `/recover` — diagnose and recover from a build gone wrong

### InsForge backend

This project uses [InsForge](https://insforge.dev) for database, auth, storage, and edge functions — project `JSM_JobPilot` (`https://s74xxncd.us-east.insforge.app`). Backend credentials live in `.env.local` (app) and `.insforge/project.json` (CLI) — never hardcoded or committed. See the InsForge section of [AGENTS.md](AGENTS.md) for the skill breakdown (`insforge`, `insforge-cli`, `insforge-debug`, `insforge-integrations`).

## Deployment

Hosted on Vercel (Hobby plan), production branch `main`, auto-deploy on push. See [docs/specs/0013-deploy-target-production-config](docs/specs/0013-deploy-target-production-config/index.md) for the full production configuration decisions (OAuth callback URLs, env vars, `maxDuration` on the research route).

## License

Private project — not licensed for reuse.
