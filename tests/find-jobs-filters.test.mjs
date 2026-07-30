import assert from "node:assert/strict";
import test from "node:test";

import { filterJobs, paginateJobs, sortJobs } from "../lib/find-jobs-filters.ts";

function makeJob(overrides) {
  return {
    id: overrides.id ?? "job-1",
    run_id: null,
    source: "search",
    source_url: null,
    external_apply_url: null,
    title: overrides.title ?? "Software Engineer",
    company: overrides.company ?? "Acme",
    location: null,
    salary: null,
    job_type: null,
    about_role: null,
    match_score: overrides.match_score ?? 50,
    match_reason: null,
    matched_skills: null,
    missing_skills: null,
    found_at: overrides.found_at ?? "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("filterJobs: text filter matches company or title, case insensitive, as a substring (AC-3)", () => {
  const jobs = [
    makeJob({ id: "1", company: "Stripe", title: "Backend Engineer" }),
    makeJob({ id: "2", company: "Notion", title: "Frontend Engineer" }),
    makeJob({ id: "3", company: "Acme", title: "Data Scientist" }),
  ];

  assert.deepEqual(
    filterJobs(jobs, "engineer", "all").map((job) => job.id),
    ["1", "2"],
  );
  assert.deepEqual(
    filterJobs(jobs, "STRIPE", "all").map((job) => job.id),
    ["1"],
  );
  assert.deepEqual(
    filterJobs(jobs, "", "all").map((job) => job.id),
    ["1", "2", "3"],
  );
});

test("filterJobs: an empty jobs array returns empty for every filter combination, never throws", () => {
  assert.deepEqual(filterJobs([], "engineer", "high"), []);
  assert.deepEqual(filterJobs([], "", "all"), []);
});

test("filterJobs: text filter and match filter both apply together, not independently (AC-3, AC-4)", () => {
  const jobs = [
    makeJob({ id: "a", company: "Stripe", match_score: 90 }),
    makeJob({ id: "b", company: "Stripe", match_score: 40 }),
    makeJob({ id: "c", company: "Notion", match_score: 95 }),
  ];

  assert.deepEqual(
    filterJobs(jobs, "stripe", "high").map((job) => job.id),
    ["a"],
  );
});

test("filterJobs: High Match keeps only scores >= 70, Low Match keeps only scores < 70 (AC-4)", () => {
  const jobs = [
    makeJob({ id: "high", match_score: 70 }),
    makeJob({ id: "low", match_score: 69 }),
    makeJob({ id: "null", match_score: null }),
  ];

  assert.deepEqual(
    filterJobs(jobs, "", "high").map((job) => job.id),
    ["high"],
  );
  assert.deepEqual(
    filterJobs(jobs, "", "low").map((job) => job.id),
    ["low"],
  );
});

test("filterJobs: a null match_score is hidden by both High Match and Low Match (AC-4)", () => {
  const jobs = [makeJob({ id: "null", match_score: null })];

  assert.deepEqual(filterJobs(jobs, "", "high"), []);
  assert.deepEqual(filterJobs(jobs, "", "low"), []);
  assert.deepEqual(
    filterJobs(jobs, "", "all").map((job) => job.id),
    ["null"],
  );
});

test("sortJobs: match-score sorts highest first, null scores last (AC-5)", () => {
  const jobs = [
    makeJob({ id: "mid", match_score: 50 }),
    makeJob({ id: "null", match_score: null }),
    makeJob({ id: "high", match_score: 90 }),
  ];

  assert.deepEqual(
    sortJobs(jobs, "match-score").map((job) => job.id),
    ["high", "mid", "null"],
  );
});

test("sortJobs: newest and oldest sort by found_at (AC-5)", () => {
  const jobs = [
    makeJob({ id: "a", found_at: "2026-07-01T00:00:00.000Z" }),
    makeJob({ id: "b", found_at: "2026-07-03T00:00:00.000Z" }),
    makeJob({ id: "c", found_at: "2026-07-02T00:00:00.000Z" }),
  ];

  assert.deepEqual(
    sortJobs(jobs, "newest").map((job) => job.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    sortJobs(jobs, "oldest").map((job) => job.id),
    ["a", "c", "b"],
  );
});

test("sortJobs never mutates the input array", () => {
  const jobs = [makeJob({ id: "a", match_score: 10 }), makeJob({ id: "b", match_score: 90 })];
  const original = [...jobs];

  sortJobs(jobs, "match-score");

  assert.deepEqual(jobs, original);
});

test("paginateJobs slices at page boundaries (AC-6)", () => {
  const jobs = Array.from({ length: 45 }, (_, index) => makeJob({ id: String(index) }));

  assert.equal(paginateJobs(jobs, 1, 20).length, 20);
  assert.equal(paginateJobs(jobs, 1, 20)[0].id, "0");
  assert.equal(paginateJobs(jobs, 3, 20).length, 5);
  assert.equal(paginateJobs(jobs, 3, 20)[0].id, "40");
  assert.equal(paginateJobs(jobs, 4, 20).length, 0);
});

test("paginateJobs on an empty list returns an empty page, never throws (AC-6)", () => {
  assert.deepEqual(paginateJobs([], 1, 20), []);
});
