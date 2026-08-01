import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractedProfileSchema } from "../agent/resume-extractor.ts";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

function validExtraction(overrides = {}) {
  return {
    fullName: "Jane Doe",
    phone: "555-0100",
    location: "Remote",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    portfolioUrl: "",
    workAuthorization: "citizen",
    currentTitle: "Software Engineer",
    experienceLevel: "senior",
    yearsExperience: 8,
    skills: ["TypeScript", "React"],
    industries: ["Software"],
    workExperience: [],
    education: {
      highestDegree: "bachelor",
      fieldOfStudy: "Computer Science",
      institutionName: "State University",
      graduationYear: "2016",
    },
    ...overrides,
  };
}

function workExperienceEntry(company) {
  return {
    company,
    jobTitle: "Engineer",
    startDate: "2020",
    endDate: "2022",
    currentlyWorkingHere: false,
    keyResponsibilities: "Built things.",
  };
}

test("extractedProfileSchema accepts a well formed GPT-4o response as is", () => {
  const result = extractedProfileSchema.parse(validExtraction());

  assert.equal(result.fullName, "Jane Doe");
  assert.equal(result.workAuthorization, "citizen");
  assert.equal(result.yearsExperience, 8);
});

test("extractedProfileSchema coerces an out of range workAuthorization to empty string instead of failing", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({ workAuthorization: "not_a_real_value" }),
  );

  assert.equal(result.workAuthorization, "");
});

test("extractedProfileSchema coerces an out of range experienceLevel and education.highestDegree to empty string", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({
      experienceLevel: "expert",
      education: {
        highestDegree: "phd",
        fieldOfStudy: "Physics",
        institutionName: "Tech Institute",
        graduationYear: "2010",
      },
    }),
  );

  assert.equal(result.experienceLevel, "");
  assert.equal(result.education.highestDegree, "");
  assert.equal(
    result.education.fieldOfStudy,
    "Physics",
    "sibling fields on the same object must survive one bad enum field",
  );
});

test("extractedProfileSchema coerces a malformed yearsExperience to empty string rather than failing the whole extraction", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({ yearsExperience: "about 8 years" }),
  );

  assert.equal(result.yearsExperience, "");
  assert.equal(
    result.fullName,
    "Jane Doe",
    "the rest of the extraction must still come through",
  );
});

test("extractedProfileSchema falls back to an empty array when skills is missing or the wrong type", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({ skills: "TypeScript, React" }),
  );

  assert.deepEqual(result.skills, []);
});

test("extractedProfileSchema caps workExperience at the 3 most recent entries instead of discarding all of them", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({
      workExperience: [
        workExperienceEntry("A"),
        workExperienceEntry("B"),
        workExperienceEntry("C"),
        workExperienceEntry("D"),
        workExperienceEntry("E"),
      ],
    }),
  );

  assert.equal(result.workExperience.length, 3);
  assert.deepEqual(
    result.workExperience.map((entry) => entry.company),
    ["A", "B", "C"],
    "capping must keep the first 3 entries GPT-4o returned (most recent/relevant first), not wipe them all",
  );
});

test("extractedProfileSchema never produces a field for email or job preferences", () => {
  const parsed = extractedProfileSchema.parse(
    validExtraction({
      email: "jane@example.com",
      jobTitlesSeeking: "Staff Engineer",
    }),
  );

  assert.equal("email" in parsed, false);
  assert.equal("jobTitlesSeeking" in parsed, false);
  assert.equal("remotePreference" in parsed, false);
  assert.equal("salaryExpectation" in parsed, false);
  assert.equal("preferredLocations" in parsed, false);
});

test("extractedProfileSchema safeParse fails outright when GPT-4o returns valid JSON that isn't an object at all", () => {
  const asArray = extractedProfileSchema.safeParse(["not", "an", "object"]);
  const asString = extractedProfileSchema.safeParse("just a string");
  const asNull = extractedProfileSchema.safeParse(null);

  assert.equal(
    asArray.success,
    false,
    "an array response has no fields to coerce and must fail validation",
  );
  assert.equal(asString.success, false);
  assert.equal(asNull.success, false);
});

test("extractedProfileSchema falls back to an empty projects array when projects is missing or wrong type (AC-2)", () => {
  const noProjects = extractedProfileSchema.parse(validExtraction());
  assert.deepEqual(
    noProjects.projects,
    [],
    "missing projects must default to empty array",
  );

  const wrongType = extractedProfileSchema.parse(
    validExtraction({ projects: "not an array" }),
  );
  assert.deepEqual(
    wrongType.projects,
    [],
    "wrong type for projects must fall back to empty array",
  );
});

test("extractedProfileSchema keeps only projects with a non empty name and caps at 5 (AC-1, AC-4)", () => {
  const result = extractedProfileSchema.parse(
    validExtraction({
      projects: [
        {
          name: "App One",
          description: "First",
          url: "https://one.com",
          technologies: ["Go"],
        },
        { name: "", description: "No name" },
        { name: "App Two" },
        { name: "App Three" },
        { name: "App Four" },
        { name: "App Five" },
        { name: "App Six" },
      ],
    }),
  );

  assert.equal(
    result.projects.length,
    5,
    "must filter nameless projects first, then cap at 5 named projects",
  );
  assert.equal(
    result.projects[0].name,
    "App One",
    "project with a name must come through",
  );
  assert.equal(result.projects[0].technologies.length, 1);
  assert.equal(
    result.projects.every((p) => p.name.length > 0),
    true,
    "projects without a name must be filtered out",
  );
});

test("extractProfileFromResumeText handles the GPT-4o call, JSON parsing, and validation failures it cannot unit test directly (no network mocking in this project)", async () => {
  const source = await readProjectFile("agent/resume-extractor.ts");

  assert.match(
    source,
    /if \(!rawContent\) \{\s*return \{ success: false, error: "Extraction returned no content\. Please try again\." \};/,
    "an empty GPT-4o response must return a clear error, not throw or return undefined data",
  );
  assert.match(
    source,
    /catch \(parseError\) \{\s*console\.error\("\[agent\/resume-extractor\]", parseError\);\s*return \{ success: false, error: "Extraction returned an unreadable response\. Please try again\." \};/,
    "a JSON.parse failure on the GPT-4o response must be caught and return a clear error, never throw uncaught",
  );
  assert.match(
    source,
    /if \(!validated\.success\) \{\s*console\.error\("\[agent\/resume-extractor\]", validated\.error\);\s*return \{ success: false, error: "Extraction returned an unexpected response\. Please try again\." \};/,
    "a schema validation failure (e.g. GPT-4o returning a JSON array instead of an object) must return a clear error",
  );
  assert.match(
    source,
    /\} catch \(error\) \{\s*console\.error\("\[agent\/resume-extractor\]", error\);\s*return \{ success: false, error: "Something went wrong extracting your profile\. Please try again\." \};/,
    "any other failure (e.g. the OpenAI call itself throwing) must be caught by the top level try/catch, never crash the route",
  );
});
