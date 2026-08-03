import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("find-jobs page redirects to login when there is no authenticated session (AC-10)", async () => {
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

test("find-jobs page no longer calls the old private beta gate (AC-7)", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.ok(
    !source.includes("requireApprovedPage"),
    "the old private beta gate must not be called; usage gating replaces it",
  );
  assert.ok(
    !source.includes("user_access"),
    "the page must never query user_access directly",
  );
});

test("find-jobs page uses the server InsForge client, never the browser client", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /createInsforgeServer/);
  assert.doesNotMatch(source, /from ["']@\/lib\/insforge-client["']/);
});

test("proxy.ts protects the /find-jobs route (AC-10)", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /"\/find-jobs\/:path\*"/);
});

test("find-jobs page composes the shared Navbar and the interactive client component", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(source, /<Navbar authenticated \/>/);
  assert.match(
    source,
    /<FindJobsPage hasSkills=\{hasSkills\} initialJobs=\{initialJobs\} searchRemaining=\{searchRemaining\} userId=\{data\.user\.id\} \/>/,
  );
});

test("find-jobs page fetches the caller's existing jobs server side, newest first (AC-1)", async () => {
  const source = await readProjectFile("app/find-jobs/page.tsx");

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.select\("\*"\)\s*\.eq\("user_id", data\.user\.id\)\s*\.order\("found_at", \{ ascending: false \}\)/,
  );
  assert.match(
    source,
    /const initialJobs = \(jobRows \?\? \[\]\) as JobRow\[\];/,
  );
});

test("job title and location inputs are real, controlled text inputs wired to state", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /id="job-title"/);
  assert.match(source, /id="location"/);
  assert.match(
    source,
    /onChange=\{\(event\) => setJobTitle\(event\.target\.value\)\}/,
  );
  assert.match(
    source,
    /onChange=\{\(event\) => setLocation\(event\.target\.value\)\}/,
  );
});

test("Find Jobs button triggers a real search request against the agent endpoint", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /fetch\("\/api\/agent\/find"/);
  assert.match(source, /method: "POST"/);
});

test("the filter input and both dropdowns are wired to real filter, sort, and search state (AC-3, AC-4, AC-5)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /aria-label="Filter by company or role"[\s\S]{0,300}onChange=\{\(event\) => handleFilterTextChange\(event\.target\.value\)\}/,
    "the filter input must be wired to filter text state",
  );
  assert.match(
    source,
    /aria-label="Filter by match"[\s\S]{0,300}onChange=\{\(event\) => handleMatchFilterChange\(event\.target\.value as MatchFilter\)\}/,
  );
  assert.match(
    source,
    /aria-label="Sort by match score"[\s\S]{0,300}onChange=\{\(event\) => handleSortModeChange\(event\.target\.value as SortMode\)\}/,
  );
  assert.match(
    source,
    /import \{ filterJobs, paginateJobs, sortJobs, type MatchFilter, type SortMode \} from "@\/lib\/find-jobs-filters";/,
  );
});

test("the match dropdown offers High Match and Low Match, the sort dropdown offers Newest and Oldest (AC-4, AC-5)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /<option value="high">High Match<\/option>/);
  assert.match(source, /<option value="low">Low Match<\/option>/);
  assert.match(source, /<option value="newest">Newest<\/option>/);
  assert.match(source, /<option value="oldest">Oldest<\/option>/);
});

test("changing the filter text, match filter, or sort resets the page back to 1 (AC-7)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  for (const fn of [
    "handleFilterTextChange",
    "handleMatchFilterChange",
    "handleSortModeChange",
  ]) {
    const start = source.indexOf(`function ${fn}(`);
    assert.ok(start !== -1, `${fn} not found`);
    const end = source.indexOf("\n  }", start);
    const body = source.slice(start, end);
    assert.match(body, /setPage\(1\)/, `${fn} must reset the page to 1`);
  }
});

test("submitting a new search resets filter text, match filter, sort, and page to defaults (AC-9)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const submitStart = source.indexOf("async function handleSubmit");
  const fetchIndex = source.indexOf('fetch("/api/agent/find"');
  const resetSection = source.slice(submitStart, fetchIndex);

  assert.match(resetSection, /setFilterText\(""\)/);
  assert.match(resetSection, /setMatchFilter\("all"\)/);
  assert.match(resetSection, /setSortMode\("match-score"\)/);
  assert.match(resetSection, /setPage\(1\)/);
});

test("dropdowns are native selects, not custom listboxes", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /<select\s[\s\S]*?aria-label="Filter by match"/);
  assert.match(source, /<select\s[\s\S]*?aria-label="Sort by match score"/);
});

test("pagination Previous, Next, and page number buttons are wired with real click handlers (AC-6)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const paginationStart = source.indexOf('aria-label="Pagination"');
  assert.ok(paginationStart !== -1, "pagination nav not found");
  const paginationSection = source.slice(paginationStart);

  assert.match(
    paginationSection,
    /onClick=\{\(\) => setPage\(currentPage - 1\)\}/,
  );
  assert.match(paginationSection, /onClick=\{\(\) => setPage\(pageNumber\)\}/);
  assert.match(
    paginationSection,
    /onClick=\{\(\) => setPage\(currentPage \+ 1\)\}/,
  );
  assert.match(paginationSection, /disabled=\{currentPage === 1\}/);
  assert.match(paginationSection, /disabled=\{currentPage === totalPages\}/);
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

test("pagination footer shows real results copy and a real page count driven by the filtered list (AC-6)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /Showing/);
  assert.match(source, /results/);
  assert.match(source, /const PAGE_SIZE = 20;/);
  assert.match(
    source,
    /const totalPages = Math\.max\(1, Math\.ceil\(visibleJobs\.length \/ PAGE_SIZE\)\);/,
  );
});

test("the current page is marked aria-current, driven by real page state, not a hardcoded page 1 (AC-6)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /aria-current=\{pageNumber === currentPage \? "page" : undefined\}/,
  );
});

test("Previous and Next are disabled at the real first and last page boundaries (AC-6)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /disabled=\{currentPage === 1\}/);
  assert.match(source, /disabled=\{currentPage === totalPages\}/);
});

test("the results section renders whenever there are jobs, whether from page load or a search (AC-1)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /\{jobs\.length > 0 \? \(/);
});

test("a returning user with no jobs yet sees a distinct message on page load, not an empty table (AC-2)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /status === "idle" \? \(/);
  assert.match(
    source,
    /No jobs yet\. Run a search above to find your first matches\./,
  );
});

test("a filter and match combination matching zero rows shows a distinct message, not an empty table (AC-8)", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /visibleJobs\.length === 0 \? \(/);
  assert.match(source, /No jobs match your filters\./);
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
  assert.match(
    source,
    /disabled=\{!hasSkills \|\| isLoading \|\| jobTitle\.trim\(\)\.length === 0\}/,
  );
});

test("a profile with no skills blocks the search before any request is made", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /if \(!hasSkills \|\| isLoading\) \{\s*return;/);
  assert.match(
    source,
    /Add your skills to your profile before searching for jobs\./,
  );
});

test("both job title and location inputs have a visible, associated label", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(
    source,
    /<label className=\{FIELD_LABEL_CLASSES\} htmlFor="job-title">/,
  );
  assert.match(
    source,
    /<label className=\{FIELD_LABEL_CLASSES\} htmlFor="location">/,
  );
});

test("the filter input and both dropdowns have an accessible name via aria-label", async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  assert.match(source, /aria-label="Filter by company or role"/);
  assert.match(source, /aria-label="Filter by match"/);
  assert.match(source, /aria-label="Sort by match score"/);
});

test('every table column header uses scope="col" for correct table semantics', async () => {
  const source = await readProjectFile("components/find-jobs/FindJobsPage.tsx");

  const headerMatches =
    source.match(/<th className="px-4 py-3" scope="col">/g) ?? [];
  assert.equal(
    headerMatches.length,
    6,
    'expected all 6 column headers to use scope="col"',
  );
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

  assert.match(
    source,
    /\.from\("jobs"\)\s*\.select\("\*"\)\s*\.eq\("user_id", userId\)\s*\.order\("found_at", \{ ascending: false \}\)/,
  );
});

test("find-jobs files never use hardcoded hex colors or raw Tailwind color classes", async () => {
  const rawTailwindColor =
    /\b(?:bg|text|border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)-\d{2,3}\b/;

  for (const file of [
    "app/find-jobs/page.tsx",
    "components/find-jobs/FindJobsPage.tsx",
  ]) {
    const source = await readProjectFile(file);

    assert.doesNotMatch(
      source,
      /#[0-9a-fA-F]{3,8}\b/,
      `${file} contains a hardcoded hex color`,
    );
    assert.doesNotMatch(
      source,
      rawTailwindColor,
      `${file} contains a raw Tailwind color class instead of a project token`,
    );
  }
});
