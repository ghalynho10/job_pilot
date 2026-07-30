import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("matcher calls GPT-4o at the documented matching/scoring temperature and token budget", async () => {
  const source = await readProjectFile("agent/matcher.ts");

  assert.match(source, /model:\s*"gpt-4o"/);
  assert.match(source, /temperature:\s*0\.3/);
  assert.match(source, /max_tokens:\s*300/);
  assert.match(source, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);
});

test("matcher's schema tolerates a malformed model response via catch fallbacks instead of failing outright", async () => {
  const source = await readProjectFile("agent/matcher.ts");

  assert.match(source, /matchScore:\s*z\.number\(\)\.catch\(0\)/);
  assert.match(source, /matchReason:\s*z\.string\(\)\.catch\(""\)/);
  assert.match(source, /matchedSkills:\s*z\.array\(z\.string\(\)\)\.catch\(\[\]\)/);
  assert.match(source, /missingSkills:\s*z\.array\(z\.string\(\)\)\.catch\(\[\]\)/);
});

test("matcher never invents a skill or requirement, per its system prompt", async () => {
  const source = await readProjectFile("agent/matcher.ts");

  assert.match(
    source,
    /Never invent a skill, requirement, or fact not present in the profile or the job description\./,
  );
});

test("matcher reports the same discriminated success/failure shape as the resume agents on every failure path", async () => {
  const source = await readProjectFile("agent/matcher.ts");

  assert.match(
    source,
    /if \(!rawContent\) \{\s*return \{ success: false, error: "Matching returned no content\." \};/,
  );
  assert.match(
    source,
    /catch \(parseError\) \{\s*console\.error\("\[agent\/matcher\]", parseError\);\s*return \{ success: false, error: "Matching returned an unreadable response\." \};/,
  );
  assert.match(
    source,
    /if \(!validated\.success\) \{\s*console\.error\("\[agent\/matcher\]", validated\.error\);\s*return \{ success: false, error: "Matching returned an unexpected response\." \};/,
  );
  assert.match(
    source,
    /\} catch \(error\) \{\s*console\.error\("\[agent\/matcher\]", error\);\s*return \{ success: false, error: "Something went wrong scoring this job\." \};/,
  );
});
