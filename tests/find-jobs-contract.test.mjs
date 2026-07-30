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
  assert.match(source, /<FindJobsPage hasSkills=\{hasSkills\} userId=\{data\.user\.id\} \/>/);
});

test("job title and location inputs are real, controlled text inputs wired to state", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /id="job-title"/);
  assert.match(source, /id="location"/);
  assert.match(source, /onChange=\{\(event\) => setJobTitle\(event\.target\.value\)\}/);
  assert.match(source, /onChange=\{\(event\) => setLocation\(event\.target\.value\)\}/);
});

test("Find Jobs button triggers a real search request against the agent endpoint", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /fetch\("\/api\/agent\/find"/);
  assert.match(source, /method: "POST"/);
});

test("the filter input and both dropdowns still carry no filter, sort, or search behavior (feature 11's scope)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.doesNotMatch(
    source,
    /aria-label="Filter by company or role"[\s\S]{0,200}onChange/,
    "the filter input must not be wired yet",
  );
  assert.doesNotMatch(source, /\.filter\(/, "the fetched jobs must never be filtered client side yet");
  assert.doesNotMatch(source, /\.sort\(/, "the fetched jobs must never be sorted client side yet");
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

test("JobRow's source field shape mirrors the real jobs table's source check constraint", async () => {
  const source = await readProjectFile("types/index.ts");

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

test("pagination footer still shows the page number set and results copy from the design", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /Showing/);
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

test("the results table only renders once a search actually succeeded with real jobs", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /status === "success" && jobs\.length > 0 \? \(/);
});

test("the search status is a single state machine, not scattered booleans", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /useState<SearchStatus>\("idle"\)/,
    "the page's search lifecycle should be one typed status value",
  );
});

test("a search with no results shows a distinct empty state, not the success banner", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /status === "empty"/);
  assert.match(source, /No jobs found for that search/);
});

test("a failed search shows an alert, not a silent failure", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /status === "error"/);
  assert.match(source, /role="alert"/);
});

test("the search inputs and button are disabled while a search is in flight", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /disabled=\{!hasSkills \|\| isLoading\}/);
  assert.match(source, /disabled=\{!hasSkills \|\| isLoading \|\| jobTitle\.trim\(\)\.length === 0\}/);
});

test("a profile with no skills blocks the search before any request is made", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /if \(!hasSkills \|\| isLoading\) \{\s*return;/);
  assert.match(source, /Add your skills to your profile before searching for jobs\./);
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

test("find-jobs page derives hasSkills from the real skills array, not just an existing profile row", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(
    source,
    /const hasSkills = Boolean\(profileRow\?\.skills && profileRow\.skills\.length > 0\);/,
    "a profile row with an empty skills array must still block searching, matching AC-3",
  );
});

test("a refetch failure after a successful search shows a distinct message instead of silently dropping the results", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /if \(fetchError\) \{\s*setStatus\("error"\);\s*setErrorMessage\("Search completed, but the results could not be loaded\. Please refresh\."\);\s*return;\s*\}/,
    "the refetch error path must set its own status/message, not fall through to the success banner",
  );
});

test("a thrown error during the search request is caught and shown as a generic error, never an unhandled rejection", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /\} catch \{\s*setStatus\("error"\);\s*setErrorMessage\("Something went wrong searching for jobs\. Please try again\."\);\s*\}/,
  );

  const tryIndex = source.indexOf("try {");
  const fetchIndex = source.indexOf('fetch("/api/agent/find"');
  const catchIndex = source.indexOf("} catch {");
  assert.ok(
    tryIndex !== -1 && tryIndex < fetchIndex && fetchIndex < catchIndex,
    "the fetch call must be inside the try block the catch actually guards",
  );
});

test("the post-search refetch orders jobs by found_at descending, so the newest results show first", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /\.order\("found_at", \{ ascending: false \}\)/);
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
