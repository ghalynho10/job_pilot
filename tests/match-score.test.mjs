import assert from "node:assert/strict";
import test from "node:test";

import { getMatchScoreTier, MATCH_THRESHOLD } from "../lib/match-score.ts";

test("getMatchScoreTier boundaries: 90+ high, 80-89 medium, below 80 low", () => {
  assert.equal(getMatchScoreTier(100), "high");
  assert.equal(getMatchScoreTier(90), "high");
  assert.equal(getMatchScoreTier(89), "medium");
  assert.equal(getMatchScoreTier(80), "medium");
  assert.equal(getMatchScoreTier(79), "low");
  assert.equal(getMatchScoreTier(0), "low");
});

test("MATCH_THRESHOLD is the single shared strong-match cutoff, 70, that agent/adzuna.ts and lib/find-jobs-filters.ts both import (AC-4)", () => {
  assert.equal(MATCH_THRESHOLD, 70);
});
