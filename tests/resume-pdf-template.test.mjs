import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

async function listFilesRecursive(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryUrl)));
    } else {
      files.push(entryUrl);
    }
  }
  return files;
}

test("ResumePdfDocument has no 'use client' directive, honoring the server only constraint", async () => {
  const source = await readProjectFile("app/api/resume/generate/ResumePdfDocument.tsx");

  assert.doesNotMatch(source, /"use client"/);
});

test("ResumePdfDocument only uses CSS properties @react-pdf/renderer actually supports", async () => {
  const source = await readProjectFile("app/api/resume/generate/ResumePdfDocument.tsx");

  const supported = new Set([
    "padding",
    "margin",
    "marginTop",
    "marginBottom",
    "fontSize",
    "color",
    "fontFamily",
    "flexDirection",
    "alignItems",
    "justifyContent",
    "borderRadius",
    "width",
    "height",
    "fontWeight",
    "textAlign",
    "lineHeight",
  ]);

  const styleBlockMatch = source.match(/StyleSheet\.create\(\{([\s\S]*?)\n\}\);/);
  assert.ok(styleBlockMatch, "StyleSheet.create block not found");
  const propertyMatches = [...styleBlockMatch[1].matchAll(/(\w+):\s*(?:"[^"]*"|-?\d)/g)];
  assert.ok(propertyMatches.length > 0, "no style properties parsed from the stylesheet");

  for (const [, property] of propertyMatches) {
    assert.ok(supported.has(property), `unsupported @react-pdf/renderer CSS property used: ${property}`);
  }
});

test("ResumePdfDocument is only ever imported from its own generate route, never from a client component", async () => {
  const componentsFiles = await listFilesRecursive(new URL("../components/", import.meta.url));
  const appFiles = await listFilesRecursive(new URL("../app/", import.meta.url));

  for (const fileUrl of [...componentsFiles, ...appFiles]) {
    if (fileUrl.pathname.endsWith("ResumePdfDocument.tsx")) continue;
    if (!/\.(t|j)sx?$/.test(fileUrl.pathname)) continue;

    const source = await readFile(fileUrl, "utf8");
    if (!source.includes("ResumePdfDocument")) continue;

    assert.doesNotMatch(
      source,
      /"use client"/,
      `${fileUrl.pathname} imports ResumePdfDocument but is a client component`,
    );
    assert.match(
      fileUrl.pathname,
      /app\/api\/resume\/generate\/route\.ts$/,
      `${fileUrl.pathname} imports ResumePdfDocument outside its own route`,
    );
  }
});

test("ResumePdfDocument renders every required section and omits optional ones when empty (AC-1)", async () => {
  const source = await readProjectFile("app/api/resume/generate/ResumePdfDocument.tsx");

  assert.match(source, />Professional Summary</, "the summary heading must always render");
  assert.match(source, /\{content\.summary\}/, "the generated summary text must always render");
  assert.match(
    source,
    /\{profile\.skills\.length > 0 \? \(/,
    "skills must only render when the profile actually has skills",
  );
  assert.match(
    source,
    /\{profile\.workExperience\.length > 0 \? \(/,
    "the experience section must only render when there is work experience to show",
  );
  assert.match(
    source,
    /\{degreeLabel \? \(/,
    "education must only render when a highest degree is actually set",
  );
  assert.match(
    source,
    /\{contactParts\.length > 0 \? \(/,
    "the contact line must only render when at least one contact field is non empty",
  );
});
