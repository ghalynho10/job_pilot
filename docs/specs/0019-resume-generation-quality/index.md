# 0019. Improve resume generation quality with ATS domain knowledge

**Date**: 2026-08-04
**Status**: Accepted

## Summary

The generated resume feature works today but writes generic prose and has no safeguard against a stated fact that never appeared in the user's profile. This decision enriches the writing instructions given to the model with resume writing and applicant tracking system (a hiring tool that scans and ranks resumes before a person sees them, often called ATS) guidance already captured in the project's own reference doc, and adds one small piece of code that checks any number the model writes against what the profile actually contains, falling back to the user's own words if a number cannot be traced back. Nothing about the page, the endpoint, or the PDF layout changes. Skills grouping and a Projects section are real gaps the reference doc also covers, but both stay out of this change since they add new output the product does not have today.

## Requirements

**User stories**:
- As a job seeker generating a resume, I want my bullet points to read like they were written by a skilled resume writer, so my resume stands out rather than reading as generic AI output.
- As a job seeker, I want every number on my generated resume to be something I can back up in an interview, so I never accidentally misrepresent my own experience.
- As a job seeker at any career stage, I want my resume's tone and level of detail to match how senior I actually am, so a junior resume does not undersell me and a senior resume does not read as junior.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: The system prompt states plainly, ahead of every style rule below, that staying accurate to the profile always outranks any of them, so a style instruction is never followed at the cost of inventing or softening a fact. The prompt then states the "accomplished X, measured by Y, by doing Z" bullet structure, including one weak and one strong example pair from the reference document, and instructs the model to vary each bullet's shape rather than repeat the same sentence pattern throughout a section.
- **AC-2**: The system prompt lists the filler phrases the reference document flags (for example "leveraged," "results driven," "proven track record of") together with a better alternative for each, and also lists the weak opening phrases the document separately flags ("responsible for," "helped with," "worked on") as phrases a bullet must never open with. The prompt also states plainly that an em dash character must never appear in generated text; on top of that instruction, any em dash the model writes anyway is stripped from the text in code and replaced with a comma before the content is used, since this one fix is deterministic and needs no judgment call, unlike the rest of this criterion.
- **AC-3**: The system prompt instructs the model to use the exact language employers search for, to write an acronym in full the first time it appears followed by the short form in parentheses (for example "Amazon Web Services (AWS)"), and to never repeat a skill artificially just to raise its count.
- **AC-4**: The system prompt ties bullet tone to the profile's own `experienceLevel` and `yearsExperience` fields (already sent today, just unused for this purpose): an early career bullet emphasizes what was built, a mid career bullet leads with the scope of the role, a senior bullet emphasizes ownership and the outcome influenced rather than the implementation detail. This only changes bullet wording; no section is reordered or added.
- **AC-5**: The system prompt instructs the model that when a role has more similar bullets than fit comfortably, near duplicate bullets should be combined rather than every one kept, so the one page limit already in place is met by combining content rather than by cutting whole roles.
- **AC-6**: The system prompt instructs the model not to pad a sparse profile (few roles, short written responsibilities, no education entered) with generic filler or invented context just to sound fuller. A short, accurate summary and a shorter bullet list are correct output for a sparse profile; length is never a target to hit at the cost of accuracy.
- **AC-7**: A new function builds one combined set of numbers the model is allowed to state for a given profile, used for the whole resume, not a separate set per role. The set is built from the literal numbers already present in a named, deliberately narrow list of the profile's own fields: skills, industries, current title, education's field of study, the profile's own stated years of experience, and each work experience entry's own job title and written responsibilities. Contact and administrative fields (phone, email, salary expectation, preferred locations, portfolio and LinkedIn URLs) are deliberately excluded from this set, since a number appearing only in a phone number or a salary figure is never a legitimate resume claim and including it would let an unrelated fabricated statistic coincidentally match. The set also gains one computed number per work experience entry: how many whole years that entry covers, rounded to the nearest whole year (not rounded down) from its start and end month, so a role held for a year and a half correctly allows "2 years" rather than incorrectly rejecting it. That computed duration is added to the entry's own data before it is sent to the model, so the model can use it directly instead of guessing. A role count or a total years figure summed across every role is deliberately not part of this set, matching the earlier decision to compute only per role duration; the model must not state either.
- **AC-8**: After the model responds, every bullet and the summary paragraph are checked against that one combined allowed set. A number is only considered a match if it is the same number as a whole, not a fragment of a larger one (for example a stated "20" never matches merely because the profile contains the year "2020" somewhere); this whole number comparison is what keeps the check from either missing a real fabrication or rejecting a real one. If a single bullet contains a number that fails this check, only that bullet is dropped from its role's list; the existing fallback used today when the model returns nothing for a role (the user's own written text, split into lines) only replaces the whole role's bullets if every one of that role's bullets gets dropped this way. If the summary contains such a number, the whole summary is replaced with the existing generic summary fallback, since a summary has no smaller unit to drop. Every time any of these fallbacks fires, one bullet dropped, a whole role's bullets replaced, or the summary replaced, it is written to the server log so it stays visible rather than silent. A number written out as a word (for example "three years") is not checked; this only covers digits, since that is the form an invented statistic actually takes.
- **AC-9**: Skills stay a single comma separated line and no Projects section is added anywhere, either sent to the model or shown on the PDF. Both are real gaps the reference document raises, deliberately left for a later, separate piece of work rather than folded into this one.
- **AC-10**: The model name, the temperature setting, and the maximum response length used today stay exactly as they are; only the instructions given to the model grow, and the shape of what the model returns (a summary plus one bullet list per role, at most three roles, six bullets each) does not change.
- **AC-11**: No bullet or summary sentence in the final output states a number that cannot be traced to the profile or to a role duration computed from it. This is the specific, code checked slice of the broader "never invent" guarantee spec 0004 already set out; word level fabrication (an invented employer, title, or responsibility) still relies on the model following the instruction in AC-1, the same as it does today, since only numbers get a check in code by this feature.

## Decision

**Chosen option**: Option 2: Prompt instruction for wording and structure, one checked rule in code for numbers

The system prompt in `agent/resume-generator.ts` gains the wording, structure, keyword, and tone guidance from the reference document as plain instruction text, and gains one new function that computes which numbers a profile actually supports and checks the model's answer against it, falling back to the user's own text on a mismatch.

## Feature design

**Data model sketch**: None. Every number this feature computes (how long someone held a role) comes from the `work_experience` data already stored on `profiles` and is computed fresh on each request; nothing new is written to the database.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/resume/generate` | POST | none (reads the caller's own saved profile) | unchanged: uploads a PDF, updates `resume_pdf_url`, no response body change | existing session, existing paid route guard | unchanged: the four existing generic failure messages, no new one added |

**Key invariants**:
- No bullet or summary sentence in the final PDF contains a number that cannot be traced to the profile's own data or to a role duration computed directly from it, compared as a whole number, never as a fragment of a larger one.
- A role whose bullets are affected by a dropped number never ends up empty: only the offending bullet is dropped first, and the role only falls back to the user's own written text if that drop would otherwise leave it with nothing.
- An em dash never reaches the final PDF, whether the model avoided it as instructed or not, since the deterministic strip in code is a second, unconditional guarantee.
- One combined allowed set covers the whole resume; a duration computed for one role could in principle also satisfy a coincidentally matching number written about a different role. This is an accepted, low risk imprecision rather than a gap, since a false pass here still has to be a real, small, plausible duration already present somewhere in the profile, not an arbitrary invented figure.
- The model, temperature, and maximum response length stay fixed, so this change cannot silently grow the cost or latency of a generation request.

**Security model**: Unchanged. The route keeps the same paid route guard it already has; this feature adds no new read, write, or endpoint.

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):
- Happy path: a profile with a role held for eighteen months and a bullet that states its duration as two years generates a resume where that bullet is kept, since the rounded duration is in the allowed set, verifies **AC-7**, **AC-8**, **AC-10**.
- Failure case: the model's answer for one role contains a percentage that appears nowhere in the profile, only that bullet is dropped, the role's remaining bullets are kept, and the drop is written to the server log, verifies **AC-8**, **AC-11**.
- Whole role fallback: every bullet the model wrote for a role fails the check, so the role falls back to the user's own written text split into lines, and the fallback is logged, verifies **AC-8**, **AC-11**.
- Summary fallback: the generated summary states a number that cannot be traced to the profile, the whole summary is replaced with the existing generic fallback, and the fallback is logged, verifies **AC-8**, **AC-11**.
- False match check: a generated bullet states "20," the profile has no "20" anywhere but does have the year "2020" in a role's dates, the bullet is correctly dropped rather than incorrectly passed, verifies **AC-8**.
- Regression: the prompt grows with the new instructions but the model, temperature, and maximum response length in the request stay byte for byte the same as today, verifies **AC-10**.

## Build plan

- [x] 1. Add the accuracy priority statement and the bullet structure guidance with its example pair to the system prompt, satisfies **AC-1**
- [x] 2. Add the filler phrase list, the weak opening phrase list, and the em dash instruction to the system prompt, and add the deterministic em dash strip in code, satisfies **AC-2**
- [x] 3. Add the keyword and acronym guidance to the system prompt, satisfies **AC-3**
- [x] 4. Add the seniority based tone guidance to the system prompt, satisfies **AC-4**
- [x] 5. Add the "combine near duplicate bullets" guidance to the system prompt, satisfies **AC-5**
- [x] 6. Add the sparse profile guidance to the system prompt, satisfies **AC-6**
- [x] 7. Write the function that computes the one combined allowed number set for a profile from the named field list, including each role's computed duration rounded to the nearest year, and add that duration to what is sent to the model, satisfies **AC-7**
- [x] 8. Write the whole number comparison check that runs the model's bullets and summary against that set after generation, dropping a single offending bullet first, wired into the existing per role fallback (only on a fully emptied role) and the existing summary fallback, with a log line on every drop, role fallback, and summary fallback, satisfies **AC-8**, **AC-11**
- [x] 9. Confirm no change is needed to the PDF template or its existing tests, and write down the Skills and Projects exclusion explicitly rather than leaving it implicit, satisfies **AC-9**
- [x] 10. Add tests for the new prompt content and the new function, following this project's existing convention of testing the real source rather than mocking the model call, including the whole number comparison edge case (a fabricated "20" must not pass just because the profile contains "2020") and the eighteen month rounding case, satisfies **AC-1** through **AC-8**, **AC-11**
- [x] 11. Run the full test suite, the type check, and the linter, confirming all three stay clean, satisfies **AC-10**

## Consequences

**Positive**:
- Closes the one gap in this feature that could put a false statement on a real document a user sends to an employer, with an actual check rather than an instruction alone.
- Bullet and summary quality should measurably improve without touching the page, the endpoint's contract, or the PDF layout at all.

**Negative / tradeoffs**:
- When the check does catch a fabricated number in a single bullet, that bullet is simply dropped rather than kept in a lesser form; a role that loses most of its bullets this way reads thinner than the model intended, though never empty. This is accepted since dropping is still less destructive than the whole role fallback it replaces, and a role only reaches the whole role fallback if every one of its bullets failed the check.
- The filler phrase list, the weak opening phrase list, and bullet length still rely on the model following an instruction, with no check behind them, so drift in those two remaining areas is possible and would only be caught by a person reading the output. The em dash rule is the one exception: it gets a deterministic fix in code on top of its instruction, so it cannot drift.

**Neutral**:
- The system prompt grows noticeably longer; this is expected and does not require raising the maximum response length, since it only affects what is sent to the model, not what the model is asked to write back.
