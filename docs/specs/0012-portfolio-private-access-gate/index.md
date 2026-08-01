# 0012. Portfolio private access gate

**Date**: 2026-08-01
**Status**: Proposed

## Summary

JobPilot is feature complete but every core action costs real money: Adzuna calls, Browserbase sessions, and four separate GPT-4o call sites. Billing (scope features 1 to 3) is planned and not built. This decision adds a temporary approval gate so the app can be deployed and linked from a portfolio without letting any visitor who signs in with Google or GitHub burn API credit.

Public visitors keep the homepage and login page. A signed in user who is not approved is redirected to a private beta screen. An approved user gets the full app. Every server route that reaches a paid provider re-checks approval on the server before any external call runs, plus an emergency `ENABLE_AGENT_RUNS` switch that pauses the two agent routes.

Approval state lives in a new `user_access` table that the user themself cannot write. The lookup sits behind one function, `isUserApproved`, so billing can later replace it with a subscription and usage check without touching a single call site.

## Requirements

**User stories**:
- As the project owner, I want to deploy JobPilot and link it from my portfolio so recruiters can see it, without any visitor being able to run up my Adzuna, Browserbase, or OpenAI bill.
- As the project owner, I want to approve a specific person (a recruiter, a friend) by hand so I can give a real demo to whoever I choose.
- As the project owner, I want a single switch that pauses the expensive agents immediately if something goes wrong, without a code change or a redeploy of application logic.
- As a signed in visitor who is not approved, I want a clear screen telling me access is private while billing is being finished, rather than a broken page or a silent error.
- As an approved user, I want the app to behave exactly as it did before this gate existed.

**Acceptance criteria**:
- **AC-1**: A signed out visitor loads `/` and `/login` normally. Neither page performs an approval check and neither redirects on account of this feature.
- **AC-2**: A signed out visitor requesting `/dashboard`, `/profile`, `/find-jobs`, `/find-jobs/[id]`, or `/private-beta` is redirected to `/login`. The existing `proxy.ts` session behaviour, including the `?error=session` rules, is unchanged.
- **AC-3**: A signed in user with no `user_access` row, or a row whose `status` is `pending` or `blocked`, is redirected to `/private-beta` from `/dashboard`, `/profile`, `/find-jobs`, and `/find-jobs/[id]`. A missing row is treated exactly like `pending`: not approved.
- **AC-4**: `/private-beta` renders without the app navbar, so it exposes no working Dashboard, Find Jobs, or Profile link and no search or research control. It shows the signed in account and a working sign out action. A signed out request to it redirects to `/login`; a request from an approved user redirects to `/dashboard`, so it is never a dead end.
- **AC-5**: A signed in user whose `user_access.status` is `approved` reaches all four protected pages with their existing content and behaviour unchanged.
- **AC-6**: `POST /api/agent/find`, `POST /api/agent/research`, `POST /api/resume/extract`, and `POST /api/resume/generate` each return `403` with a generic message when the caller is signed in but not approved. The check runs before request body parsing and before any `profiles` or `jobs` read, so no Adzuna, Browserbase, Stagehand, or OpenAI call is made and no `agent_runs` row is inserted.
- **AC-7**: Those same four routes return `401` with a generic message when there is no session, preserving today's behaviour.
- **AC-8**: With `ENABLE_AGENT_RUNS=false`, `POST /api/agent/find` and `POST /api/agent/research` return `503` for an approved user before any external call, while `POST /api/resume/extract` and `POST /api/resume/generate` keep working for an approved user. Any other value of the variable, including it being unset, empty, or `true`, allows the agent routes to run.
- **AC-9**: `user_access` has row level security enabled with a select own row policy and no insert, update, or delete policy and no matching grant to `authenticated`. An authenticated user attempting to insert or update their own `user_access` row through the SDK is denied by the database, not by application code.
- **AC-10**: The signed in check is defined once for the protected pages. The four page level copies of the `getCurrentUser` plus `redirect("/login?error=session")` block are removed and replaced by a single route group layout. Page URLs are unchanged and `proxy.ts`'s matcher still covers them.
- **AC-11**: `lib/access.ts` exposes `agentRunsEnabled` as a pure function taking the flag value as an argument, following the injectable arguments pattern in `lib/auth-routing.ts`, so it is unit testable without process environment mutation. No call site outside `lib/access.ts` queries `user_access` directly.
- **AC-12**: `ENABLE_AGENT_RUNS` is added to `.env.example` and to the environment variable table in `context/code-standards.md`, and `user_access` is documented in `context/architecture.md`'s schema section. `types/index.ts` gains a `UserAccessRow` type. No `any` is introduced.
- **AC-13**: Existing auth, profile save, resume upload, resume extract, resume generate, job search, and company research flows behave identically for an approved user. `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` all pass.

## Decision

**Chosen option**: A dedicated read only `user_access` table, one shared `lib/access.ts` helper, a route group layout for the page gate, and the same helper re-checked in every paid route

Approval is a single row per user in a new `user_access` table. It is a separate table rather than a column on `profiles` because `profiles` carries a `profiles_update` policy that lets a user update their own row, so an approval flag there would be self grantable straight through PostgREST. `user_access` gets a select own row policy and nothing else, so only admin SQL through the InsForge CLI can grant access.

`lib/access.ts` holds three layered exports: `agentRunsEnabled` (pure, injectable), `isUserApproved` (the one place `user_access` is read), and `guardPaidRoute` (the route handler guard that runs auth, then approval, then optionally the kill switch, returning either the client and user id or a ready made denial response).

The page gate moves `dashboard/`, `profile/`, and `find-jobs/` under an `app/(app)/` route group with one `layout.tsx` doing auth plus approval once. Route groups do not change URLs, so `proxy.ts`'s matcher is untouched for those paths. This also removes the four copies of the signed in check that exist today.

The gate is checked twice on purpose. The layout is the user experience: it sends the unapproved user somewhere sensible. The route guard is the security boundary: a hand crafted `curl` with a valid session cookie never touches the layout, so each paid route re-checks on its own.

**Billing seam**: `isUserApproved` is the single function that billing later replaces with a subscription plus usage check. Because no call site reads `user_access` directly, that swap changes one function body and nothing else.

**Implementation skills**: `insforge` (`.claude/skills/insforge/`) for the SDK query and storage rules · `insforge-cli` (`.claude/skills/insforge-cli/`) for applying the migration and running the approval SQL · `tailwind-css-patterns` for the private beta screen, subject to `context/ui-tokens.md`.

## Feature design

**Data model sketch**:

New table, one row per user, created only when the owner grants or records access. Absence of a row means not approved.

| Field | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | Primary key, `REFERENCES auth.users (id) ON DELETE CASCADE`. Not `profiles`, because access is an account fact, not a profile fact, and should survive a user who has not filled a profile yet. |
| `status` | `text` | `NOT NULL DEFAULT 'pending'`, `CHECK (status IN ('pending', 'approved', 'blocked'))`. Only `approved` opens the app. |
| `approved_at` | `timestamptz` | Nullable. Set when access is granted. Record only, nothing reads it in this feature. |
| `notes` | `text` | Nullable. Free text for the owner, for example `portfolio demo`. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`. |

`types/index.ts` adds:

```typescript
export type UserAccessStatus = "pending" | "approved" | "blocked";

export type UserAccessRow = {
  user_id: string;
  status: UserAccessStatus;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
};
```

**State transitions**:

A user's access has three observable states and no application code moves between them. Only the owner does, through SQL.

```
no row / pending  →  private beta screen, every paid route returns 403
approved          →  full app, paid routes run (agents also need the kill switch on)
blocked           →  private beta screen, every paid route returns 403
```

`pending` and `blocked` behave identically to the user today. They are kept apart so the owner can tell "not looked at yet" from "deliberately denied" when reading the table.

Orthogonal to all three, `ENABLE_AGENT_RUNS=false` pauses only `POST /api/agent/find` and `POST /api/agent/research` for everyone, approved included. It does not affect page access or the two resume routes.

**API surface**:

No new HTTP endpoint. Four existing routes gain a guard, and one new page route is added.

| Call | Where | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `agentRunsEnabled(flag)` | `lib/access.ts` | `string \| undefined` | `boolean` | none, pure | never throws |
| `isUserApproved(insforge, userId)` | `lib/access.ts` | cookie scoped client, user id | `boolean` | relies on the caller's session for RLS scoping | never throws; a query error is logged and returns `false` |
| `guardPaidRoute({ requireAgentSwitch })` | `lib/access.ts` | whether the kill switch applies | `{ ok: true, insforge, userId }` or `{ ok: false, response }` | creates the server client and reads the session itself | returns the denial response rather than throwing |
| `POST /api/agent/find` | `app/api/agent/find/route.ts` | unchanged | unchanged | `guardPaidRoute({ requireAgentSwitch: true })` | new `403`, new `503` |
| `POST /api/agent/research` | `app/api/agent/research/route.ts` | unchanged | unchanged | `guardPaidRoute({ requireAgentSwitch: true })` | new `403`, new `503` |
| `POST /api/resume/extract` | `app/api/resume/extract/route.ts` | unchanged | unchanged | `guardPaidRoute({ requireAgentSwitch: false })` | new `403` |
| `POST /api/resume/generate` | `app/api/resume/generate/route.ts` | unchanged | unchanged | `guardPaidRoute({ requireAgentSwitch: false })` | new `403` |
| `GET /private-beta` | `app/private-beta/page.tsx` | none | the private beta screen | signed in, not approved | redirects to `/login` or `/dashboard` rather than erroring |

Denial responses use the project's `{ success, error }` wrapper from `context/code-standards.md`:

| Case | Status | Message |
|---|---|---|
| No session | `401` | `You must be signed in to do that.` |
| Signed in, not approved | `403` | `JobPilot is in private beta. Your account is not approved yet.` |
| `ENABLE_AGENT_RUNS=false` | `503` | `Job search and company research are temporarily paused.` |

`app/api/resume/signed-url/route.ts` is deliberately left alone. It mints a signed URL for a file the caller already owns and reaches no paid provider.

**Key invariants**:
- No application code ever writes `user_access`. The table has no insert, update, or delete grant to `authenticated`, so the database enforces this rather than convention.
- A missing `user_access` row means not approved. Nothing creates rows on signup.
- `isUserApproved` is the only place in the codebase that queries `user_access`.
- `guardPaidRoute` runs before request body parsing and before any database read in every route that calls it, so a denial costs one auth call and one indexed primary key lookup and nothing else.
- Every paid route re-checks approval on the server. The layout gate is user experience only and is never the security boundary.
- `agentRunsEnabled` defaults to allowing. Only the exact string `"false"` disables, so a missing or misspelled variable never silently breaks a working deployment.
- `/private-beta` lives outside the `(app)` route group, so the layout's redirect can never target a page that redirects back into it.
- All styling uses tokens from `context/ui-tokens.md`. No raw hex values, no raw Tailwind color classes.

**Security model**:

The threat is cost, not data. Row level security already stops any user reading another user's rows, and this feature does not weaken that. What it adds is a spend boundary.

The real boundary is server side and per route. The layout redirect is cosmetic: anyone can skip it by posting directly to a route with a valid session cookie, which is exactly why `guardPaidRoute` is called in all four paid routes rather than being trusted to the layout. `guardPaidRoute` reads `user_access` through the caller's own cookie scoped client, so RLS scopes the lookup to their row and no service key is introduced anywhere.

The privilege escalation to avoid is self approval. Putting the flag on `profiles` would have handed it to the user, because `profiles_update` lets them update their own row. `user_access` is granted `SELECT` only.

Denial messages are generic and identical regardless of whether the row is missing, `pending`, or `blocked`, so the response never reveals the owner's decision about a specific account.

**Configuration required**:
- `ENABLE_AGENT_RUNS` — new, optional, server only, no `NEXT_PUBLIC_` prefix. Unset means agents run. Added to `.env.example` and to the table in `context/code-standards.md`.
- No new provider keys, no new dependency.

**Critical test scenarios**:
- Happy path: an approved user runs a job search, opens a job, runs company research, uploads and extracts a resume, and generates a resume, all unchanged, verifies **AC-5**, **AC-13**.
- Gate path: a signed in user with no `user_access` row visits each of the four protected pages and lands on `/private-beta` every time, with no working navigation on it, verifies **AC-3**, **AC-4**.
- Failure case: that same user posts to each of the four paid routes and gets `403`, with the agent and provider mocks asserted never called, verifies **AC-6**.
- Failure case: an unauthenticated post to each of the four paid routes still returns `401`, verifies **AC-7**.
- Switch case: `ENABLE_AGENT_RUNS=false` with an approved user gives `503` on both agent routes and success on both resume routes, verifies **AC-8**.
- Switch case: `agentRunsEnabled` over `undefined`, `""`, `"true"`, `"false"`, and `"FALSE"`, confirming only the exact lowercase `"false"` disables, verifies **AC-8**, **AC-11**.
- Lookup case: `isUserApproved` over a missing row, `pending`, `blocked`, `approved`, and a query error, confirming only `approved` returns `true` and an error returns `false` rather than throwing, verifies **AC-3**, **AC-11**.
- Security case: an approved user attempts an insert and an update against `user_access` through the SDK and is denied by RLS, verifies **AC-9**.
- Regression case: a signed out visitor loads `/` and `/login`, and is bounced from `/dashboard` to `/login` with the existing `?error=session` behaviour intact, verifies **AC-1**, **AC-2**.
- Visual check: `/private-beta` at desktop and mobile widths, verifies **AC-4**.

## Build plan

Build approach for this feature is Skateboard, per the `docs/scope/scope.md` header: the thinnest usable whole first. Tasks 1 to 3 are that whole, a working server side spend boundary. Tasks 4 to 6 grow it into a decent user experience on top. If work stops after task 3 the money is already safe, which is the property that matters here.

1. Add `migrations/<timestamp>_create-user-access.sql` creating `user_access` with the check constraint, RLS enabled, the select own row policy, and `GRANT SELECT` only. Apply it to the linked InsForge project with the `insforge-cli` skill. Satisfies **AC-9**
2. Add `UserAccessStatus` and `UserAccessRow` to `types/index.ts`, document `user_access` in `context/architecture.md`'s schema section, and add `ENABLE_AGENT_RUNS` to `.env.example` and to `context/code-standards.md`'s environment variable table. Satisfies **AC-12**
3. Write `lib/access.ts` with `agentRunsEnabled`, `isUserApproved`, and `guardPaidRoute`, logging errors under an `[lib/access]` prefix and returning the documented status codes and generic messages. Satisfies **AC-11**, and the response contract behind **AC-6**, **AC-7**, **AC-8**
4. Replace the hand rolled auth block at the top of all four paid routes with `guardPaidRoute`, `requireAgentSwitch: true` for the two agent routes and `false` for the two resume routes, placing the call before body parsing and before any database read. Leave `app/api/resume/signed-url/route.ts` untouched. Satisfies **AC-6**, **AC-7**, **AC-8**
5. Create the `app/(app)/` route group, move `dashboard/`, `profile/`, and `find-jobs/` into it, add `app/(app)/layout.tsx` doing auth then approval then render, and delete the now redundant redirect block from each of the four pages while leaving their own data reads alone. Satisfies **AC-3**, **AC-5**, **AC-10**
6. Add `app/private-beta/page.tsx` outside the route group, with its own signed out redirect to `/login`, an approved redirect to `/dashboard`, no app navbar, the signed in account shown, and sign out reusing `actions/auth.ts`. Add `"/private-beta"` to `proxy.ts`'s matcher. Satisfies **AC-2**, **AC-4**
7. Add `tests/access.test.mjs` covering `agentRunsEnabled` and `isUserApproved` across every case above, and extend `tests/agent-find-route.test.mjs`, `tests/agent-research-route.test.mjs`, `tests/resume-extract-route.test.mjs`, and `tests/resume-generate-route.test.mjs` to assert the denial status codes and that the agent and provider mocks are never invoked. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-11**
8. Verify a real run: an unapproved second account through all four pages and all four routes, then approved through SQL and re-checked, plus `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Satisfies **AC-1**, **AC-2**, **AC-5**, **AC-13**
9. Run `/imprint` to record the private beta screen in `context/ui-registry.md`, and update `context/progress-tracker.md`, per root project rules

## Consequences

**Positive**:
- The app can be deployed and linked publicly today, with the spend boundary enforced server side on every paid route rather than hidden behind a user interface that anyone can skip.
- Two paid routes that the original request overlooked, resume extract and resume generate, are now covered. Both call GPT-4o and were reachable by any signed in visitor.
- The four duplicated page guards collapse into one route group layout, so the next protected page inherits both checks for free.
- `isUserApproved` gives billing a single, named seam. Scope features 1 to 3 replace one function body rather than editing every call site.
- `ENABLE_AGENT_RUNS` is a real incident control: one environment variable change stops the two most expensive paths without a code change.

**Negative / tradeoffs**:
- Granting access is manual SQL through the InsForge CLI. There is no admin user interface, so every new demo user costs the owner a command. Accepted deliberately: an admin surface is more work than the gate itself and billing supersedes it.
- Moving three route directories into `app/(app)/` is a larger diff than an inline check and will show up as file renames in review. Worth it once, because it removes four copies of a guard that would otherwise become five.
- Every protected page render now costs one extra indexed primary key lookup against `user_access`, and every paid route call costs the same. Negligible, but non zero, and it is not cached.
- The gate is checked in two places on purpose, so an approval rule change means editing the layout and the guard if the rule ever diverges. Kept in one file to keep that divergence unlikely.

**Neutral**:
- One new table, select only, no writes from application code.
- No new dependency, no new provider key, no new HTTP endpoint.
- `pending` and `blocked` are behaviourally identical for now. The distinction exists for the owner reading the table, not for the code.

## Follow-up

- [ ] This whole feature is superseded by scope features 1 to 3 (billing). When free tier usage gating ships, `isUserApproved` becomes a subscription plus usage check and `user_access` can be dropped or repurposed.
- [ ] `insforge.toml` has `allowed_redirect_urls = ["http://localhost:3000/callback"]`, localhost only. Production OAuth will not work until the deployed origin is added. Required for deployment, but a separate change from this gate.
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are read in code but missing from `.env.example`.
- [ ] Server actions in `actions/profile.ts` and `actions/jobs.ts` stay ungated. They are cheap database writes already scoped by RLS, and an unapproved user cannot reach the interface that triggers them. Revisit if a paid call is ever added to a server action.
- [ ] No admin surface for approving users. If manual SQL becomes tedious before billing lands, a minimal owner only page is the natural next step.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
