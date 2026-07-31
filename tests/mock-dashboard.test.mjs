import assert from "node:assert/strict";
import test from "node:test";

import {
  mockCompanyResearchActivity,
  mockJobsFoundOverTime,
  mockMatchScoreDistribution,
} from "../lib/mock-dashboard.ts";

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
