import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("agent find route checks auth before reading anything, returning 401 when unauthenticated", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  assert.match(source, /insforge\.auth\.getCurrentUser\(\)/);
  const authCheckIndex = source.indexOf("if (authError || !authData.user) {");
  const bodyReadIndex = source.indexOf("await req.json()");

  assert.ok(authCheckIndex !== -1, "auth check not found");
  assert.ok(
    authCheckIndex < bodyReadIndex,
    "auth must be checked before the request body is even read",
  );
  assert.match(
    source.slice(authCheckIndex, authCheckIndex + 250),
    /status: 401/,
  );
});

test("a missing or blank jobTitle is rejected with 400 before any profile read", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  const validationIndex = source.indexOf('typeof jobTitle !== "string" || jobTitle.trim().length === 0');
  const profileReadIndex = source.indexOf('.from("profiles")');

  assert.ok(validationIndex !== -1, "jobTitle validation not found");
  assert.match(
    source.slice(validationIndex, validationIndex + 200),
    /status: 400/,
  );
  assert.ok(
    validationIndex < profileReadIndex,
    "jobTitle must be validated before the profile is loaded",
  );
});

test("a profile with no skills is rejected with 422 before the search runs", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  const skillsCheckIndex = source.indexOf("!profileRow.skills || profileRow.skills.length === 0");
  const runSearchIndex = source.indexOf("runJobSearch(");

  assert.ok(skillsCheckIndex !== -1, "skills presence check not found");
  assert.match(
    source.slice(skillsCheckIndex, skillsCheckIndex + 300),
    /status: 422/,
  );
  assert.ok(
    skillsCheckIndex < runSearchIndex,
    "the skills check must run before the search is ever started",
  );
});

test("a search failure returns a generic 500 built from the orchestrator's own error, not a leaked internal", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  assert.match(
    source,
    /if \(!result\.success\) \{\s*return NextResponse\.json\(\{ success: false, error: result\.error \}, \{ status: 500 \}\);\s*\}/,
  );
});

test("a successful search returns the jobsFound/strongMatches summary and the exact hardcoded message format", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  assert.match(
    source,
    /const message = `Found \$\{jobsFound\} jobs and saved \$\{strongMatches\} strong matches\.`;/,
  );
  assert.match(
    source,
    /return NextResponse\.json\(\{ success: true, jobsFound, strongMatches, message \}\);/,
  );
});

test("the route wraps its work in try/catch and logs with the route prefix", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  assert.match(source, /^\s*try \{/m);
  assert.match(source, /\} catch \(error\) \{/);
  assert.match(source, /console\.error\("\[api\/agent\/find\]", error\)/);
});
