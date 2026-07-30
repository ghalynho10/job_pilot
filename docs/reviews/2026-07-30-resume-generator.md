# Review, resume-pdf-generation (spec 0004), 2026-07-30

**Reviewed by**: claude-opus-4-8 (author on a different model)
**Scope**: 11 changed files (+ new spec/tests), branch vs `main` (merge-base 957b330)
**Verdict**: Approve with nits

## Summary
This change adds a `POST /api/resume/generate` route that reads the caller's saved profile, asks GPT-4o to write a summary and per-role bullets, renders a one-page PDF with `@react-pdf/renderer`, uploads it under a fresh key, repoints `resume_pdf_url`, and deletes the old file — plus a small `GET /api/resume/signed-url` endpoint and the wired-up UI. The implementation is clean, closely mirrors the sibling extraction feature (07), and gets the important invariants right: auth-before-read, a server-side completeness gate that does not trust client state, upload-before-write-before-delete ordering, orphan cleanup on a failed write, and no key/URL leaking in the response. No blockers or majors. The findings below are robustness and consistency nits.

## Minor
### 🟡 Full work-experience list sent/expected with a fixed 1400 token cap risks total failure for large profiles, `agent/resume-generator.ts:38-48,88`
**Problem**: `buildUserMessage` sends every `workExperience` entry and the prompt demands one bullet array per entry, but the response is capped at `max_tokens: 1400`. Unlike feature 07's extractor (which caps `workExperience` to the first 3 via a `.transform(...slice(0,3))`), there is no cap here. A profile with many roles can truncate the JSON mid-output, `JSON.parse` then throws, and the user gets "returned an unreadable response" every time — a deterministic failure with no user recovery (retrying won't help).
**Why it matters**: A power user with 7-8+ roles could find the feature simply never works, while the error copy implies a transient glitch.
**Suggested fix**: Either cap/paginate the roles fed to the model (as extraction does), scale `max_tokens` with role count, or fall back per-role to `reconcileBullets` when parsing fails instead of failing the whole generation. At minimum, confirm the realistic worst case fits in 1400 tokens.

### 🟡 Fallback bullets are not capped at `MAX_BULLETS_PER_ROLE`, `agent/resume-generator.ts:64-69`
**Problem**: The model-provided path caps bullets via `generated.slice(0, MAX_BULLETS_PER_ROLE)`, but the fallback path (`return splitIntoLines(entry.keyResponsibilities)`) returns however many lines the raw notes contain, uncapped. A role whose notes have many newline-separated lines will render an unbounded bullet list.
**Why it matters**: Undermines the same one-page intent the cap exists to protect, specifically for the degraded case the fallback is meant to handle gracefully.
**Suggested fix**: Apply `.slice(0, MAX_BULLETS_PER_ROLE)` to the fallback result as well.

### 🟡 Client `canGenerate` uses unsaved form state while the server reads the saved DB row, `components/profile/ProfileEditor.tsx:42`; `app/api/resume/generate/route.ts:31-55`
**Problem**: `canGenerate` is derived from the live (possibly unsaved) `profile` state, so the button enables as soon as a name + one role are typed. The server, correctly per AC-2, reads the saved DB row. A user who fills the form but has not clicked Save Profile sees an enabled button that, on click, returns "Please save your profile…". Additionally, the generated PDF reflects the last *saved* data, not what's currently on screen — a user who edits fields then generates gets stale content with no indication.
**Why it matters**: Confusing UX; the enabled-then-rejected button and the "why is my edit not in the PDF" case are both easy to hit. The server behavior is correct (this is a client hint issue).
**Suggested fix**: Consider gating/hinting on saved state (e.g. a "save your changes first" hint when the form is dirty), or surfacing the returned server error prominently. Not a correctness bug — the server is the source of truth by design.

### 🟡 `context/library-docs.md` GPT-4o guidance is now stale vs the implementation, `context/library-docs.md:532-542`
**Problem**: The GPT-4o section still lists resume generation as `temperature: 0.7` and `max_tokens: 1000`, but this feature ships `0.55` / `1400`. `library-docs.md` was edited in this same diff (storage + react-pdf sections) yet this table was left unchanged, so the durable doc now contradicts the code it's meant to govern.
**Why it matters**: AGENTS.md makes these context files the canonical rules the next agent reads; a stale entry will mislead future work. (The decision itself is recorded in `progress-tracker.md`, so this is a doc-sync gap, not a wrong choice.)
**Suggested fix**: Update the GPT-4o temperature/max-tokens table to match, or note resume generation's values explicitly.

## Nits
- ⚪ `app/api/resume/generate/ResumePdfDocument.tsx:9,15` — hardcoded `#444444` hex. This is an acceptable and unavoidable exception (react-pdf's `StyleSheet` cannot consume the project's CSS design tokens), but the AGENTS.md "no hardcoded hex" rule has no documented carve-out for it; worth a one-line note in `library-docs.md`'s react-pdf section so it isn't flagged as a violation later.
- ⚪ `app/api/resume/generate/route.ts:48-53` and `:60` — the completeness gate and AI-failure responses return `success:false` with an implicit `200`, while other failures use explicit statuses (401/500). Harmless (client only reads `success`), but slightly inconsistent.
- ⚪ `docs/specs/0004-.../index.md:45` — spec's API table names the endpoint `/api/resume/signed_url` (underscore) while the shipped route and client use `signed-url` (hyphen). Internally consistent in code; spec doc typo only (spec is /architect-owned).

## Strengths
- The write ordering (upload → DB write → delete old key) and the orphan-cleanup on a failed DB write are implemented exactly to the AC-4 invariant, with tests that assert the source ordering directly.
- `reconcileBullets` mapping the model's output back onto the profile by index (with a per-role fallback) is a genuinely good defense against the model dropping/reordering roles — satisfies AC-3 without ever fabricating or rendering an empty role.
- Security is tight: both routes take no request body, derive `userId` only from the session, and scope every read/write to the caller's own row and `${userId}/` key prefix (AC-6/AC-7).
- Co-locating `ResumePdfDocument.tsx` inside the route folder, plus the test that fails if it's imported by any client component, is a nice structural guard for the server-only constraint.

## Test coverage
Coverage is strong for this project's source-contract convention (`node:test`, regex over source, no jsdom). The new suites assert the load-bearing invariants: auth-before-read, the completeness gate before any AI/render/storage work, upload→write→delete ordering, fresh-unique-key, orphan cleanup, no key/URL in the response, the no-client-body/session-only-id guarantee, the reconcile-by-index + cap + fallback logic, the schema `.catch()` tolerance, error copy/log prefixes, and the react-pdf server-only + supported-CSS constraints. Two behaviors are unverified even at the contract level: the `max_tokens` truncation risk (Minor 1) and the uncapped fallback bullets (Minor 2) — the latter is testable within the existing convention by asserting the fallback also slices to `MAX_BULLETS_PER_ROLE`.
