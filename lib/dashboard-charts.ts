import type { DashboardDayCount, DashboardScoreBand } from "@/lib/dashboard-types";
import type { JobRow } from "@/types";

export type ChartsSourceJob = Pick<
  JobRow,
  "found_at" | "match_score" | "company_research_completed_at"
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// A row's timestamp comes from the database, so it can be malformed. One bad value
// drops its own row, the same way computeDashboardStats and computeRecentActivity
// degrade, rather than throwing RangeError and failing the whole dashboard render.
function rowDateKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : utcDateKey(date);
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function shortDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

function weekdayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

function computeZeroFilledWindow(
  timestamps: (string | null)[],
  now: Date,
  windowSize: number,
  label: (date: Date) => string,
): DashboardDayCount[] {
  const todayStart = utcDayStart(now);
  const counts = new Map<string, number>();

  for (const timestamp of timestamps) {
    if (timestamp === null) {
      continue;
    }
    const key = rowDateKey(timestamp);
    if (key === null) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: DashboardDayCount[] = [];
  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const date = new Date(todayStart.getTime() - offset * DAY_MS);
    const key = utcDateKey(date);
    days.push({ day: label(date), count: counts.get(key) ?? 0 });
  }

  return days;
}

export function computeJobsFoundOverTime(
  jobs: Pick<ChartsSourceJob, "found_at">[],
  now: Date = new Date(),
): DashboardDayCount[] {
  return computeZeroFilledWindow(
    jobs.map((job) => job.found_at),
    now,
    30,
    shortDateLabel,
  );
}

// Uses company_research_completed_at, not the company_research dossier column that
// computeDashboardStats' "Companies Researched" count uses — see the comment there.
export function computeCompanyResearchActivity(
  jobs: Pick<ChartsSourceJob, "company_research_completed_at">[],
  now: Date = new Date(),
): DashboardDayCount[] {
  return computeZeroFilledWindow(
    jobs.map((job) => job.company_research_completed_at),
    now,
    7,
    weekdayLabel,
  );
}

const SCORE_BANDS = [
  { band: "50-60%", min: 50, max: 60 },
  { band: "60-70%", min: 60, max: 70 },
  { band: "70-80%", min: 70, max: 80 },
  { band: "80-90%", min: 80, max: 90 },
  { band: "90-100%", min: 90, max: 100 },
];

export function computeMatchScoreDistribution(
  jobs: Pick<ChartsSourceJob, "match_score">[],
): DashboardScoreBand[] {
  return SCORE_BANDS.map(({ band, min, max }) => ({
    band,
    count: jobs.filter((job) => {
      if (job.match_score === null) {
        return false;
      }
      if (max === 100) {
        return job.match_score >= min && job.match_score <= max;
      }
      return job.match_score >= min && job.match_score < max;
    }).length,
  }));
}
