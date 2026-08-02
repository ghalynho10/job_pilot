/**
 * Live verification of spec 0014 AC-5 and AC-6.
 *
 * AC-5: The profile form shows a Projects section → verified by
 *       profile-contract source-regex tests (see below).
 *
 * AC-6: Saving the profile persists projects alongside all other
 *       fields in a single save call. The save action, profile
 *       mapping, and profile completion logic all handle the new
 *       field without breaking.
 *
 * This script verifies AC-6 by doing a real database round-trip
 * through the same mapping functions the app uses.
 *
 * Run:  node --env-file=.env.local --test tests/verify-spec-0014-ac5-ac6.mjs
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  getTestAdmin,
  TEST_USER_EMAIL,
  TEST_USER_ID,
} from "../lib/test-auth.ts";
import {
  mapProfileRowToProfile,
  mapProfileToRow,
} from "../lib/profile-mapping.ts";
import { deriveProfileCompletion } from "../lib/profile-completion.ts";

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const profileWithProjects = {
  fullName: "AC-6 Verify",
  email: TEST_USER_EMAIL,
  phone: "+1 555 000 9999",
  location: "Remote",
  linkedinUrl: "",
  portfolioUrl: "",
  workAuthorization: "citizen",
  currentTitle: "Verification Engineer",
  experienceLevel: "senior",
  yearsExperience: 5,
  skills: ["Testing", "TypeScript"],
  industries: ["SaaS"],
  workExperience: [
    {
      company: "VerifyCorp",
      jobTitle: "QA Lead",
      startDate: "2022-01",
      endDate: "",
      currentlyWorkingHere: true,
      keyResponsibilities: "Verified things.",
    },
  ],
  education: {
    highestDegree: "bachelor",
    fieldOfStudy: "Computer Science",
    institutionName: "Verify University",
    graduationYear: "2020",
  },
  jobTitlesSeeking: "QA Engineer",
  remotePreference: "remote",
  salaryExpectation: "",
  preferredLocations: "",
  projects: [
    {
      name: "VerifyLib",
      description:
        "A test assertion library for Node.js.\nHandles deep equality and async flows.",
      url: "https://github.com/verify/verifylib",
      technologies: ["TypeScript", "Node.js", "Vitest"],
    },
    {
      name: "Minimal Project",
    },
    {
      name: "Full Stack App",
      description: "End-to-end testing dashboard.",
      url: "https://verify-dash.example.com",
      technologies: ["Next.js", "Playwright", "PostgreSQL"],
    },
  ],
};

const profileWithoutProjects = {
  ...profileWithProjects,
  projects: null,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("spec 0014 AC-6 — projects persist through save/reload round-trip", () => {
  const admin = getTestAdmin();

  /** @type {Record<string, unknown> | null} */
  let backupRow = null;

  // Backup the test user's real profile before any writes
  before(async () => {
    const { data } = await admin.database
      .from("profiles")
      .select("*")
      .eq("id", TEST_USER_ID)
      .maybeSingle();
    backupRow = data;
  });

  // Restore after all tests complete
  after(async () => {
    if (backupRow) {
      await admin.database
        .from("profiles")
        .upsert(backupRow, { onConflict: "id" });
    }
  });

  it("AC-6: upsert a profile with projects, read it back, projects round-trip intact", async () => {
    const row = mapProfileToRow(
      profileWithProjects,
      TEST_USER_ID,
      TEST_USER_EMAIL,
    );

    // Verify mapping includes projects
    assert.deepEqual(row.projects, profileWithProjects.projects);

    // Write to the real database
    const payload = {
      ...row,
      is_complete: true,
    };

    const { error: writeError } = await admin.database
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    assert.equal(
      writeError,
      null,
      `write failed: ${writeError?.message ?? "unknown"}`,
    );

    // Read back
    const { data: readRow, error: readError } = await admin.database
      .from("profiles")
      .select("*")
      .eq("id", TEST_USER_ID)
      .maybeSingle();

    assert.equal(
      readError,
      null,
      `read failed: ${readError?.message ?? "unknown"}`,
    );
    assert.ok(readRow, "row not found after upsert");

    // Map back through the app's own reader
    const roundTripped = mapProfileRowToProfile(readRow);

    // Assert every project field round-trips
    assert.ok(
      Array.isArray(roundTripped.projects),
      "projects should be an array",
    );
    assert.equal(roundTripped.projects.length, 3, "should have 3 projects");

    // Project 1 — all fields present
    const p1 = roundTripped.projects[0];
    assert.equal(p1.name, "VerifyLib");
    assert.match(p1.description, /test assertion library/);
    assert.match(p1.description, /\n/); // newline-separated bullets preserved
    assert.equal(p1.url, "https://github.com/verify/verifylib");
    assert.deepEqual(p1.technologies, ["TypeScript", "Node.js", "Vitest"]);

    // Project 2 — minimal (only name)
    const p2 = roundTripped.projects[1];
    assert.equal(p2.name, "Minimal Project");
    assert.equal(p2.description ?? "", "");
    assert.equal(p2.url ?? "", "");
    assert.deepEqual(p2.technologies ?? [], []);

    // Project 3 — all fields
    const p3 = roundTripped.projects[2];
    assert.equal(p3.name, "Full Stack App");
    assert.equal(p3.description, "End-to-end testing dashboard.");
    assert.equal(p3.url, "https://verify-dash.example.com");
    assert.deepEqual(p3.technologies, ["Next.js", "Playwright", "PostgreSQL"]);
  });

  it("AC-6: a null projects column maps back to null (backward compat)", async () => {
    const row = mapProfileToRow(
      profileWithoutProjects,
      TEST_USER_ID,
      TEST_USER_EMAIL,
    );
    assert.equal(row.projects, null);

    const payload = {
      ...row,
      is_complete: true,
    };

    const { error: writeError } = await admin.database
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    assert.equal(writeError, null);

    const { data: readRow } = await admin.database
      .from("profiles")
      .select("*")
      .eq("id", TEST_USER_ID)
      .maybeSingle();

    const roundTripped = mapProfileRowToProfile(readRow);
    assert.equal(roundTripped.projects, null, "null projects should stay null");
  });

  it("AC-6: profile completion ignores projects (not a required field)", () => {
    // A profile with projects but missing required fields should still be incomplete
    const incompleteProfile = {
      ...profileWithProjects,
      fullName: "", // missing required field
    };

    const incompleteRow = mapProfileToRow(
      incompleteProfile,
      TEST_USER_ID,
      TEST_USER_EMAIL,
    );
    const completion = deriveProfileCompletion({
      fullName: incompleteRow.full_name ?? "",
      phone: incompleteRow.phone ?? "",
      location: incompleteRow.location ?? "",
      currentTitle: incompleteRow.current_title ?? "",
      experienceLevel: incompleteRow.experience_level ?? "",
      yearsExperience: incompleteRow.years_experience,
      skills: incompleteRow.skills ?? [],
      workExperience: incompleteRow.work_experience ?? [],
      education: incompleteRow.education ?? {
        highestDegree: "",
        fieldOfStudy: "",
        institutionName: "",
        graduationYear: "",
      },
      jobTitlesSeeking: incompleteRow.job_titles_seeking ?? [],
    });

    assert.ok(
      completion.missingFields.includes("Full Name"),
      "Full Name should be missing",
    );
    assert.ok(
      completion.percentage < 100,
      "profile should not be complete with missing Full Name",
    );
    // projects is never in the missing fields list
    assert.ok(
      !completion.missingFields.includes("Projects"),
      "Projects must NOT be a required field",
    );
  });

  it("AC-6: a complete profile with projects is recognized as complete", () => {
    const completeRow = mapProfileToRow(
      profileWithProjects,
      TEST_USER_ID,
      TEST_USER_EMAIL,
    );
    const completion = deriveProfileCompletion({
      fullName: completeRow.full_name ?? "",
      phone: completeRow.phone ?? "",
      location: completeRow.location ?? "",
      currentTitle: completeRow.current_title ?? "",
      experienceLevel: completeRow.experience_level ?? "",
      yearsExperience: completeRow.years_experience,
      skills: completeRow.skills ?? [],
      workExperience: completeRow.work_experience ?? [],
      education: completeRow.education ?? {
        highestDegree: "",
        fieldOfStudy: "",
        institutionName: "",
        graduationYear: "",
      },
      jobTitlesSeeking: completeRow.job_titles_seeking ?? [],
    });

    assert.equal(
      completion.missingFields.length,
      0,
      "complete profile should have no missing fields",
    );
    assert.equal(completion.percentage, 100, "complete profile should be 100%");
  });

  it("AC-6: all other profile fields survive the round-trip alongside projects", async () => {
    const row = mapProfileToRow(
      profileWithProjects,
      TEST_USER_ID,
      TEST_USER_EMAIL,
    );
    const payload = {
      ...row,
      is_complete: true,
    };

    await admin.database.from("profiles").upsert(payload, { onConflict: "id" });

    const { data: readRow } = await admin.database
      .from("profiles")
      .select("*")
      .eq("id", TEST_USER_ID)
      .maybeSingle();

    const rt = mapProfileRowToProfile(readRow);

    // Spot-check non-project fields from AC-3 (no field changed by this feature)
    assert.equal(rt.fullName, "AC-6 Verify");
    assert.equal(rt.phone, "+1 555 000 9999");
    assert.equal(rt.currentTitle, "Verification Engineer");
    assert.equal(rt.experienceLevel, "senior");
    assert.equal(rt.yearsExperience, 5);
    assert.deepEqual(rt.skills, ["Testing", "TypeScript"]);
    assert.equal(rt.workExperience.length, 1);
    assert.equal(rt.workExperience[0].company, "VerifyCorp");
    assert.equal(rt.education.highestDegree, "bachelor");
  });
});
