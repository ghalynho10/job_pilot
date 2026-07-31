import assert from "node:assert/strict";
import test from "node:test";

import { computeDashboardStats } from "../lib/dashboard-stats.ts";

const now = new Date("2026-07-31T12:00:00.000Z");

test("computeDashboardStats returns the four stat cards in the design's order (feature 15)", () => {
  const stats = computeDashboardStats([], now);

  assert.deepEqual(
    stats.map((stat) => stat.label),
    ["Total Jobs Found", "Avg. Match Rate", "Companies Researched", "Jobs This Week"],
  );
});

test("computeDashboardStats counts total jobs, average match score, and researched companies for the current user's rows only (feature 15)", () => {
  const jobs = [
    { match_score: 80, company_research: { summary: "x" }, found_at: "2026-01-01T00:00:00.000Z" },
    { match_score: 60, company_research: null, found_at: "2026-01-02T00:00:00.000Z" },
    { match_score: null, company_research: { summary: "y" }, found_at: "2026-01-03T00:00:00.000Z" },
  ];

  const stats = computeDashboardStats(jobs, now);

  assert.equal(stats[0].value, "3");
  assert.equal(stats[1].value, "70%");
  assert.equal(stats[2].value, "2");
});

test("computeDashboardStats shows N/A for the average match rate when no job has a score yet (feature 15)", () => {
  const jobs = [{ match_score: null, company_research: null, found_at: now.toISOString() }];

  const stats = computeDashboardStats(jobs, now);

  assert.equal(stats[1].value, "N/A");
});

test("computeDashboardStats counts jobs found within the last 7 days, excluding older ones (feature 15)", () => {
  const jobs = [
    { match_score: null, company_research: null, found_at: "2026-07-31T00:00:00.000Z" },
    { match_score: null, company_research: null, found_at: "2026-07-25T00:00:00.000Z" },
    { match_score: null, company_research: null, found_at: "2026-07-20T00:00:00.000Z" },
  ];

  const stats = computeDashboardStats(jobs, now);

  assert.equal(stats[3].value, "2");
});

test("computeDashboardStats returns all zero-value stats for a user with no jobs yet (feature 15)", () => {
  const stats = computeDashboardStats([], now);

  assert.deepEqual(
    stats.map((stat) => stat.value),
    ["0", "N/A", "0", "0"],
  );
});
