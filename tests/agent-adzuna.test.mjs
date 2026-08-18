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

test("a job only counts toward strongMatches at or above the documented 70 threshold", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(source, /import \{ MATCH_THRESHOLD \} from "@\/lib\/match-score";/);
  assert.match(
    source,
    /if \(\(match\.matchScore \?\? 0\) >= MATCH_THRESHOLD\) \{\s*strongMatches \+= 1;\s*\}/,
    "strongMatches must increment only when the score meets the shared threshold, and a null score must count as 0, not throw",
  );

  const matchScoreSource = await readProjectFile("lib/match-score.ts");
  assert.match(matchScoreSource, /export const MATCH_THRESHOLD = 70;/);

  const incrementIndex = source.indexOf("strongMatches += 1;");
  const jobsFoundIncrementIndex = source.indexOf("jobsFound += 1;");
  assert.ok(
    jobsFoundIncrementIndex < incrementIndex,
    "jobsFound must increment for every saved job regardless of score, before the threshold check narrows to strong matches",
  );
});

test("formatSalary returns null when Adzuna gives no salary_min, otherwise a rounded $Xk-$Yk range", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /function formatSalary\(job: AdzunaJob\): string \| null \{\s*if \(!job\.salary_min\) \{\s*return null;\s*\}/,
    "must return null outright when salary_min is missing, not a malformed range",
  );
  assert.match(
    source,
    /const min = Math\.round\(job\.salary_min \/ 1000\);/,
    "salary_min must be rounded to the nearest thousand",
  );
  assert.match(
    source,
    /const max = job\.salary_max \? Math\.round\(job\.salary_max \/ 1000\) : min;/,
    "salary_max must fall back to the same value as min when Adzuna doesn't provide a max",
  );
  assert.match(
    source,
    /return min === max \? `\$\$\{min\}k` : `\$\$\{min\}k - \$\$\{max\}k`;/,
    "a point estimate must render as one figure, not as a range from a number to itself",
  );
});

test("job_type falls back to fulltime when Adzuna omits contract_type", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(source, /job_type:\s*adzunaJob\.contract_type \|\| "fulltime",/);
});

test("a repeat search skips a job the user already has, checked by Adzuna's own id, before scoring or inserting it (dedupe fix)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.select\("external_id"\)\s*\.eq\("user_id", userId\)\s*\.in\(\s*"external_id",\s*adzunaJobs\.map\(\(job\) => job\.id\),\s*\)/,
    "must look up this user's already-saved external_ids scoped to the incoming Adzuna results before the scoring loop",
  );

  const dedupeLookupIndex = source.indexOf('.select("external_id")');
  const loopIndex = source.indexOf("for (const adzunaJob of adzunaJobs) {");
  const skipIndex = source.indexOf("if (existingExternalIds.has(adzunaJob.id)) {");
  const scoreCallIndex = source.indexOf("scoreJobMatch(");

  assert.ok(dedupeLookupIndex !== -1 && dedupeLookupIndex < loopIndex, "the dedupe lookup must run before the loop");
  assert.ok(
    skipIndex !== -1 && skipIndex > loopIndex && skipIndex < scoreCallIndex,
    "the duplicate check must skip a job before it reaches the scorer, not after",
  );
});

test("the dedupe check does not filter the Adzuna result list itself, preserving the unconditional per-job loop (dedupe fix)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.doesNotMatch(
    source,
    /adzunaJobs\.filter\(/,
    "duplicates must be skipped with an early continue inside the loop, not by filtering the array beforehand",
  );
});

test("every inserted job carries Adzuna's own id as external_id, the column the unique index and dedupe lookup both key on (dedupe fix)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(source, /external_id:\s*adzunaJob\.id,/);
});

test("an empty Adzuna result skips the dedupe lookup entirely rather than querying with an empty id list (dedupe fix)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /if \(adzunaJobs\.length > 0\) \{\s*const \{ data: existingRows, error: existingError \}/,
    "the dedupe lookup must be guarded by a non-empty check before running",
  );
});

// Content dedupe: Adzuna lists one opening under several ids, so external_id
// alone leaves visible duplicates. These mirror the external_id tests above.

test("the signature lookup selects every field the signature keys on, so a seeded row and a fresh one hash the same way (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /\.select\("company, title, location, salary"\)/,
    "omitting a field here would make every seeded signature differ from the one built in the loop, silently disabling the dedupe",
  );
  assert.match(
    source,
    /\.in\("company", \[\s*\.\.\.new Set\(adzunaJobs\.map\(\(job\) => job\.company\.display_name\)\),\s*\]\)/,
    "the seeding query must be scoped to the companies in this batch, not the user's whole history",
  );
});

test("the signature keys on location, so two cities are never merged into one job (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /jobSignature\(\s*adzunaJob\.company\.display_name,\s*adzunaJob\.title,\s*adzunaJob\.location\.display_name,\s*salary,\s*\)/,
    "dropping location here silently discards a real posting, which is worse than showing a duplicate",
  );
});

test("the signature skip runs before scoring, so a duplicate never costs a GPT-4o call (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  const loopIndex = source.indexOf("for (const adzunaJob of adzunaJobs) {");
  const skipIndex = source.indexOf("if (existingSignatures.has(signature)) {");
  const scoreCallIndex = source.indexOf("scoreJobMatch(");

  assert.ok(
    skipIndex !== -1 && skipIndex > loopIndex && skipIndex < scoreCallIndex,
    "the signature check must skip a job before it reaches the scorer, not after",
  );
});

test("a signature is recorded on insert, so duplicates inside one Adzuna response are caught too (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  const insertGuardIndex = source.indexOf("if (jobInsertError) {");
  const addIndex = source.indexOf("existingSignatures.add(signature);");
  const countIndex = source.indexOf("jobsFound += 1;");

  assert.ok(
    addIndex !== -1 && addIndex > insertGuardIndex,
    "the signature must be recorded only after a successful insert, so a failed insert does not block a later retry of the same job",
  );
  assert.ok(addIndex < countIndex, "record the signature alongside the count, before the loop moves on");
});

test("an empty Adzuna result skips the signature lookup too, not just the external_id one (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /if \(adzunaJobs\.length > 0\) \{\s*const \{ data: signatureRows, error: signatureError \}/,
    "the signature lookup must be guarded by a non-empty check before running",
  );
});

test("a failed signature lookup logs and continues rather than aborting the search (content dedupe)", async () => {
  const source = await readProjectFile("agent/adzuna.ts");

  assert.match(
    source,
    /if \(signatureError\) \{\s*console\.error\("\[agent\/adzuna\]", signatureError\);\s*\}/,
    "a dedupe lookup failure must fail open (duplicates shown) rather than failing the whole search",
  );
});
