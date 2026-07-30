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

  assert.match(source, /function fallbackSummary\(profile: Profile\): string \{/);
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
