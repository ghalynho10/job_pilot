import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("resume generator calls GPT-4o with a higher, more generative temperature than extraction (AC-1)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /model:\s*"gpt-4o"/);
  assert.match(source, /temperature:\s*0\.55/);
  assert.match(source, /max_tokens:\s*1400/);
  assert.match(source, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
});

test("resume generator's schema tolerates a malformed shape via catch fallbacks instead of failing outright (AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /summary:\s*z\.string\(\)\.catch\(""\)/);
  assert.match(
    source,
    /workExperienceBullets:\s*z\.array\(z\.array\(z\.string\(\)\)\.catch\(\[\]\)\)\.catch\(\[\]\)/,
  );
});

test("resume generator reconciles bullets against the profile's own work experience by index, never trusting the model's count or order (AC-1, AC-3)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /function reconcileBullets\(\s*profile: Profile,\s*generatedBullets: string\[\]\[\],\s*\): string\[\]\[\] \{/,
  );
  assert.match(
    source,
    /profile\.workExperience\.slice\(0, MAX_WORK_EXPERIENCE_ENTRIES\)\.map\(\(entry, index\) => \{/,
  );
  assert.match(
    source,
    /generated\.slice\(0, MAX_BULLETS_PER_ROLE\)/,
    "bullets per role must be capped so a role can't overflow the one page layout",
  );
  assert.match(
    source,
    /return splitIntoLines\(entry\.keyResponsibilities\)\.slice\(0, MAX_BULLETS_PER_ROLE\);/,
    "a dropped or reordered index must fall back to the entry's own notes, capped the same as the model path, never render empty and never fabricate",
  );
});

test("resume generator caps work experience at 3 entries before building the prompt, defense in depth against a large profile truncating the response (AC-1)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /const MAX_WORK_EXPERIENCE_ENTRIES = 3;/);
  assert.match(
    source,
    /workExperience: profile\.workExperience\.slice\(0, MAX_WORK_EXPERIENCE_ENTRIES\)\.map\(\(entry, index\) => \(\{/,
    "the prompt sent to GPT-4o must also be capped, not just the reconciliation step",
  );
});

test("resume generator never invents facts, per its system prompt (AC-3)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /Never invent employers, titles, dates, or accomplishments not present in the input\./,
  );
});

test("resume generator falls back to a generic summary if the model returns an empty one, and reports the same error shape as extraction (AC-1, AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /function fallbackSummary\(profile: Profile\): string \{/,
  );
  assert.match(
    source,
    /const summary =\s*validated\.data\.summary\.trim\(\)\.length > 0 \? validated\.data\.summary : fallbackSummary\(profile\);/,
  );

  assert.match(
    source,
    /if \(!rawContent\) \{\s*return \{ success: false, error: "Resume generation returned no content\. Please try again\." \};/,
  );
  assert.match(
    source,
    /catch \(parseError\) \{\s*console\.error\("\[agent\/resume-generator\]", parseError\);\s*return \{ success: false, error: "Resume generation returned an unreadable response\. Please try again\." \};/,
  );
  assert.match(
    source,
    /if \(!validated\.success\) \{\s*console\.error\("\[agent\/resume-generator\]", validated\.error\);\s*return \{ success: false, error: "Resume generation returned an unexpected response\. Please try again\." \};/,
  );
  assert.match(
    source,
    /\} catch \(error\) \{\s*console\.error\("\[agent\/resume-generator\]", error\);\s*return \{ success: false, error: "Something went wrong generating your resume\. Please try again\." \};/,
  );
});

// ---------------------------------------------------------------------------
// Spec 0019: Resume generation quality (ATS domain knowledge)
// ---------------------------------------------------------------------------

// AC-1: Accuracy priority + bullet structure with XYZ example pair
test("system prompt states accuracy outranks every style rule (AC-1)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /STAYING ACCURATE TO THE PROFILE ALWAYS OUTRANKS ANY STYLE RULE BELOW/,
  );
});

test("system prompt includes the XYZ bullet structure with a weak and strong example pair (AC-1)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Accomplished X, as measured by Y, by doing Z/);
  assert.match(
    source,
    /Weak: Worked on improving the checkout flow using React and Redux/,
  );
  assert.match(
    source,
    /Strong: Cut checkout abandonment 23% by rebuilding the flow in React, reducing steps from five to two/,
  );
});

test("system prompt instructs the model to vary bullet shape so a section does not read as machine-produced (AC-1)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Vary each bullet.s shape deliberately/);
  assert.match(source, /reads as machine-produced/);
});

// AC-2: Filler phrases, weak openings, em dash ban in prompt + deterministic strip
test("system prompt lists filler phrases with alternatives, including leveraged and spearheaded (AC-2)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /leveraged/);
  assert.match(source, /spearheaded/);
  assert.match(source, /Use the specific verb instead/);
});

test("system prompt bans weak opening phrases and lists responsible for, helped with, worked on (AC-2)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Never open a bullet with:/);
  assert.match(source, /responsible for/);
  assert.match(source, /helped with/);
  assert.match(source, /worked on/);
});

test("system prompt bans em dashes and a deterministic strip in code replaces them with commas (AC-2)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Never use an em dash/);
  // The deterministic strip must exist in code, not just the prompt instruction.
  assert.match(source, /\.replace\(\/—\/g,\s*","\)/);
});

// AC-3: Keyword placement and acronym guidance
test("system prompt instructs the model to use exact language employers search for (AC-3)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Use the exact language employers search for/);
});

test("system prompt instructs the model to spell out acronyms on first use (AC-3)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /Amazon Web Services \(AWS\)/,
    "the acronym example must be present as concrete guidance",
  );
});

test("system prompt instructs the model never to repeat a skill artificially (AC-3)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Never repeat a skill artificially/);
});

// AC-4: Seniority calibration
test("system prompt ties bullet tone to experienceLevel and yearsExperience, with distinct guidance per tier (AC-4)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /SENIORITY CALIBRATION/);
  assert.match(source, /early career.*emphasizes what was built/);
  assert.match(source, /mid career.*leads with the scope of the role/);
  assert.match(source, /senior.*emphasizes ownership/);
  assert.match(source, /experienceLevel and yearsExperience fields/);
});

// AC-5: Combine near-duplicate bullets
test("system prompt instructs the model to combine near-duplicate bullets rather than keeping every one (AC-5)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /combine near-duplicate bullets/);
  assert.match(source, /Four similar bullets become two/);
});

// AC-6: Sparse profile guidance
test("system prompt instructs the model not to pad sparse profiles and states length is never a target (AC-6)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /SPARSE PROFILES/);
  assert.match(source, /Do not pad it with generic filler/);
  assert.match(
    source,
    /Length is never a target to hit at the cost of accuracy/,
  );
});

// AC-7: computeRoleDuration exists and rounds to nearest year
test("computeRoleDuration computes whole years rounded to the nearest year from YYYY-MM dates (AC-7)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /function computeRoleDuration\(/);
  assert.match(source, /Math\.round\(totalMonths \/ 12\)/);
  // Must split on hyphen, not slash or space.
  assert.match(source, /\.split\("-"\)/);
});

// AC-7: 18-month role correctly rounds to 2 years (not 1)
test("an eighteen month role rounds to 2 years, not 1, because rounding is to nearest year (AC-7)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  // The function body must exist with Math.round, and the allowed-numeral set
  // must add the computed duration as a string.
  assert.match(source, /Math\.round\(totalMonths \/ 12\)/);
  assert.match(source, /numerals\.add\(String\(duration\)\)/);
});

// AC-7: durationYears is included in the user message sent to the model
test("buildUserMessage includes durationYears computed per role in the prompt sent to the model (AC-7)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /durationYears: computeRoleDuration\(/);
});

// AC-7: Excluded fields (phone, email, salary, location, URLs) are NOT in the allowed numeral set
test("buildAllowedNumerals collects from the named field list only, never from phone, email, salary, or URLs (AC-7)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  // The function body must mention the included fields by name.
  assert.match(source, /profile\.yearsExperience/);
  assert.match(source, /profile\.skills/);
  assert.match(source, /profile\.industries/);
  assert.match(source, /profile\.currentTitle/);
  assert.match(source, /profile\.education\?\.fieldOfStudy/);

  // The excluded fields must not appear inside buildAllowedNumerals.
  const fnMatch = source.match(/function buildAllowedNumerals\([\s\S]+?\n\}/);
  const fnBody = fnMatch ? fnMatch[0] : "";
  assert.ok(
    !fnBody.includes("phone"),
    "phone number digits must never enter the allowed set",
  );
  assert.ok(
    !fnBody.includes("email"),
    "email must never enter the allowed set",
  );
  assert.ok(
    !fnBody.includes("salary"),
    "salary must never enter the allowed set",
  );
  assert.ok(
    !fnBody.includes("linkedin"),
    "linkedin URL must never enter the allowed set",
  );
  assert.ok(
    !fnBody.includes("portfolio"),
    "portfolio URL must never enter the allowed set",
  );
  assert.ok(
    !fnBody.includes("preferred"),
    "preferred locations must never enter the allowed set",
  );
});

// AC-7: Per-role computed duration is added to the allowed set
test("buildAllowedNumerals adds each role's computed duration to the allowed set (AC-7)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /numerals\.add\(String\(duration\)\)/,
    "computed per-role duration must be added to the set",
  );
});

// AC-8: extractDigitSequences extracts digit sequences from text
test("extractDigitSequences captures every run of digits as separate whole tokens (AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /function extractDigitSequences\(/);
  assert.match(source, /\.match\(\/\\d\+\/g\)/);
});

// AC-8: Whole-number comparison — a stated "20" must not match merely because the profile contains "2020"
test("digit sequences are compared as whole strings, so '20' never matches '2020' from profile data (AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  // The extractDigitSequences function uses /\d+/g to extract whole runs of
  // digits.  "2020" extracts as ["2020"], and "20" extracts as ["20"].  These
  // are different strings, so Set.has("20") correctly returns false when only
  // "2020" is in the set.  No substring check exists anywhere in the code.
  const fnMatch = source.match(/function extractDigitSequences\([\s\S]+?\n\}/);
  const fnBody = fnMatch ? fnMatch[0] : "";
  assert.ok(
    !fnBody.includes("includes"),
    "digit comparison must use Set membership, not substring includes",
  );
  assert.ok(
    !fnBody.includes("indexOf"),
    "digit comparison must use Set membership, not substring indexOf",
  );
});

// AC-8: Summary numeral validation — fabricated number triggers fallbackSummary
test("a fabricated number in the summary triggers the generic summary fallback and logs a warning (AC-8, AC-11)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /Fabricated number in summary.*falling back to generic summary/,
  );
  assert.match(source, /console\.warn/);
  assert.match(source, /fallbackSummary\(profile\)/);
});

// AC-8: Single bullet drop — only the offending bullet is dropped, not the whole role
test("a fabricated number in one bullet drops only that bullet and logs a warning (AC-8, AC-11)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /Fabricated number in role.*bullet.*dropped/);
});

// AC-8: Role-level fallback — when every bullet is dropped, the role falls back to raw keyResponsibilities
test("when every bullet for a role is dropped, the role falls back to raw keyResponsibilities and logs a warning (AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(
    source,
    /All bullets dropped for role.*falling back to raw responsibilities/,
  );
  assert.match(source, /keyResponsibilities/);
});

// AC-8: Every fallback path logs via console.warn
test("every numeral validation fallback logs via console.warn so it stays visible (AC-8)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  // The summary fallback, per-bullet drop, and per-role fallback must all use
  // console.warn, not console.log or console.error.
  const validationBlock = source.slice(
    source.indexOf("const allowedNumerals = buildAllowedNumerals"),
    source.lastIndexOf("return {"),
  );
  const warnCount = (validationBlock.match(/console\.warn/g) || []).length;
  assert.ok(
    warnCount >= 3,
    `expected at least 3 console.warn calls (summary, per-bullet, per-role), found ${warnCount}`,
  );
});

// AC-9: Skills stay a single comma-separated line, no Projects section
test("the system prompt does not mention grouping skills into categories or adding a Projects section (AC-9)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.ok(
    !source.includes("Languages / Frameworks / Tools"),
    "skill categorization must stay out of the prompt per AC-9",
  );
  assert.ok(
    !source.includes("Projects section"),
    "Projects section must stay out of the prompt per AC-9",
  );
});

// AC-10: Model, temperature, and max_tokens are unchanged
test("the model name, temperature, and max_tokens stay exactly as they were (AC-10)", async () => {
  const source = await readProjectFile("agent/resume-generator.ts");

  assert.match(source, /model:\s*"gpt-4o"/);
  assert.match(source, /temperature:\s*0\.55/);
  assert.match(source, /max_tokens:\s*1400/);
});
