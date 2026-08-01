# 0013. Deploy target and production config

**Date**: 2026-08-01
**Status**: In Progress

## Summary

JobPilot will deploy to Vercel on the free Hobby tier, at the default `<project>.vercel.app` origin the project gets when created. The existing Google and GitHub OAuth apps get the production callback URL added, `insforge.toml` allows the production origin, and every environment variable the app reads lands in both `.env.example` and the Vercel project. The company research route ships with configuration that maximizes its allowed execution time inside the plan limits, because that route blocks the request for the full Browserbase session. This makes the app reachable from the portfolio with the access gate working, which is the whole point of the prior gate work.

## Requirements

**User stories**:
- As a portfolio visitor, I want to open the deployed URL so that I can try JobPilot from my portfolio.
- As the owner, I want Google and GitHub sign in to work on the deployed site so that visitors can actually get through the access gate.
- As the owner, I want every secret and public var the app reads to be set in production and documented, so that no route fails at runtime for a missing variable.

**Acceptance criteria** (each independently checkable):
- **AC-1**: A host and production origin are chosen and recorded, and the deployed app responds over HTTPS at that origin.
- **AC-2**: The production origin is in `insforge.toml` `allowed_redirect_urls`, and the production callback URL is registered in the existing Google and GitHub OAuth apps.
- **AC-3**: Google and GitHub sign in both complete successfully on the deployed origin in a real browser session.
- **AC-4**: Every environment variable the app reads is documented in `.env.example` and set in the Vercel production environment, including the two PostHog public vars (which were previously missing from `.env.example`).
- **AC-5**: The deployed app serves the access gate as specced: an approved signed in user reaches the protected pages, an unapproved signed in user lands on `/private-beta`, and the four paid routes keep their server side denial.
- **AC-6**: The company research route ships with `maxDuration` and `force-dynamic` so it uses the highest allowed execution time on the plan, and the note in `context/library-docs.md` that claims the research route returns early is corrected, because the verified code blocks the request for the whole session.

## Decision

**Chosen option**: Option 2: Vercel Hobby with prolonged execution config for the research route.

Deploy to Vercel on the free Hobby tier at the default `<project>.vercel.app` origin, with auto deploy on push to `main` and preview URLs on pull requests. Add the production callback URL to the existing Google and GitHub OAuth apps. Extend the research route's execution window with `export const maxDuration` and `export const dynamic = "force-dynamic"`, and correct the library docs claim that contradicts the real code.

**Implementation skills**: `insforge` and `insforge-cli` as registered in `AGENTS.md` for the BaaS and deploy conventions.

## Feature design

**Configuration surface** (the shape of the change):

| Layer | Current | Target |
|---|---|---|
| Host | none (localhost only) | Vercel Hobby, production branch `main`, auto deploy + PR previews |
| Origin | `http://localhost:3000` | `https://<project>.vercel.app` (the real slug once created) |
| `insforge.toml` `allowed_redirect_urls` | `["http://localhost:3000/callback"]` | `["http://localhost:3000/callback", "https://<project>.vercel.app/callback"]` |
| Google OAuth app | localhost callback | add the production callback, keep localhost |
| GitHub OAuth app | localhost callback | add the production callback, keep localhost |
| `NEXT_PUBLIC_APP_URL` in prod | unset | the production origin (the app throws in production without it) |
| `.env.example` | missing the two PostHog public vars | add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` |
| Research route | no duration config | `export const maxDuration = <plan max>` and `export const dynamic = "force-dynamic"` |
| `context/library-docs.md` research note | claims the route returns early | correct it: the route awaits the full session and synthesis |

**Key invariants**:
- The localhost callback stays registered in both OAuth apps and in `insforge.toml`, so local development keeps working.
- `user_access` stays admin SQL only; the deploy does not change the access gate logic.
- The app never hardcodes a secret; everything goes through Vercel's environment variables or `.env.local` locally.

**Security model**:
- No new security surface. The access gate, route guards, and RLS stay exactly as specced in spec 0012.
- The OAuth apps now trust a second origin (production). This widens the redirect blast radius slightly; it is acceptable because the callback is server side and the app validates the origin through `getAppOrigin`, which reads the production `NEXT_PUBLIC_APP_URL`.
- Secrets (OpenAI, Adzuna, Browserbase, anon key) never appear in source control; they live only in Vercel env vars and `.env.local`.

**Critical test scenarios** (each maps to an AC):
- Deployed origin loads over HTTPS and serves the app, verifies **AC-1**.
- A fresh browser session on the deployed origin signs in with Google and with GitHub, verifies **AC-2**, **AC-3**.
- An approved account reaches `/dashboard` and `/find-jobs` on the deployed site; a throwaway unapproved account lands on `/private-beta`; the four paid routes return `403` for the unapproved account, verifies **AC-5**.
- The deployed app's env var set matches `.env.example` and no route 500s on a missing var, verifies **AC-4**.
- The research route has `maxDuration` and `force-dynamic` exported, and `context/library-docs.md` no longer claims an early return, verifies **AC-6**.

## Build plan

Skateboard: ship the thinnest usable live deploy first, then grow. Ordered so a visitor can reach the gate on the first deploy.

1. Create the Vercel project from the repo, production branch `main`, and set the production environment variables (every current `.env.example` var plus the two PostHog public vars), satisfies **AC-1**, **AC-4**.
2. Add the production origin to `insforge.toml` `allowed_redirect_urls`, satisfies **AC-2**.
3. Add the production callback URL to the existing Google and GitHub OAuth apps, keeping the localhost callback, satisfies **AC-2**, **AC-3**.
4. Add the missing PostHog public vars to `.env.example`, satisfies **AC-4**.
5. Add `export const maxDuration` (set to the plan's highest allowed value) and `export const dynamic = "force-dynamic"` to `app/api/agent/research/route.ts`, and correct the misleading early-return note in `context/library-docs.md`, satisfies **AC-6**.
6. Verify OAuth and the access gate on the deployed origin with the steps in `verify.md`, satisfies **AC-3**, **AC-5**.

## Consequences

**Positive**:
- The app gets a free, portfolio linkable URL with zero DNS work.
- One less vendor than any non-InsForge hosting, since the backend stays on InsForge and the frontend goes to Vercel (two vendors total is the accepted price of the free tier).
- PR preview URLs give a safety net before production.
- Every env var becomes documented, closing a known gap.

**Negative / tradeoffs**:
- Vercel Hobby's per function execution limits constrain the longest route (company research). The shipped `maxDuration` is the mitigation, not a guarantee; if the plan ceiling is still below the route's real runtime, company research must move to a background job or a different host.
- Production `main` means the current unmerged `deployment_guardsafe` access gate work must reach `main` before the first production deploy actually gates anything.
- The `<project>.vercel.app` URL is Vercel branded and lives as long as the Vercel project lives; deleting the project ends the URL.

**Neutral**:
- A second environment configuration (Vercel) now exists alongside the InsForge backend config; both must be kept in sync when OAuth or env vars change.
- Localhost sign in continues to work because the local callback stays registered.

## Follow-up

- [ ] Merge the `deployment_guardsafe` branch into `main` before the first production deploy so the access gate ships to production.
- [ ] At deploy time, confirm the current Vercel Hobby max duration ceiling against the research route's real runtime; if it is still too small, move company research to an async background job (for example an InsForge edge function or a Vercel background function) and revisit this spec.
- [ ] Set the real PostHog public key and host in the Vercel production environment once they exist.
- [ ] If a custom domain is wanted later: add the domain as the origin, re-add the callback to both OAuth apps and `allowed_redirect_urls`, and set `NEXT_PUBLIC_APP_URL` to the new origin.

## Rationale

Reasoning and options: see `rationale.md`.