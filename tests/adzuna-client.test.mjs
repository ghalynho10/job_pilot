import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { detectCountry } from "../lib/adzuna.ts";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("detectCountry matches gb, au, ca keywords case-insensitively, and defaults to us", () => {
  assert.equal(detectCountry("London"), "gb");
  assert.equal(detectCountry("Remote, UK"), "gb");
  assert.equal(detectCountry("Sydney, Australia"), "au");
  assert.equal(detectCountry("Toronto, Canada"), "ca");
  assert.equal(detectCountry("New York, NY"), "us");
  assert.equal(detectCountry(""), "us");
  assert.equal(detectCountry("Remote"), "us");
});

test("searchJobs always includes category=it-jobs and results_per_page=10", async () => {
  const source = await readProjectFile("lib/adzuna.ts");

  assert.match(source, /category:\s*"it-jobs"/);
  assert.match(source, /results_per_page:\s*"10"/);
});

test("searchJobs only sets the where param when location is non-empty", async () => {
  const source = await readProjectFile("lib/adzuna.ts");

  assert.match(
    source,
    /if \(location\) \{\s*params\.set\("where", location\);\s*\}/,
    "where must be omitted entirely for an empty location, not sent as an empty string",
  );
});

test("searchJobs throws on a non-2xx response rather than silently returning an empty list", async () => {
  const source = await readProjectFile("lib/adzuna.ts");

  assert.match(
    source,
    /if \(!response\.ok\) \{\s*throw new Error\(`Adzuna API error: \$\{response\.status\}`\);\s*\}/,
  );
});

test("searchJobs defaults to an empty array when Adzuna returns no results field", async () => {
  const source = await readProjectFile("lib/adzuna.ts");

  assert.match(source, /return data\.results \|\| \[\];/);
});
