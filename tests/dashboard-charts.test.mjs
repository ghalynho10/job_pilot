import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCompanyResearchActivity,
  computeJobsFoundOverTime,
  computeMatchScoreDistribution,
} from "../lib/dashboard-charts.ts";

// 2026-07-31 is a Friday in UTC. Midday so the tests never sit on a day boundary by accident.
const now = new Date("2026-07-31T12:00:00.000Z");

const DAY_MS = 24 * 60 * 60 * 1000;

function foundAt(iso) {
  return { found_at: iso };
}

function researchedAt(iso) {
  return { company_research_completed_at: iso };
}

function scored(score) {
  return { match_score: score };
}

test("computeJobsFoundOverTime always returns exactly 30 zero filled days, even with no jobs (AC-1)", () => {
  const days = computeJobsFoundOverTime([], now);

  assert.equal(days.length, 30);
  assert.ok(
    days.every((day) => day.count === 0),
    "every day should be zero filled when the user has no jobs",
  );
});

test("computeJobsFoundOverTime labels the window from 29 days ago through today, in UTC short dates (AC-1)", () => {
  const days = computeJobsFoundOverTime([], now);

  assert.equal(days[0].day, "Jul 2", "the window should start 29 days before today");
  assert.equal(days[29].day, "Jul 31", "the window should end on today");
});

test("computeJobsFoundOverTime buckets jobs by UTC calendar day, counting repeats on the same day (AC-1)", () => {
  const days = computeJobsFoundOverTime(
    [
      foundAt("2026-07-31T00:00:00.000Z"),
      foundAt("2026-07-31T23:59:59.999Z"),
      foundAt("2026-07-30T08:00:00.000Z"),
    ],
    now,
  );

  assert.equal(days[29].count, 2, "both of today's jobs land in the last bucket");
  assert.equal(days[28].count, 1, "yesterday's job lands in its own bucket");
  assert.equal(
    days.slice(0, 28).reduce((sum, day) => sum + day.count, 0),
    0,
    "no other day should have picked anything up",
  );
});

test("computeJobsFoundOverTime includes the window's first UTC midnight and excludes the moment before it (AC-1)", () => {
  const windowStart = new Date("2026-07-02T00:00:00.000Z");
  const justBefore = new Date(windowStart.getTime() - 1);

  const included = computeJobsFoundOverTime([foundAt(windowStart.toISOString())], now);
  assert.equal(included[0].count, 1, "a job at the exact start of the window is counted");

  const excluded = computeJobsFoundOverTime([foundAt(justBefore.toISOString())], now);
  assert.equal(
    excluded.reduce((sum, day) => sum + day.count, 0),
    0,
    "a job one millisecond before the window is dropped, never folded into the first bucket",
  );
});

test("computeJobsFoundOverTime drops jobs from the future and from long before the window (AC-1)", () => {
  const days = computeJobsFoundOverTime(
    [
      foundAt(new Date(now.getTime() + 5 * DAY_MS).toISOString()),
      foundAt("2026-01-01T00:00:00.000Z"),
    ],
    now,
  );

  assert.equal(days.length, 30);
  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    0,
  );
});

test("computeCompanyResearchActivity always returns exactly 7 zero filled days with weekday labels (AC-3)", () => {
  const days = computeCompanyResearchActivity([], now);

  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((day) => day.day),
    ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    "a rolling window ending on Friday 2026-07-31, oldest to newest, not a fixed Monday to Sunday week",
  );
  assert.ok(days.every((day) => day.count === 0));
});

test("computeCompanyResearchActivity counts only rows inside the rolling 7 day window (AC-3)", () => {
  const days = computeCompanyResearchActivity(
    [
      researchedAt("2026-07-31T09:00:00.000Z"),
      researchedAt("2026-07-25T09:00:00.000Z"),
      researchedAt("2026-07-24T23:59:59.999Z"),
    ],
    now,
  );

  assert.equal(days[6].count, 1, "today is counted");
  assert.equal(days[0].count, 1, "the oldest day in the window is counted");
  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    2,
    "the row one day outside the window is dropped",
  );
});

test("a malformed timestamp drops only its own row, never throwing and failing the whole render", () => {
  const jobs = [
    foundAt("not a date"),
    foundAt(""),
    foundAt("2026-13-45T99:99:99.000Z"),
    foundAt("2026-07-31T09:00:00.000Z"),
  ];

  const days = computeJobsFoundOverTime(jobs, now);

  assert.equal(days.length, 30, "the window is still fully built");
  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    1,
    "only the one well formed timestamp is counted",
  );
  assert.equal(days[29].count, 1);
});

test("a malformed research timestamp is dropped the same way, on the 7 day window too", () => {
  const days = computeCompanyResearchActivity(
    [researchedAt("garbage"), researchedAt("2026-07-31T09:00:00.000Z")],
    now,
  );

  assert.equal(days.length, 7);
  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    1,
  );
});

test("computeCompanyResearchActivity ignores jobs that were never researched (AC-3)", () => {
  const days = computeCompanyResearchActivity(
    [researchedAt(null), researchedAt(null), researchedAt("2026-07-31T09:00:00.000Z")],
    now,
  );

  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    1,
    "a null company_research_completed_at is excluded, never coerced into a bucket",
  );
});

test("computeMatchScoreDistribution returns the five bands in order, zeroed when there is nothing to count (AC-2)", () => {
  const bands = computeMatchScoreDistribution([]);

  assert.deepEqual(
    bands.map((band) => band.band),
    ["50-60%", "60-70%", "70-80%", "80-90%", "90-100%"],
  );
  assert.ok(bands.every((band) => band.count === 0));
});

test("computeMatchScoreDistribution puts each band boundary in the lower band, upper edge exclusive (AC-2)", () => {
  const bands = computeMatchScoreDistribution([
    scored(50),
    scored(59),
    scored(60),
    scored(69),
    scored(70),
    scored(79),
    scored(80),
    scored(89),
    scored(90),
    scored(99),
  ]);

  assert.deepEqual(
    bands.map((band) => band.count),
    [2, 2, 2, 2, 2],
    "50 and 59 in the first band, 60 starts the second, and so on up",
  );
});

test("computeMatchScoreDistribution counts a perfect 100 in the top band, its one inclusive upper edge (AC-2)", () => {
  const bands = computeMatchScoreDistribution([scored(100), scored(90)]);

  assert.equal(bands[4].count, 2, "the 90-100% band includes 100 itself");
  assert.equal(
    bands.slice(0, 4).reduce((sum, band) => sum + band.count, 0),
    0,
  );
});

test("computeMatchScoreDistribution excludes null scores and scores below 50, never coercing them into a band (AC-2)", () => {
  const bands = computeMatchScoreDistribution([
    scored(null),
    scored(0),
    scored(49),
    scored(75),
  ]);

  assert.equal(
    bands.reduce((sum, band) => sum + band.count, 0),
    1,
    "only the 75 is counted; the null and both sub 50 scores are dropped",
  );
  assert.equal(bands[2].count, 1);
});

test("computeMatchScoreDistribution is all time, ignoring how old a job is (AC-2)", () => {
  const bands = computeMatchScoreDistribution([
    { match_score: 95, found_at: "2020-01-01T00:00:00.000Z" },
    { match_score: 95, found_at: now.toISOString() },
  ]);

  assert.equal(bands[4].count, 2, "no date window is applied to the score distribution");
});

test("every compute function defaults now to the current time, matching the dashboard-stats signature", () => {
  assert.equal(computeJobsFoundOverTime([]).length, 30);
  assert.equal(computeCompanyResearchActivity([]).length, 7);
});
