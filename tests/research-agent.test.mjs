import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("homepage url derivation follows the saved redirect, strips subdomains, and falls back to a company name guess (AC-5)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(source, /const redirectUrl = job\.external_apply_url \?\? job\.source_url;/);
  assert.match(source, /fetch\(redirectUrl, \{ redirect: "follow" \}\)/);
  assert.match(source, /if \(!finalUrl\.hostname\.includes\("adzuna\.com"\)\) \{/);
  assert.match(source, /return `https:\/\/\$\{stripSubdomain\(finalUrl\.hostname\)\}`;/);
  assert.match(source, /return `https:\/\/www\.\$\{slugifyCompanyName\(job\.company\)\}\.com`;/);
});

test("sub page selection is capped at 3 pages and prefers about/engineering/blog/product over careers (AC-6)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(source, /const MAX_SUB_PAGES = 3;/);
  assert.match(
    source,
    /const PREFERRED_LINK_KIND_ORDER = \["about", "engineering", "blog", "product", "team", "other", "careers"\];/,
  );
  assert.match(source, /return resolved\.slice\(0, MAX_SUB_PAGES\)\.map\(\(link\) => link\.url\);/);
});

test("the Stagehand session is always closed in a finally block, even when extraction throws (AC-6)", async () => {
  const source = await readProjectFile("agent/research.ts");

  const tryIndex = source.indexOf("let stagehand: Stagehand | null = null;");
  const finallyIndex = source.indexOf("} finally {", tryIndex);
  const closeIndex = source.indexOf("await stagehand.close();", finallyIndex);

  assert.notEqual(tryIndex, -1);
  assert.notEqual(finallyIndex, -1);
  assert.notEqual(closeIndex, -1);
  assert.ok(finallyIndex > tryIndex);
  assert.ok(closeIndex > finallyIndex);
});

test("thin homepage content bails out of browsing before any sub page is visited (AC-7)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(
    source,
    /if \(!homepage\.oneLiner\.trim\(\) && !homepage\.productSummary\.trim\(\)\) \{\s*return null;/,
  );
});

test("synthesis always runs even when browsing failed, and never fabricates research it didn't collect (AC-7)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(source, /export async function runCompanyResearch\(/);
  assert.match(source, /const research = await collectCompanyResearch\(homepageUrl\);/);
  assert.match(source, /return synthesizeDossier\(job, profile, research\);/);
  assert.match(
    source,
    /"No research could be collected from the company website\. Base the briefing on the job posting and candidate profile only, and say so in companyOverview\."/,
  );
});

test("dossier synthesis validates GPT-4o output against the nine field schema before returning success (AC-8)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(source, /model:\s*"gpt-4o"/);
  assert.match(source, /temperature:\s*0\.4/);
  assert.match(source, /response_format:\s*\{\s*type:\s*"json_object"\s*\}/);

  for (const field of [
    "companyOverview",
    "techStack",
    "culture",
    "whyThisRole",
    "yourEdge",
    "gapsToAddress",
    "smartQuestions",
    "interviewPrep",
    "sources",
  ]) {
    assert.match(source, new RegExp(`${field}:`));
  }

  assert.match(source, /satisfies z\.ZodType<CompanyResearchDossier>/);
  assert.match(
    source,
    /if \(!validated\.success\) \{\s*console\.error\("\[agent\/research\]", validated\.error\);\s*return \{ success: false, error: "Research returned an unexpected response\." \};/,
  );
});

test("research never invents facts, per its synthesis system prompt", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(
    source,
    /Never invent\s*\n\s*funding, customers, headcount, or facts\./,
  );
});

test("opens exactly one Browserbase session per request, constructed before any sub page is visited (AC-6)", async () => {
  const source = await readProjectFile("agent/research.ts");

  const stagehandConstructorMatches = source.match(/new Stagehand\(/g) ?? [];
  assert.equal(stagehandConstructorMatches.length, 1, "collectCompanyResearch must construct exactly one Stagehand session");

  const constructorIndex = source.indexOf("new Stagehand(");
  const subPageLoopIndex = source.indexOf("for (const subPageUrl of subPageUrls)");
  assert.notEqual(constructorIndex, -1);
  assert.notEqual(subPageLoopIndex, -1);
  assert.ok(constructorIndex < subPageLoopIndex, "the single session must exist before any sub page is visited");
});

test("a single sub page extraction failure is caught inside the loop and does not abort the remaining sub pages (AC-6)", async () => {
  const source = await readProjectFile("agent/research.ts");

  const loopIndex = source.indexOf("for (const subPageUrl of subPageUrls) {");
  const tryIndex = source.indexOf("try {", loopIndex);
  const pushIndex = source.indexOf("subPages.push(subPage);", tryIndex);
  const catchIndex = source.indexOf("} catch (error) {", pushIndex);
  const loggedErrorIndex = source.indexOf('console.error("[agent/research]", error);', catchIndex);

  assert.notEqual(loopIndex, -1);
  assert.notEqual(tryIndex, -1);
  assert.notEqual(pushIndex, -1);
  assert.notEqual(catchIndex, -1);
  assert.notEqual(loggedErrorIndex, -1);
  assert.ok(loopIndex < tryIndex && tryIndex < pushIndex && pushIndex < catchIndex && catchIndex < loggedErrorIndex);

  const returnIndex = source.indexOf("return { homepage, subPages };");
  assert.notEqual(returnIndex, -1);
  assert.ok(catchIndex < returnIndex, "a caught sub page failure must fall through to still returning the pages collected so far");
});

test("sub page selection dedupes repeated links and resolves relative urls against the homepage, skipping malformed ones (AC-6)", async () => {
  const source = await readProjectFile("agent/research.ts");

  assert.match(source, /const seen = new Set<string>\(\);/);
  assert.match(source, /new URL\(link\.url, homepageUrl\)\.toString\(\)/);
  assert.match(source, /if \(!seen\.has\(absoluteUrl\)\) \{/);
  assert.match(source, /\} catch \{\s*continue;\s*\}/);
});
