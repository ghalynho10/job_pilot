import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatFoundAt,
  formatNullableText,
  isLikelyTruncatedDescription,
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

test("job details route rejects malformed ids before auth or database work (AC-2)", async () => {
  const source = await readProjectFile("app/find-jobs/[id]/page.tsx");

  const validationIndex = source.indexOf("if (!isValidUuid(id))");
  const serverClientIndex = source.indexOf("await createInsforgeServer()");
  const jobQueryIndex = source.indexOf('.from("jobs")');

  assert.notEqual(validationIndex, -1);
  assert.notEqual(serverClientIndex, -1);
  assert.notEqual(jobQueryIndex, -1);
  assert.ok(validationIndex < serverClientIndex);
  assert.ok(validationIndex < jobQueryIndex);
});

test("job details route keeps the existing authenticated shell and skip link (AC-11)", async () => {
  const source = await readProjectFile("app/find-jobs/[id]/page.tsx");

  assert.match(source, /<Navbar authenticated \/>/);
  assert.match(source, /href="#main-content"/);
  assert.match(source, /id="main-content"/);
  assert.match(source, /<JobDetailsPage job=\{job\} \/>/);
});

test("Find Jobs table links each role to the details route with keyboard focus styling (AC-3)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /import Link from "next\/link";/);
  assert.match(source, /href=\{`\/find-jobs\/\$\{job\.id\}`\}/);
  assert.match(source, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/);
});

test("Find Jobs reloads saved results for only the signed in user after search (AC-1, AC-3)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const reloadSectionStart = source.indexOf("const { data: freshJobs");
  assert.notEqual(reloadSectionStart, -1);
  const reloadSection = source.slice(reloadSectionStart, source.indexOf("setJobs", reloadSectionStart));

  assert.match(reloadSection, /\.from\("jobs"\)/);
  assert.match(reloadSection, /\.select\("\*"\)/);
  assert.match(reloadSection, /\.eq\("user_id", userId\)/);
  assert.match(reloadSection, /\.order\("found_at", \{ ascending: false \}\)/);
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
    "company_research_completed_at",
  ]) {
    assert.match(source, new RegExp(`${field}:`));
  }

  assert.match(source, /company_research: CompanyResearchDossier \| null;/);
  assert.match(source, /company_research_completed_at: string \| null;/);
  assert.doesNotMatch(source, /company_research: any/);
});

test("JobRow keeps nullable detail fields typed as nullable arrays or strings (AC-5 through AC-9)", async () => {
  const source = await readProjectFile("types/index.ts");

  for (const field of ["responsibilities", "requirements", "nice_to_have", "benefits"]) {
    assert.match(source, new RegExp(`${field}: string\\[\\] \\| null;`));
  }

  for (const field of ["external_apply_url", "source_url", "about_role", "about_company", "match_reason"]) {
    assert.match(source, new RegExp(`${field}: string \\| null;`));
  }

  assert.match(source, /match_score: number \| null;/);
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

test("external job url resolution rejects unsafe schemes and relative urls without hiding safe fallbacks (AC-4, AC-10)", () => {
  assert.equal(
    resolveExternalJobUrl({
      external_apply_url: "mailto:jobs@example.com",
      source_url: "https://adzuna.example/redirect?id=123",
    }),
    "https://adzuna.example/redirect?id=123",
  );
  assert.equal(
    resolveExternalJobUrl({
      external_apply_url: "/internal/jobs/123",
      source_url: "data:text/html,hello",
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

test("structured text list normalization ignores malformed legacy entries instead of throwing (AC-8)", () => {
  assert.deepEqual(
    normalizeStringList([" Build APIs ", 123, null, { value: "React" }, "", "Write tests"]),
    ["Build APIs", "Write tests"],
  );
  assert.deepEqual(normalizeStringList({ value: ["React"] }), []);
});

test("job description preview detection catches saved text that ends at the source preview boundary", () => {
  assert.equal(
    isLikelyTruncatedDescription(
      "This role is based out of the Boston office in t…",
    ),
    true,
  );
  assert.equal(isLikelyTruncatedDescription("This role is based out of the Boston office..."), true);
  assert.equal(isLikelyTruncatedDescription("This role is based out of the Boston office."), false);
  assert.equal(isLikelyTruncatedDescription(null), false);
});

test("uuid validation rejects malformed route ids before any database read (AC-2)", () => {
  assert.equal(isValidUuid("6f6d6c30-31ef-4f01-a0a1-17836e4d4db1"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid("javascript:alert(1)"), false);
});

test("uuid validation accepts valid variants and rejects ids that could alter routing or queries (AC-2)", () => {
  assert.equal(isValidUuid("6F6D6C30-31EF-4F01-A0A1-17836E4D4DB1"), true);
  assert.equal(isValidUuid("6f6d6c30-31ef-7f01-a0a1-17836e4d4db1"), false);
  assert.equal(isValidUuid("6f6d6c30-31ef-4f01-c0a1-17836e4d4db1"), false);
  assert.equal(isValidUuid("6f6d6c30-31ef-4f01-a0a1-17836e4d4db1/extra"), false);
  assert.equal(isValidUuid("' OR 1=1 --"), false);
});

test("job details components render required screenshot sections and the real research action (AC-4 through AC-13)", async () => {
  const pageSource = await readProjectFile("components/job-details/JobDetailsPage.tsx");
  const headerSource = await readProjectFile("components/job-details/JobHeader.tsx");
  const infoSource = await readProjectFile("components/job-details/JobInfoCards.tsx");
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
  assert.match(researchSource, /"use client";/);
  assert.match(researchSource, /fetch\("\/api\/agent\/research"/);
  assert.match(descriptionSource, /whitespace-pre-line/);
  assert.match(descriptionSource, /Read the full job post/);
  assert.match(infoSource, /break-words text-base font-semibold text-text-primary/);
  assert.doesNotMatch(infoSource, /truncate text-base font-semibold/);
});

test("job details page passes one safe external url to both external actions (AC-4, AC-10)", async () => {
  const source = await readProjectFile("components/job-details/JobDetailsPage.tsx");

  assert.match(source, /const externalJobUrl = resolveExternalJobUrl\(job\);/);
  assert.match(source, /<JobHeader externalJobUrl=\{externalJobUrl\} job=\{job\} \/>/);
  assert.match(source, /<JobActions company=\{job\.company\} externalJobUrl=\{externalJobUrl\} \/>/);
  assert.match(
    source,
    /<CompanyResearchCard company=\{job\.company\} dossier=\{job\.company_research\} jobId=\{job\.id\} \/>/,
  );
});

test("job details page normalizes saved row values before child components render them (AC-5 through AC-8)", async () => {
  const source = await readProjectFile("components/job-details/JobDetailsPage.tsx");

  assert.match(source, /foundAt=\{formatFoundAt\(job\.found_at\)\}/);
  assert.match(source, /jobType=\{formatNullableText\(job\.job_type\)\}/);
  assert.match(source, /location=\{formatNullableText\(job\.location\)\}/);
  assert.match(source, /salary=\{formatNullableText\(job\.salary\)\}/);
  assert.match(source, /matchedSkills=\{normalizeStringList\(job\.matched_skills\)\}/);
  assert.match(source, /missingSkills=\{normalizeStringList\(job\.missing_skills\)\}/);
  assert.match(source, /benefits=\{normalizeStringList\(job\.benefits\)\}/);
  assert.match(source, /externalJobUrl=\{externalJobUrl\}/);
  assert.match(source, /niceToHave=\{normalizeStringList\(job\.nice_to_have\)\}/);
  assert.match(source, /requirements=\{normalizeStringList\(job\.requirements\)\}/);
  assert.match(source, /responsibilities=\{normalizeStringList\(job\.responsibilities\)\}/);
});

test("job header renders safe link and unavailable states without broken anchors (AC-4, AC-10)", async () => {
  const source = await readProjectFile("components/job-details/JobHeader.tsx");

  assert.match(source, /job\.match_score === null \? "Match unavailable" : `\$\{job\.match_score\}% Match Score`/);
  assert.match(source, /externalJobUrl \? \(/);
  assert.match(source, /href=\{externalJobUrl\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /<button[\s\S]*disabled[\s\S]*View Job Post[\s\S]*<\/button>/);
});

test("job action button uses the same safe url and disables itself when no url exists (AC-10)", async () => {
  const source = await readProjectFile("components/job-details/JobActions.tsx");

  assert.match(source, /if \(!externalJobUrl\) \{/);
  assert.match(source, /Apply link unavailable/);
  assert.match(source, /disabled/);
  assert.match(source, /href=\{externalJobUrl\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /Apply Now at \{company\}/);
});

test("skills card renders clear matched and gap empty states (AC-7)", async () => {
  const skillsSource = await readProjectFile("components/job-details/SkillsCard.tsx");
  const groupSource = await readProjectFile("components/job-details/SkillGroup.tsx");

  assert.match(skillsSource, /label="You have"/);
  assert.match(skillsSource, /emptyText="No matched skills were saved for this job\."/);
  assert.match(skillsSource, /label="Gap skills"/);
  assert.match(skillsSource, /emptyText="No gap skills were saved for this job\."/);
  assert.match(groupSource, /skills\.length > 0 \? \(/);
  assert.match(groupSource, /<p className="mt-2 text-sm text-text-muted">\{emptyText\}<\/p>/);
});

test("job description card renders only saved plain text and non empty structured sections (AC-8)", async () => {
  const descriptionSource = await readProjectFile("components/job-details/JobDescriptionCard.tsx");
  const listSource = await readProjectFile("components/job-details/StructuredList.tsx");

  assert.match(descriptionSource, /const description = aboutRole\?\.trim\(\);/);
  assert.match(descriptionSource, /const companyText = aboutCompany\?\.trim\(\);/);
  assert.match(descriptionSource, /const isPreviewDescription = isLikelyTruncatedDescription\(description \?\? null\);/);
  assert.match(descriptionSource, /No job description was saved for this role\./);
  assert.match(descriptionSource, /This saved description ends where the job source preview stops\./);
  assert.match(descriptionSource, /href=\{externalJobUrl\}/);
  assert.match(descriptionSource, /target="_blank"/);
  assert.match(descriptionSource, /rel="noopener noreferrer"/);
  assert.match(descriptionSource, /<StructuredList label="Responsibilities" items=\{responsibilities\} \/>/);
  assert.match(descriptionSource, /<StructuredList label="Requirements" items=\{requirements\} \/>/);
  assert.match(descriptionSource, /<StructuredList label="Nice to have" items=\{niceToHave\} \/>/);
  assert.match(descriptionSource, /<StructuredList label="Benefits" items=\{benefits\} \/>/);
  assert.doesNotMatch(descriptionSource, /dangerouslySetInnerHTML/);
  assert.match(listSource, /if \(items\.length === 0\) \{\s*return null;/);
});

test("company research card shows the empty state, an enabled button, and no dossier rendering with no saved research (AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

  assert.match(source, /Research Company/);
  assert.match(source, /No research yet/);
  assert.match(source, /dossier \? null : \(/);
});

test("company research card blocks the button while loading and shows an inline error on failure, never a partial dossier (AC-7, AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

  assert.match(source, /disabled=\{status === "loading"\}/);
  assert.match(source, /Researching…/);
  assert.match(source, /if \(!result\.success\) \{\s*setStatus\("error"\);\s*setErrorMessage\(result\.error\);\s*return;/);
  assert.match(source, /Research failed/);
  assert.match(source, /role="alert"/);
});

test("company research card renders the saved dossier's nine fields directly with no button once research exists (AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

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
    assert.match(source, new RegExp(`dossier\\.${field}`));
  }
});

test("company research card refreshes the router on success instead of managing DB state itself (AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

  assert.match(source, /router\.refresh\(\);/);
  assert.doesNotMatch(source, /insforge/);
  assert.doesNotMatch(source, /\.database/);
  assert.doesNotMatch(source, /stagehand/i);
});

test("company research card posts the job's own id as the request body, not the whole job or dossier (AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

  assert.match(
    source,
    /fetch\("\/api\/agent\/research", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ jobId \}\),/,
  );
});

test("company research card shows a generic error if the fetch call itself rejects, not only when the API responds with success:false (AC-11)", async () => {
  const source = await readProjectFile("components/job-details/CompanyResearchCard.tsx");

  assert.match(
    source,
    /\} catch \{\s*setStatus\("error"\);\s*setErrorMessage\("Something went wrong researching this company\. Please try again\."\);\s*\}/,
  );
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
