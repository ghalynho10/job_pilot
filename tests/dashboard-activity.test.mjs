import assert from "node:assert/strict";
import test from "node:test";

import { computeRecentActivity, formatTimeAgo } from "../lib/dashboard-activity.ts";

const now = new Date("2026-07-31T12:00:00.000Z");

test("formatTimeAgo formats minutes, hours, yesterday, and days correctly (feature 16)", () => {
  assert.equal(formatTimeAgo(new Date(now.getTime() - 30 * 1000).toISOString(), now), "Just now");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 1 * 60 * 1000).toISOString(), now), "1 min ago");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 10 * 60 * 1000).toISOString(), now), "10 mins ago");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 60 * 60 * 1000).toISOString(), now), "1 hour ago");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), now), "2 hours ago");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), now), "Yesterday");
  assert.equal(formatTimeAgo(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), now), "5 days ago");
});

test("computeRecentActivity merges agent_runs and researched jobs, sorted newest first (feature 16)", () => {
  const agentRuns = [
    {
      id: "run-1",
      job_title_searched: "Frontend Engineer",
      jobs_found: 8,
      completed_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    },
  ];
  const researchedJobs = [
    {
      id: "job-1",
      company: "Stripe",
      company_research_completed_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    },
  ];

  const activity = computeRecentActivity(agentRuns, researchedJobs, now);

  assert.equal(activity.length, 2);
  assert.equal(activity[0].title, "Found 8 jobs for Frontend Engineer");
  assert.equal(activity[0].dotColor, "success");
  assert.equal(activity[0].timestamp, "10 mins ago");
  assert.equal(activity[1].title, "Researched Stripe");
  assert.equal(activity[1].dotColor, "info");
  assert.equal(activity[1].timestamp, "1 hour ago");
});

test("computeRecentActivity caps the merged list at 8 entries (feature 16)", () => {
  const agentRuns = Array.from({ length: 6 }, (_, i) => ({
    id: `run-${i}`,
    job_title_searched: "Engineer",
    jobs_found: i,
    completed_at: new Date(now.getTime() - i * 60 * 1000).toISOString(),
  }));
  const researchedJobs = Array.from({ length: 6 }, (_, i) => ({
    id: `job-${i}`,
    company: `Company ${i}`,
    company_research_completed_at: new Date(now.getTime() - i * 60 * 1000).toISOString(),
  }));

  const activity = computeRecentActivity(agentRuns, researchedJobs, now);

  assert.equal(activity.length, 8);
});

test("computeRecentActivity ignores agent_runs with no completed_at and jobs with no research timestamp (feature 16)", () => {
  const agentRuns = [
    { id: "run-1", job_title_searched: "Engineer", jobs_found: 3, completed_at: null },
  ];
  const researchedJobs = [{ id: "job-1", company: "Acme", company_research_completed_at: null }];

  const activity = computeRecentActivity(agentRuns, researchedJobs, now);

  assert.equal(activity.length, 0);
});

test("computeRecentActivity falls back to 0 jobs and a generic label when data is missing (feature 16)", () => {
  const agentRuns = [
    {
      id: "run-1",
      job_title_searched: null,
      jobs_found: null,
      completed_at: now.toISOString(),
    },
  ];

  const activity = computeRecentActivity(agentRuns, [], now);

  assert.equal(activity[0].title, "Found 0 jobs for your search");
});

test("computeRecentActivity returns an empty list for a user with no activity yet (feature 16)", () => {
  assert.deepEqual(computeRecentActivity([], [], now), []);
});
