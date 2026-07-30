import assert from "node:assert/strict";
import test from "node:test";

import { getMatchScoreTier, mockJobs } from "../lib/mock-jobs.ts";

test("mock jobs dataset has exactly the 6 rows shown in the design", () => {
  assert.equal(mockJobs.length, 6);

  const companies = mockJobs.map((job) => job.company);
  assert.deepEqual(companies, [
    "Vercel",
    "Stripe",
    "Linear",
    "Notion",
    "OpenAI",
    "Figma",
  ]);
});

test("mock job ids are unique", () => {
  const ids = new Set(mockJobs.map((job) => job.id));
  assert.equal(ids.size, mockJobs.length);
});

test("mock job source values only ever match the real jobs.source check constraint", () => {
  for (const job of mockJobs) {
    assert.ok(
      job.source === "search" || job.source === "url",
      `unexpected source "${job.source}" for ${job.company}`,
    );
  }
});

test("match score tier matches the design's color bands for every mock row", () => {
  const expectedTiers = {
    Vercel: "high",
    Stripe: "medium",
    Linear: "high",
    Notion: "low",
    OpenAI: "high",
    Figma: "medium",
  };

  for (const job of mockJobs) {
    assert.equal(getMatchScoreTier(job.matchScore), expectedTiers[job.company]);
  }
});

test("getMatchScoreTier boundaries: 90+ high, 80-89 medium, below 80 low", () => {
  assert.equal(getMatchScoreTier(100), "high");
  assert.equal(getMatchScoreTier(90), "high");
  assert.equal(getMatchScoreTier(89), "medium");
  assert.equal(getMatchScoreTier(80), "medium");
  assert.equal(getMatchScoreTier(79), "low");
  assert.equal(getMatchScoreTier(0), "low");
});

test("every mock job has every field the jobs table shaped schema requires, non-empty", () => {
  const stringFields = [
    "id",
    "company",
    "title",
    "salary",
    "foundAtLabel",
    "location",
    "externalApplyUrl",
  ];

  for (const job of mockJobs) {
    for (const field of stringFields) {
      assert.equal(typeof job[field], "string", `${field} must be a string for ${job.company}`);
      assert.ok(job[field].length > 0, `${field} must not be empty for ${job.company}`);
    }
    assert.equal(typeof job.matchScore, "number");
    assert.ok(
      job.matchScore >= 0 && job.matchScore <= 100,
      `matchScore out of range for ${job.company}`,
    );
  }
});

test("salary is always a pre-formatted range, never a raw number the UI would have to format", () => {
  const salaryRange = /^\$\d+k - \$\d+k$/;

  for (const job of mockJobs) {
    assert.match(job.salary, salaryRange, `unexpected salary format for ${job.company}`);
  }
});

test("externalApplyUrl is always a well formed https URL", () => {
  for (const job of mockJobs) {
    assert.doesNotThrow(() => new URL(job.externalApplyUrl), `invalid URL for ${job.company}`);
    assert.match(job.externalApplyUrl, /^https:\/\//, `expected https for ${job.company}`);
  }
});
