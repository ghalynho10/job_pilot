# Review, bug-fixes, 2026-08-18 (re-review)

**Reviewed by**: Claude Sonnet 5 (author on unspecified model)
**Scope**: 11 files, branch vs base (`main` @ `64a8e92`)
**Verdict**: Approve with nits

## Summary
This is a second pass over the same diff, after a first pass returned Blocked on a false-merge bug in the new `jobSignature` dedup and two Majors for missing coverage. All three are genuinely fixed, not papered over: `jobSignature` now takes `location` as its third parameter, both call sites in `agent/adzuna.ts` (the DB-seeded path and the in-loop path) pass it in matching positional order, and I confirmed by extracting the old three-parameter implementation into a scratch file and running the current `tests/job-signature.test.mjs` against it that the suite genuinely fails against the regression it's meant to catch (one assertion trips: a stated vs. missing salary become indistinguishable once positional arguments shift). `tests/agent-adzuna.test.mjs` gained six new source-contract tests that match the current code precisely, and `tests/find-jobs-contract.test.mjs` gained two that pin the destructive-early-return fix. `npm test` passes 500/500 across 30 files and `tsc --noEmit` is clean. The five previously-reported Minors are each resolved, empirically settled, or left as pre-agreed non-blocking gaps, and none of them got worse. One new, purely cosmetic nit below; nothing rises to Major or Blocker.

## Minor

### 🟡 A "nothing new" result now renders inside the success banner's celebratory styling, `components/find-jobs/FindJobsPage.tsx:257-265`
**Problem**: Before this diff, `jobsFound === 0` always took the early return into the `"empty"` status, so the green `success-lightest` banner with the `Sparkles` icon only ever appeared alongside a positive result. Now that the early return is gone, `status` becomes `"success"` whenever the refetch returns any rows at all — which includes the case where this run added nothing (`jobsFound === 0`, `resultsReturned > 0`) and the case where Adzuna returned zero results outright (`resultsReturned === 0`) but the user already has jobs from earlier runs. Both now display their message (`"No new jobs. Every result was already in your list."` / `"No jobs found for that search."`) inside the same success-styled, sparkle-icon banner used for `"Added 3 new jobs."`
**Why it matters**: Purely cosmetic — the wording itself is accurate in every case (that's the fix this diff makes), so no one is misled about what happened. But a "found nothing" message under a checkmark-adjacent icon and a green background reads as slightly self-contradictory, and it's a new combination that couldn't occur before this diff (the old early return kept the two states from ever mixing).
**Suggested fix**: Optional. If it's worth polishing, branch the banner's icon/styling on `jobsFound > 0` separately from the `status` state machine, so a zero-result message gets a neutral treatment even while `status` stays `"success"` for refetch purposes.

## Nits
- ⚪ None beyond the item above.

## Strengths
- The location fix is correct, not just present: I traced both call sites by hand (seeded-row order `company, title, location, salary` at `agent/adzuna.ts:117-122` vs. the function signature at `lib/job-signature.ts:14-19`, and the in-loop call at `agent/adzuna.ts:137-142`) and they agree on argument order, so the seeded path and the fresh path hash identically for the same job — the exact thing that would silently disable dedup if it drifted.
- `tests/job-signature.test.mjs` is real regression coverage, not theater: verified by running it against a reconstructed three-parameter version of the function outside the repo, where it fails as intended (the missing-salary-vs-stated-salary case collides once `location` shifts into the old `salary` parameter slot).
- The six new tests in `tests/agent-adzuna.test.mjs` and two in `tests/find-jobs-contract.test.mjs` are each checked against the current source and pass — no stale regex, no assertion of the wrong behavior.
- The `new Set(...)` nit from the first review is fixed (`agent/adzuna.ts:107-109`), and the README test-count sentence now hedges with "around"/"roughly" rather than a number that goes stale on the next added test, which also resolves that Minor.
- `resultsReturned` is threaded cleanly: `runJobSearch`'s return type, the route's three-way branch, and both test files agree on the exact wording and the `else if (resultsReturned === 0)` / `else` structure.

## Test coverage
No new gaps. The two pieces of logic that shipped without coverage in the first pass — the signature-dedup wiring in `agent/adzuna.ts` and the `FindJobsPage` destructive-early-return fix — are now covered at the same source-contract level the rest of the suite uses, and `lib/job-signature.ts` itself has real executing coverage. `npm test` reports 500 passing across 30 files (7 executing: `dashboard-stats`, `dashboard-activity`, `find-jobs-filters`, `match-score`, `adzuna-client`, `access`, `job-signature`), matching the README's now-hedged claim.

## Previously-reported items, verified this round
- 🔴→ **Fixed**: `jobSignature` location omission. Verified by argument-order trace and by running the test file against a reconstructed old implementation (fails as intended).
- 🟠→ **Fixed**: signature-dedup wiring untested. Six new tests, all verified against current source.
- 🟠→ **Fixed**: `FindJobsPage` fix untested. Two new tests, verified against current source; also produced the one new cosmetic Minor above as a side effect of the fix now being reachable in combination with the success banner.
- 🟡→ **Fixed**: "no new jobs" message overclaiming. `resultsReturned` added and threaded through correctly.
- 🟡→ **Fixed**: README test-count staleness. Now accurate and hedged.
- 🟡→ **Not fixed, by agreement, not worse**: `.in("company", ...)` has no time bound.
- 🟡→ **Not fixed, by agreement, not worse**: `z.number().catch(0)` collides with the 0-29 band.
- 🟡→ **Closed with evidence**: `temperature: 0` round-number concern; production data already checked and non-round.
- ⚪→ **Fixed**: `new Set(...)` wrap on the company list.

No evidence the diff made any of the four explicitly out-of-scope known gaps (silent `match_score = null`, salary-jitter near-duplicates, stale salary strings on old rows, un-retried Adzuna rate limits) worse. The interaction between the new `formatSalary` point-estimate rendering and the new signature dedup (an old row's pre-fix `"$103k - $103k"` string no longer matching a freshly-formatted `"$103k"` for the same posting) is real but is exactly the pre-acknowledged "stale salary strings, no backfill" gap, present since the first version of this diff, not a new or worsened issue.
