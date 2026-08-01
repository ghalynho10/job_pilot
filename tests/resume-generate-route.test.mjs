import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("resume generate route checks auth before reading the profile (AC-6)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  const guardIndex = source.indexOf(
    "await guardPaidRoute({ requireAgentSwitch: false })",
  );
  const readIndex = source.indexOf('.from("profiles")\n      .select("*")');

  assert.ok(
    guardIndex !== -1,
    "guardPaidRoute must be called with requireAgentSwitch: false, since the kill switch covers agent runs only",
  );
  assert.ok(readIndex !== -1);
  assert.ok(
    guardIndex < readIndex,
    "the guard must run before the profile row is read",
  );
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

test("resume generate route gates on full name and work experience before calling GPT-4o, PDF render, or storage (AC-2)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  const gateIndex = source.indexOf(
    "if (!row || !hasFullName || !hasWorkExperience)",
  );
  const generateIndex = source.indexOf("generateResumeContent(profile)");
  assert.ok(gateIndex !== -1 && generateIndex !== -1);
  assert.ok(
    gateIndex < generateIndex,
    "the completeness gate must run before any AI, render, or storage work",
  );
});

test("resume generate route returns an explicit status for the completeness gate and an AI generation failure, not an implicit 200 (AC-2, AC-8)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(
    source,
    /Please save your profile with your full name and at least one work experience entry before generating a resume\.",\s*\},\s*\{ status: 400 \},/,
    "the completeness gate is a client precondition failure, not a silent 200",
  );
  assert.match(
    source,
    /if \(!generated\.success\) \{\s*return NextResponse\.json\(\{ success: false, error: generated\.error \}, \{ status: 500 \}\);/,
    "an AI generation failure must return an explicit failure status, matching every other non-2xx path in this route",
  );
});

test("resume generate route uploads the new PDF before writing the database pointer, and writes before deleting the previous key (AC-4)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  const uploadIndex = source.indexOf(".upload(key, pdfBlob)");
  const writeIndex = source.indexOf(
    ".update({ resume_pdf_url: uploadData.key })",
  );
  const deleteIndex = source.indexOf(".remove(previousResumeKey)");

  assert.ok(uploadIndex !== -1 && writeIndex !== -1 && deleteIndex !== -1);
  assert.ok(
    uploadIndex < writeIndex,
    "upload must happen before the database write",
  );
  assert.ok(
    writeIndex < deleteIndex,
    "the previous key must only be removed after the new pointer is durably written",
  );
});

test("resume generate route uploads to a fresh unique key, never a fixed path (AC-4)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(
    source,
    /const key = `\$\{userId\}\/\$\{randomUUID\(\)\}\.pdf`;/,
  );
});

test("resume generate route best effort cleans up an orphaned upload if the database write fails (AC-8)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(
    source,
    /if \(writeError\) \{[\s\S]*?\.remove\(uploadData\.key\)/,
    "a failed database write must remove the now orphaned upload rather than leaving it dangling",
  );
});

test("resume generate route revalidates the profile page after a successful generation (AC-4)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  const writeIndex = source.indexOf(
    ".update({ resume_pdf_url: uploadData.key })",
  );
  const revalidateIndex = source.indexOf('revalidatePath("/profile")');
  assert.ok(revalidateIndex !== -1 && writeIndex < revalidateIndex);
});

test("resume generate route never leaks a storage key or signed URL in its response (AC-5)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(source, /return NextResponse\.json\(\{ success: true \}\);/);
  assert.doesNotMatch(source, /success: true, .*key/i);
  assert.doesNotMatch(source, /success: true, .*url/i);
});

test("resume generate route wraps its work in try/catch and logs with the route prefix (AC-8)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(source, /^\s*try \{/m);
  assert.match(source, /\} catch \(error\) \{/);
  assert.match(source, /console\.error\("\[resume\/generate\]", error\)/);
});

test("resume generate route accepts no request body and derives the target user only from the authenticated session (AC-7)", async () => {
  const source = await readProjectFile("app/api/resume/generate/route.ts");

  assert.match(
    source,
    /export async function POST\(\): Promise</,
    "POST must take no request parameter, so there is nothing to read a client supplied id from",
  );
  assert.doesNotMatch(
    source,
    /req\.json\(\)/,
    "the route must never parse a request body for a user or profile id",
  );
  assert.match(
    source,
    /const \{ insforge, userId \} = guard;/,
    "the only user id source is the guard, which derives it from the authenticated session",
  );
});

test("resume generator does not reference projects (AC-7: projects out of scope for generation)", async () => {
  const generatorSource = await readProjectFile("agent/resume-generator.ts");
  const routeSource = await readProjectFile("app/api/resume/generate/route.ts");
  const pdfSource = await readProjectFile(
    "app/api/resume/generate/ResumePdfDocument.tsx",
  );

  assert.doesNotMatch(
    generatorSource,
    /projects/,
    "resume generator agent must not reference projects",
  );
  assert.doesNotMatch(
    routeSource,
    /projects/,
    "resume generate route must not reference projects",
  );
  assert.doesNotMatch(
    pdfSource,
    /projects/,
    "resume PDF document must not reference projects",
  );
});
