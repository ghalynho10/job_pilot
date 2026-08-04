# 0019. Rationale — resume generation quality

## Context

The resume generation feature (`agent/resume-generator.ts`, spec 0004) sends a profile to GPT4o with one instruction: rephrase what is given, never invent employers, titles, dates, or accomplishments. That instruction alone produces resumes that are safe (nothing invented outright) but generic: bullets follow no consistent strong structure, common filler phrases are not screened out, there is no guidance on how a summary or skill should be worded so an automated scanner picks it up, and nothing adjusts tone for a junior candidate versus a senior one.

The team already wrote `docs/reference/resume-domain-knowledge.md`, a reference document covering exactly these gaps: a bullet formula, a list of filler phrases to avoid, guidance on how scanners weigh keywords, and how word choice and detail should shift with seniority. None of this knowledge has been applied to the actual prompt yet. The scope entry for this feature (`docs/scope/scope.md`, feature 4) asks for quality of output only, explicitly ruling out new capability such as cover letters or resumes tailored per job.

The reference document also names one gap that instruction text alone does not reliably close: a model can still write a number, a percentage, or a dollar figure that never appeared anywhere in the profile. Every other rule in the document (word choice, formatting, structure) is a matter of degree, but a fabricated number is a factual claim about the user that they did not make, on a document they will send to an employer under their own name. The document proposes checking every number in the generated text against what the profile actually contains, computing a small number of facts (such as how long someone held a role) in code rather than trusting the model to infer them correctly.

The existing PDF template (`app/api/resume/generate/ResumePdfDocument.tsx`) already avoids nearly everything that breaks an automated scanner: one column, no tables, no images, no header or footer regions, real selectable text. The gaps the reference document raises beyond the prompt (grouping skills into categories, adding a Projects section, reordering sections by seniority) are all changes to that template and to what the model is asked to produce, not corrections to existing output, so they sit outside this decision's boundary.

The consequence of not deciding this now: the generated resume keeps reading as competent but forgettable, with no protection at all against an invented number reaching a user's actual job application.

## Options considered

### Option 1: Add every rule as prompt instruction only, no new code

Every rule from the reference document, including the number checking rule, is written as plain instruction text inside the existing system prompt, and nothing else in the code changes.

**Pros**:
- Smallest possible change: one string grows, nothing else moves.
- No new function to design, test, or maintain.

**Cons**:
- The reference document itself says a model does not reliably follow the "do not invent a number" rule from instruction text alone, since the failure mode it is guarding against (a plausible sounding invented statistic) is exactly the kind of text a language model produces confidently. This option accepts that risk with no way to catch it.

### Option 2: Prompt instruction for wording and structure, one checked rule in code for numbers

Every wording, structure, keyword, and tone rule is added as instruction text, the same as Option 1. The one rule the reference document itself calls out as needing an actual check, not just an instruction, gets one: the set of numbers a profile actually supports is computed in code, and anything the model writes outside that set is caught after the fact and replaced with the user's own words.

**Pros**:
- Puts the one piece of code level protection exactly where the reference document says it is needed, and nowhere else, so effort stays proportional to actual risk: a wrong tone reads awkwardly, a fabricated statistic is a false claim on a document sent to an employer.
- Reuses a pattern already proven in this codebase: `reconcileBullets` already falls back to the user's own written text whenever the model's answer for a role cannot be trusted, so this adds one more reason to take that same path rather than inventing a new failure behavior.

**Cons**:
- One new function and its tests to write and keep correct, rather than a pure text change.

### Option 3: Check every reference document rule in code, not just numbers

Beyond numbers, also write a checker for the em dash rule, the filler phrase list, and bullet length, each with its own decision for what happens on a violation.

**Pros**:
- Closest match to the reference document's full "some rules need enforcement, not just instruction" section.

**Cons**:
- Three of the four rules this would check are about tone, not fact. The worst case if the model ignores them is a bullet that reads a little generic, not a false claim, so the extra build and test effort for four checkers and four violation policies is not proportional to what is actually at stake for three of the four.
- Slows down shipping the one check that matters most (numbers) while building three checks that can just as well be added later if the prompt instructions turn out not to hold up in practice.

## Rationale

The reference document itself draws the line this spec follows: most of its guidance is a matter of degree that a well written instruction handles well, but numeral fabrication is different in kind, since it is a factual claim rather than a style choice, and the document names it as the one rule that needs an actual check rather than trust in the instruction. Building a check for every flagged rule (Option 3) spends the same effort on a filler phrase reading generic as it does on an invented statistic, which is not where the real risk sits. Building nothing (Option 1) accepts exactly the failure mode the reference document warns about, with no way to catch it before it reaches the user's own resume. Option 2 puts the one check where the actual risk is, and reuses the existing fallback path (`reconcileBullets`'s per role fallback to the user's own written text) rather than inventing a new failure behavior, which keeps the change small and consistent with how this file already handles a model answer it cannot fully trust.

## Follow-up

- [ ] Design a separate feature for a Projects section (sending `profile.projects` to the model, rendering it in the PDF, and reordering sections for early career profiles). The engineer has already confirmed this is the intended next piece of work after this one ships.
- [ ] Consider grouping Skills into categories (Languages, Frameworks, Tools) instead of one flat line, as a later, separate PDF template change.
- [ ] If the filler phrase list or the weak opening phrase list turn out not to hold up reliably once this ships, consider adding a checked rule for either, the same way this feature added one for numbers and already added one for the em dash.
- [ ] Revisit whether a role's computed duration should round to the nearest whole year (as built here) or show a finer unit such as months, once real generated resumes can be reviewed.
- [ ] Role count and total years across every role are not in the allowed set today, so the model attempting either gets that bullet dropped. If that turns out to happen often enough to visibly cost bullet quality, consider adding both as further computed numbers, the same way per role duration was added here.

## References

**Project sources** (verifiable, in this repo):
- `docs/reference/resume-domain-knowledge.md`, "Never invent" (basis for AC-1's accuracy priority statement)
- `docs/reference/resume-domain-knowledge.md`, "Bullet structure: the XYZ pattern" (basis for AC-1's bullet structure)
- `docs/reference/resume-domain-knowledge.md`, "Sounding human" (basis for AC-2)
- `docs/reference/resume-domain-knowledge.md`, "Keyword placement" (basis for AC-3)
- `docs/reference/resume-domain-knowledge.md`, "Seniority calibration" (basis for AC-4)
- `docs/reference/resume-domain-knowledge.md`, "Length and what to cut" (basis for AC-5)
- `docs/reference/resume-domain-knowledge.md`, "Handling sparse profiles" (basis for AC-6)
- `docs/reference/resume-domain-knowledge.md`, "Validating numerals: two tiers, not one" and "Never invent" (basis for AC-7, AC-8, and AC-11)
- Spec 0004 (`docs/specs/0004-resume-pdf-generation-from-profile/`), the existing per role fallback in `reconcileBullets` (basis for the Decision's chosen fallback behavior)

**Practices and standards**:
- Positional reconciliation as an existing safety net pattern already established in this codebase, reused here rather than inventing a new one
