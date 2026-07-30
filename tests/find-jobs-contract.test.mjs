import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("find-jobs page redirects to login when there is no authenticated session", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /if \(error \|\| !data\.user\) \{/);
  assert.match(source, /redirect\("\/login\?error=session"\)/);

  const redirectIndex = source.indexOf('redirect("/login?error=session")');
  const returnIndex = source.indexOf("return (");
  assert.ok(
    redirectIndex < returnIndex,
    "the auth redirect must happen before the page renders its JSX",
  );
});

test("find-jobs page uses the server InsForge client, never the browser client", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /createInsforgeServer/);
  assert.doesNotMatch(source, /from ["']@\/lib\/insforge-client["']/);
});

test("proxy.ts protects the /find-jobs route", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /"\/find-jobs\/:path\*"/);
});

test("find-jobs page composes the shared Navbar and the interactive client component", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /<Navbar authenticated \/>/);
  assert.match(source, /<FindJobsPage \/>/);
});

test("job title and location inputs are real, unwired text inputs", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /id="job-title"/);
  assert.match(source, /id="location"/);
  assert.doesNotMatch(source, /onChange=\{.*job-?[Tt]itle/);
});

test("Find Jobs button reveals the results area via local state, not a network call", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /useState\(false\)/);
  assert.match(source, /setHasSearched\(true\)/);
  assert.doesNotMatch(source, /fetch\(/);
});

test("filter input and both dropdowns carry no filter, sort, or search behavior", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.doesNotMatch(source, /onChange/, "no control in this feature should be wired to onChange");
  assert.doesNotMatch(source, /\.filter\(/, "the mock dataset must never be filtered client side yet");
  assert.doesNotMatch(source, /\.sort\(/, "the mock dataset must never be sorted client side yet");
});

test("dropdowns are native selects, not custom listboxes", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /<select aria-label="Filter by match"/);
  assert.match(source, /<select\s[\s\S]*?aria-label="Sort by match score"/);
});

test("pagination buttons have no click handlers wired", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const paginationStart = source.indexOf('aria-label="Pagination"');
  assert.ok(paginationStart !== -1, "pagination nav not found");
  const paginationSection = source.slice(paginationStart);
  assert.doesNotMatch(paginationSection, /onClick/);
});

test("every interactive element carries the project's focus-visible treatment", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const focusVisibleClass =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const occurrences = source.split(focusVisibleClass).length - 1;

  // Find Jobs button, job title input, location input, filter input, select classes
  // (shared by both dropdowns), and the shared pagination button classes.
  assert.ok(
    occurrences >= 6,
    `expected the focus-visible treatment on every interactive element, found ${occurrences} occurrences`,
  );
});

test("the jobs table is wrapped in a horizontally scrolling container", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /overflow-x-auto/);
});

test("mock data shape mirrors the real jobs table's source check constraint", async () => {
  const source = await readProjectFile("lib/mock-jobs.ts");

  assert.match(source, /source: "search" \| "url"/);
});

test("match score tier classes map to the project's success/info/warning tokens, not hardcoded colors", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /high:\s*"bg-success"/);
  assert.match(source, /medium:\s*"bg-info-medium"/);
  assert.match(source, /low:\s*"bg-warning"/);
  assert.match(
    source,
    /const tier = getMatchScoreTier\(matchScore\)/,
    "the bar's color must be derived from the shared tier function, not a second, divergent threshold",
  );
});

test("source badge label and classes match the design for both search and url", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /search:\s*\{\s*label:\s*"Search",\s*className:\s*"bg-accent-muted text-accent"\s*\}/,
  );
  assert.match(
    source,
    /url:\s*\{\s*label:\s*"URL",\s*className:\s*"bg-surface-secondary text-text-secondary"\s*\}/,
  );
});

test("pagination shows the exact static results text and page numbers from the design", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /Showing/);
  assert.match(source, />1</);
  assert.match(source, />6</);
  assert.match(source, />24</);
  assert.match(source, /results/);
  assert.match(source, /const PAGE_NUMBERS = \[1, 2, 3, 8\]/);
});

test("only page 1 is marked aria-current, matching the design's active page state", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /aria-current=\{page === 1 \? "page" : undefined\}/);
});

test("the Previous button is disabled since page 1 is always the starting page", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const previousIndex = source.indexOf("Previous");
  assert.ok(previousIndex !== -1, "Previous button text not found");
  const buttonStart = source.lastIndexOf("<button", previousIndex);
  const buttonTag = source.slice(buttonStart, previousIndex);
  assert.match(buttonTag, /\bdisabled\b/);
});

test("the success banner and the results table are gated behind the exact same hasSearched flag", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const occurrences = source.split("{hasSearched ? (").length - 1;
  assert.equal(
    occurrences,
    2,
    "expected exactly two hasSearched-gated blocks (the banner and the results section); a third or a differently-named flag would let them go out of sync",
  );
  assert.doesNotMatch(
    source,
    /useState\(false\)[\s\S]*useState\(false\)/,
    "only one piece of state should gate the results area",
  );
});

test("both job title and location inputs have a visible, associated label", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /<label className=\{FIELD_LABEL_CLASSES\} htmlFor="job-title">/);
  assert.match(source, /<label className=\{FIELD_LABEL_CLASSES\} htmlFor="location">/);
});

test("the filter input and both dropdowns have an accessible name via aria-label", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /aria-label="Filter by company or role"/);
  assert.match(source, /aria-label="Filter by match"/);
  assert.match(source, /aria-label="Sort by match score"/);
});

test("every table column header uses scope=\"col\" for correct table semantics", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const headerMatches = source.match(/<th className="px-4 py-3" scope="col">/g) ?? [];
  assert.equal(headerMatches.length, 6, "expected all 6 column headers to use scope=\"col\"");
});

test("the pagination nav has an accessible name", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /<nav aria-label="Pagination"/);
});

test("find-jobs page provides a skip-to-content link that targets the actual main landmark", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /href="#main-content"/);
  assert.match(source, /id="main-content"/);
});

test("find-jobs files never use hardcoded hex colors or raw Tailwind color classes", async () => {
  const rawTailwindColor =
    /\b(?:bg|text|border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)-\d{2,3}\b/;

  for (const file of [
    "app/find-jobs/page.tsx",
    "components/find-jobs/FindJobsPage.tsx",
  ]) {
    const source = await readProjectFile(file);

    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file} contains a hardcoded hex color`);
    assert.doesNotMatch(
      source,
      rawTailwindColor,
      `${file} contains a raw Tailwind color class instead of a project token`,
    );
  }
});
