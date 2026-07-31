import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("research route requires a signed in session before any database or agent work (AC-1)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  const authIndex = source.indexOf("insforge.auth.getCurrentUser()");
  const jobQueryIndex = source.indexOf('.from("jobs")');
  assert.notEqual(authIndex, -1);
  assert.notEqual(jobQueryIndex, -1);
  assert.ok(authIndex < jobQueryIndex, "auth must be checked before the job row is read");

  assert.match(
    source,
    /if \(authError \|\| !authData\.user\) \{\s*return NextResponse\.json\(\s*\{ success: false, error: "You must be signed in to research a company\." \},\s*\{ status: 401 \},/,
  );
});

test("research route rejects a missing or malformed jobId before any database read (AC-2)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  const validationIndex = source.indexOf('typeof jobId !== "string"');
  const jobQueryIndex = source.indexOf('.from("jobs")');
  assert.notEqual(validationIndex, -1);
  assert.ok(validationIndex < jobQueryIndex);

  assert.match(
    source,
    /if \(typeof jobId !== "string" \|\| jobId\.trim\(\)\.length === 0\) \{\s*return NextResponse\.json\(\s*\{ success: false, error: "A valid job is required to run research\." \},\s*\{ status: 400 \},/,
  );
});

test("research route scopes the job read by both id and user id, matching the job details read pattern (AC-3)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.select\("\*"\)\s*\.eq\("id", jobId\)\s*\.eq\("user_id", userId\)\s*\.maybeSingle\(\)/,
  );
});

test("research route falls back to an empty profile instead of crashing when no profile row exists (AC-4)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(
    source,
    /const profile = profileRow\s*\? mapProfileRowToProfile\(profileRow as ProfileRow\)\s*: buildEmptyProfile\(authData\.user\.email\);/,
  );
});

test("research route writes company_research and company_research_completed_at together, scoped to id and user id (AC-9)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.update\(\{ company_research: result\.data, company_research_completed_at: completedAt \}\)\s*\.eq\("id", jobId\)\s*\.eq\("user_id", userId\)/,
  );
});

test("research route fires company_researched with the documented properties and shuts down PostHog (AC-9)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(
    source,
    /event: "company_researched",\s*properties: \{ userId, jobId, company: job\.company \}/,
  );
  assert.match(source, /await posthog\.shutdown\(\);/);
});

test("research route only writes and fires the event after a successful agent result, and revalidates the details page (AC-9)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  const resultIndex = source.indexOf("const result = await runCompanyResearch(job, profile);");
  const failureIndex = source.indexOf("if (!result.success)");
  const updateIndex = source.indexOf('.update({ company_research');
  const captureIndex = source.indexOf('event: "company_researched"');
  const revalidateIndex = source.indexOf("revalidatePath(`/find-jobs/${jobId}`);");

  assert.notEqual(resultIndex, -1);
  assert.notEqual(failureIndex, -1);
  assert.notEqual(updateIndex, -1);
  assert.notEqual(captureIndex, -1);
  assert.notEqual(revalidateIndex, -1);
  assert.ok(resultIndex < failureIndex);
  assert.ok(failureIndex < updateIndex);
  assert.ok(updateIndex < captureIndex);
  assert.ok(captureIndex < revalidateIndex);
});

test("research route revalidates the specific job's own resolved path, not the bare dynamic segment literal Next.js silently no-ops on (AC-9)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(source, /revalidatePath\(`\/find-jobs\/\$\{jobId\}`\);/);
  assert.doesNotMatch(source, /revalidatePath\("\/find-jobs\/\[id\]"\)/);
});

test("research route never exposes raw errors and always returns the shared ActionResult shape (AC-1 through AC-9)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  assert.match(source, /ActionResult<\{ data: CompanyResearchDossier \}>/);
  assert.match(
    source,
    /\} catch \(error\) \{\s*console\.error\("\[api\/agent\/research\]", error\);\s*return NextResponse\.json\(\s*\{ success: false, error: "Something went wrong researching this company\. Please try again\." \},\s*\{ status: 500 \},/,
  );
});
