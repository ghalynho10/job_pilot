import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmptyProfile,
  mapProfileRowToProfile,
  mapProfileToRow,
} from "../lib/profile-mapping.ts";

const baseProfile = {
  fullName: "  Verify Test  ",
  email: "verify@example.com",
  phone: "",
  location: "",
  linkedinUrl: "",
  portfolioUrl: "",
  workAuthorization: "",
  currentTitle: "",
  experienceLevel: "",
  yearsExperience: "",
  skills: [],
  industries: [],
  workExperience: [],
  education: {
    highestDegree: "",
    fieldOfStudy: "",
    institutionName: "",
    graduationYear: "",
  },
  jobTitlesSeeking: "",
  remotePreference: "",
  salaryExpectation: "",
  preferredLocations: "",
};

test("trims whitespace and converts empty strings to null for free text fields", () => {
  const row = mapProfileToRow(baseProfile, "user-1", "verify@example.com");

  assert.equal(row.full_name, "Verify Test");
  assert.equal(row.phone, null);
  assert.equal(row.location, null);
});

test("converts an unset enum-like field to null, and passes through a set one unchanged", () => {
  const unset = mapProfileToRow(baseProfile, "user-1", "e@e.com");
  const set = mapProfileToRow(
    { ...baseProfile, workAuthorization: "citizen" },
    "user-1",
    "e@e.com",
  );

  assert.equal(unset.work_authorization, null);
  assert.equal(set.work_authorization, "citizen");
});

test("splits, trims, and drops empty entries when converting comma separated text to an array", () => {
  const row = mapProfileToRow(
    { ...baseProfile, jobTitlesSeeking: "Engineer, , Product Manager" },
    "user-1",
    "e@e.com",
  );

  assert.deepEqual(row.job_titles_seeking, ["Engineer", "Product Manager"]);
});

test("converts a comma-and-whitespace-only string to an empty array, not an array of blanks", () => {
  const row = mapProfileToRow(
    { ...baseProfile, preferredLocations: " , , " },
    "user-1",
    "e@e.com",
  );

  assert.deepEqual(row.preferred_locations, []);
});

test("deduplicates and trims skills, dropping empty entries", () => {
  const row = mapProfileToRow(
    { ...baseProfile, skills: ["React", " React", "", "TypeScript"] },
    "user-1",
    "e@e.com",
  );

  assert.deepEqual(row.skills, ["React", "TypeScript"]);
});

test("truncates a decimal years of experience to an integer", () => {
  const row = mapProfileToRow(
    { ...baseProfile, yearsExperience: 4.9 },
    "user-1",
    "e@e.com",
  );

  assert.equal(row.years_experience, 4);
});

test("treats an empty years of experience as null", () => {
  const row = mapProfileToRow(
    { ...baseProfile, yearsExperience: "" },
    "user-1",
    "e@e.com",
  );

  assert.equal(row.years_experience, null);
});

test("treats a negative years of experience as null rather than storing a negative number", () => {
  const row = mapProfileToRow(
    { ...baseProfile, yearsExperience: -5 },
    "user-1",
    "e@e.com",
  );

  assert.equal(row.years_experience, null);
});

test("passes work experience and education through unchanged", () => {
  const workExperience = [{ company: "Acme", jobTitle: "QA" }];
  const education = { highestDegree: "bachelor", fieldOfStudy: "CS", institutionName: "", graduationYear: "" };
  const row = mapProfileToRow(
    { ...baseProfile, workExperience, education },
    "user-1",
    "e@e.com",
  );

  assert.deepEqual(row.work_experience, workExperience);
  assert.deepEqual(row.education, education);
});

test("always takes id and email from the session values passed in, not from the profile object", () => {
  const row = mapProfileToRow(baseProfile, "the-real-user-id", "session@example.com");

  assert.equal(row.id, "the-real-user-id");
  assert.equal(row.email, "session@example.com");
});

test("mapProfileRowToProfile fills every field with an empty-equivalent default when the row is all null", () => {
  const nullRow = {
    id: "user-1",
    full_name: null,
    email: null,
    phone: null,
    location: null,
    current_title: null,
    experience_level: null,
    years_experience: null,
    skills: null,
    industries: null,
    work_experience: null,
    education: null,
    job_titles_seeking: null,
    remote_preference: null,
    preferred_locations: null,
    salary_expectation: null,
    cover_letter_tone: null,
    linkedin_url: null,
    portfolio_url: null,
    work_authorization: null,
    resume_pdf_url: null,
    is_complete: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const profile = mapProfileRowToProfile(nullRow);

  assert.equal(profile.fullName, "");
  assert.equal(profile.email, "");
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(profile.workExperience, []);
  assert.deepEqual(profile.education, {
    highestDegree: "",
    fieldOfStudy: "",
    institutionName: "",
    graduationYear: "",
  });
  assert.equal(profile.jobTitlesSeeking, "");
});

test("mapProfileRowToProfile joins array columns back into comma separated strings", () => {
  const row = {
    id: "user-1",
    full_name: "Verify Test",
    email: "e@e.com",
    phone: null,
    location: null,
    current_title: null,
    experience_level: null,
    years_experience: null,
    skills: [],
    industries: [],
    work_experience: [],
    education: null,
    job_titles_seeking: ["Engineer", "Product Manager"],
    remote_preference: null,
    preferred_locations: ["New York", "London"],
    salary_expectation: null,
    cover_letter_tone: null,
    linkedin_url: null,
    portfolio_url: null,
    work_authorization: null,
    resume_pdf_url: null,
    is_complete: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const profile = mapProfileRowToProfile(row);

  assert.equal(profile.jobTitlesSeeking, "Engineer, Product Manager");
  assert.equal(profile.preferredLocations, "New York, London");
});

test("round trips a fully populated, already-normalized profile through both mapping directions without losing data", () => {
  const normalizedProfile = {
    fullName: "Verify Test",
    email: "verify@example.com",
    phone: "+1 555 000 1234",
    location: "Remote",
    linkedinUrl: "https://linkedin.com/in/verify",
    portfolioUrl: "https://github.com/verify",
    workAuthorization: "citizen",
    currentTitle: "QA Engineer",
    experienceLevel: "junior",
    yearsExperience: 2,
    skills: ["Testing", "Automation"],
    industries: ["FinTech"],
    workExperience: [
      {
        company: "Acme",
        jobTitle: "QA",
        startDate: "2022-01",
        endDate: "",
        currentlyWorkingHere: true,
        keyResponsibilities: "Tested things.",
      },
    ],
    education: {
      highestDegree: "bachelor",
      fieldOfStudy: "Computer Science",
      institutionName: "State University",
      graduationYear: "2020",
    },
    jobTitlesSeeking: "Engineer, Product Manager",
    remotePreference: "remote",
    salaryExpectation: "$120k+",
    preferredLocations: "New York, London",
    projects: null,
  };

  const row = mapProfileToRow(normalizedProfile, "user-1", normalizedProfile.email);
  const fullRow = {
    id: "user-1",
    cover_letter_tone: null,
    resume_pdf_url: null,
    is_complete: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...row,
  };
  const roundTripped = mapProfileRowToProfile(fullRow);

  assert.deepEqual(roundTripped, normalizedProfile);
});

test("buildEmptyProfile pre-fills only the email field, leaving everything else empty", () => {
  const profile = buildEmptyProfile("new-user@example.com");

  assert.equal(profile.email, "new-user@example.com");
  assert.equal(profile.fullName, "");
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(profile.workExperience, []);
  assert.equal(profile.jobTitlesSeeking, "");
  assert.deepEqual(profile.education, {
    highestDegree: "",
    fieldOfStudy: "",
    institutionName: "",
    graduationYear: "",
  });
  assert.equal(profile.projects, null);
});

test("round trips projects through both mapping directions", () => {
  const profile = buildEmptyProfile("proj@example.com");
  profile.projects = [
    { name: "My App", description: "A web app", url: "https://github.com/me/app", technologies: ["React", "TypeScript"] },
    { name: "CLI Tool", description: "", url: "", technologies: [] },
  ];

  const row = mapProfileToRow(profile, "user-1", profile.email);
  assert.deepEqual(row.projects, profile.projects);

  const roundTripped = mapProfileRowToProfile({
    ...row,
    id: "user-1",
    cover_letter_tone: null,
    resume_pdf_url: null,
    is_complete: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(roundTripped.projects, profile.projects);
});

test("mapProfileRowToProfile treats a null projects column as null", () => {
  const profile = mapProfileRowToProfile({
    id: "user-1",
    full_name: null,
    email: null,
    phone: null,
    location: null,
    current_title: null,
    experience_level: null,
    years_experience: null,
    skills: null,
    industries: null,
    work_experience: null,
    education: null,
    job_titles_seeking: null,
    remote_preference: null,
    preferred_locations: null,
    salary_expectation: null,
    linkedin_url: null,
    portfolio_url: null,
    work_authorization: null,
    resume_pdf_url: null,
    projects: null,
    is_complete: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(profile.projects, null);
});
