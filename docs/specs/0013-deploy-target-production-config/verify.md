# Verify: deploy-target-production-config · spec 0013 · updated 2026-08-01

_Steps derived from spec 0013 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Two accounts are needed from spec 0012's verify flow once the gate is live: **UNAPPROVED** (signed in, no `user_access` row) and **APPROVED** (`user_access.status = 'approved'`). Grant and revoke with the `insforge-cli` skill, exactly as recorded in spec 0012 `verify.md`.

The record of the chosen origin lives in `insforge.toml`, `app/(auth)/` OAuth callbacks, and `NEXT_PUBLIC_APP_URL`. Before any browser check, confirm the recorded origin with:

```
grep -n "allowed_redirect_urls" insforge.toml
grep -n "NEXT_PUBLIC_APP_URL" .env.example
```

## Deploy target and origin

- [ ] The Vercel project exists, created from this repo, production branch `main` → AC-1
- [ ] Auto deploy on push to `main` is on, and a PR branch produces a preview URL → AC-1
- [ ] `https://<project>.vercel.app` (the recorded origin) responds over HTTPS and serves the JobPilot app, not an error page or a framework default → AC-1
- [ ] `NEXT_PUBLIC_APP_URL` in the Vercel production environment equals that same origin, with no trailing slash → AC-1, AC-4

## OAuth callbacks

- [ ] `insforge.toml` `allowed_redirect_urls` lists both `http://localhost:3000/callback` and `https://<project>.vercel.app/callback` → AC-2
- [ ] The Google OAuth app lists the production callback `https://<project>.vercel.app/callback` and still lists the localhost callback → AC-2
- [ ] The GitHub OAuth app lists the production callback `https://<project>.vercel.app/callback` and still lists the localhost callback → AC-2
- [ ] On the deployed origin, in a fresh browser session, sign in with Google completes and lands on `/dashboard` → AC-3
- [ ] On the deployed origin, in a fresh browser session, sign in with GitHub completes and lands on `/dashboard` → AC-3
- [ ] On localhost, both Google and GitHub sign in still work, proving the localhost callback was not removed → AC-3

## Environment variables

- [ ] `.env.example` documents every var the code reads: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `ENABLE_AGENT_RUNS` → AC-4
- [ ] The two PostHog public vars are present in `.env.example` with `NEXT_PUBLIC_` prefixes, and a placeholder value, not a real key → AC-4
- [ ] The Vercel production environment set matches `.env.example` one for one, with no var missing and no secret in a `NEXT_PUBLIC_` var → AC-4
- [ ] Every provider var needed by the agent routes is set in production (`OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`) → AC-4

## Access gate on the deployed origin

- [ ] As APPROVED on the deployed origin, visit `/dashboard`, `/profile`, `/find-jobs`, and a real `/find-jobs/<id>` → each renders its existing content → AC-5
- [ ] As UNAPPROVED on the deployed origin, visit `/dashboard` and `/find-jobs` → each redirects to `/private-beta`, with no app navbar → AC-5
- [ ] As UNAPPROVED on the deployed origin, POST to each of `/api/agent/find`, `/api/agent/research`, `/api/resume/extract`, `/api/resume/generate` → each returns `403` and no provider call is made (no `agent_runs` or `agent_logs` row, no Browserbase session, no OpenAI usage) → AC-5
- [ ] As APPROVED on the deployed origin, POST to `/api/agent/find` → the route behaves exactly as before the deploy → AC-5

## Research route execution config

- [ ] `app/api/agent/research/route.ts` exports `maxDuration` set to the plan's highest allowed value and `export const dynamic = "force-dynamic"` → AC-6
- [ ] No other route needed or got `maxDuration`; the find and resume routes keep their current configuration → AC-6
- [ ] `context/library-docs.md` no longer claims the research route returns a response while the Browserbase session continues; it now states the route awaits the full session and synthesis → AC-6
- [ ] Grep `library-docs.md` for the stale phrase and confirm it is gone → AC-6

## Commands

- [ ] `npx tsc --noEmit` → no type errors → all ACs
- [ ] `npm run lint` → no lint errors → all ACs
- [ ] `npm test` → all pass, including the existing access and route contract tests → AC-5
- [ ] `npm run build` → production build succeeds → AC-6
- [ ] `npx @insforge/cli project list` (or equivalent) confirms the `JSM_JobPilot` project is reachable from the current CLI config → AC-1

## Acceptance-criteria coverage

- AC-1 (host and origin chosen, HTTPS) → Deploy target and origin, all steps
- AC-2 (production origin in insforge.toml and OAuth apps) → OAuth callbacks, steps 1 to 3
- AC-3 (Google and GitHub sign in work on deployed origin) → OAuth callbacks, steps 4 to 6
- AC-4 (every env var documented and set) → Environment variables, all steps
- AC-5 (access gate on the deployed origin) → Access gate on the deployed origin, all steps
- AC-6 (research route maxDuration and docs correction) → Research route execution config, all steps; Commands, build step