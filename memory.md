# Memory — Feature 06 loose end cleanup

Last updated: 2026-07-29 19:48 EDT

## What was built

- `components/profile/ProfileForm.tsx`: added blank first options for Work Authorization, Experience Level, Highest Degree, and Remote Preference so genuinely empty profile values no longer visually appear as the first real option. The select change handlers now cast to the union type that includes `""`.
- `tests/profile-contract.test.mjs`: added a regression test that verifies those four blank select placeholders exist and that the handlers accept the empty value type.
- `context/build-plan.md`: corrected Profile Page planning text so Cover Letter Tone is no longer listed in the current Profile UI, and feature 06 now says `resume_pdf_url` stores the uploaded storage key only after Save Profile is clicked.
- `context/architecture.md`: corrected resume storage from the stale fixed `resumes/{user_id}/resume.pdf` path to fresh unique keys, `resumes/{user_id}/{random}.pdf`, and documented `cover_letter_tone` as a reserved nullable column not rendered in the current profile UI.
- `context/ui-registry.md`: updated `Navbar` and `ProfileForm` entries. Navbar remains text only with color only active state. ProfileForm records the blank select placeholder pattern and that Cover Letter Tone is intentionally absent from the current UI.
- `context/progress-tracker.md`: marked the loose end cleanup as the last completed work and removed contradictory old notes that still described these items as open.
- `docs/specs/0002-profile-save-logic/index.md` and `rationale.md`: corrected stale storage wording and marked the Cover Letter Tone follow up as resolved for the current UI.

## Decisions made

- Cover Letter Tone is resolved for now as intentionally absent from the profile UI, matching the delivered design. The `cover_letter_tone` database column remains reserved and nullable.
- The shared Navbar continues to follow `ui-rules.md`: text only navigation, color only active state, no icons, no underline.
- Orphan cleanup for uploaded but never saved resume objects remains a future storage maintenance feature. It was not built as part of this cleanup because it has lifecycle and safety implications, especially with staged resume keys that can live in `sessionStorage`.

## Problems solved

- Empty select fields no longer show the first valid option while the completion banner still treats them as missing.
- Stale planning and architecture text no longer points future work toward a fixed `resume.pdf` path or `upsert` based storage behavior.
- The old ambiguity around Cover Letter Tone and Navbar active styling is now resolved in the living docs.

## Current state

- Feature 06 and its loose end cleanup are done.
- Validation from this session passed: `npm test` is 94/94, `npx tsc --noEmit` is clean, and `npm run lint` is clean.
- `/sync` was run. It made no AGENTS.md changes. It reported no scope file exists under `docs/scope/`. It also flagged one remaining spec content mismatch: `docs/specs/0002-profile-save-logic/index.md` still has older prose in the Decision section that describes rehydration with `useEffect`, while the implemented and documented convention is `useSyncExternalStore`. `/sync` cannot rewrite spec content beyond status lines, so this needs `/architect` if the spec should be corrected.
- `context/progress-tracker.md` lists the next feature as 07 AI Profile Extraction from Resume.

## Next session starts with

Run `/architect` before Feature 07, AI Profile Extraction from Resume. The next concrete task is to design the Extract from Resume flow: PDF text extraction, GPT structured schema, how extracted values merge into `ProfileEditor` without overwriting fields the user manually filled, and the empty or short PDF text error path.

## Open questions

- Whether to run `/architect` just to correct the stale `useEffect` prose in spec 0002, or leave it until a future spec touch.
- When feature 13 is designed: add a `company_research_completed_at` column, or source feature 16's activity feed from `agent_logs.created_at`.
- Whether to ever complete a real human driven Google or GitHub login to close the last remaining feature 02 verification gap.
- When and how to implement orphan cleanup for resume storage objects, with a grace period or other protection so cleanup does not delete a key still referenced by a live `sessionStorage` staged resume entry.
