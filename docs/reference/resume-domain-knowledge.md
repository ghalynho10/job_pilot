# Resume domain knowledge

Reference material for JobPilot's resume generation path (`app/api/resume/*` → GPT-4o → `@react-pdf/renderer`). Not a spec — source material for one, capturing what makes a generated resume actually survive an applicant tracking system and a seven-second human skim.

Two sections: foundations that apply to any resume, and guidance specific to generating one from structured profile data.

---

## Part 1 — Foundations

### Why formatting matters more than it looks

Applicant tracking systems parse a resume into structured fields before any human sees it. Parse failures are silent: the candidate is never surfaced and never learns why. This is the reason formatting rules that sound pedantic are worth enforcing in generated output.

### What breaks parsers

- **Tables and multi-column layouts.** The most common failure. A two-column layout often parses as interleaved text, mixing a skills sidebar into job descriptions.
- **Text boxes and graphics.** Frequently skipped entirely. Contact info inside one can vanish.
- **Headers and footers.** Often ignored — never put contact details there.
- **Images and icons.** Unparseable. Skill-level charts ("Python ●●●●○") convey nothing to a parser and little to a human.
- **Nonstandard section names.** "Where I've Made an Impact" defeats section detection. Use conventional headers.
- **Image-based PDFs.** Invisible to every parser. Generated output must always carry a real text layer.

Single column, standard headers, text-based PDF. Non-negotiable for generated output.

### Section conventions

Use these headers, or very close variants:

- Experience (or Work Experience / Professional Experience)
- Education
- Skills (or Technical Skills)
- Projects
- Certifications

Order depends on the candidate. Experience first for anyone with relevant employment; Projects first for career changers and early-career candidates whose projects outweigh their job history.

Dates consistent throughout — "March 2023 – August 2025", not a mix of formats. Include months; year-only ranges read as concealing gaps.

### Bullet structure: the XYZ pattern

Accomplished **X**, as measured by **Y**, by doing **Z**.

Order matters — lead with outcome, not activity. A screener reading only the first few words of each bullet should still absorb the impact.

**Weak:** Worked on improving the checkout flow using React and Redux.
**Strong:** Cut checkout abandonment 23% by rebuilding the flow in React, reducing steps from five to two.

No bullet exceeds two lines. White space is what makes a resume skimmable, and skimmability decides the first seven seconds.

**The pattern is a tool, not a template.** If every bullet in a section carries the same rhythm and the same clause order, the section reads as machine-produced. Real resumes are uneven, because some accomplishments need a clause of context and others do not. Vary the shape deliberately.

### Action verbs

Open every bullet with a concrete one: architected, shipped, reduced, migrated, automated, rebuilt, cut, scaled, diagnosed, benchmarked, consolidated.

Never generate: "responsible for", "helped with", "worked on", "assisted in", "participated in". These describe presence, not contribution.

**Do not rotate synonyms to avoid repetition.** If the same verb is the accurate one for two bullets, use it twice. Cycling through a thesaurus for variety's sake is itself a generated-text tell, and it usually costs precision. Genuine low-effort repetition (three identical openers in a row on unrelated work) is worth breaking; accurate repetition is not.

### Sounding human

This section matters more for generated resumes than for reviewed ones. A human writing their own resume produces AI-sounding text occasionally. A language model producing it from structured data will produce AI-sounding text by default, on every bullet, unless explicitly steered away.

The stakes are concrete: recruiters and hiring managers now read with AI-written text in mind, and a resume that pattern-matches to machine output gets discounted before its content is judged. Output that clears the parser and then fails the human read has not succeeded.

Keep the list short and specific. General humanizing advice does not transfer to resumes — title-case section headers, bold job titles, clipped fragments, and parallel bullet structure are all correct in this format and should be left alone. Only these patterns actually cost the candidate.

**The vocabulary cluster.** These read as generated on sight:

| Avoid | Use instead |
| --- | --- |
| leveraged, utilized | used, or the specific verb (queried, indexed, cached) |
| spearheaded, orchestrated | led, built, ran, shipped |
| passionate about, deeply passionate | cut entirely, or show it with a project |
| results-driven, detail-oriented, self-starter | cut; claims with no evidence behind them |
| proven track record of | the track record itself, with a number |
| seasoned professional, subject matter expert | the years and the domain, stated plainly |
| robust, seamless, cutting-edge, innovative | cut; if the thing was genuinely novel, say what was novel |

**Em dashes.** Do not generate them in resume prose. Comma, period, or colon. Mechanical, and worth enforcing at the prompt level rather than hoping the model avoids it.

**Significance inflation.** "Played a pivotal role in driving the company's data transformation" says nothing and sounds generated. What was built, and what changed as a result.

**Hedging.** "Helped to improve", "contributed to reducing", "assisted in the development of". Either the person did the thing, in which case say so, or they were one of several, in which case name their part specifically. Hedged verbs read as both machine-written and weak.

**Uniform bullet shape.** Covered above under bullet structure, and it belongs here too: identical rhythm down a section is one of the strongest generated-text signals in a resume.

**This never outranks accuracy.** If removing inflated language leaves a bullet with nothing concrete underneath, the correct output is the thinner honest bullet, not better-sounding filler. The never-invent constraint below wins every time.

### Keyword placement

Parsers weight the top of the document and the Skills section most heavily, and many rank by keyword frequency and position.

- A summary at the top is the densest keyword real estate on the page.
- A skill appearing only in Projects carries less weight than the same skill in both Skills and a work bullet.
- Spell out and abbreviate on first use — "Amazon Web Services (AWS)" — so either search term matches.

Keyword stuffing is self-defeating: detected by modern systems and every human reader, and it collapses at the interview regardless. The legitimate version is stating genuinely-held skills in the language employers use, in the places that carry weight.

### Length and what to cut

One page under roughly ten years of experience — a hard expectation in most software hiring. Two pages acceptable for senior candidates with substantial history.

When trimming, remove in this order:

1. Spoken languages, interests, generic "Additional" content
2. Roles older than ~10 years, or reduce to a single line
3. Coursework, if any professional experience exists
4. Redundant bullets within a role — four similar bullets become two
5. Leadership and volunteer content, compressed rather than deleted

Protect Projects and recent Experience last.

### Seniority calibration

- **Early career:** Projects may precede Experience. Emphasize what was built and shipped.
- **Mid career:** Experience leads; Projects support it.
- **Senior:** Scope, ownership, and influence over outcomes — fewer implementation details, more decisions and consequences. A senior resume heavy on individual feature work reads as under-leveled.

### Career changers

The failing pattern: all evidence for the target field sits in Projects while Experience reads entirely as the previous field. A screener judges from Experience and never reaches Projects.

Highest-leverage fixes, in order:

1. A summary stating the target role explicitly — the only place to reframe before anything else is read.
2. Surface genuinely relevant work already present in the old experience (data work, automation, analysis, ML-adjacent features), promoting it above routine bullets.
3. Reorder within each role so the most relevant bullet comes first.
4. Name a study or building period filling an employment gap — an unexplained gap reads worse than a dated entry describing deliberate investment.

---

## Part 2 — Generating from profile data

JobPilot generates a resume from `profiles` table data, not from an existing document. That changes several things.

### Available inputs

Generation draws on: `full_name`, `email`, `phone`, `location`, `current_title`, `experience_level`, `years_experience`, `skills[]`, `industries[]`, `work_experience` (jsonb, up to 3 roles), `education` (jsonb), `projects` (jsonb, optional), `linkedin_url`, `portfolio_url`, `work_authorization`.

Note the ceiling of three roles — generated output is structurally bounded to a short history, which suits the one-page target but means role selection matters when a user has more.

### Never invent

The single most important constraint. The model must not fabricate metrics, tools, employers, dates, or achievements not present in profile data. A resume inflated at generation time collapses in the interview, and the user may not notice the fabrication before sending it.

When a role's description lacks quantification, the correct output is a strong unquantified bullet — not an invented percentage. Prefer scale and scope drawn from real data ("across a 12-person team") over fabricated improvement figures.

This constraint and the sounding-human guidance pull against each other in one specific place: puffed-up language is often what a model reaches for when the underlying data is thin. Removing it exposes the thinness. That exposure is correct. A short honest bullet beats an impressive-sounding empty one, and the generation prompt should say so explicitly rather than leaving the model to resolve the tension on its own.

### Handling sparse profiles

Profiles will often be thin — a title, a few skills, no detailed accomplishments. Generation must degrade gracefully rather than padding.

- Thin `work_experience` → fewer, honest bullets, not invented ones
- Missing summary material → derive from `current_title`, `years_experience`, and top `skills[]` rather than generic filler ("results-driven professional", which is both empty and on the avoid list above)
- No projects → omit the section rather than emitting an empty header

A short honest resume outperforms a padded one, and padding is the failure mode a generative system falls into by default.

### Mapping seniority

`experience_level` and `years_experience` should drive bullet altitude per the calibration above, and drive section ordering (Projects-first for early career). This mapping is currently implicit and is the clearest candidate for explicit prompt instruction.

### Skills section

`skills[]` is user-entered and often unordered and over-inclusive. Generation should group into conventional categories (Languages / Frameworks / Tools) rather than emitting a flat list, and should not silently drop entries — grouping is presentation, not filtering.

### Projects section

`projects` is optional and frequently absent, since many users are not in technical fields. When present, the same rules apply as to work bullets: outcome first, no invented metrics, no inflated language. When absent, omit the section entirely rather than generating a placeholder.

### PDF constraints

Output goes through `@react-pdf/renderer`, so the parser rules above are enforced at the template layer, not by the model: single column, no tables, standard headers, real text layer. The model's job is content; the template's job is parse-safety. Both need to hold.

### Where this most likely needs enforcement rather than instruction

Some of the guidance above is reliably followed when stated in a prompt. Some is not, and is better handled by validating the output before it reaches the PDF layer. Candidates for the second category, worth deciding at spec time:

- Em dash presence — trivially checkable, and models reintroduce them regardless of instruction
- Banned vocabulary — a string check against the avoid list is cheaper and more reliable than trusting the prompt
- Bullet length over two lines
- Numerals that do not trace to profile data, which is the mechanical proxy for an invented metric

### Validating numerals: two tiers, not one

A flat "every numeral in output must appear in source data" check fails on the numbers a resume most needs. "Three roles spanning four and a half years" is true and derivable, but neither figure appears literally anywhere in `profiles`. A naive string match flags it as fabricated.

Split the problem instead.

**Tier 1, literal pass-through.** Numbers stated directly in profile data: `years_experience`, percentages or dollar amounts inside a `work_experience` description, team sizes the user typed. Validate these by string match. Any Tier 1 numeral in output must trace to a numeral in source.

**Tier 2, derived.** Role counts from array length, tenure computed from start and end dates, total years summed across roles. Do not let the model derive these and then try to verify the result. Compute them in code before generation, inject them into the prompt as finished facts, and treat them as Tier 1 literals from that point on.

This closes two problems at once. The false positive disappears, because the model is restating a number rather than inventing one. And the arithmetic never runs inside the model, which matters because verifying a model's math after the fact is strictly worse than not asking it to do math. Tenure and count arithmetic belongs in deterministic backend code.

**Implementation note.** This means two allowlists at prompt-construction time, raw profile values and derived precomputed values, checked as one combined set at validation time. Write it as an explicit function rather than letting it stay implicit:

```
buildAllowedNumerals(profile) -> Set<string>
```

The failure mode this guards against is a later schema change adding a derived field that nobody remembers to register — the validator then rejects a correct number, or worse, someone loosens the check to make the error go away. One named function with one obvious place to add to is cheap insurance against that.

---

## Not covered here

Resume *review* — auditing an existing resume, flagging weak bullets, gap analysis against a job description — is out of scope for JobPilot per `context/project-overview.md`, alongside per-job tailoring and cover letter generation. Material for that exists in a personal `resume-architect` Claude skill maintained outside this repo, if the scope decision is ever revisited.