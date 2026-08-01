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

### Action verbs

Vary them so bullets do not all sound alike:

- **Built:** architected, engineered, shipped, implemented, developed, prototyped
- **Improved:** optimized, reduced, accelerated, streamlined, refactored, hardened
- **Led:** spearheaded, drove, coordinated, mentored, owned
- **Analyzed:** diagnosed, modeled, evaluated, benchmarked, investigated
- **Scaled:** migrated, automated, deployed, integrated, consolidated

Never generate: "responsible for", "helped with", "worked on", "assisted in", "participated in". These describe presence, not contribution.

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
4. Name a study/building period filling an employment gap — an unexplained gap reads worse than a dated entry describing deliberate investment.

---

## Part 2 — Generating from profile data

JobPilot generates a resume from `profiles` table data, not from an existing document. That changes several things.

### Available inputs

Generation draws on: `full_name`, `email`, `phone`, `location`, `current_title`, `experience_level`, `years_experience`, `skills[]`, `industries[]`, `work_experience` (jsonb, up to 3 roles), `education` (jsonb), `linkedin_url`, `portfolio_url`, `work_authorization`.

Note the ceiling of three roles — generated output is structurally bounded to a short history, which suits the one-page target but means role selection matters when a user has more.

### Never invent

The single most important constraint. The model must not fabricate metrics, tools, employers, dates, or achievements not present in profile data. A resume inflated at generation time collapses in the interview, and the user may not notice the fabrication before sending it.

When a role's description lacks quantification, the correct output is a strong unquantified bullet — not an invented percentage. Prefer scale and scope drawn from real data ("across a 12-person team") over fabricated improvement figures.

### Handling sparse profiles

Profiles will often be thin — a title, a few skills, no detailed accomplishments. Generation must degrade gracefully rather than padding.

- Thin `work_experience` → fewer, honest bullets, not invented ones
- Missing summary material → derive from `current_title`, `years_experience`, and top `skills[]` rather than generic filler ("results-driven professional")
- No projects → omit the section rather than emitting an empty header

A short honest resume outperforms a padded one, and padding is the failure mode a generative system falls into by default.

### Mapping seniority

`experience_level` and `years_experience` should drive bullet altitude per the calibration above, and drive section ordering (Projects-first for early career). This mapping is currently implicit and is the clearest candidate for explicit prompt instruction.

### Skills section

`skills[]` is user-entered and often unordered and over-inclusive. Generation should group into conventional categories (Languages / Frameworks / Tools) rather than emitting a flat list, and should not silently drop entries — grouping is presentation, not filtering.

### PDF constraints

Output goes through `@react-pdf/renderer`, so the parser rules above are enforced at the template layer, not by the model: single column, no tables, standard headers, real text layer. The model's job is content; the template's job is parse-safety. Both need to hold.

---

## Not covered here

Resume *review* — auditing an existing resume, flagging weak bullets, gap analysis against a job description — is out of scope for JobPilot per `context/project-overview.md`, alongside per-job tailoring and cover letter generation. Material for that exists in a personal `resume-architect` Claude skill maintained outside this repo, if the scope decision is ever revisited.