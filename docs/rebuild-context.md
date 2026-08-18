# JobPilot — Context for a Rebuild

**Written:** 2026-08-18
**Purpose:** Feed this into a brainstorming session for the next version. It is a
statement of what is actually true about the current app, not what its docs claim.
**Companion file:** [`docs/reviews/2026-08-17-feature-inventory-audit.md`](./reviews/2026-08-17-feature-inventory-audit.md)
— the full 332-line inventory. Part 1 below condenses it; read the original for detail.

This file is in two parts. **Part 1** is the baseline as of 2026-08-17, established by
static audit: reading code, git history, and migrations. **Part 2 begins at the marked
heading "NEW FINDINGS (2026-08-18)"** and covers everything found the following day by a
different method — driving the running app and querying the production database directly.

The split matters, and it is the single most useful thing in this document. Part 1 was
produced by reading the codebase carefully and found real problems. Part 2 was produced by
*using* the product for twenty minutes and found nine more, none of which the reading
caught, none of which 482 passing tests caught, and none of which nineteen design specs
caught. That contrast should shape how the rebuild is tested.

---

# PART 1 — Baseline as of 2026-08-17 (static audit)

## What the app is

An AI job hunting assistant: set up a profile, upload a resume, and it searches Adzuna,
scores each result against your profile with GPT-4o, researches the company with a
Browserbase browser session, and tracks it on a dashboard. Next.js 16 App Router, React 19,
InsForge (Postgres BaaS) for auth/database/storage, Stripe billing via an InsForge managed
integration, deployed on Vercel.

## Honest size

| Area | Files | Lines |
|---|---:|---:|
| `components/` | 31 | 3,241 |
| `lib/` | 20 | 1,365 |
| `app/` | 16 | 1,364 |
| `agent/` (all AI logic) | 5 | **985** |
| `actions/` | 3 | 433 |
| **App subtotal** | **76** | **7,627** |
| `tests/` | 30 | 7,872 |
| `migrations/` | 12 | 938 |

Plus ~8,400 lines of Markdown across `docs/` and `context/`.

**The AI layer is 985 lines.** That is the real size of the "AI product."

## The architectural finding that matters most

**Nothing here is agentic.** No tool calling, no loop, no planning, no self-correction, no
model deciding what happens next. Every AI call is a single-shot request/response inside
hand-written control flow. Four thin GPT-4o wrappers (~90–300 lines each) plus one 264-line
hardcoded browse-then-synthesize pipeline in `agent/research.ts`, where the model picks
which links look interesting and the code picks everything else.

**The real engineering depth is in the SQL, not the AI.** 938 lines of migrations contain
more careful work than 985 lines of `agent/`:

- `check_and_increment_usage`: a `SECURITY DEFINER` RPC that checks a quota and increments
  it in one statement, correct under concurrent requests.
- `fulfill_stripe_subscription()`: webhook fulfillment as a Postgres trigger with
  `INSERT ... ON CONFLICT` plus out-of-order-event protection. Cannot double-activate a
  subscription by construction.
- A deliberate privilege model that does `REVOKE ALL FROM anon, authenticated` before
  granting narrower rights back, because InsForge grants broad table access by default and
  writing no RLS policy does *not* leave a table closed.

If anything transfers to the next project, it is this and the numeral-verification pattern
described below. Not the AI code.

## The one genuinely differentiated AI feature

`agent/resume-generator.ts` has a deterministic post-generation guardrail: it collects
every digit sequence appearing in the user's profile, regex-scans each generated bullet,
and **drops any bullet containing a numeral that is not in that set**. Falls back to the
user's raw text when all bullets for a role are dropped. Re-indexes model output against
the profile's own array so a dropped bullet cannot misattribute work to the wrong employer.

**Scope is narrow and worth stating precisely: it verifies numerals only.** A fabricated
employer, job title, or technology passes through untouched. But it is a real, provable
constraint on model output, and it is the most transferable idea in the repo.

## Known state, condensed

**Working in production:** OAuth, profile CRUD, resume upload/extraction/generation,
Adzuna search + scoring, job details, company research, dashboard, PostHog.

**Working but deliberately not live:** Stripe. Checkout and trigger-based fulfillment work
end to end but are pinned to test mode on both sides (`actions/billing.ts` requests a
`"test"` session; the trigger filters `environment = 'test'`). The Upgrade button sits
behind a `user_access` allowlist. No account has been billed.

**Dead code and schema:**
- Five `jobs` columns (`responsibilities`, `requirements`, `nice_to_have`, `benefits`,
  `about_company`) are read by a component and written by nothing. The structured sections
  of the job details page never render.
- `agent_logs` table: created with RLS and indexes, zero references anywhere.
- `profiles.cover_letter_tone`: column exists, no UI, no reader.
- The homepage advertises "or paste a job link." That input does not exist.

**Unmetered spend path:** `/api/resume/extract` and `/api/resume/generate` reach GPT-4o
with no usage cap and no kill switch. Deliberate per a code comment, but it is an open door.

## The 2026-08-02 outage — the anchor lesson

`check_and_increment_usage` is declared `RETURNS TABLE(...)`, so PostgREST returns an
**array** of rows. The client cast that array to a single object and read `.allowed` off
it, always getting `undefined`, which read as "denied" downstream. **Every metered action
was refused for every account — free users under the cap and Pro users alike — for two
weeks**, from 2026-08-02 to 2026-08-17.

All six test mocks returned a bare object, encoding the same wrong assumption as the
implementation. The suite passed against a wire shape that never occurs.

The design spec was *right*: `docs/specs/0018-free-tier-usage-gating.md` specifies the RPC
as returning "exactly one row" and explicitly asks for a concurrency test driven "directly
over two separate database connections... the RPC boundary is where the guarantee actually
lives." The spec named the exact boundary. The prescribed test was written as a mock
instead. And this is the one billing feature with no entry in `docs/reviews/`: the two
before it were reviewed, this one shipped in the same commit as its own spec.

**The process did not fail. It was skipped.**

## Test suite: the number is misleading

482 tests, all passing. But **21 of 30 files `readFileSync` the implementation and assert
regexes against its source text.** They verify the code still *reads* a certain way, not
that it *behaves* a certain way. Only about six files import and execute anything. Nothing
calls a real external dependency.

A source-contract test cannot catch a wrong assumption about an external system, because
the code and its mocks encode the same assumption.

---

---

# PART 2 — NEW FINDINGS (2026-08-18)

> **Everything below this line is new.** It was found the day after the audit, by a
> different method: running the app locally, performing real searches, reading the rendered
> output, and querying the `jobs` table directly with the service role key.
>
> **None of these were visible to the static audit. None were caught by 482 passing tests.**
> Nine defects in roughly twenty minutes of actually using the product.

## 2.1 The README contained fabricated product imagery

The most serious finding, and the one with the least to do with code.

The README's screenshot, captioned *"Dashboard — stats, recent activity, and match-score
analytics,"* was **the signed-out login page**. The only dashboard in the image was a
marketing illustration embedded in the hero, showing invented figures (284 jobs found, 82%
average match rate, 35 companies researched) under a fake URL, `jobpilot.ai/dashboard`,
which is not the real domain.

Two other images in `public/images/` were also mockups, not captures:
- `jobs-lists.png` lists **LinkedIn** as a job source. The only integration is Adzuna.
- `agnet-log.png` (note the typo, in a public directory) shows "Tailoring resume for
  Stripe" and "Generating cover letter." Neither feature exists.

**Why this outranks the code bugs:** the README's entire credibility rests on candidly
listing its own gaps. Illustrating that with fabricated product imagery converts the candor
into a pose. A reader who notices `jobpilot.ai`, or a cover-letter feature that does not
exist, re-reads every honest admission as marketing.

**Rebuild rule:** never ship a mockup where a screenshot is implied. If there is no real
capture, ship no image.

## 2.2 Four defects visible on the first real search

| # | Defect | Location |
|---|---|---|
| 1 | Single predicted salaries rendered as `$103k - $103k`, a range from a number to itself | `agent/adzuna.ts` `formatSalary` |
| 2 | `"Found 1 jobs"` — no pluralization | `app/api/agent/find/route.ts` |
| 3 | The success banner reported a **per-run delta** ("Found 1 jobs") directly above an **all-time list** of dozens of rows, reading as a contradiction | same |
| 4 | **A repeat search wiped the visible table.** `setJobs([])` fired whenever a search added nothing new, blanking a list that could hold dozens of saved jobs | `components/find-jobs/FindJobsPage.tsx` |

Number 4 is the serious one, and it is the same root mistake as number 3: `jobsFound`
counts only rows inserted by the current run, and two separate places treated it as a
total. Both were fixed. All four are the kind of defect that is invisible when reading code
and unmissable when using the product.

## 2.3 Adzuna returns duplicate listings that id-based dedup cannot catch

The existing dedup keys on Adzuna's `external_id`. But Adzuna routinely lists one opening
several times under **different ids**. Confirmed pairs, identical in every visible field
including score:

```
Vestmark, Inc.        Software Engineer   $83k    7/30   75%   (x2)
Two Six Technologies  Software Engineer   $111k   7/30   70%   (x2)
```

One employer occupied nine of the top ten rows. This does more damage to the product's
credibility than the scoring does, and no amount of id-based dedup fixes it.

**Fixed** by adding a content signature (company + title + salary), seeded from existing
rows and added to on insert so within-batch duplicates are caught too. It runs before the
scoring call, so a skipped duplicate also saves a GPT-4o call.

**Known remaining gap:** the signature includes salary, and Adzuna's *predicted* salaries
jitter a few percent for the same posting, so near-duplicates still get through
(Amazon "Software Development Engineer, AWS" at $208k and $204k; Capital One "Distinguished
AI Engineer" at $195k / $191k / $205k). Bucketing salary to the nearest $10k would help, at
some risk of falsely merging genuinely different postings.

## 2.4 The match scores were meaningless, and no test could have known

The scoring prompt gave the model an unanchored scale: *"matchScore is an integer from 0 to
100."* No rubric, no anchor points, nothing discouraging round numbers. With
`temperature: 0.3`, real output clustered in a narrow band of 60–75, mostly 70 and 75.

Two separate postings, identical in company / role / salary / date, scored **75% and 70%**
— the same job getting different answers from sampling jitter.

**Fixed** with a five-band rubric (90–100 / 70–89 / 50–69 / 30–49 / 0–29), an explicit
instruction against round numbers, and `temperature: 0` so the same input scores the same
twice.

**Verified against real data.** A "software developer" search run against an AI-focused
profile after the change:

```
48  Amazon Development Center   Software Development Engineer, AWS
48  Amazon Development Center   Software Development Engineer, AWS
42  Amazon Development Center   Sr. Software Development Engineer
42  Govcio LLC                  Software Developer- SME
42  Govcio LLC                  Senior Software Developer
42  Govcio LLC                  SME - Software Developer
35  Annapurna Labs Inc.         Software Development Manager
35  Amazon Development Center   Software Development Engineer, Gla
35  Amazon Development Center   Software Development Manager, S3
35  CSL                         Director, Agentic Software Develop
```

Scores now reach the 30s and 40s and land off multiples of five. "0 strong matches" became
a correct and meaningful answer. The old prompt would have called all ten of these 75%.

**This is the finding with the biggest implication for the rebuild.** The scoring feature
was the product's core value proposition, it was shipped, it passed every test, it had a
design spec — and it was returning a nearly constant number. **No test in the suite could
have detected this, because the suite has no notion of output quality.** That is precisely
what an eval harness is for, and there is none.

## 2.5 Silent scoring failures leave unusable rows

Querying the `jobs` table directly surfaced rows with `match_score: null`:

```
null  $95k - $95k  L3Harris Technologies  Software Engineering
null  $79k - $79k  L3Harris Technologies  Specialist, Software Engineering
null  $81k - $81k  L3Harris Technologies  Specialist, Software Engineering
null  $74k - $74k  L3Harris Technologies  Lead, Software Engineer
```

When `scoreJobMatch` fails, the code falls back to `matchScore: null`, **inserts the job
anyway, and the run still reports success.** Nothing surfaces the failure: not the banner,
not the UI, not a metric. `(match.matchScore ?? 0) >= MATCH_THRESHOLD` also silently treats
null as zero.

So the user pays for the Adzuna fetch, gets unusable rows, and is told everything worked.
**Not fixed** — pre-existing, and it deserves its own debugging pass.

## 2.6 Upstream data quality is unguarded

One row read `$10k - $120k` for a Senior AI Engineer at Robert Half. Adzuna garbage, passed
through untouched. There is no sanity check on any field coming from the source. **Not
fixed** — it is a judgment call how much to second-guess upstream data.

## 2.7 Verified cost model

Call counts read from source, not estimated:

- **A job search** is 1 Adzuna HTTP call plus **one GPT-4o call per job**, sequential, at
  `results_per_page: 10`. Already-seen jobs are skipped before scoring.
- **A research run** is **2–5 GPT-4o calls**, not one. Stagehand is configured with
  `gpt-4o`, so each `extract` is itself a model call: one homepage extract, zero to three
  sub-page extracts, then one synthesis call.

At list prices this is roughly $0.05 per search and $0.05–0.10 per research run, so a free
account exhausting both caps costs under a dollar a month in model spend. The dollar
figures are arithmetic from estimated token counts, not metered.

## 2.8 The process finding, repeated in miniature

Worth recording because it is the same lesson as the outage, at small scale and one day
later.

Every defect in Part 2 was fixed **ad hoc**, straight from screenshots. The project defines
a `/debug` skill for exactly this situation (reproduce → localize → hypothesize → test →
fix → verify) and a `/check review` gate before merge. Neither was run until the work was
essentially done. `AGENTS.md` requires reading nine context documents before any
implementation; none were read.

The cost was visible and specific: an early claim that the duplicate PwC rows were
genuinely distinct postings, reasoned from their differing salaries, was **disproved by the
next screenshot**, which showed Vestmark and Two Six pairs identical in every field. A
hypothesize-then-test loop would have caught that before it was asserted.

Separately, a new pure function written during this session, `lib/job-signature.ts`, had a
real bug on first run: joining fields with `|` meant `["a|b", "c"]` and `["a", "b|c"]`
produced the same signature — two different jobs collapsing into one identity. **The
executing test caught it immediately.** A source-contract test would have transcribed the
buggy `.join("|")` into a regex and passed.

That is the whole argument of this document, reproduced inside a twenty-line helper.

## 2.9 The cross-model review gate caught a real bug the author could not see

Worth recording separately, because it is the one piece of the existing process that
demonstrably worked, and it is cheap.

After the fixes above were written, a `/check review` ran the diff past a **different model
than wrote it** (author on Opus, review on Sonnet). It returned **Blocked** on a genuine
correctness defect in the one piece of new logic:

`jobSignature` keyed on company, title, and salary but **omitted location**. Two real
postings for the same role at the same company for the same money in different cities
produced an identical signature, so the second was silently dropped. No error, no log,
nothing distinguishing it at the UI or API level from "Adzuna did not return that job."

The detail that matters: **the author had explicitly asked the reviewer to hunt for exactly
this class of bug** ("whether the signature dedup can ever discard a job the user should
have seen, which is worse than leaving a duplicate") and had written nine executing tests
for the function — every one of which varied company, title, or salary, and none of which
held those three fixed while varying location. The blind spot survived writing the code,
writing the tests, and explicitly naming the failure mode in the review request.

A same-model review would likely have shared it. The rule that a reviewer must be a
different model than the author is not ceremony; it is the only reason this was caught
before it shipped.

**Rebuild rule:** keep the cross-model review gate, and actually run it. It is the cheapest
defect-catching mechanism in the whole process, and it found a false-merge bug that would
have silently hidden real jobs from users — the same category of invisible, no-error
failure as the two-week outage.

---

# PART 3 — What this means for the rebuild

## The three findings that should shape the design

**1. Test against reality or do not claim coverage.** The rule is mechanical, not a
resolution to be careful: *every external dependency gets at least one test that actually
calls it, or replays a recorded real response.* Mocks hand-written from the same assumption
as the implementation are not coverage. This one rule would have caught the two-week
outage, and the wire-shape class of bug generally.

**2. LLM output quality needs an eval harness, because no unit test can see it.** The
scoring feature passed every test while returning a nearly constant number. If the product
depends on model output being *good*, and not merely well-shaped, then a graded set of
fixed inputs with expected-range outputs is not optional — it is the only instrument that
can detect the failure. Note that Zod validation gives false comfort here: it proved the
score was a number, which it always was.

**3. Look at real output early and often.** Nine defects in twenty minutes of use, after a
careful static audit had found none of them. The static audit was good and still could not
see the product. Whatever the rebuild is, budget for driving it by hand from the first
week, and query the database directly rather than trusting the UI — three of these findings
(null scores, exact duplicate pairs, the true score distribution) were only visible in raw
rows.

## What to carry forward

- **The SQL rigor.** Atomic `SECURITY DEFINER` RPCs, trigger-based webhook fulfillment with
  out-of-order protection, and `REVOKE`-before-`GRANT` privilege discipline. This is the
  strongest work in the repo.
- **The numeral-verification pattern.** Deterministic post-generation constraint on model
  output. Narrow, but real and generalizable — the seed of a proper verification layer.
- **Spec discipline and the scope file.** Both genuinely good. Spec 0018 correctly reasoned
  about read-committed semantics under concurrency and rejected two alternatives on cost
  grounds. The specs were not the problem.
- **The cross-model review gate.** See 2.9. It caught a false-merge blocker the author
  missed while actively looking for that exact bug. Cheapest defect-catching mechanism in
  the process, and the one that most needs to be non-optional rather than remembered.

## What to change

- **The testing layer**, which currently measures whether code *looks like* the spec rather
  than whether it *works*. This is the single highest-leverage change.
- **The gap between computed state and displayed state.** Three separate defects
  (the delta-vs-total banner, the list-wiping early return, salary formatting) came from
  the same class of mistake. Consider making the display layer derive from one source of
  truth rather than from separately-passed counts.
- **Formatted values stored in the database.** `salary` is stored as a display string, so
  fixing the formatter cannot fix historical rows. Store raw values, format at render.

## The unexplored territory

The audit's recommendation stands and Part 2 strengthens it: **build something that forces
an agent loop and an eval harness.** Orchestration, tool calling, retry and fallback,
multi-step failure handling, and output grading are all absent from this codebase. There is
no baseline to build on there because none of it exists here — and section 2.4 shows what
happens when a model-dependent feature ships with no way to measure whether its output is
any good.

---

## Appendix: state of the repo as of writing

Committed to branch `bug-fixes` as four commits (`b00763d`, `45364eb`, `2ecd0bd`,
`1f2496a`), not pushed:

- `formatSalary` renders a point estimate as one figure, not a range to itself.
- Content dedup on company + title + location + salary, in `lib/job-signature.ts` with ten
  executing tests, seeded from existing rows and scoped to the batch's companies.
- The banner distinguishes three cases: jobs added, nothing new, and Adzuna returned
  nothing at all.
- The list-wiping early return is gone; "empty" now derives from what the refetch returned.
- The scoring rubric plus `temperature: 0`.

**501 tests pass**, `tsc --noEmit` clean, eslint clean. Two `/check review` passes on the
cross-model gate: the first returned **Blocked** on the location gap (see 2.9,
`docs/reviews/2026-08-18-bug-fixes.md`), the second **Approve with nits** after it was fixed
(`docs/reviews/2026-08-18-bug-fixes-rereview.md`). The re-review independently verified the
fix by reconstructing the old three-parameter function and confirming the new tests fail
against it, rather than taking the fix on trust.

### Known gaps carried forward, each worth a line in any rebuild backlog

| Gap | Where it is described |
| --- | --- |
| Silent `match_score = null`; a failed scoring call still reports success | 2.5 |
| Salary jitter defeats content dedup for near-duplicate postings | 2.3 |
| No sanity check on upstream Adzuna data (a `$10k` senior role) | 2.6 |
| `z.number().catch(0)` now collides with the legitimate 0–29 rubric band | review, 2026-08-18 |
| No backfill: old rows keep stale salary strings and stale scores | below |

**The backfill gap is larger than it first looked, and is a design lesson in itself.**
`salary` is stored as a formatted display string, so fixing the formatter cannot fix history.
Beyond the cosmetic issue, an old row's `"$103k - $103k"` will never match a freshly
formatted `"$103k"` for the same posting, so dedup cannot recognise them as one job. It also
means the product demos badly: a screenshot taken after all these fixes still shows mostly
pre-fix rows, because the account's history dominates the view.

**Rebuild rule:** store raw values and format at render. A formatted string in a database
column freezes a presentation decision into the data, and every later fix has to fight it.
