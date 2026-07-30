import { MATCH_THRESHOLD } from "./match-score.ts";
import type { JobRow } from "@/types";

export type MatchFilter = "all" | "high" | "low";

export type SortMode = "match-score" | "newest" | "oldest";

export function filterJobs(jobs: JobRow[], filterText: string, matchFilter: MatchFilter): JobRow[] {
  const needle = filterText.trim().toLowerCase();

  return jobs.filter((job) => {
    const matchesText =
      needle.length === 0 ||
      job.company.toLowerCase().includes(needle) ||
      job.title.toLowerCase().includes(needle);

    if (!matchesText) {
      return false;
    }

    if (matchFilter === "all") {
      return true;
    }

    if (job.match_score === null) {
      return false;
    }

    return matchFilter === "high" ? job.match_score >= MATCH_THRESHOLD : job.match_score < MATCH_THRESHOLD;
  });
}

export function sortJobs(jobs: JobRow[], sortMode: SortMode): JobRow[] {
  const sorted = [...jobs];

  if (sortMode === "newest") {
    return sorted.sort((a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime());
  }

  if (sortMode === "oldest") {
    return sorted.sort((a, b) => new Date(a.found_at).getTime() - new Date(b.found_at).getTime());
  }

  return sorted.sort((a, b) => {
    if (a.match_score === null) {
      return b.match_score === null ? 0 : 1;
    }

    if (b.match_score === null) {
      return -1;
    }

    return b.match_score - a.match_score;
  });
}

export function paginateJobs(jobs: JobRow[], page: number, pageSize: number): JobRow[] {
  const start = (page - 1) * pageSize;
  return jobs.slice(start, start + pageSize);
}
