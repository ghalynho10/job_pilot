import type { DashboardActivityEntry } from "@/lib/dashboard-types";
import type { AgentRunRow, JobRow } from "@/types";

export type RecentActivityAgentRun = Pick<
  AgentRunRow,
  "id" | "job_title_searched" | "jobs_found" | "completed_at"
>;

export type RecentActivityResearchedJob = Pick<
  JobRow,
  "id" | "company" | "company_research_completed_at"
>;

const MAX_ENTRIES = 8;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeAgo(timestamp: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(timestamp).getTime();

  if (diffMs < MINUTE) {
    return "Just now";
  }
  if (diffMs < HOUR) {
    const minutes = Math.floor(diffMs / MINUTE);
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (diffMs < DAY) {
    const hours = Math.floor(diffMs / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 2 * DAY) {
    return "Yesterday";
  }
  const days = Math.floor(diffMs / DAY);
  return `${days} days ago`;
}

export function computeRecentActivity(
  agentRuns: RecentActivityAgentRun[],
  researchedJobs: RecentActivityResearchedJob[],
  now: Date = new Date(),
): DashboardActivityEntry[] {
  const runEntries = agentRuns
    .filter((run): run is RecentActivityAgentRun & { completed_at: string } => run.completed_at !== null)
    .map((run) => ({
      id: `run-${run.id}`,
      dotColor: "success" as const,
      title: `Found ${run.jobs_found ?? 0} jobs for ${run.job_title_searched ?? "your search"}`,
      timestampValue: run.completed_at,
    }));

  const researchEntries = researchedJobs
    .filter(
      (job): job is RecentActivityResearchedJob & { company_research_completed_at: string } =>
        job.company_research_completed_at !== null,
    )
    .map((job) => ({
      id: `research-${job.id}`,
      dotColor: "info" as const,
      title: `Researched ${job.company}`,
      timestampValue: job.company_research_completed_at,
    }));

  return [...runEntries, ...researchEntries]
    .sort((a, b) => new Date(b.timestampValue).getTime() - new Date(a.timestampValue).getTime())
    .slice(0, MAX_ENTRIES)
    .map((entry) => ({
      id: entry.id,
      dotColor: entry.dotColor,
      title: entry.title,
      timestamp: formatTimeAgo(entry.timestampValue, now),
    }));
}
