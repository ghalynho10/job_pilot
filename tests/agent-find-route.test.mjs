import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("agent find route guards on auth and approval before reading anything, and the kill switch applies", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  const guardIndex = source.indexOf("await guardPaidRoute({ requireAgentSwitch: true })");
  const bodyReadIndex = source.indexOf("await req.json()");

  assert.ok(guardIndex !== -1, "guardPaidRoute not called with requireAgentSwitch: true");
  assert.ok(
    guardIndex < bodyReadIndex,
    "the guard must run before the request body is even read",
  );
  assert.match(
    source.slice(guardIndex, guardIndex + 200),
    /if \(!guard\.ok\) \{\s*return guard\.response;/,
    "a denied guard must short circuit the route",
  );
});

test("agent find route denies before parsing, so a bad body from an unapproved caller is 403 and never 400", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  const guardIndex = source.indexOf("guardPaidRoute");
  const validationIndex = source.indexOf('typeof jobTitle !== "string"');
  const profileReadIndex = source.indexOf('.from("profiles")');

  assert.ok(
    guardIndex < validationIndex && guardIndex < profileReadIndex,
    "the guard must sit above body validation and every database read",
  );
  assert.ok(
    !source.includes("insforge.auth.getCurrentUser()"),
    "the route must not keep its own hand rolled auth block alongside the guard",
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
