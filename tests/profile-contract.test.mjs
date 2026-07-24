import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

const PROFILE_FILES = [
  "app/profile/page.tsx",
  "components/profile/CompletionIndicator.tsx",
  "components/profile/ResumeUpload.tsx",
  "components/profile/ProfileForm.tsx",
  "components/profile/ProfileEditor.tsx",
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

test("profile page composes the needs-attention banner and the profile editor from real fetched data", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /<CompletionIndicator completion=\{completion\} \/>/);
  assert.match(source, /<ProfileEditor initialProfile=\{profile\} \/>/);
  assert.doesNotMatch(source, /mockProfile|mockCompletion/, "mock data from feature 05 must be fully gone");
});

test("profile page fetches the real profiles row, scoped to the signed in user, and falls back for a brand new user", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /insforge\.database\s*\.from\("profiles"\)/);
  assert.match(source, /\.select\("\*"\)/);
  assert.match(source, /\.eq\("id", data\.user\.id\)/);
  assert.match(source, /\.maybeSingle</, "must distinguish no-row-yet from a real query error");
  assert.match(source, /row \? mapProfileRowToProfile\(row\) : buildEmptyProfile\(data\.user\.email\)/);
  assert.match(source, /deriveProfileCompletion\(/);
});

test("profile page itself never imports the save action directly; the client ProfileEditor owns that boundary", async () => {
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

test("resume upload never touches storage or the network directly; it only stages a file for its parent", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.doesNotMatch(source, /insforge\.storage/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.match(source, /onFileSelected\(file\)/);
});

test("resume upload rejects a non-PDF or oversized file client side before ever calling onFileSelected", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  const handleFileMatch = source.match(/const handleFile = \(file: File\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleFileMatch, "handleFile function not found");
  const handleFileBody = handleFileMatch[0];

  assert.match(handleFileBody, /file\.type !== "application\/pdf"/);
  assert.match(handleFileBody, /file\.size > MAX_RESUME_SIZE_BYTES/);

  const typeCheckIndex = handleFileBody.indexOf('file.type !== "application/pdf"');
  const callIndex = handleFileBody.indexOf("onFileSelected(file)");
  assert.ok(
    typeCheckIndex !== -1 && callIndex !== -1 && typeCheckIndex < callIndex,
    "the PDF type check must happen before onFileSelected is ever called",
  );
});

test("resume upload wires both the file input and the drop handler through the same validated path", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /onChange=\{handleInputChange\}/);
  assert.match(source, /event\.dataTransfer\.files\?\.\[0\]/);
  assert.match(source, /if \(file\) handleFile\(file\);/g);
});

test("resume upload shows the selected file name and a staged, not-yet-saved hint", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /selectedFileName \?\? "Click to upload or drag and drop"/);
  assert.match(source, /Selected\. Click Save Profile below to store it\./);
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

test("profile form renders all five sections", async () => {
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
});

test("profile form is a fully controlled component driven by its parent, not its own local profile state", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.doesNotMatch(
    source,
    /useState<Profile>/,
    "ProfileForm must not own profile state itself now that ProfileEditor does",
  );
  assert.match(source, /onProfileChange\(\{ \.\.\.profile, \[key\]: value \}\)/);
  assert.doesNotMatch(source, /actions\/profile/, "ProfileForm calls the onSave prop, never the action directly");
});

test("profile form's Save Profile button is wired to the onSave prop, disabled while saving, and shows the result", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /disabled=\{isSaving\}/);
  assert.match(source, /onClick=\{onSave\}/);
  assert.match(source, /\{isSaving \? "Saving…" : "Save Profile"\}/);
  assert.match(source, /\{saveError \? \(/);
  assert.match(source, /\{saveSuccess \? \(/);
});

test("profile editor owns the shared profile and resume file state, wiring both children to it", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /useState<Profile>\(initialProfile\)/);
  assert.match(source, /useState<File \| null>\(null\)/);
  assert.match(source, /<ResumeUpload\s+onFileSelected=\{setResumeFile\}/);
  assert.match(source, /<ProfileForm[\s\S]*?onProfileChange=\{setProfile\}/);
});

test("profile editor calls saveProfile with both the profile and the staged resume file, and clears the file only on success", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /saveProfile\(profile, resumeFile\)/);

  const handleSaveMatch = source.match(/const handleSave = \(\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleSaveMatch, "handleSave function not found");
  const body = handleSaveMatch[0];
  assert.match(body, /if \(result\.success\) \{\s*setResumeFile\(null\);\s*setSaveSuccess\(true\);/);
  assert.match(body, /\} else \{\s*setSaveError\(result\.error\);/);
});

test("profile editor auto-clears the save success message after a delay, with cleanup", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /useEffect\(/);
  assert.match(source, /setTimeout\(\(\) => setSaveSuccess\(false\), SAVE_SUCCESS_DISPLAY_MS\)/);
  assert.match(source, /return \(\) => clearTimeout\(timeout\);/);
});

test("actions/profile.ts saveProfile re-checks the caller is signed in before doing anything else", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /^"use server";/);
  assert.match(source, /await insforge\.auth\.getCurrentUser\(\)/);

  const authCheckIndex = source.indexOf("if (authError || !authData.user)");
  const uploadIndex = source.indexOf("insforge.storage");
  const writeIndex = source.indexOf(".upsert(payload");
  assert.ok(authCheckIndex !== -1, "auth check not found");
  assert.ok(
    authCheckIndex < uploadIndex && authCheckIndex < writeIndex,
    "the auth check must happen before any upload or database write",
  );
});

test("actions/profile.ts validates the resume file before ever calling storage.upload", async () => {
  const source = await readProjectFile("actions/profile.ts");

  const typeCheckIndex = source.indexOf('resumeFile.type !== "application/pdf"');
  const sizeCheckIndex = source.indexOf("resumeFile.size > MAX_RESUME_SIZE_BYTES");
  const uploadIndex = source.indexOf(".upload(key, resumeFile)");

  assert.ok(typeCheckIndex !== -1 && sizeCheckIndex !== -1 && uploadIndex !== -1);
  assert.ok(typeCheckIndex < uploadIndex && sizeCheckIndex < uploadIndex);
});

test("actions/profile.ts reads the existing row before writing, to learn the previous resume key and completion state", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /\.select\("resume_pdf_url, is_complete"\)/);
  assert.match(source, /\.eq\("id", userId\)/);
  assert.match(source, /\.maybeSingle\(\)/);

  const readIndex = source.indexOf('.select("resume_pdf_url, is_complete")');
  const uploadIndex = source.indexOf(".upload(key, resumeFile)");
  const writeIndex = source.indexOf(".upsert(payload");
  assert.ok(readIndex < uploadIndex && readIndex < writeIndex, "the row read must happen before the upload and the write");
});

test("actions/profile.ts uploads every resume to a fresh unique key, never the fixed userId/resume.pdf path", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /const key = `\$\{userId\}\/\$\{randomUUID\(\)\}\.pdf`;/);
  assert.doesNotMatch(source, /\$\{userId\}\/resume\.pdf/);
});

test("actions/profile.ts only includes resume_pdf_url in the write payload when a file was actually uploaded", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /\.\.\.\(resumeKey \? \{ resume_pdf_url: resumeKey \} : \{\}\)/);
});

test("actions/profile.ts deletes the previous resume key only after the write succeeds, and only if it actually changed", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(
    source,
    /if \(resumeKey && previousResumeKey && previousResumeKey !== resumeKey\) \{/,
  );

  const writeIndex = source.indexOf(".upsert(payload");
  const deleteGuardIndex = source.indexOf(
    "if (resumeKey && previousResumeKey && previousResumeKey !== resumeKey)",
  );
  assert.ok(writeIndex < deleteGuardIndex, "the delete must be attempted only after the write, never before");
});

test("actions/profile.ts fires profile_completed only on the false to true transition, not on every save of an already complete profile", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /if \(isComplete && !wasComplete\) \{/);
  assert.match(source, /event: "profile_completed"/);
  assert.match(source, /await posthog\.shutdown\(\);/);
});

test("actions/profile.ts uses the database accessor, not the nonexistent top level insforge.from", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /insforge\.database\s*\n?\s*\.from\("profiles"\)/);
  assert.doesNotMatch(source, /(?<!\.database\s{0,20})insforge\s*\.from\("profiles"\)/s);
});

test("actions/profile.ts revalidates the profile page and never throws an uncaught error", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /revalidatePath\("\/profile"\)/);
  assert.match(source, /^\s*try \{/m);
  assert.match(source, /\} catch \(error\) \{/);
  assert.match(source, /console\.error\("\[actions\/profile:saveProfile\]", error\)/);
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
