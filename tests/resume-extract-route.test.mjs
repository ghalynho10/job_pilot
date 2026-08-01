import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("resume extract route imports pdf-parse/worker before pdf-parse itself, and next.config declares pdf-parse external", async () => {
  const routeSource = await readProjectFile("app/api/resume/extract/route.ts");
  const configSource = await readProjectFile("next.config.ts");

  const workerImportIndex = routeSource.indexOf('import "pdf-parse/worker";');
  const parseImportIndex = routeSource.indexOf('import { PDFParse } from "pdf-parse";');

  assert.ok(
    workerImportIndex !== -1,
    'must import "pdf-parse/worker" or pdfjs-dist fails with "Setting up fake worker failed" under Next.js\'s server bundler',
  );
  assert.ok(parseImportIndex !== -1, "PDFParse import not found");
  assert.ok(
    workerImportIndex < parseImportIndex,
    "pdf-parse/worker must be imported before pdf-parse so the worker module is registered first",
  );

  assert.match(
    configSource,
    /serverExternalPackages:\s*\[[^\]]*"pdf-parse"[^\]]*\]/,
    "next.config.ts must list pdf-parse in serverExternalPackages so it runs as a real dependency, not bundled",
  );
});

test("resume extract route guards on auth and approval before reading anything", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  const guardIndex = source.indexOf("await guardPaidRoute({ requireAgentSwitch: false })");
  const bodyReadIndex = source.indexOf("await req.json()");
  const storageIndex = source.indexOf("createSignedUrl(resumeKey)");

  assert.notEqual(
    guardIndex,
    -1,
    "guardPaidRoute must be called with requireAgentSwitch: false, since the kill switch covers agent runs only",
  );
  assert.ok(guardIndex < bodyReadIndex, "the guard must run before the request body is read");
  assert.ok(guardIndex < storageIndex, "must reject before touching storage");
  assert.match(
    source.slice(guardIndex, guardIndex + 200),
    /if \(!guard\.ok\) \{\s*return guard\.response;/,
    "a denied guard must short circuit the route",
  );
  assert.ok(
    !source.includes("insforge.auth.getCurrentUser()"),
    "the route must not keep its own hand rolled auth block alongside the guard",
  );
});

test("resume extract route rejects a resume key that does not belong to the caller", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  const ownershipCheckIndex = source.indexOf("resumeKey.startsWith(`${userId}/`)");
  const signedUrlIndex = source.indexOf("createSignedUrl(resumeKey)");

  assert.ok(ownershipCheckIndex !== -1, "ownership check on the resume key prefix not found");
  assert.ok(signedUrlIndex !== -1, "signed URL mint not found");
  assert.ok(
    ownershipCheckIndex < signedUrlIndex,
    "the ownership check must run before the signed URL is minted, never after",
  );
});

test("resume extract route never writes to the database", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  assert.doesNotMatch(
    source,
    /insforge\.database/,
    "extraction must stay read only; it never persists anything to the profiles table",
  );
});

test("resume extract route guards on empty or too short extracted text with the exact specified copy", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  assert.match(
    source,
    /"Could not extract text from this PDF\. Please try a different file\."/,
  );
  assert.match(source, /extractedText\.trim\(\)\.length < MIN_EXTRACTABLE_TEXT_LENGTH/);
});

test("resume extract route wraps its work in try/catch and logs with the route prefix", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  assert.match(source, /^\s*try \{/m);
  assert.match(source, /\} catch \(error\) \{/);
  assert.match(source, /console\.error\("\[resume\/extract\]", error\)/);
});

test("resume extract route always closes the pdf-parse parser, even on failure", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  const tryFinallyMatch = source.match(/try \{[\s\S]*?getText\(\);[\s\S]*?\} finally \{[\s\S]*?parser\.destroy\(\);[\s\S]*?\}/);
  assert.ok(tryFinallyMatch, "parser.destroy() must run in a finally block around getText()");
});

test("resume extract route rejects a missing or empty resumeKey with 400 before any storage read", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  const validationIndex = source.indexOf('typeof resumeKey !== "string" || resumeKey.length === 0');
  const signedUrlIndex = source.indexOf("createSignedUrl(resumeKey)");

  assert.ok(validationIndex !== -1, "resumeKey type/emptiness validation not found");
  assert.match(source, /"No resume selected to extract from\."/);
  assert.match(
    source.slice(validationIndex, validationIndex + 200),
    /status: 400/,
    "a missing or empty resumeKey must return 400",
  );
  assert.ok(
    validationIndex < signedUrlIndex,
    "body validation must run before any storage read",
  );
});

test("resume extract route returns a 500 with a generic message when the signed URL mint or the PDF fetch fails", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  assert.match(
    source,
    /if \(signedUrlError \|\| !signed\) \{[\s\S]{0,150}"Could not read the uploaded resume\. Please try again\."[\s\S]{0,60}status: 500/,
    "a signed URL failure must return a generic 500, not leak the underlying storage error",
  );
  assert.match(
    source,
    /if \(!pdfResponse\.ok\) \{[\s\S]{0,200}"Could not read the uploaded resume\. Please try again\."[\s\S]{0,60}status: 500/,
    "a failed PDF fetch must return the same generic 500",
  );
});

test("resume extract route propagates the agent function's own error message on extraction failure, and returns its data unchanged on success", async () => {
  const source = await readProjectFile("app/api/resume/extract/route.ts");

  assert.match(
    source,
    /if \(!extraction\.success\) \{\s*return NextResponse\.json\(\{ success: false, error: extraction\.error \}\);/,
    "an extraction failure must surface the agent function's own error, not a re-derived one",
  );
  assert.match(
    source,
    /return NextResponse\.json\(\{ success: true, data: extraction\.data \}\);/,
    "a successful extraction must return the agent function's data unchanged",
  );
});
