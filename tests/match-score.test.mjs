import assert from "node:assert/strict";
import test from "node:test";

import { getMatchScoreTier } from "../lib/match-score.ts";

test("getMatchScoreTier boundaries: 90+ high, 80-89 medium, below 80 low", () => {
  assert.equal(getMatchScoreTier(100), "high");
  assert.equal(getMatchScoreTier(90), "high");
  assert.equal(getMatchScoreTier(89), "medium");
  assert.equal(getMatchScoreTier(80), "medium");
  assert.equal(getMatchScoreTier(79), "low");
  assert.equal(getMatchScoreTier(0), "low");
});
