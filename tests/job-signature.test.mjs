import assert from "node:assert/strict";
import test from "node:test";

import { jobSignature } from "../lib/job-signature.ts";

// These execute the function rather than asserting regexes against its source,
// so they still hold if it is rewritten. The duplicates below are real pairs
// observed in Adzuna results, not invented cases.

test("the same role at the same company in the same place for the same money is one job", () => {
  assert.equal(
    jobSignature("Vestmark, Inc.", "Software Engineer", "Wakefield, MA", "$83k"),
    jobSignature("Vestmark, Inc.", "Software Engineer", "Wakefield, MA", "$83k"),
  );
});

test("casing and surrounding whitespace do not defeat the comparison", () => {
  assert.equal(
    jobSignature("  Two Six Technologies ", "Software Engineer", " Arlington, VA", "$111k"),
    jobSignature("two six technologies", "software engineer", "arlington, va", "$111k"),
  );
});

// The case that matters most. Merging these would hide a real opening, which is
// strictly worse than showing a duplicate: a duplicate is noise the user can
// skip past, a false merge is a job they never learn exists.
test("the same role at the same company for the same money in a DIFFERENT city is two jobs", () => {
  assert.notEqual(
    jobSignature("Amazon", "Software Development Engineer", "Seattle, WA", "$208k"),
    jobSignature("Amazon", "Software Development Engineer", "Arlington, VA", "$208k"),
  );
});

test("a remote posting is distinct from an onsite one at the same company, title and pay", () => {
  assert.notEqual(
    jobSignature("Capital One", "Lead AI Engineer", "Remote", "$160k"),
    jobSignature("Capital One", "Lead AI Engineer", "McLean, VA", "$160k"),
  );
});

test("a different employer is a different job", () => {
  assert.notEqual(
    jobSignature("Vestmark, Inc.", "Software Engineer", "Boston, MA", "$83k"),
    jobSignature("Southwest Airlines", "Software Engineer", "Boston, MA", "$83k"),
  );
});

test("a different role at the same employer is a different job", () => {
  assert.notEqual(
    jobSignature("Capital One", "Distinguished AI Engineer", "McLean, VA", "$195k"),
    jobSignature("Capital One", "Senior AI Engineer", "McLean, VA", "$195k"),
  );
});

test("the same role at different pay is a different job", () => {
  // Capital One listed two Distinguished AI Engineer roles at $195k and $191k.
  // Different money means a genuinely different posting, so both are kept.
  assert.notEqual(
    jobSignature("Capital One", "Distinguished AI Engineer", "McLean, VA", "$195k"),
    jobSignature("Capital One", "Distinguished AI Engineer", "McLean, VA", "$191k"),
  );
});

test("a missing salary is stable, and distinct from any stated salary", () => {
  assert.equal(
    jobSignature("Stride, Inc.", "AI Engineer", "New York, NY", null),
    jobSignature("Stride, Inc.", "AI Engineer", "New York, NY", null),
  );
  assert.notEqual(
    jobSignature("Stride, Inc.", "AI Engineer", "New York, NY", null),
    jobSignature("Stride, Inc.", "AI Engineer", "New York, NY", "$101k"),
  );
});

test("a missing location is stable, and distinct from any stated location", () => {
  assert.equal(
    jobSignature("Stride, Inc.", "AI Engineer", "", "$101k"),
    jobSignature("Stride, Inc.", "AI Engineer", "", "$101k"),
  );
  assert.notEqual(
    jobSignature("Stride, Inc.", "AI Engineer", "", "$101k"),
    jobSignature("Stride, Inc.", "AI Engineer", "New York, NY", "$101k"),
  );
});

test("no field can be smeared into another by a value containing the separator", () => {
  // "a|b" as a company must not collide with company "a" and title "b".
  assert.notEqual(
    jobSignature("a|b", "c", "d", null),
    jobSignature("a", "b|c", "d", null),
  );
  assert.notEqual(
    jobSignature("a", "b", "c|d", null),
    jobSignature("a", "b|c", "d", null),
  );
});
