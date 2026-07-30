import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("resume signed url route checks auth before reading anything (AC-6)", async () => {
  const source = await readProjectFile("app/api/resume/signed-url/route.ts");

  const authIndex = source.indexOf("insforge.auth.getCurrentUser()");
  const readIndex = source.indexOf('.select("resume_pdf_url")');
  assert.ok(authIndex !== -1 && readIndex !== -1);
  assert.ok(authIndex < readIndex);
});

test("resume signed url route never accepts a client supplied key; it only ever reads the caller's own row (AC-7)", async () => {
  const source = await readProjectFile("app/api/resume/signed-url/route.ts");

  assert.doesNotMatch(source, /req\.json\(\)|resumeKey/);
  assert.match(source, /\.eq\("id", userId\)/);
});

test("resume signed url route handles a missing resume gracefully instead of crashing (AC-5, AC-8)", async () => {
  const source = await readProjectFile("app/api/resume/signed-url/route.ts");

  assert.match(
    source,
    /if \(!row\?\.resume_pdf_url\) \{\s*return NextResponse\.json\(\s*\{ success: false, error: "No resume available yet\." \},\s*\{ status: 404 \},\s*\);/,
  );
});

test("resume signed url route mints the signed URL only on request, never returning a cached or stored one (AC-5)", async () => {
  const source = await readProjectFile("app/api/resume/signed-url/route.ts");

  assert.match(source, /createSignedUrl\(row\.resume_pdf_url\)/);
  assert.match(source, /success: true, url: signed\.signedUrl/);
});

test("resume signed url route wraps its work in try/catch and logs with the route prefix (AC-8)", async () => {
  const source = await readProjectFile("app/api/resume/signed-url/route.ts");

  assert.match(source, /^\s*try \{/m);
  assert.match(source, /\} catch \(error\) \{/);
  assert.match(source, /console\.error\("\[resume\/signed-url\]", error\)/);
});
