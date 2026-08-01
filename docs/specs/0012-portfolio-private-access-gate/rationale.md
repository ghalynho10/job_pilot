# Rationale for 0012. Portfolio private access gate

## Context

Features A through Q in `docs/scope/scope.md` are all `existing`: JobPilot works end to end. What it does not have is any limit on who can spend the owner's money. Signing in is Google or GitHub OAuth with no allowlist, and once signed in a user can trigger Adzuna searches, GPT-4o scoring, Browserbase and Stagehand sessions, GPT-4o dossier synthesis, GPT-4o resume extraction, and GPT-4o resume generation. Every one of those is billed to the owner's keys.

The owner wants to deploy the app now and link it from a portfolio, which puts that surface in front of anyone who reads the portfolio. Billing is the real answer and is already planned as scope features 1 to 3, but it is a full weight slice involving Stripe products, checkout, webhooks, and usage counters. This spec exists to put a cheap, correct stopgap in front of the spend surface so deployment does not have to wait for billing, and to shape that stopgap so billing replaces it cleanly rather than fighting it.

Four load bearing questions were open when this spec was drafted. Three were put to the engineer and answered; the fourth was settled here on the security argument below.

## Options considered

### Panel 1: Which routes the gate covers

**Option A — The two agent routes only (the original proposal)**: gate `POST /api/agent/find` and `POST /api/agent/research`.

- **Pros**: Smallest diff. Covers the two most expensive paths, since company research opens a real cloud browser session.
- **Cons**: Leaves two GPT-4o call sites reachable by any signed in visitor. `app/api/resume/extract/route.ts` runs GPT-4o over an uploaded PDF and `app/api/resume/generate/route.ts` runs GPT-4o to draft resume content. Both are cheaper per call than a Browserbase session, and both are trivially repeatable in a loop by anyone with a session cookie. A cost gate with two open doors is not a cost gate.

**Option B — All four paid routes, kill switch on the agent routes only (chosen)**: gate all four; `ENABLE_AGENT_RUNS` still covers only the two agent routes.

- **Pros**: Closes the whole spend surface. Keeps the kill switch semantically honest: it is named for agent runs and the resume routes are not agent runs, so an incident on Browserbase does not also break resume features for approved users.
- **Cons**: Two more route files to touch and two more test files to extend.

**Option C — All four, kill switch covers all four**: one variable pauses every paid call in the app.

- **Pros**: Simplest mental model for an incident: one switch, everything paid stops.
- **Cons**: Over broad. The realistic incident is a runaway agent loop or a Browserbase billing surprise, and in that case there is no reason to also take resume upload and generation away from an approved user. Coupling unrelated failure domains to one switch makes the switch more costly to use, which makes it less likely to be used.

**Decision**: Option B. `app/api/resume/signed-url/route.ts` was checked and deliberately excluded: it mints a signed URL for a file the caller already owns and reaches no paid provider.

### Panel 2: Where approval state lives

**Option A — A dedicated `user_access` table (chosen)**: one row per user, primary key referencing `auth.users(id)`, RLS select own row, no write grant.

- **Pros**: The user cannot grant themself access, because the database refuses the write rather than the application declining to offer it. Access is an account fact rather than a profile fact, so keying on `auth.users` means it works for a user who has not filled a profile yet. Granting is a one line SQL statement through the InsForge CLI, no redeploy. `status` distinguishes `pending` from `blocked` for the owner's own bookkeeping.
- **Cons**: A migration and a new table for a feature that is meant to be temporary.

**Option B — An `is_approved` column on `profiles`**: no new table, one boolean.

- **Pros**: Zero new tables. `profiles` is already read on most protected paths, so the lookup could sometimes ride along for free.
- **Cons**: Disqualifying. `migrations/20260718170543_create-core-tables.sql` defines `profiles_update` as `FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())`, with `GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated`. Any signed in user can therefore `PATCH` their own `profiles` row through PostgREST and set any column on it, including an approval flag. The gate would be self service. Splitting the column's write permission out of that policy is possible with column level grants, but it means complicating a policy that currently reads cleanly, in order to store one fact that does not belong to the profile anyway.

**Option C — An environment variable allowlist of approved emails**: `APPROVED_EMAILS="a@x.com,b@y.com"`.

- **Pros**: No migration, no table, no RLS to reason about. The value cannot be reached by any user at all, so self approval is impossible by construction.
- **Cons**: Every new demo user needs an environment change and a redeploy on the hosting platform, which is slower and more disruptive than one SQL statement. It also gives billing nothing to build on: a subscription is per account state, and it will need a table regardless, so this path is thrown away entirely when billing lands rather than evolving into it.

**Decision**: Option A. The self approval hole in Option B is the deciding argument; Option C is safe but a dead end.

### Panel 3: Where the page level gate lives

**Option A — An `app/(app)/` route group layout**: move `dashboard/`, `profile/`, and `find-jobs/` under a route group with one `layout.tsx` doing auth then approval.

- **Pros**: Defines the check once. Today the `getCurrentUser` plus `redirect("/login?error=session")` block is copy pasted at `app/dashboard/page.tsx:67`, `app/profile/page.tsx:14`, `app/find-jobs/page.tsx:11`, and `app/find-jobs/[id]/page.tsx:24`; adding an approval check inline would make that four copies of two checks. Route groups do not affect URLs, so `proxy.ts`'s matcher and every existing link keep working untouched. The next protected page inherits both checks automatically.
- **Cons**: Three directories move, so the diff shows renames and is larger to read than a four line addition.

**Option B — Inline in each of the four pages (chosen)**: add one shared `requireApprovedPage` call beside the existing guard in each page.

- **Pros**: Smallest possible diff, nothing moves, lowest risk of breaking a route by accident. Nothing has to be unwound when billing supersedes this gate. The existing page contract tests keep passing as written, since no file moves and no block is deleted.
- **Cons**: Institutionalises the duplication at the exact moment it was about to double. Four places to keep in sync, and the fifth page someone adds will be guarded from memory or not at all. Softened, but not removed, by putting the rule in `requireApprovedPage` so what repeats is one call rather than the logic.

**Option C — In `proxy.ts`**: check approval in the edge proxy alongside the session refresh.

- **Pros**: One place, runs before the page even renders, covers any route the matcher lists including future ones.
- **Cons**: Wrong tool. `proxy.ts` runs on the edge runtime and currently only touches cookies through `updateSession`. Adding a `user_access` lookup means a database round trip on every matched request including asset and prefetch traffic, using a database client the file does not have and that the edge runtime does not suit. It also puts application authorisation logic in a file whose job is session transport.

**Decision**: Option B, revised after a cross check review on 2026-08-01. Option A was chosen first, on the argument that the duplication is real today and about to get worse. The review pushed back on the cost side and won the point: the route group adds no security, since the page gate is cosmetic and `guardPaidRoute` is the actual boundary, and it is the largest and highest regression part of the diff, forcing four existing contract test files to be repointed. Weighed against a feature the Follow-up section already marks as superseded by billing, paying down that duplication inside a temporary gate is not worth the churn. Option B ships the same protection with four added lines. The duplication cost is accepted and written into Consequences rather than argued away.

### Panel 4: What the unapproved user sees

**Option A — Redirect to a dedicated `/private-beta` page (chosen)**.

- **Pros**: One screen to write and style. Clean, linkable URL. An empty `app/private-beta/` directory already exists in the repository, which suggests this was the intent before the plan was written. The page can render without the app navbar, so nothing on screen implies a working Dashboard, Find Jobs, or Profile link.
- **Cons**: A redirect, so the URL the user typed is replaced. Needs its own guards to avoid becoming a dead end for signed out and approved users, both specified in the acceptance criteria.

**Option B — Render the private beta panel in place on each page**.

- **Pros**: No redirect, the URL stays where the user put it, no flash.
- **Cons**: The panel has to be wired into four pages, and unlike Panel 3's one line call this means four copies of real markup. The navbar also stays rendered around it, so the screen still shows navigation that goes nowhere useful.

**Decision**: Option A.

## Rationale

The through line in all four panels is that the security boundary is the server route, and everything else is user experience. That is why the gate is checked twice: `guardPaidRoute` in each of the four paid routes is what actually protects the money, because a `curl` with a valid session cookie never renders a page, and the page level redirect exists purely so an unapproved user gets a sensible screen instead of a wall of failed requests. Reading those two as redundant would be the mistake; dropping either one loses something the other does not provide.

The second through line is that this feature is deliberately temporary and should cost as little as possible to remove. That is what decided Panel 3 on review: a route group refactor is good hygiene in code expected to last, and the wrong spend in code with a planned end date. Confining the `user_access` read to `isUserApproved` means the billing work in scope features 1 to 3 replaces one function body. Choosing a table over an environment allowlist means the shape the gate leaves behind, per account state keyed on `auth.users`, is the shape billing needs anyway.

The two corrections to the original proposal both come from reading what is actually in the repository rather than what the plan assumed. The resume routes were not in the proposed plan and are two live GPT-4o call sites. The `profiles_update` policy is what rules out the obvious cheap place to store an approval flag. Neither is visible from the feature description alone.
