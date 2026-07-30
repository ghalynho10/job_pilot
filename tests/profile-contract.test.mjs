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
  assert.match(source, /<ProfileEditor initialProfile=\{profile\} userId=\{data\.user\.id\} \/>/);
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

test("completion indicator switches to a complete state (not needs-attention) once nothing is missing", async () => {
  const source = await readProjectFile("components/profile/CompletionIndicator.tsx");

  assert.match(source, /const isComplete = missingFields\.length === 0;/);
  assert.match(source, /Profile complete/);
  assert.match(source, /<CheckCircle aria-hidden="true"/);
  assert.match(
    source,
    /isComplete \? "Profile complete" : "Profile needs attention"/,
    "the heading text must actually depend on isComplete, not always read needs-attention",
  );
  assert.match(
    source,
    /const ringColorClass = isComplete \? "text-success" : "text-error";/,
    "the ring must switch to success colors when complete, not stay red at 100%",
  );
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

test("resume upload shows an uploading state, then the uploaded file name with a not-yet-saved hint", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /isUploading \? "Uploading…" : "Click to upload or drag and drop"/);
  assert.match(source, /Uploaded\. Click Save Profile below to add it to your profile\./);
});

test("resume upload disables both the dropzone button and the file input while an upload or extraction is in flight", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(
    source,
    /const isBusy = isUploading \|\| isExtracting;/,
    "isBusy must combine both the upload and extraction in-flight states",
  );

  const disabledMatches = source.match(/disabled=\{isBusy\}/g) ?? [];
  assert.equal(
    disabledMatches.length,
    3,
    "the dropzone button, the file input, and the Extract from Resume button must all be disabled while uploading or extracting, so a second file can never be picked before the first resolves",
  );
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

test("profile form select fields with empty profile values render blank placeholders first", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  for (const placeholder of [
    "Select authorization",
    "Select level",
    "Select degree",
    "Select preference",
  ]) {
    assert.match(
      source,
      new RegExp(`<option value="">${placeholder}</option>`),
      `${placeholder} placeholder missing`,
    );
  }

  assert.match(source, /event\.target\.value as Profile\["workAuthorization"\]/);
  assert.match(source, /event\.target\.value as Profile\["experienceLevel"\]/);
  assert.match(source, /event\.target\.value as Education\["highestDegree"\]/);
  assert.match(source, /event\.target\.value as Profile\["remotePreference"\]/);
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

test("profile form's Save Profile button is wired to the onSave prop, disabled while saving or externally disabled, and shows the result", async () => {
  const source = await readProjectFile("components/profile/ProfileForm.tsx");

  assert.match(source, /disabled=\{isSaving \|\| saveDisabled\}/);
  assert.match(source, /onClick=\{onSave\}/);
  assert.match(source, /\{isSaving \? "Saving…" : "Save Profile"\}/);
  assert.match(source, /\{saveError \? \(/);
  assert.match(source, /\{saveSuccess \? \(/);
});

test("profile editor owns the shared profile state and reads the staged resume from an external store, wiring both children to it", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /useState<Profile>\(initialProfile\)/);
  assert.match(source, /useSyncExternalStore\(\s*subscribeToStagedResume/);
  assert.match(source, /getStagedResumeKey\(userId\)/);
  assert.match(source, /getStagedResumeFileName\(userId\)/);
  assert.match(source, /getStagedResumeServerSnapshot/);
  assert.match(source, /<ResumeUpload[\s\S]*?onFileSelected=\{handleFileSelected\}/);
  assert.match(source, /<ProfileForm[\s\S]*?onProfileChange=\{setProfile\}/);
});

test("profile editor never reads sessionStorage in a useState initializer or a bare useEffect, only through useSyncExternalStore (hydration safety, AC-10)", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.doesNotMatch(
    source,
    /useState\([^)]*sessionStorage/,
    "reading sessionStorage inside a useState initializer runs on the client's first render only, desyncing it from the server rendered HTML with no sessionStorage at all",
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{[^}]*setResumeKey/,
    "rehydrating via setState inside a plain useEffect is exactly the pattern this project's react-hooks/set-state-in-effect lint rule rejects; useSyncExternalStore is the correct tool for a hydration safe one time external read",
  );
});

test("profile editor uploads a resume immediately on select, through uploadResumeFile, passing the previous unsaved key for best effort cleanup", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  const handleFileSelectedMatch = source.match(
    /const handleFileSelected = \(file: File\): void => \{[\s\S]*?\n {2}\};/,
  );
  assert.ok(handleFileSelectedMatch, "handleFileSelected function not found");
  const body = handleFileSelectedMatch[0];

  assert.match(body, /setIsUploading\(true\)/);
  assert.match(body, /const previousUnsavedKey = resumeKey \?\? undefined;/);
  assert.match(body, /uploadResumeFile\(file, previousUnsavedKey\)/);
  assert.match(body, /writeStagedResume\(userId, result\.key, file\.name\)/);
});

test("profile editor's upload promise chain handles a rejection, not just a resolved failure, so isUploading always resets", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  const handleFileSelectedMatch = source.match(
    /const handleFileSelected = \(file: File\): void => \{[\s\S]*?\n {2}\};/,
  );
  assert.ok(handleFileSelectedMatch, "handleFileSelected function not found");
  const body = handleFileSelectedMatch[0];

  const hasCatch = /\.catch\(/.test(body);
  const hasTryCatch = /try\s*\{[\s\S]*await[\s\S]*\}\s*catch/.test(body);
  assert.ok(
    hasCatch || hasTryCatch,
    "handleFileSelected only attaches .then(), with no .catch() and no try/catch. " +
      "uploadResumeFile(file, previousUnsavedKey) can reject outright, not just resolve " +
      "with { success: false } (confirmed live: a real 2MB PDF trips Next.js's own default " +
      "1MB Server Action body limit and rejects before uploadResumeFile's own code ever runs, " +
      "see /check verify's report on spec 0002's second revision). When that happens, the " +
      ".then() callback never runs, so setIsUploading(false) never fires: the resume control " +
      "and Save Profile stay disabled forever for that session, with no error shown to the " +
      "user. Add a .catch() that calls setIsUploading(false) and setUploadError(...) so an " +
      "unexpected rejection degrades to a visible, recoverable error instead of a silent, " +
      "permanent stuck state.",
  );
});

test("profile editor disables Save Profile while a resume upload or extraction is in flight, via saveDisabled, not the isSaving text", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /<ResumeUpload[\s\S]*?isUploading=\{isUploading\}/);
  assert.match(source, /<ResumeUpload[\s\S]*?isExtracting=\{isExtracting\}/);
  assert.match(source, /<ProfileForm[\s\S]*?isSaving=\{isPending\}/);
  assert.match(source, /<ProfileForm[\s\S]*?saveDisabled=\{isUploading \|\| isExtracting\}/);
});

test("profile editor calls saveProfile with the profile and the resolved resume key, clearing the staged entry only on success", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /saveProfile\(profile, resumeKey\)/);

  const handleSaveMatch = source.match(/const handleSave = \(\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleSaveMatch, "handleSave function not found");
  const body = handleSaveMatch[0];
  assert.match(
    body,
    /if \(result\.success\) \{\s*clearStagedResume\(userId\);\s*setSaveSuccess\(true\);/,
  );
  assert.match(body, /\} else \{\s*setSaveError\(result\.error\);/);
});

test("profile editor auto-clears the save success message after a delay, with cleanup", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /useEffect\(/);
  assert.match(source, /setTimeout\(\(\) => setSaveSuccess\(false\), SAVE_SUCCESS_DISPLAY_MS\)/);
  assert.match(source, /return \(\) => clearTimeout\(timeout\);/);
});

test("actions/profile.ts re-checks the caller is signed in inside both uploadResumeFile and saveProfile before doing anything else", async () => {
  const source = await readProjectFile("actions/profile.ts");

  assert.match(source, /^"use server";/);

  const uploadStart = source.indexOf("export async function uploadResumeFile");
  const saveStart = source.indexOf("export async function saveProfile");
  assert.ok(uploadStart !== -1 && saveStart !== -1 && uploadStart < saveStart);

  const uploadBody = source.slice(uploadStart, saveStart);
  const uploadAuthCheckIndex = uploadBody.indexOf("if (authError || !authData.user)");
  const uploadCallIndex = uploadBody.indexOf(".upload(key, file)");
  assert.ok(uploadAuthCheckIndex !== -1 && uploadCallIndex !== -1);
  assert.ok(uploadAuthCheckIndex < uploadCallIndex, "uploadResumeFile must check auth before uploading");

  const saveBody = source.slice(saveStart);
  const saveAuthCheckIndex = saveBody.indexOf("if (authError || !authData.user)");
  const writeIndex = saveBody.indexOf(".upsert(payload");
  assert.ok(saveAuthCheckIndex !== -1 && writeIndex !== -1);
  assert.ok(saveAuthCheckIndex < writeIndex, "saveProfile must check auth before writing");
});

test("actions/profile.ts's uploadResumeFile validates the file before ever calling storage.upload", async () => {
  const source = await readProjectFile("actions/profile.ts");
  const uploadStart = source.indexOf("export async function uploadResumeFile");
  const saveStart = source.indexOf("export async function saveProfile");
  const uploadBody = source.slice(uploadStart, saveStart);

  const typeCheckIndex = uploadBody.indexOf('file.type !== "application/pdf"');
  const sizeCheckIndex = uploadBody.indexOf("file.size > MAX_RESUME_SIZE_BYTES");
  const uploadIndex = uploadBody.indexOf(".upload(key, file)");

  assert.ok(typeCheckIndex !== -1 && sizeCheckIndex !== -1 && uploadIndex !== -1);
  assert.ok(typeCheckIndex < uploadIndex && sizeCheckIndex < uploadIndex);
});

test("actions/profile.ts's uploadResumeFile best effort deletes the previous unsaved key, never failing its own upload on a delete error", async () => {
  const source = await readProjectFile("actions/profile.ts");
  const uploadStart = source.indexOf("export async function uploadResumeFile");
  const saveStart = source.indexOf("export async function saveProfile");
  const uploadBody = source.slice(uploadStart, saveStart);

  assert.match(uploadBody, /if \(previousUnsavedKey\) \{/);
  assert.match(uploadBody, /\.remove\(previousUnsavedKey\)/);

  const uploadCallIndex = uploadBody.indexOf(".upload(key, file)");
  const deleteIndex = uploadBody.indexOf(".remove(previousUnsavedKey)");
  assert.ok(uploadCallIndex !== -1 && deleteIndex !== -1 && uploadCallIndex < deleteIndex);

  const removeErrorBlock = uploadBody.slice(deleteIndex, deleteIndex + 200);
  assert.match(removeErrorBlock, /console\.error/);
  assert.doesNotMatch(removeErrorBlock, /return \{ success: false/);
});

test("actions/profile.ts's saveProfile reads the existing row before writing, and never uploads anything itself", async () => {
  const source = await readProjectFile("actions/profile.ts");
  const saveStart = source.indexOf("export async function saveProfile");
  const saveBody = source.slice(saveStart);

  assert.match(saveBody, /\.select\("resume_pdf_url, is_complete"\)/);
  assert.match(saveBody, /\.eq\("id", userId\)/);
  assert.match(saveBody, /\.maybeSingle\(\)/);

  const readIndex = saveBody.indexOf('.select("resume_pdf_url, is_complete")');
  const writeIndex = saveBody.indexOf(".upsert(payload");
  assert.ok(readIndex !== -1 && writeIndex !== -1 && readIndex < writeIndex, "the row read must happen before the write");

  assert.doesNotMatch(saveBody, /\.upload\(/, "saveProfile must not upload a file itself; that is uploadResumeFile's job now");
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

test("resume upload only shows Extract from Resume once a resume is staged", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(source, /\{canExtract \? \(/);
  assert.match(source, /onClick=\{onExtract\}/);
  assert.match(source, /\{isExtracting \? "Extracting…" : "Extract from Resume"\}/);
});

test("profile editor's extract flow never fires without a staged resume key and merges the result by overwrite", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  const handleExtractMatch = source.match(/const handleExtract = \(\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleExtractMatch, "handleExtract function not found");
  const body = handleExtractMatch[0];

  assert.match(body, /if \(!resumeKey\) return;/);
  assert.match(body, /fetch\("\/api\/resume\/extract"/);
  assert.match(body, /method: "POST"/);
  assert.match(body, /body: JSON\.stringify\(\{ resumeKey \}\)/);
  assert.match(
    body,
    /setProfile\(\(prev\) => \(\{ \.\.\.prev, \.\.\.result\.data \}\)\)/,
    "a successful extraction must overwrite the extracted fields onto the current profile",
  );
});

test("profile editor's extract fetch chain handles a rejection, not just a resolved failure, so isExtracting always resets", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  const handleExtractMatch = source.match(/const handleExtract = \(\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleExtractMatch, "handleExtract function not found");
  const body = handleExtractMatch[0];

  assert.match(
    body,
    /\.catch\(\(\) => \{\s*setIsExtracting\(false\);\s*setExtractError\(/,
    "a rejected fetch (network failure, not just a { success: false } response) must still " +
      "reset isExtracting and show an error, the same rejection gap the upload flow was fixed " +
      "for earlier; without it, Extract from Resume and Save Profile would stay disabled " +
      "forever after a network failure",
  );
});

test("profile editor sets extractError on failure and clears it before a new extraction attempt", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  const handleExtractMatch = source.match(/const handleExtract = \(\): void => \{[\s\S]*?\n {2}\};/);
  assert.ok(handleExtractMatch, "handleExtract function not found");
  const body = handleExtractMatch[0];

  assert.match(body, /setExtractError\(null\)/, "must clear any previous error before a new attempt");
  assert.match(body, /setExtractError\(result\.error\)/, "must surface the server's own error message on failure");
});

test("resume upload receives the extract wiring (canExtract, onExtract, extractError) from the editor, not left undefined", async () => {
  const source = await readProjectFile("components/profile/ProfileEditor.tsx");

  assert.match(source, /<ResumeUpload[\s\S]*?canExtract=\{resumeKey !== null\}/);
  assert.match(source, /<ResumeUpload[\s\S]*?extractError=\{extractError\}/);
  assert.match(source, /<ResumeUpload[\s\S]*?onExtract=\{handleExtract\}/);
});

test("resume upload shows a server side extraction error the same way it shows an upload error", async () => {
  const source = await readProjectFile("components/profile/ResumeUpload.tsx");

  assert.match(
    source,
    /\{extractError \? \(\s*<p className="mt-2 text-xs text-error" role="alert">\s*\{extractError\}/,
    "extractError must render with the same text-error/role=alert pattern as uploadError",
  );
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
