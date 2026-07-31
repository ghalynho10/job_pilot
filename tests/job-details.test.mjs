import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatFoundAt,
  formatNullableText,
  isValidUuid,
  normalizeStringList,
  resolveExternalJobUrl,
} from "../lib/job-details.ts";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("job details route uses async params, redirects signed out users, and hides invalid or missing jobs (AC-1, AC-2)", async () => {
  const source = await readProjectFile("app/find-jobs/[id]/page.tsx");

  assert.match(source, /params: Promise<\{ id: string \}>/);
  assert.match(source, /const \{ id \} = await params;/);
  assert.match(source, /if \(!isValidUuid\(id\)\) \{\s*notFound\(\);/);
  assert.match(source, /redirect\("\/login\?error=session"\)/);
  assert.match(source, /if \(!jobRow\) \{\s*notFound\(\);/);
});

test("proxy sends direct signed out job detail visits to the session error login URL (AC-1)", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /function shouldShowSessionError\(request: NextRequest, hadSession: boolean, hasError: boolean\): boolean/);
  assert.match(source, /\^\\\/find-jobs\\\/\[\^\/]\+\$\//);
  assert.match(source, /shouldShowSessionError\(request, hadSession, Boolean\(error\)\)/);
});

test("job details route scopes the row read by id and user id, and throws real database errors (AC-1, AC-2)", async () => {
  const source = await readProjectFile("app/find-jobs/[id]/page.tsx");

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.select\("\*"\)\s*\.eq\("id", id\)\s*\.eq\("user_id", data\.user\.id\)\s*\.maybeSingle\(\)/,
  );
  assert.match(source, /if \(jobError\) \{\s*throw new Error\("Job details could not be loaded\."\);/);
});

test("Find Jobs table links each role to the details route with keyboard focus styling (AC-3)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /import Link from "next\/link";/);
  assert.match(source, /href=\{`\/find-jobs\/\$\{job\.id\}`\}/);
  assert.match(source, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/);
});

test("JobRow includes every field the details page reads without any typed as any", async () => {
  const source = await readProjectFile("types/index.ts");

  for (const field of [
    "user_id",
    "responsibilities",
    "requirements",
    "nice_to_have",
    "benefits",
    "about_company",
    "company_research",
  ]) {
    assert.match(source, new RegExp(`${field}:`));
  }

  assert.match(source, /company_research: Record<string, unknown> \| null;/);
  assert.doesNotMatch(source, /company_research: any/);
});

test("external job url resolution accepts only http and https, preferring external_apply_url (AC-4, AC-10)", () => {
  assert.equal(
    resolveExternalJobUrl({
      external_apply_url: "https://company.example/jobs/123",
      source_url: "https://adzuna.example/redirect",
    }),
    "https://company.example/jobs/123",
  );
  assert.equal(
    resolveExternalJobUrl({
      external_apply_url: "javascript:alert(1)",
      source_url: "http://adzuna.example/redirect",
    }),
    "http://adzuna.example/redirect",
  );
  assert.equal(
    resolveExternalJobUrl({
      external_apply_url: "notaurl",
      source_url: "ftp://adzuna.example/redirect",
    }),
    null,
  );
});

test("job details helpers normalize nullable display values and structured text arrays (AC-5, AC-7, AC-8)", () => {
  assert.equal(formatNullableText("  Remote  "), "Remote");
  assert.equal(formatNullableText("  "), "—");
  assert.equal(formatNullableText(null, "Unavailable"), "Unavailable");
  assert.deepEqual(normalizeStringList([" React ", "", "TypeScript"]), ["React", "TypeScript"]);
  assert.deepEqual(normalizeStringList(null), []);
  assert.equal(formatFoundAt("not a date"), "—");
});

test("uuid validation rejects malformed route ids before any database read (AC-2)", () => {
  assert.equal(isValidUuid("6f6d6c30-31ef-4f01-a0a1-17836e4d4db1"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid("javascript:alert(1)"), false);
});

test("job details components render required screenshot sections and disabled research behavior (AC-4 through AC-11)", async () => {
  const pageSource = await readProjectFile("components/job-details/JobDetailsPage.tsx");
  const headerSource = await readProjectFile("components/job-details/JobHeader.tsx");
  const researchSource = await readProjectFile("components/job-details/CompanyResearchCard.tsx");
  const actionsSource = await readProjectFile("components/job-details/JobActions.tsx");
  const descriptionSource = await readProjectFile("components/job-details/JobDescriptionCard.tsx");

  assert.match(pageSource, /Back to Jobs/);
  assert.match(pageSource, /<JobInfoCards/);
  assert.match(pageSource, /<MatchReasoningCard/);
  assert.match(pageSource, /<SkillsCard/);
  assert.match(pageSource, /<JobDescriptionCard/);
  assert.match(pageSource, /<CompanyResearchCard/);
  assert.match(pageSource, /<JobActions/);
  assert.match(headerSource, /View Job Post/);
  assert.match(actionsSource, /Apply Now at \{company\}/);
  assert.match(actionsSource, /rel="noopener noreferrer"/);
  assert.match(researchSource, /disabled/);
  assert.match(researchSource, /Company research for \{company\} arrives in the next feature\./);
  assert.doesNotMatch(researchSource, /fetch\("/);
  assert.doesNotMatch(researchSource, /\/api\/agent\/research/);
  assert.match(descriptionSource, /whitespace-pre-line/);
});

test("job details files use token classes, not hardcoded hex colors or raw Tailwind color classes (AC-11)", async () => {
  const files = [
    "app/find-jobs/[id]/page.tsx",
    "components/job-details/JobActions.tsx",
    "components/job-details/JobDescriptionCard.tsx",
    "components/job-details/JobDetailsPage.tsx",
    "components/job-details/JobHeader.tsx",
    "components/job-details/JobInfoCards.tsx",
    "components/job-details/CompanyResearchCard.tsx",
    "components/job-details/MatchReasoningCard.tsx",
    "components/job-details/SkillGroup.tsx",
    "components/job-details/SkillsCard.tsx",
    "components/job-details/StructuredList.tsx",
    "lib/job-details.ts",
  ];

  const rawTailwindColorPattern =
    /\b(?:bg|text|border|from|to|via|ring|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

  for (const file of files) {
    const source = await readProjectFile(file);
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/, `${file} must not use hardcoded hex colors`);
    assert.doesNotMatch(source, rawTailwindColorPattern, `${file} must not use raw Tailwind color classes`);
  }
});
