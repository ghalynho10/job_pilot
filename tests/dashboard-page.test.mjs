import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("dashboard page keeps the auth redirect, skip link, Navbar, and PostHog identify unchanged (AC-7)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /const \{ data, error \} = await insforge\.auth\.getCurrentUser\(\);/);
  assert.match(source, /redirect\("\/login\?error=session"\)/);
  assert.match(source, /href="#main-content"/);
  assert.match(source, /id="main-content"/);
  assert.match(source, /<Navbar authenticated \/>/);
  assert.match(source, /<DashboardIdentity userId=\{data\.user\.id\} \/>/);
});

test("dashboard page removed the old placeholder shell and its DashboardActions import (AC-7)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.doesNotMatch(source, /DashboardActions/);
  assert.doesNotMatch(source, /Set up your search profile/);
  assert.doesNotMatch(source, /Welcome back/);
});

test("DashboardActions component no longer exists in the codebase (AC-7)", async () => {
  await assert.rejects(() => readProjectFile("components/dashboard/DashboardActions.tsx"));
});

test("dashboard page computes profile completeness from a real profiles read, never from mock data (AC-6, AC-10)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /\.from\("profiles"\)/);
  assert.match(source, /\.select\("\*"\)/);
  assert.match(source, /\.eq\("id", data\.user\.id\)/);
  assert.match(source, /\.maybeSingle<ProfileRow>\(\)/);
  assert.match(source, /isProfileComplete\(\{/);
  assert.match(source, /jobTitlesSeeking: row\?\.job_titles_seeking \?\? \[\]/);
});

test("dashboard page only conditionally renders the banner, and reads only the profiles, jobs, and agent_runs tables (AC-6, AC-10)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /\{!profileComplete \? <IncompleteProfileBanner \/> : null\}/);

  const fromCalls = [...source.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual(fromCalls, ["profiles", "jobs", "agent_runs", "jobs"]);
});

test("dashboard page computes real recent activity from the current user's agent_runs and jobs rows, never from mock data (feature 16)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /from "@\/lib\/dashboard-activity"/);
  assert.match(source, /\.from\("agent_runs"\)/);
  assert.match(source, /\.select\("id, job_title_searched, jobs_found, completed_at"\)/);
  assert.match(source, /\.eq\("status", "completed"\)/);
  assert.match(source, /\.select\("id, company, company_research_completed_at"\)/);
  assert.match(source, /\.not\("company_research_completed_at", "is", null\)/);
  assert.match(source, /computeRecentActivity\(/);
  assert.doesNotMatch(source, /mockActivity/);
});

test("dashboard page computes real stat cards from the current user's jobs rows, never from mock data (feature 15)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /from "@\/lib\/dashboard-stats"/);
  assert.match(source, /\.from\("jobs"\)/);
  assert.match(source, /\.select\("match_score, company_research, found_at, company_research_completed_at"\)/);
  assert.match(source, /\.eq\("user_id", data\.user\.id\)/);
  assert.match(source, /computeDashboardStats\(/);
  assert.doesNotMatch(source, /mockStats/);
});

test("dashboard page computes real chart data from the current user's jobs rows, never from mock data (feature 17)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /from "@\/lib\/dashboard-charts"/);
  assert.match(source, /computeJobsFoundOverTime\(/);
  assert.match(source, /computeMatchScoreDistribution\(/);
  assert.match(source, /computeCompanyResearchActivity\(/);
  assert.doesNotMatch(source, /mockJobsFoundOverTime|mockMatchScoreDistribution|mockCompanyResearchActivity/);
});

test("dashboard page composes stat cards, activity, and all three charts, in the design's order (AC-1 to AC-5)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /stats\.map\(\(stat\) => \(/);
  assert.match(source, /<RecentActivityCard activity=\{activity\} \/>/);
  assert.match(source, /<CompanyResearchActivityChart data=\{companyResearchActivity\} \/>/);
  assert.match(source, /<JobsFoundOverTimeChart data=\{jobsFoundOverTime\} \/>/);
  assert.match(source, /<MatchScoreDistributionChart data=\{matchScoreDistribution\} \/>/);

  const activityIndex = source.indexOf("<RecentActivityCard");
  const researchChartIndex = source.indexOf("<CompanyResearchActivityChart");
  const jobsChartIndex = source.indexOf("<JobsFoundOverTimeChart");
  const matchChartIndex = source.indexOf("<MatchScoreDistributionChart");

  assert.ok(activityIndex < researchChartIndex, "Recent Activity should come before Company Research Activity");
  assert.ok(researchChartIndex < jobsChartIndex, "Company Research Activity should come before Jobs Found Over Time");
  assert.ok(jobsChartIndex < matchChartIndex, "Jobs Found Over Time should come before Match Score Distribution");
});

test("dashboard page stacks the stat cards, and each chart pair, to a single column on narrow viewports (AC-8)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4/);
  const twoColumnGrids = source.match(/grid grid-cols-1 gap-6 lg:grid-cols-2/g) ?? [];
  assert.equal(twoColumnGrids.length, 2, "expected exactly two responsive two-column rows");
});

test("StatCard uses the shared card surface and swaps between a trend pill and a plain caption (AC-1, AC-9)", async () => {
  const source = await readProjectFile("components/dashboard/StatCard.tsx");

  assert.match(source, /rounded-xl border border-border bg-surface p-6 shadow-sm/);
  assert.match(source, /\{stat\.trend \? \(/);
  assert.match(source, /bg-success-lightest px-2 py-0\.5 font-medium text-success-foreground/);
  assert.match(source, /\) : stat\.caption \? \(/);
});

test("RecentActivityCard uses the shared card surface, a semantic list, and maps every dot color to a token (AC-2, AC-9)", async () => {
  const source = await readProjectFile("components/dashboard/RecentActivityCard.tsx");

  assert.match(source, /rounded-xl border border-border bg-surface p-6 shadow-sm/);
  assert.match(source, /<ul className="mt-4 divide-y divide-border">/);
  assert.match(source, /accent: "bg-accent"/);
  assert.match(source, /info: "bg-info-medium"/);
  assert.match(source, /success: "bg-success"/);
  assert.match(source, /aria-hidden="true"/);
});

test("IncompleteProfileBanner links to /profile, announces as a status region, and hides its icon from assistive tech (AC-6)", async () => {
  const source = await readProjectFile("components/dashboard/IncompleteProfileBanner.tsx");

  assert.match(source, /role="status"/);
  assert.match(source, /href="\/profile"/);
  assert.match(source, /<AlertCircle aria-hidden="true"/);
  assert.match(source, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/);
  assert.match(source, /bg-warning px-4 py-3 text-sm font-medium text-warning-foreground/);
});

test("CompanyResearchActivityChart renders a Recharts bar chart colored from the info token (AC-3, AC-9)", async () => {
  const source = await readProjectFile("components/dashboard/CompanyResearchActivityChart.tsx");

  assert.match(source, /"use client";/);
  assert.match(source, /rounded-xl border border-border bg-surface p-6 shadow-sm/);
  assert.match(source, /<BarChart data=\{data\}>/);
  assert.match(source, /dataKey="day"/);
  assert.match(source, /<Bar dataKey="count" fill="var\(--color-info-medium\)"/);
});

test("MatchScoreDistributionChart renders a Recharts bar chart colored from the success token, keyed by band (AC-5, AC-9)", async () => {
  const source = await readProjectFile("components/dashboard/MatchScoreDistributionChart.tsx");

  assert.match(source, /"use client";/);
  assert.match(source, /<BarChart data=\{data\}>/);
  assert.match(source, /dataKey="band"/);
  assert.match(source, /<Bar dataKey="count" fill="var\(--color-success\)"/);
});

test("JobsFoundOverTimeChart renders a Recharts area chart with an accent-colored gradient fill (AC-4, AC-9)", async () => {
  const source = await readProjectFile("components/dashboard/JobsFoundOverTimeChart.tsx");

  assert.match(source, /"use client";/);
  assert.match(source, /<AreaChart data=\{data\}>/);
  assert.match(source, /dataKey="day"/);
  assert.match(source, /stopColor="var\(--color-accent\)"/);
  assert.match(source, /stroke="var\(--color-accent\)"/);
  assert.match(source, /type="monotone"/);
});

test("no chart component hardcodes a hex color or raw Tailwind color class; every fill and stroke is a CSS variable token (AC-9)", async () => {
  const files = [
    "components/dashboard/CompanyResearchActivityChart.tsx",
    "components/dashboard/JobsFoundOverTimeChart.tsx",
    "components/dashboard/MatchScoreDistributionChart.tsx",
  ];

  for (const file of files) {
    const source = await readProjectFile(file);
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}(?!\))/, `${file} should not contain a hardcoded hex color`);
  }
});

// --- spec 0011 (feature 17, analytics charts wired to real data) ---
// The AC numbers below refer to docs/specs/0011-analytics-charts-real-data/index.md,
// not to spec 0010's AC numbers used by the tests above.

const CHART_EMPTY_STATES = [
  {
    file: "components/dashboard/CompanyResearchActivityChart.tsx",
    copy: "No companies researched in the last 7 days.",
  },
  {
    file: "components/dashboard/JobsFoundOverTimeChart.tsx",
    copy: "No jobs found in the last 30 days.",
  },
  {
    file: "components/dashboard/MatchScoreDistributionChart.tsx",
    copy: "No jobs scored 50% or higher yet.",
  },
];

test("each chart shows the shared empty state treatment, with copy naming its own empty condition (spec 0011 AC-4)", async () => {
  for (const { file, copy } of CHART_EMPTY_STATES) {
    const source = await readProjectFile(file);

    assert.match(
      source,
      /rounded-lg bg-surface-secondary px-4 py-3 text-sm font-medium text-text-secondary/,
      `${file} should reuse the FindJobsPage empty state treatment`,
    );
    assert.match(source, /role="status"/, `${file}'s empty state should announce itself`);
    assert.ok(
      source.includes(copy),
      `${file} should name its own empty condition, expected copy: ${copy}`,
    );
  }
});

test("each chart derives its empty state from the data it was given, not from a separate flag (spec 0011 AC-4)", async () => {
  for (const { file } of CHART_EMPTY_STATES) {
    const source = await readProjectFile(file);

    assert.match(
      source,
      /const total = data\.reduce\(/,
      `${file} should total the data it renders`,
    );
    assert.match(source, /total === 0 \? \(/, `${file} should branch on that total`);
  }
});

test("the empty state replaces the chart rather than rendering alongside it (spec 0011 AC-4)", async () => {
  for (const { file } of CHART_EMPTY_STATES) {
    const source = await readProjectFile(file);

    const branchIndex = source.indexOf("total === 0 ? (");
    const containerIndex = source.indexOf("<ResponsiveContainer");

    assert.ok(branchIndex !== -1, `${file} should have an empty state branch`);
    assert.ok(
      branchIndex < containerIndex,
      `${file} should render the chart only in the non-empty branch`,
    );
  }
});

test("only JobsFoundOverTimeChart thins its axis ticks, since only it renders 30 of them (spec 0011 AC-5)", async () => {
  const jobsFound = await readProjectFile("components/dashboard/JobsFoundOverTimeChart.tsx");
  assert.match(
    jobsFound,
    /interval="preserveStartEnd"/,
    "the 30 point axis thins its labels by available width and always keeps both ends, so today is never left unlabeled",
  );
  assert.doesNotMatch(
    jobsFound,
    /interval=\{\d+\}/,
    "a fixed numeric interval drops the final tick (30 points step 5 stops at index 25) and does not adapt to width",
  );

  for (const file of [
    "components/dashboard/CompanyResearchActivityChart.tsx",
    "components/dashboard/MatchScoreDistributionChart.tsx",
  ]) {
    const source = await readProjectFile(file);
    assert.doesNotMatch(
      source,
      /interval=/,
      `${file} renders few enough ticks that it should not thin them`,
    );
  }
});

test("lib/dashboard-types.ts keeps the shared types but no longer carries any mock data (spec 0011 AC-8)", async () => {
  const source = await readProjectFile("lib/dashboard-types.ts");

  for (const type of [
    "DashboardStat",
    "DashboardActivityEntry",
    "DashboardDayCount",
    "DashboardScoreBand",
  ]) {
    assert.match(
      source,
      new RegExp(`export type ${type} =`),
      `${type} is still imported by the real data path and must stay exported`,
    );
  }

  assert.doesNotMatch(
    source,
    /mockJobsFoundOverTime|mockMatchScoreDistribution|mockCompanyResearchActivity|mockStats|mockActivity/,
    "every mock constant is superseded by a real compute function and must not come back",
  );
});

test("the chart compute module reads the database only, with no PostHog query path (spec 0011 AC-7)", async () => {
  const source = await readProjectFile("lib/dashboard-charts.ts");

  assert.doesNotMatch(source, /posthog/i, "this feature adds no PostHog read path");
  assert.doesNotMatch(
    source,
    /fetch\(|process\.env/,
    "the compute functions are pure; they take rows in and never reach out",
  );
});

test("the dashboard logs every failed read instead of rendering a failure as an empty account (spec 0011 AC-4 guard)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  for (const errorName of [
    "profileError",
    "statsJobsError",
    "agentRunsError",
    "researchedJobsError",
  ]) {
    assert.match(
      source,
      new RegExp(`error: ${errorName}`),
      `the read producing ${errorName} should destructure its error`,
    );
    assert.match(
      source,
      new RegExp(`if \\(${errorName}\\) \\{\\s*console\\.error\\("\\[app/dashboard\\]", ${errorName}\\);`),
      `${errorName} should be logged with the project's route prefix, so a backend failure is not silently shown as the empty state`,
    );
  }
});
