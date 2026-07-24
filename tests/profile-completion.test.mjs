import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveProfileCompletion,
  isProfileComplete,
} from "../lib/profile-completion.ts";

const EMPTY_EDUCATION = {
  highestDegree: "",
  fieldOfStudy: "",
  institutionName: "",
  graduationYear: "",
};

const FULL_EDUCATION = {
  highestDegree: "bachelor",
  fieldOfStudy: "Computer Science",
  institutionName: "State University",
  graduationYear: "2020",
};

const emptyInput = {
  fullName: "",
  phone: "",
  location: "",
  currentTitle: "",
  experienceLevel: "",
  yearsExperience: null,
  skills: [],
  workExperience: [],
  education: EMPTY_EDUCATION,
  jobTitlesSeeking: [],
};

const fullInput = {
  fullName: "Verify Test",
  phone: "+1 555 000 1234",
  location: "Remote",
  currentTitle: "QA Engineer",
  experienceLevel: "junior",
  yearsExperience: 2,
  skills: ["Testing"],
  workExperience: [{ company: "Acme", jobTitle: "QA" }],
  education: FULL_EDUCATION,
  jobTitlesSeeking: ["Engineer", "Product Manager"],
};

test("returns 0% and lists all ten fields missing when every input is empty", () => {
  const result = deriveProfileCompletion(emptyInput);

  assert.equal(result.percentage, 0);
  assert.deepEqual(result.missingFields, [
    "Full Name",
    "Phone",
    "Location",
    "Current Title",
    "Experience Level",
    "Years of Experience",
    "Skills",
    "Work Experience",
    "Education",
    "Job Titles Seeking",
  ]);
});

test("returns 100% and no missing fields when every check passes", () => {
  const result = deriveProfileCompletion(fullInput);

  assert.equal(result.percentage, 100);
  assert.deepEqual(result.missingFields, []);
});

test("reproduces the design mock exactly: phone, location, and education missing gives 70%", () => {
  const result = deriveProfileCompletion({
    ...fullInput,
    phone: "",
    location: "",
    education: EMPTY_EDUCATION,
  });

  assert.equal(result.percentage, 70);
  assert.deepEqual(result.missingFields, ["Phone", "Location", "Education"]);
});

test("counts a years of experience of 0 as present, not missing", () => {
  const result = deriveProfileCompletion({ ...fullInput, yearsExperience: 0 });

  assert.ok(!result.missingFields.includes("Years of Experience"));
  assert.equal(result.percentage, 100);
});

test("counts a null years of experience as missing", () => {
  const result = deriveProfileCompletion({ ...fullInput, yearsExperience: null });

  assert.ok(result.missingFields.includes("Years of Experience"));
});

test("counts an empty highest degree as missing education, even with other education fields filled", () => {
  const result = deriveProfileCompletion({
    ...fullInput,
    education: { ...FULL_EDUCATION, highestDegree: "" },
  });

  assert.ok(result.missingFields.includes("Education"));
});

test("counts a work experience entry with every field left blank as satisfying the check", () => {
  const result = deriveProfileCompletion({
    ...fullInput,
    workExperience: [
      {
        company: "",
        jobTitle: "",
        startDate: "",
        endDate: "",
        currentlyWorkingHere: false,
        keyResponsibilities: "",
      },
    ],
  });

  assert.ok(
    !result.missingFields.includes("Work Experience"),
    "a present-but-blank entry is a known, accepted limitation of the presence check, not a bug",
  );
});

test("isProfileComplete returns true only when every check passes", () => {
  assert.equal(isProfileComplete(fullInput), true);
  assert.equal(isProfileComplete(emptyInput), false);
  assert.equal(isProfileComplete({ ...fullInput, skills: [] }), false);
});
