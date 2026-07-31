import assert from "node:assert/strict";
import test from "node:test";

import {
  mockActivity,
  mockCompanyResearchActivity,
  mockJobsFoundOverTime,
  mockMatchScoreDistribution,
  mockStats,
} from "../lib/mock-dashboard.ts";

test("mockStats has exactly the four stat cards from the design, in order (AC-1)", () => {
  assert.equal(mockStats.length, 4);
  assert.deepEqual(
    mockStats.map((stat) => stat.label),
    ["Total Jobs Found", "Avg. Match Rate", "Companies Researched", "Jobs This Week"],
  );
  assert.deepEqual(
    mockStats.map((stat) => stat.value),
    ["284", "82%", "35", "28"],
  );
});

test("mockStats only gives a trend to the two stats that show one in the design (AC-1)", () => {
  const [totalJobs, matchRate, companiesResearched, jobsThisWeek] = mockStats;

  assert.deepEqual(totalJobs.trend, { direction: "up", label: "vs last week" });
  assert.equal(totalJobs.caption, "+12%");
  assert.deepEqual(matchRate.trend, { direction: "up", label: "vs last week" });
  assert.equal(matchRate.caption, "+3%");

  assert.equal(companiesResearched.trend, undefined);
  assert.equal(companiesResearched.caption, "Total researched");
  assert.equal(jobsThisWeek.trend, undefined);
  assert.equal(jobsThisWeek.caption, "New this week");
});

test("mockActivity has exactly five entries in the design's order (AC-2)", () => {
  assert.equal(mockActivity.length, 5);
  assert.deepEqual(
    mockActivity.map((entry) => entry.title),
    [
      "Found 8 jobs for Frontend Engineer",
      "Researched Stripe",
      "Found 12 jobs for React Developer",
      "Researched Vercel",
      "Found 10 jobs for Full Stack Engineer",
    ],
  );
  assert.deepEqual(
    mockActivity.map((entry) => entry.timestamp),
    ["10 mins ago", "1 hour ago", "2 hours ago", "Yesterday", "Yesterday"],
  );
});

test("mockActivity entry ids are unique, so React keys never collide (AC-2)", () => {
  const ids = mockActivity.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("mockActivity dotColor is always one of the three tokenized tones (AC-2)", () => {
  for (const entry of mockActivity) {
    assert.ok(["accent", "info", "success"].includes(entry.dotColor), `unexpected dotColor "${entry.dotColor}"`);
  }
});

test("mockCompanyResearchActivity has seven Mon-to-Sun bars matching the design's values (AC-3)", () => {
  assert.deepEqual(
    mockCompanyResearchActivity,
    [
      { day: "Mon", count: 2 },
      { day: "Tue", count: 5 },
      { day: "Wed", count: 3 },
      { day: "Thu", count: 8 },
      { day: "Fri", count: 12 },
      { day: "Sat", count: 4 },
      { day: "Sun", count: 1 },
    ],
  );
});

test("mockJobsFoundOverTime has seven Mon-to-Sun points shaped like the design (dip after Tue, peak near Fri) (AC-4)", () => {
  assert.equal(mockJobsFoundOverTime.length, 7);
  assert.deepEqual(
    mockJobsFoundOverTime.map((point) => point.day),
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  );

  const counts = mockJobsFoundOverTime.map((point) => point.count);
  const [mon, tue, wed, , fri] = counts;

  assert.ok(tue > mon, "Tue should rise above Mon");
  assert.ok(wed < tue, "Wed should dip below Tue");
  assert.ok(fri === Math.max(...counts), "Fri should be the peak, matching the design");
});

test("mockMatchScoreDistribution has the five score bands with the design's relative sizes (AC-5)", () => {
  assert.deepEqual(
    mockMatchScoreDistribution.map((band) => band.band),
    ["50-60%", "60-70%", "70-80%", "80-90%", "90-100%"],
  );

  const counts = mockMatchScoreDistribution.map((band) => band.count);
  assert.ok(counts[3] === Math.max(...counts), "80-90% should be the tallest bar, matching the design");
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2] && counts[2] < counts[3], "bars should rise up to the peak");
});
