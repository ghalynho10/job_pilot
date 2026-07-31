import type { DashboardStat } from "@/lib/mock-dashboard";
import type { JobRow } from "@/types";

export type DashboardStatsJob = Pick<JobRow, "match_score" | "company_research" | "found_at">;

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

export function computeDashboardStats(
  jobs: DashboardStatsJob[],
  now: Date = new Date(),
): DashboardStat[] {
  const totalJobsFound = jobs.length;

  const scores = jobs
    .map((job) => job.match_score)
    .filter((score): score is number => score !== null);
  const avgMatchRate =
    scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;

  const companiesResearched = jobs.filter((job) => job.company_research !== null).length;

  const weekAgo = now.getTime() - WEEK_IN_MS;
  const jobsThisWeek = jobs.filter((job) => new Date(job.found_at).getTime() >= weekAgo).length;

  return [
    {
      label: "Total Jobs Found",
      value: String(totalJobsFound),
      caption: "All time",
    },
    {
      label: "Avg. Match Rate",
      value: avgMatchRate === null ? "N/A" : `${avgMatchRate}%`,
      caption: "Across scored jobs",
    },
    {
      label: "Companies Researched",
      value: String(companiesResearched),
      caption: "Total researched",
    },
    {
      label: "Jobs This Week",
      value: String(jobsThisWeek),
      caption: "New this week",
    },
  ];
}
