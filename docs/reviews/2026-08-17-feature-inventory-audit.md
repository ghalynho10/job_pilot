# JobPilot — Feature Inventory Audit

**Date:** 2026-08-17
**Branch:** `main` @ `0748a53` (re-verified; first written against `d89cc1e`)
**Scope:** Full-repository audit. What is actually in the codebase, not what the docs claim.
**Purpose:** Establish a real baseline for deciding what to build in a new project.

> **Re-verification pass, same day, against `0748a53`.** Three claims below were true at
> `d89cc1e` and are now stale. Corrected in place, flagged here so the diff is legible:
>
> 1. **§5.3 "479 tests, 474 pass, 5 fail" is no longer true.** `npm test` on `0748a53`
>    reports **482 tests, 482 pass, 0 fail**. `b91ea8d` (line reformatting) and `0748a53`
>    (the usage-RPC fix, +3 regression tests) closed the regex drift. The suite is green
>    on `main`. The *caveat* in §5.3 stands unchanged and still matters more than the count.
> 2. **§9.1 priority 1 is done.** PR #11 merged as `0748a53`. Usage gating now works;
>    §5.1's correction is history, not an open defect.
> 3. **§6 / scope.md drift:** `app/private-beta/page.tsx` no longer exists (removed with
>    feature 3), but `docs/scope/scope.md` still lists it under feature 0 as live code,
>    and `requireApprovedPage` has zero references anywhere in the repo.
>
> Independently re-confirmed as still accurate: the four `gpt-4o` call sites, the
> numeral-verification scope, the dead `jobs` columns and `agent_logs`, the test-mode
> Stripe pinning on both sides, the uncapped resume routes, and the absent
> `lib/browserbase.ts`.

---

## 1. Size and structure

Leading with this, since it calibrates everything else.

| Area | Files | Lines |
|---|---:|---:|
| `components/` | 31 | 3,241 |
| `lib/` | 20 | 1,365 |
| `app/` (pages + API routes) | 16 | 1,364 |
| `agent/` (all AI logic) | 5 | **985** |
| `actions/` (Server Actions) | 3 | 433 |
| `types/` | 1 | 239 |
| **App subtotal** | **76** | **7,627** |
| `tests/` | 30 | 7,872 |
| `migrations/` | 12 | 938 |
| **Total** | **118** | **16,437** |

Plus ~8,400 lines of Markdown in `docs/` + `context/`, and a large `.agents/skills/` + `.claude/skills/` tree (26 skill directories) not counted above.

The AI layer is 985 lines across five files. That is the honest size of the "AI product" here.

### Directory layout

```
app/            Pages and API routes
  (auth)/       login page, OAuth callback route
  api/
    agent/find/       Adzuna search + GPT match scoring
    agent/research/   Browserbase + GPT dossier synthesis
    resume/extract/   PDF -> text -> GPT profile extraction
    resume/generate/  GPT resume content -> react-pdf -> storage
    resume/signed-url/
    auth/refresh/     3 lines, re-exports the InsForge SSR router
  dashboard/ find-jobs/ find-jobs/[id]/ profile/
agent/          matcher.ts, adzuna.ts, research.ts,
                resume-extractor.ts, resume-generator.ts
actions/        auth.ts, profile.ts, billing.ts
components/     auth/ dashboard/ find-jobs/ homepage/
                job-details/ layout/ profile/
lib/            access.ts + access-rules.ts (gating seam),
                insforge-{client,server,service}.ts,
                dashboard-{stats,activity,charts,types}.ts,
                adzuna.ts, profile-{mapping,completion}.ts,
                find-jobs-filters.ts, job-details.ts, match-score.ts,
                auth-routing.ts, staged-resume-storage.ts,
                posthog-{client,server}.ts, test-auth.ts
migrations/     12 versioned InsForge SQL migrations
tests/          30 node:test files
```

---

## 2. Feature list by provenance

`docs/scope/scope.md` labels 17 features `existing` (pre-workflow, i.e. the course) and numbers everything added afterward. Git history corroborates: commits through `c12a9dc scope` are course-track; everything after is the owner's work.

### 2.1 Course-provided (JS Mastery track) — features A–Q

| Feature | Code |
|---|---|
| Marketing homepage (hero, features, how-it-works) | `components/homepage/` |
| Google + GitHub OAuth via InsForge, PKCE cookies server-owned | `actions/auth.ts`, `proxy.ts`, `app/(auth)/` |
| PostHog init (client + server) | `lib/posthog-*.ts`, `app/PostHogProvider.tsx` |
| DB schema: `profiles`, `agent_runs`, `jobs`, `agent_logs` + RLS + `resumes` bucket | `migrations/20260718170543_create-core-tables.sql` |
| Profile page UI + save logic + completion % | `app/profile/`, `actions/profile.ts` |
| AI profile extraction from resume PDF | `agent/resume-extractor.ts` |
| Resume PDF generation | `agent/resume-generator.ts` (original), `ResumePdfDocument.tsx` |
| Find Jobs UI, Adzuna discovery, GPT match scoring | `agent/adzuna.ts`, `agent/matcher.ts` |
| Client-side filter/sort/pagination | `lib/find-jobs-filters.ts` |
| Job details page | `components/job-details/` |
| Company research agent (Browserbase + Stagehand) | `agent/research.ts` |
| Dashboard: stats, activity feed, 3 Recharts charts on real Postgres data | `lib/dashboard-*.ts` |

### 2.2 Owner's additions (specs 0012–0019)

| # | Feature | Real substance |
|---|---|---|
| 0 | Portfolio private access gate | `user_access` table, select-only RLS, `guardPaidRoute`, `ENABLE_AGENT_RUNS` kill switch. **Mostly removed** by feature 3; residue is now a checkout allowlist. |
| 0a | Vercel deploy + production config | `maxDuration = 300` + `force-dynamic` on research route, OAuth redirect URLs, env plumbing |
| 0b | Projects extraction from resumes | Added `projects` to extractor schema + prompt + profile form |
| 1 | Billing foundation | `subscriptions` table, `REVOKE ALL FROM anon, authenticated`, no RLS policies at all, `updated_at` trigger |
| 1a | Privileged subscriptions read | Service-role client (`lib/insforge-service.ts`), discriminated-union `getSubscription()` |
| 2 | Checkout & subscribe | `startCheckout()` Server Action + **Postgres trigger** fulfillment (`fulfill_stripe_subscription`) |
| 3 | Free-tier usage gating | `check_and_increment_usage` SECURITY DEFINER RPC, atomic guarded UPDATE, rolling 30-day window, UI counters |
| 4 | Resume generation quality | Rewritten system prompt (ATS domain knowledge) + numeral-verification layer |

### 2.3 Built but easy to forget

- **`lib/staged-resume-storage.ts`** — a `sessionStorage`-backed pub/sub store with `useSyncExternalStore` semantics, so an uploaded-but-unsaved resume survives a page refresh. Small, non-obvious, solves a real bug.
- **Dev-only password auth** (`actions/auth.ts`) — `signUp`/`signInWithPassword` that hard-return an error when `NODE_ENV === "production"`. Built so `/check verify` and CI could log in without a browser.
- **`lib/test-auth.ts`** — admin-client factory reading `.insforge/project.json`, with a hardcoded `TEST_USER_ID` and a **real personal email address in tracked source**.
- **PostgREST pagination workaround** in `app/dashboard/page.tsx` — `fetchAllStatsJobs` pages with `.range()` because an unbounded `.select()` silently truncates at 1000 rows.
- **Adzuna dedupe** via `external_id` + a unique index, checked before scoring so a repeat search doesn't burn a GPT-4o call.
- **`next.config.ts` body-size fix** — Server Action limit raised to 6mb because Next's 1mb default was silently rejecting 1–5MB resumes.
- **PostHog reverse-proxy rewrites** through `/ingest/*` in `next.config.ts`.

### 2.4 Correction: the "forked circuit-breaker skill"

`recover` (the `/recover` circuit breaker: "if the same problem persists after one corrective prompt, stop") is **not** an addition. `git diff` from the initial `agents` commit to HEAD is empty for both `.agents/skills/recover` and `.claude/skills/recover` — it shipped with the course scaffold, unmodified.

What *is* owner-sourced in `skills-lock.json` is **`checkpoint`**, from `ghalynho10/skills` rather than `JavaScript-Mastery-Pro/skills` — a session save/restore skill, not a circuit breaker.

The genuine circuit breaker is in *code*, not skills: the `ENABLE_AGENT_RUNS` kill switch plus fail-closed usage gating.

---

## 3. Tech stack and architecture

| Layer | Actual |
|---|---|
| Framework | Next.js **16.2.10** App Router, React 19.2.4, TS strict |
| Backend | InsForge (`@insforge/sdk` 1.4.5) — Postgres + PostgREST, auth, storage |
| Auth | InsForge OAuth (Google, GitHub), server-owned PKCE cookies, `proxy.ts` route protection |
| AI | OpenAI SDK v7, **`gpt-4o` on all four call sites**, `response_format: json_object`, Zod validation |
| Browser automation | Browserbase + Stagehand v3 (`extract` only) |
| Jobs data | Adzuna REST, `results_per_page: 10`, `category: it-jobs` hardcoded |
| Payments | InsForge-managed Stripe; fulfillment is a **Postgres trigger**, not an app route |
| Charts | Recharts 3.10 |
| PDF | `@react-pdf/renderer` out, `pdf-parse` in |
| Analytics | PostHog — 4 events: `job_search_started`, `job_found`, `company_researched`, one in `actions/profile.ts` |
| Styling | Tailwind **v4** |
| Hosting | Vercel Hobby (`prj_mwyM7iBqEWUZxib0BPDAsicT7HAN`) |

### Agentic vs. plain CRUD

Nothing here is agentic in the loop-and-decide sense. There is no tool calling, no multi-turn planning, no self-correction loop, no model choosing what to do next. Every AI call is a single-shot request/response inside a fixed, hand-coded control flow.

The one thing with genuine multi-step *machinery* is `agent/research.ts`, and even there the sequence is hardcoded: fetch homepage → extract → sort links by a static priority array → visit at most 3 → extract each → one synthesis call. The model picks *which links look interesting*; the code picks everything else.

Everything else — dashboard, find-jobs list, filters, profile — is plain CRUD over PostgREST.

---

## 4. Each AI feature, under the hood

### 4.1 Job match scoring — `agent/matcher.ts` (93 lines)

One `gpt-4o` call, `temperature: 0.3`, `max_tokens: 300`. Sends `{job: {title, company, description}, candidate: {6 profile fields}}` as JSON; asks for `{matchScore, matchReason, matchedSkills, missingSkills}`.

**Guardrails:** Zod schema with `.catch()` per field (a bad type degrades to `0`/`""`/`[]` rather than failing). Prompt says "never invent a skill."

**No verification** of the score, and no check that returned skills actually appear in the profile or the job description. A failed call writes `null` match fields and the job is still saved.

Called in a **sequential for-loop, one call per job**, up to 10 jobs per search (`agent/adzuna.ts:98`). No batching, no concurrency, no retry.

### 4.2 Resume → profile extraction — `agent/resume-extractor.ts` (164 lines)

`pdf-parse` → text → one `gpt-4o` call, `temp 0.3`, `max_tokens: 2000`. Long prompt with strict enum vocabularies; returns 15 profile fields.

**Guardrails:** the strongest Zod layer in the repo — enum coercion with `.catch("")`, `.transform()` truncating work experience to 3 and projects to 5, `MIN_EXTRACTABLE_TEXT_LENGTH = 50` rejecting image-only PDFs.

All schema-shape enforcement. **No factual verification against the source text.**

### 4.3 Resume generation — `agent/resume-generator.ts` (303 lines)

One `gpt-4o` call, `temp 0.55`, `max_tokens: 1400`. The ~35-line system prompt is real domain knowledge: XYZ bullet formula, a 17-phrase filler blocklist, banned bullet openers, no-em-dash rule, keyword/acronym placement, seniority calibration, trimming order, sparse-profile handling, and an explicit accuracy-outranks-style directive.

**This is the only feature with post-generation verification, and it is genuinely deterministic:**

1. `buildAllowedNumerals()` collects every digit sequence from profile fields, plus computed per-role durations.
2. Every bullet is regex-scanned; a bullet containing a digit not in that set is **dropped**.
3. If all bullets for a role are dropped → fall back to the user's raw `keyResponsibilities`.
4. Summary containing an unknown digit → replaced with a template summary.
5. `stripEmDashes()` — regex, applied unconditionally.
6. `reconcileBullets()` re-indexes model output against the profile's own array, so a dropped or reordered index cannot misattribute bullets to the wrong employer.

**Precise scope:** it verifies **numerals only**. A fabricated employer, title, technology, or unquantified claim passes through untouched. A narrow, well-built guardrail — not an output verifier.

### 4.4 Company research — `agent/research.ts` (264 lines)

Two-phase, N+1 model calls.

**Phase 1 (Stagehand / Browserbase):** derive homepage URL, then 1 homepage `extract` + up to 3 sub-page `extract` calls. Stagehand is configured with `model: gpt-4o`, so **each `extract` is itself a GPT-4o call** — 2–4 model calls before synthesis.

**Phase 2 (OpenAI direct):** one `gpt-4o` synthesis call, `temp 0.4`, **no `max_tokens` cap**, producing a 9-field dossier.

**URL derivation, precisely:** first follows `external_apply_url` with `redirect: "follow"` and, if the final hostname is not Adzuna, strips to the last two labels. **Only on failure** does it fall back to `https://www.{company-with-all-non-alphanumerics-removed}.com`.

**Guardrails:** Zod `safeParse` on the dossier, prompt-level "ground every claim." If browsing yields nothing, a sentinel string is passed in and the model is told to say so. **No verification that dossier claims trace to scraped content.**

---

## 5. Stubbed vs. working

### 5.1 Fully working in production

OAuth, profile CRUD + resume upload/storage, resume extraction, resume generation + PDF + signed URLs, Adzuna search + match scoring, job details, company research, dashboard (all four data paths real), PostHog.

> **Correction (same day, found while reproducing a user report).** "Usage gating end to end" was listed here originally and was **wrong**. `check_and_increment_usage` is declared `RETURNS TABLE(...)`, so PostgREST returns an array of rows; `lib/access-rules.ts` cast that array to a single object and read `.allowed` off it, always getting `undefined`. `enforceUsageCap` treats `!undefined` as denied, so **every metered action was denied for every account — free, under-cap, and Pro alike — since feature 3 shipped on 2026-08-02.** Job search and company research were fully non-functional in production for about two weeks.
>
> All 6 usage-gating test mocks returned a bare object, encoding the same wrong assumption as the implementation, so the entire suite passed against a shape that never occurs on the wire. Fixed 2026-08-17: unwrap the first row, fail closed on an empty array or a non-boolean `allowed`. Three regression tests added pinning the wire shape.
>
> This is the sharpest lesson in the repo for the "what should I build next" question: source-contract tests cannot catch a wrong assumption about an external system's response shape, because both the code and its mocks encode the same assumption. One integration test against the real backend would have caught it on day one.

### 5.2 Working but not live

- **Stripe is test-mode only, and structurally pinned there.** `actions/billing.ts:72` calls `createCheckoutSession("test", …)`, and the fulfillment trigger has `OR NEW.environment <> 'test'` in its early-return guard. The migration comment states these "must flip together at live launch." No user has ever been billed real money.
- **The Upgrade button is allowlisted off.** `components/profile/UpgradeCard.tsx:35` renders `<UpgradeButton/>` only when `isApproved`, and `startCheckout` redirects to `?error=not_approved` otherwise. Checkout is unreachable for essentially every visitor. Both sides carry `TEMPORARY:` comments.
- **`user_access` is a vestige.** Spec 0018 removed the private-beta gate; the table survives solely to gate that button.

### 5.3 Test suite: 482 tests, 482 pass, 0 fail

Green on `main` as of `0748a53`. (At `d89cc1e` five were failing — regex drift in
`tests/access.test.mjs`, `tests/dashboard-page.test.mjs`, and `tests/resume-generator.test.mjs`
from the `9ae2777`/`b91ea8d` reformatting commits. Since resolved; `0748a53` also added three
regression tests pinning the PostgREST array wire shape.)

**Important caveat.** Most of these are *source-contract* tests: 21 of 30 files `readFileSync` the implementation and assert regexes against its text. They verify the code still *reads* a certain way, not that it *behaves* a certain way. Only ~6 files actually import and execute code (`dashboard-stats`, `dashboard-activity`, `find-jobs-filters`, `match-score`, `adzuna-client`, `access`). Treat "479 tests" as a much smaller behavioral baseline than the count implies.

### 5.4 Never built

Billing portal / self-serve cancel, dunning, legal pages, job application status tracking, projects in generated resumes, cover letters, auto-apply.

---

## 6. UI that exists but is not wired to real logic

1. **Job Details structured sections are permanently empty.** `JobDescriptionCard` renders Responsibilities / Requirements / Nice to have / Benefits / About the company from `job.responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`. **No writer anywhere populates those columns** — `agent/adzuna.ts` writes only `about_role`. `StructuredList` returns `null` on empty, so they silently never render. Five schema columns and a component, dead.

2. **`agent_logs` table is entirely unused.** Created with RLS, two indexes, and select/insert policies. Zero code references anywhere in the repo.

3. **"Paste a job link" is advertised but not built.** `components/homepage/HowItWorks.tsx:4` says "Search by title and location **or paste a job link**." Find Jobs has exactly two inputs, title and location. `jobs.source` has `CHECK (source IN ('search','url'))` and nothing ever writes `'url'`.

4. **`profiles.cover_letter_tone`** — column exists, no UI, no reader.

5. **Metering gap** (not UI, but a real hole). `enforceUsageCap` is called in only two places: the find and research routes. `/api/resume/extract` and `/api/resume/generate` call `guardPaidRoute({requireAgentSwitch: false})` and then hit GPT-4o **with no cap and no kill switch**. Any signed-in user can call either repeatedly, unmetered. The comment at `lib/access.ts:47` says this is deliberate — worth knowing it is a deliberate open door.

---

## 7. README accuracy

> **RESOLVED at `0748a53`.** Every row in the table below was accurate against `d89cc1e`.
> PR #11 rewrote the README alongside the usage-RPC fix and corrected all of them; none of
> these strings survive at HEAD (`grep` for `lib/browserbase.ts`, `2-minute`, `shadcn`,
> `350+`, `billing cycle`, `PostHog-powered` returns zero). The table is kept as the record
> of what was wrong, not as an open action.
>
> A later pass found **six smaller issues that the `0748a53` rewrite did not catch**, since
> fixed: a broken header image path (`./public/screenshot-dashboard.png` → the file is at
> `public/images/`), "Realtime" listed in the stack table though InsForge realtime is used
> nowhere, "3–5 GPT-4o calls" per research run (the floor is 2), "a personal fork of an
> Agent Skills pipeline" (the workflow skills are pinned *unmodified* from
> `JavaScript-Mastery-Pro/skills`; only `checkpoint` is self-authored), an `OPENAI_API_KEY`
> row omitting resume generation and Stagehand's own calls, and a Billing stack row that
> implied a direct `stripe` SDK dependency that does not exist.

The README oversells in several checkable places.

| Claim | Reality |
|---|---|
| "single 2-minute Browserbase session (`lib/browserbase.ts`)" | **File does not exist.** Code is `agent/research.ts`. No timeout is configured anywhere; the 2-minute figure is not in the code. |
| "strips legal suffixes (`Inc.`, `LLC`, `Corp.`)" | `slugifyCompanyName` strips *all* non-alphanumerics. "Acme Inc." → `acmeinc.com`. No suffix logic exists. |
| "The company homepage is guessed, not searched" | The guess is the *fallback*. The primary path follows the Adzuna redirect to the real employer domain. |
| "PostHog-powered charts" | Charts are computed from Postgres rows in `lib/dashboard-charts.ts`. PostHog is not involved. |
| "Tailwind CSS + shadcn/ui" | No shadcn — no `components.json`, no `components/ui/`. Hand-written Tailwind v4. |
| "350+ source-contract tests" | 479 tests, **5 failing**. |
| "Free tier caps reset each billing cycle" | Rolling 30-day window from `usage_period_start`, unrelated to any billing cycle. |
| "actions/ — … (profile save, **job status**)" | Job status tracking does not exist. |
| Env var table | Omits `SERVICE_ROLE_KEY` and `STRIPE_PRO_MONTHLY_PRICE_ID`, both required. |
| Billing section | Nothing anywhere states billing is test-mode-only. It is, on both sides. |

Two accurate and genuinely strong claims worth keeping: the idempotent-by-construction Stripe fulfillment trigger, and the `REVOKE`-before-`GRANT` privilege pattern. Both are real, both are in the migrations, both are unusual to get right.

Also note: `AGENTS.md` says "Use Tailwind CSS 3.4 (do not upgrade to v4)" while `package.json` pins `tailwindcss: ^4`.

---

## 8. The honest baseline

Four thin GPT-4o wrappers (one call, JSON mode, Zod parse, ~90–160 lines each) plus one 264-line hardcoded browse-then-synthesize pipeline. No agent loop, no tool calling, no evals, no retries, no streaming, one model, no fallback provider.

The real engineering depth is not in the AI layer — it is in the **SQL**: an atomic SECURITY DEFINER usage RPC that is correct under concurrent requests, a webhook-fulfillment trigger with out-of-order-event protection, and a deliberate privilege model that revokes InsForge's permissive defaults. That is 938 lines of migrations doing more careful work than the 985 lines of `agent/`.

**For deciding what to build next:** the differentiated, transferable assets are the numeral-verification pattern (narrow but real) and the billing/gating infrastructure. The *unexplored* territory is everything agentic — loops, tools, evals, multi-model routing. There is no existing baseline to build on there, because none of it is here.

**The process finding, which outranks the feature findings.** A structured spec → build → verify → test pipeline produced 19 specs, 8,400 lines of design documentation, and 479 tests — and still shipped a feature that was 100% non-functional in production for two weeks (see the correction in §5.1). The pipeline's blind spot is specific and worth naming: **nothing in it ever executed code against a real dependency.** Specs describe intent, source-contract tests assert the code matches the spec's wording, and mocks are written from the same assumption the implementation makes. All three layers can agree with each other and all be wrong about the outside world at once.

Note the irony in the paragraph above this one: the SQL *was* correct. `check_and_increment_usage` handles concurrency properly and has always returned the right answer. The failure was entirely in reading its response.

---

## 9. Recommended next actions

### 9.1 On this repo, ranked by cost-to-value

| Priority | Action | Cost | Why |
|---|---|---|---|
| ~~1~~ | ~~Merge the usage-gating fix (PR #11)~~ | **done** — merged as `0748a53` | Was denying every job search and research run in production |
| ~~2~~ | ~~Correct the README~~ | **done** — `0748a53` + follow-up pass | See §7; all listed claims corrected, plus six smaller ones found afterward |
| ~~3~~ | ~~Fix the 5 failing tests on `main`~~ | **done** — green at 482/482 | Resolved by `b91ea8d` + `0748a53` |
| 1 | Cap or kill-switch the two resume routes | ~1 hr | **Now the top item.** `/api/resume/extract` and `/api/resume/generate` reach GPT-4o with no metering and no switch. The only uncapped spend path in the app. |
| 5 | Decide on Stripe explicitly | judgment call | Either finish it (live mode, drop the `user_access` allowlist) or describe it accurately as test-mode. Today it reads as shipped billing and is not. |
| 6 | Remove or populate the dead UI | ~1 hr | Five `jobs` columns and `agent_logs` are written by nothing (§6). Dead schema is worse than absent schema; it implies a feature that does not exist. |

### 9.2 On the next project

Build something that forces **an agent loop and an eval harness**, and make integration tests against real or recorded external responses non-negotiable from day one.

Rationale, in order:

1. **The agentic gap is the real gap.** Four single-shot wrappers is a fine baseline but it means orchestration, tool calling, retry/fallback, and multi-step failure handling are all unexplored. Another CRUD-plus-LLM app adds nothing to what this repo already demonstrates.
2. **Generalize the strongest existing idea.** The numeral-verification layer in `agent/resume-generator.ts` is the most differentiated thing here: a deterministic, post-generation guardrail that provably constrains model output. Growing that into a real verification and eval layer is a far better story than a second app.
3. **Fix the pipeline's blind spot structurally, not by resolving to be careful.** The rule that would have caught this bug is mechanical: every external dependency gets at least one test that actually calls it, or replays a recorded real response. Mocks hand-written from the same assumption as the implementation do not count as coverage.

What to keep from this project's process: the spec discipline, the scope file, and the migration rigor — all three are genuinely good. What to change: the testing layer, which currently measures whether the code looks like the spec rather than whether it works.
