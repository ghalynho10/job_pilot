# Rationale: 0013 Deploy target and production config

Last updated: 2026-08-01

## Context

The access gate from spec 0012 exists so JobPilot can be deployed and linked from the portfolio. Everything behind the gate is real: the homepage, login, the protected pages, and the paid routes. Yet the app only runs on localhost today. `insforge.toml` lists `allowed_redirect_urls = ["http://localhost:3000/callback"]`, so any deployed origin fails Google and GitHub sign in immediately. The app enforces `NEXT_PUBLIC_APP_URL` in production through `getAppOrigin` in `lib/auth-routing.ts`: in a production build with no value set it throws. And `.env.example` is missing two variables the code clearly reads: `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` appear in `lib/posthog-client.ts`, `lib/posthog-server.ts`, and `next.config.ts`.

The decision to make is the hosting target and the production configuration that follows from it: origin, OAuth callbacks, environment variables, and how the platform's execution limits interact with the app's longest routes. Vercel Hobby was chosen by the engineer for a specific reason worth recording: it is the known free option for this workload, and the deploy flow (auto deploy on push, PR previews, configurable production branch) is the standard Next.js experience.

## Options considered

### Option 1: InsForge hosting

InsForge's own `create-deployment` tooling, one vendor with the backend. No second pipeline. On paper the cleanest single vendor story.

**Pros**:
- One vendor for backend and frontend, one account, one toolchain.
- No static host function caps designed for static sites applied to a server heavy app.

**Cons**:
- Pricing could not be verified in this session (no web tool connected), so the cost story was unprovable.
- The engineer explicitly picked the known free option instead; the session could not show that InsForge hosting was free.

### Option 2: Vercel Hobby with prolonged execution config (chosen)

Free hobby tier, default `<project>.vercel.app`, auto deploy on `main` push, PR previews. Research route gets `maxDuration` plus `force-dynamic` to use the plan's highest execution allowance.

**Pros**:
- Known free, zero DNS, no credit card.
- Standard Next.js host, first class App Router support.
- PR preview URLs before production.

**Cons**:
- Per function execution limits. Every paid route awaits provider calls inline; company research is the long one because it blocks a full Browserbase session.
- A second vendor alongside InsForge, with a separate env configuration to keep in sync.

### Option 3: Cloudflare Pages or Netlify

Both support Next.js and have free tiers.

**Pros**:
- Free tiers exist.
- Familiar static hosting controls.

**Cons**:
- Next.js App Router support is less turnkey than Vercel, especially for server routes that need long execution.
- Same function timeout risk family as Vercel, with less mature tooling for App Router.

## Rationale

The engineer's stated priority was free without sacrificing quality, and Vercel Hobby is the one host the session could present as known free. Vercel is also the platform where Next.js App Router is a first class citizen; the app is a Next.js server app, not a static site, so the host best aligned with that framework is the quality answer within the free constraint.

The plan is honest about the load bearing risk. The verified code in `app/api/agent/research/route.ts` calls `runCompanyResearch(job, profile)` and awaits it (line 77); once a request passes the guard, validation, and database checks, the route never responds until the Browserbase session and the synthesis finish (it does return early on guard, validation, and database errors, which is the expected failure behavior). Company research blocks the request for the full Browserbase session (up to 120 seconds by project convention) plus synthesis and the save. That makes it the route most exposed to a per function execution cap. Shipping `export const maxDuration` and `export const dynamic = "force-dynamic"` on that route uses the plan's highest allowance and is the right skateboard mitigation. If the ceiling is still below the real runtime, the Follow-up in `index.md` names the escape hatch: move company research to an async background job.

The engineer also chose the default `<project>.vercel.app` origin and updating the existing Google and GitHub OAuth apps with the production callback. Keeping the localhost callback in place preserves local development. Production branch stays `main`; the current unmerged `deployment_guardsafe` access gate work must merge before the first production deploy actually gates anything, which is recorded as a Follow-up.

Two facts checked during the interview shape this spec: `getAppOrigin` throws in production without `NEXT_PUBLIC_APP_URL`, and `.env.example` is missing the two PostHog public vars the code reads. Both are now part of the build plan.

## References

The engineer chose the no references level. This file is the complete decision record, kept inline.

## Evidence

Search results during design:
- `process.env` usage found in `next.config.ts`, `proxy.ts`, `actions/auth.ts`, `lib/posthog-client.ts`, `lib/posthog-server.ts`, `lib/auth-routing.ts`, `lib/adzuna.ts`, `lib/access.ts`, `agent/matcher.ts`, `agent/resume-extractor.ts`, `agent/resume-generator.ts`, `agent/research.ts`, and the two agent API routes. The full runtime env var set is: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `ENABLE_AGENT_RUNS`, plus `NODE_ENV` (framework managed).
- `app/api/agent/research/route.ts` line 77 awaits `runCompanyResearch`; the route never responds before the session and synthesis finish (it does return early on guard, validation, and database errors). `context/library-docs.md`'s claim that the route "returns a response while the session continues" is contradicted by the verified code and is corrected by this spec (AC-6).
- `app/api/agent/find/route.ts` line 89 awaits `runJobSearch` inline; the find route also blocks, but its runtime is materially shorter (Adzuna HTTP call plus GPT scoring) than company research.
- `lib/auth-routing.ts` `getAppOrigin`: in production with no `NEXT_PUBLIC_APP_URL`, it throws. The origin must be the deployed origin, never a guessed default.
- `insforge.toml` current auth section allows only `http://localhost:3000/callback`.
- `.env.example` currently documents nine vars and is missing `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.