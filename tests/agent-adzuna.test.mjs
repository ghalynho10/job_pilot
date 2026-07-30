import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("runJobSearch creates an agent_runs row with status running before calling Adzuna", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  const insertIndex = source.indexOf('.from("agent_runs")\n    .insert([');
  const searchIndex = source.indexOf("searchJobs(jobTitle, location, country)");

  assert.ok(insertIndex !== -1, "agent_runs insert not found");
  assert.match(source, /status:\s*"running"/);
  assert.ok(
    insertIndex < searchIndex,
    "the agent_runs row must be created before the Adzuna call, not after",
  );
});

test("an Adzuna failure marks the run failed and returns a generic error, without ever scoring or saving a job", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  const catchBlockMatch = source.match(
    /catch \(error\) \{\s*console\.error\("\[agent\/adzuna\]", error\);\s*await insforge\.database\s*\.from\("agent_runs"\)\s*\.update\(\{ status: "failed", completed_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("id", runId\);\s*return \{ success: false, error: "Something went wrong searching for jobs\. Please try again\." \};\s*\}/,
  );
  assert.ok(catchBlockMatch, "Adzuna failure path must mark the run failed with completed_at and return a generic error");
});

test("every job Adzuna returns is saved, scoring never filters a result out before the insert", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /for \(const adzunaJob of adzunaJobs\) \{/,
    "must loop every returned job unconditionally, no score based filtering before this loop",
  );
  assert.doesNotMatch(
    source,
    /adzunaJobs\.filter\(/,
    "the Adzuna result list must never be filtered before saving",
  );
});

test("jobs.source is always search, and run_id ties every inserted job back to this run", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(source, /source:\s*"search"/);
  assert.match(source, /run_id:\s*runId/);
});

test("a per-job scoring failure still saves the job with a null match score, instead of dropping it", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /const match = scoreResult\.success\s*\? scoreResult\.data\s*: \{ matchScore: null, matchReason: null, matchedSkills: null, missingSkills: null \};/,
  );
});

test("agent_runs is updated to completed with the real jobs_found count after the loop finishes", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(source, /status:\s*"completed"/);
  assert.match(source, /jobs_found:\s*jobsFound/);
});

test("job_found fires once per saved job with the exact documented props, and PostHog is shut down once after the loop", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /event:\s*"job_found",\s*properties:\s*\{\s*userId,\s*source:\s*"search",\s*matchScore:\s*match\.matchScore\s*\},/,
  );

  const captureCount = (source.match(/posthog\.capture\(/g) ?? []).length;
  const shutdownCount = (source.match(/await posthog\.shutdown\(\);/g) ?? []).length;
  assert.equal(captureCount, 1, "job_found capture call site must appear exactly once, inside the loop");
  assert.equal(shutdownCount, 1, "shutdown must be called exactly once, after the loop, not per event");
});
