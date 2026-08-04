# Verify: resume generation quality · spec 0019 · updated 2026-08-04

_Steps derived from spec 0019 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Start a real resume generation through the profile page. Open the generated PDF and confirm no em dash character appears anywhere in the text (commas, periods, or colons only). → AC-2
- [ ] Generate a resume for a profile with at least one role. Open the PDF and confirm every bullet follows the XYZ structure (outcome first, not activity), and no two consecutive bullets carry the same rhythm and clause order. → AC-1
- [ ] Generate a resume for a profile with an experience level set to "junior" and confirm bullets emphasize what was built and shipped rather than ownership or scope. Generate another for "senior" and confirm bullets emphasize ownership and outcomes over implementation detail. → AC-4
- [ ] Generate a resume for a sparse profile (one role, short responsibilities, no education). Confirm the output is short and accurate, not padded with invented context or generic filler. → AC-6

## Commands

- [ ] `npx tsc --noEmit` → clean, zero errors → AC-10
- [ ] `npm run lint` → clean, zero warnings → AC-10
- [ ] `npm test` → all resume-generator tests pass, plus full suite clean (pre-existing failures in unrelated files only) → AC-10

## Code inspection (one time, already confirmed by /develop)

- [ ] SYSTEM_PROMPT in `agent/resume-generator.ts` contains: accuracy priority statement, XYZ pattern with weak/strong example pair, vary-bullet-shape instruction → AC-1
- [ ] SYSTEM_PROMPT contains: filler phrase list with alternatives, weak opening ban ("responsible for", "helped with", "worked on"), em dash ban. Code contains deterministic `replace(/—/g, ",")` → AC-2
- [ ] SYSTEM_PROMPT contains: keyword placement guidance, "Amazon Web Services (AWS)" example, "never repeat a skill artificially" → AC-3
- [ ] SYSTEM_PROMPT contains: SENIORITY CALIBRATION with distinct per-tier guidance tied to `experienceLevel` and `yearsExperience` → AC-4
- [ ] SYSTEM_PROMPT contains: "combine near-duplicate bullets" and "Four similar bullets become two" → AC-5
- [ ] SYSTEM_PROMPT contains: SPARSE PROFILES section, "Do not pad", "Length is never a target" → AC-6
- [ ] `computeRoleDuration` uses `Math.round(totalMonths / 12)` and `split("-")`. `buildAllowedNumerals` collects from named fields only (skills, industries, currentTitle, education.fieldOfStudy, yearsExperience, each role's jobTitle and keyResponsibilities), excludes phone/email/salary/URLs, adds `String(duration)` per role. `buildUserMessage` includes `durationYears` → AC-7
- [ ] `extractDigitSequences` uses `/\d+/g` and Set membership (no substring check). Validation drops single offending bullet with `console.warn`, falls back to `keyResponsibilities` only when all bullets for a role are dropped, falls back summary to `fallbackSummary` with `console.warn` → AC-8, AC-11
- [ ] No "Languages / Frameworks / Tools" or "Projects section" in prompt. PDF template and its test unchanged → AC-9
- [ ] Model `"gpt-4o"`, temperature `0.55`, `max_tokens: 1400` unchanged in source → AC-10

## Acceptance-criteria coverage

- AC-1 … covered by code inspection (prompt content) + manual (XYZ structure, varied bullets)
- AC-2 … covered by code inspection (prompt + deterministic strip) + manual (no em dashes in PDF)
- AC-3 … covered by code inspection (prompt content)
- AC-4 … covered by code inspection (prompt content) + manual (junior vs senior tone)
- AC-5 … covered by code inspection (prompt content)
- AC-6 … covered by code inspection (prompt content) + manual (sparse profile output)
- AC-7 … covered by code inspection + automated tests
- AC-8 … covered by code inspection + automated tests
- AC-9 … covered by code inspection (no prompt/diff changes)
- AC-10 … covered by commands (tsc, lint, test) + code inspection (model/temp/tokens)
- AC-11 … covered by code inspection (post-generation validation)
