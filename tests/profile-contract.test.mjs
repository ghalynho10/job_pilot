import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

const PROFILE_FILES = [
  "app/profile/page.tsx",
  "components/profile/CompletionIndicator.tsx",
  "components/profile/ResumeUpload.tsx",
  "components/profile/ProfileForm.tsx",
];

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

function extractInputTag(source, idAttr) {
  const idIndex = source.indexOf(`id="${idAttr}"`);
  assert.ok(idIndex !== -1, `id="${idAttr}" not found in source`);
  const tagStart = source.lastIndexOf("<input", idIndex);
  const tagEnd = source.indexOf("/>", idIndex);
  assert.ok(tagStart !== -1 && tagEnd !== -1, `<input .../> not found around id="${idAttr}"`);
  return source.slice(tagStart, tagEnd + 2);
}

test("profile page redirects to login when there is no authenticated session", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /if \(error \|\| !data\.user\) \{/);
  assert.match(source, /redirect\("\/login\?error=session"\)/);

  const redirectIndex = source.indexOf('redirect("/login?error=session")');
  const returnIndex = source.indexOf("return (");
  assert.ok(
    redirectIndex < returnIndex,
    "the auth redirect must happen before the page renders its JSX",
  );
});

test("profile page uses the server InsForge client, never the browser client", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /createInsforgeServer/);
  assert.doesNotMatch(source, /from ["']@\/lib\/insforge-client["']/);
});

test("profile page hides the navbar sign out action, matching the design", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /<Navbar authenticated showAuthAction=\{false\} \/>/);
});

test("profile page composes the needs-attention banner, resume upload, and profile form", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /<CompletionIndicator completion=\{mockCompletion\} \/>/);
  assert.match(source, /<ResumeUpload \/>/);
  assert.match(source, /<ProfileForm initialProfile=\{mockProfile\} \/>/);
});

test("profile page has no profile save wiring yet, since feature 06 owns that", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.doesNotMatch(source, /actions\/profile/);
  assert.doesNotMatch(source, /"use server"/);
});

test("completion indicator shows the needs-attention heading and only renders missing fields when present", async () => {
  const source = await readProjectFile("components/profile/CompletionIndicator.tsx");

  assert.match(source, /Profile needs attention/);
  assert.match(source, /missingFields\.length > 0/);
  assert.match(source, /<AlertCircle aria-hidden="true"/);
});

test("completion indicator ring offset is driven by the percentage prop, not a fixed value", async () => {
  const source = await readProjectFile("components/profile/CompletionIndicator.tsx");

  assert.match(source, /const RING_CIRCUMFERENCE = 2 \* Math\.PI \* RING_RADIUS;/);
  assert.match(
    source,
    /const offset = RING_CIRCUMFERENCE \* \(1 - percentage \/ 100\);/,
  );

  const ringSize = 128;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  assert.match(source, new RegExp(`const RING_SIZE = ${ringSize};`));
  assert.match(source, new RegExp(`const RING_STROKE = ${ringStroke};`));
  assert.ok(circumference > 0, "sanity check on the geometry constants read from source");
});

test("resume upload dropzone accepts PDF only and shows the documented size limit", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /Click to upload or drag and drop/);
  assert.match(source, /PDF formatting only\. Maximum file size 5MB\./);
  assert.match(source, /accept="application\/pdf"/);
  assert.match(source, /<UploadCloud aria-hidden="true"/);
});

test("resume upload tracks drag-over state and exposes the generate action", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /isDraggingOver/);
  assert.match(source, /Generate Resume from Profile/);
  assert.match(source, /<FileText aria-hidden="true"/);
});

test("resume upload has no upload or generate wiring yet, since features 06 and 08 own that", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.doesNotMatch(source, /insforge\.storage/);
  assert.doesNotMatch(source, /fetch\(/);
});

test("profile form email field is pre-filled and not editable", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");
  const emailInput = extractInputTag(source, "email");

  assert.match(emailInput, /\bdisabled\b/);
  assert.doesNotMatch(emailInput, /onChange/);
});

test("profile form caps work experience at 3 entries and disables Add role past the cap", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /const MAX_WORK_EXPERIENCE_ENTRIES = 3;/);
  assert.match(source, /if \(profile\.workExperience\.length >= MAX_WORK_EXPERIENCE_ENTRIES\) return;/);
  assert.match(
    source,
    /disabled=\{profile\.workExperience\.length >= MAX_WORK_EXPERIENCE_ENTRIES\}/,
  );
});

test("currently working here disables the end date field for that role", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /checked=\{entry\.currentlyWorkingHere\}/);
  assert.match(source, /disabled=\{entry\.currentlyWorkingHere\}/);
});

test("skills and industries are trimmed and deduplicated before being added", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /const value = skillInput\.trim\(\);/);
  assert.match(source, /if \(value\.length === 0 \|\| profile\.skills\.includes\(value\)\) return;/);
  assert.match(source, /const value = industryInput\.trim\(\);/);
  assert.match(
    source,
    /if \(value\.length === 0 \|\| profile\.industries\.includes\(value\)\) return;/,
  );
});

test("pressing Enter in a tag input adds the tag instead of submitting", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /if \(event\.key === "Enter"\) \{/);
  assert.match(source, /event\.preventDefault\(\);/);
});

test("skill and industry remove buttons have an accessible name", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /aria-label=\{`Remove \$\{skill\}`\}/);
  assert.match(source, /aria-label=\{`Remove \$\{industry\}`\}/);
});

test("profile form renders all five sections and the save action, with no save action wired yet", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  for (const heading of [
    "Personal Info",
    "Professional Info",
    "Work Experience",
    "Education",
    "Job Preferences",
  ]) {
    assert.match(source, new RegExp(`>${heading}<`));
  }
  assert.match(source, />\s*Save Profile\s*</);
  assert.doesNotMatch(source, /actions\/profile/);
});

test("changed profile files never use hardcoded hex colors or raw Tailwind color classes", async () => {
  const rawTailwindColor =
    /\b(?:bg|text|border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)-\d{2,3}\b/;

  for (const file of PROFILE_FILES) {
    const source = await readProjectFile(file);

    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file} contains a hardcoded hex color`);
    assert.doesNotMatch(
      source,
      rawTailwindColor,
      `${file} contains a raw Tailwind color class instead of a project token`,
    );
  }
});
