"use client";

import { AlertCircle, Building2, Search, Sparkles } from "lucide-react";
import posthog from "posthog-js";
import { useState, type FormEvent, type JSX } from "react";

import { insforge } from "@/lib/insforge-client";
import { getMatchScoreTier, type MatchScoreTier } from "@/lib/match-score";
import type { ActionResult, JobRow } from "@/types";

const MATCH_SCORE_TIER_CLASSES: Record<MatchScoreTier, string> = {
  high: "bg-success",
  medium: "bg-info-medium",
  low: "bg-warning",
};

const SOURCE_BADGE = {
  search: { label: "Search", className: "bg-accent-muted text-accent" },
  url: { label: "URL", className: "bg-surface-secondary text-text-secondary" },
} as const;

const PAGE_NUMBERS = [1, 2, 3, 8];

const FIELD_LABEL_CLASSES =
  "text-xs font-medium uppercase tracking-wide text-text-secondary";

const TEXT_INPUT_CLASSES =
  "w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const SELECT_CLASSES =
  "appearance-none rounded-md border border-border bg-surface py-2 pl-4 pr-9 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PAGINATION_BUTTON_CLASSES =
  "rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

function MatchScoreBar({ matchScore }: { matchScore: number | null }): JSX.Element {
  if (matchScore === null) {
    return <span className="text-sm text-text-muted">—</span>;
  }

  const tier = getMatchScoreTier(matchScore);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-24 rounded-full bg-border-light">
        <div
          className={`h-1 rounded-full ${MATCH_SCORE_TIER_CLASSES[tier]}`}
          style={{ width: `${matchScore}%` }}
        />
      </div>
      <span className="text-sm font-medium text-text-primary">{matchScore}%</span>
    </div>
  );
}

export function FindJobsPage({
  hasSkills,
  userId,
}: {
  hasSkills: boolean;
  userId: string;
}): JSX.Element {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  const isLoading = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!hasSkills || isLoading) {
      return;
    }

    posthog.capture("job_search_started", { userId, jobTitle, location });
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, location }),
      });
      const result: ActionResult<{ jobsFound: number; strongMatches: number; message: string }> =
        await response.json();

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }

      if (result.jobsFound === 0) {
        setJobs([]);
        setStatus("empty");
        return;
      }

      const { data: freshJobs, error: fetchError } = await insforge.database
        .from("jobs")
        .select("*")
        .order("found_at", { ascending: false });

      if (fetchError) {
        setStatus("error");
        setErrorMessage("Search completed, but the results could not be loaded. Please refresh.");
        return;
      }

      setJobs((freshJobs ?? []) as JobRow[]);
      setResultMessage(result.message);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong searching for jobs. Please try again.");
    }
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
          <div className="flex-1">
            <label className={FIELD_LABEL_CLASSES} htmlFor="job-title">
              Job Title
            </label>
            <div className="relative mt-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              />
              <input
                className={TEXT_INPUT_CLASSES}
                disabled={!hasSkills || isLoading}
                id="job-title"
                name="jobTitle"
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Frontend Engineer"
                type="text"
                value={jobTitle}
              />
            </div>
          </div>
          <div className="flex-1">
            <label className={FIELD_LABEL_CLASSES} htmlFor="location">
              Location
            </label>
            <div className="relative mt-2">
              <input
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasSkills || isLoading}
                id="location"
                name="location"
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Remote, New York..."
                type="text"
                value={location}
              />
            </div>
          </div>
          <button
            className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasSkills || isLoading || jobTitle.trim().length === 0}
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            {isLoading ? "Searching…" : "Find Jobs"}
          </button>
        </form>

        {!hasSkills ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-warning px-4 py-3 text-sm font-medium text-warning-foreground"
            role="status"
          >
            <AlertCircle aria-hidden="true" className="size-4" />
            Add your skills to your profile before searching for jobs.
          </div>
        ) : null}

        {status === "success" ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-success-lightest px-4 py-3 text-sm font-medium text-success-foreground"
            role="status"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {resultMessage}
          </div>
        ) : null}

        {status === "empty" ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-surface-secondary px-4 py-3 text-sm font-medium text-text-secondary"
            role="status"
          >
            No jobs found for that search. Try a different title or location.
          </div>
        ) : null}

        {status === "error" ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-error px-4 py-3 text-sm font-medium text-error-foreground"
            role="alert"
          >
            <AlertCircle aria-hidden="true" className="size-4" />
            {errorMessage}
          </div>
        ) : null}
      </section>

      {status === "success" && jobs.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              />
              <input
                aria-label="Filter by company or role"
                className={TEXT_INPUT_CLASSES}
                placeholder="Filter by company or role..."
                type="text"
              />
            </div>
            <div className="relative">
              <select aria-label="Filter by match" className={SELECT_CLASSES} defaultValue="all">
                <option value="all">All Matches</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                ⌄
              </span>
            </div>
            <div className="relative">
              <select
                aria-label="Sort by match score"
                className={SELECT_CLASSES}
                defaultValue="match-score"
              >
                <option value="match-score">Match Score</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                ⌄
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3" scope="col">
                    Company
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Role
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Match Score
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Salary Est.
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Source
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Date Found
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const badge = SOURCE_BADGE[job.source];

                  return (
                    <tr className="border-t border-border hover:bg-surface-secondary" key={job.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-md bg-surface-secondary">
                            <Building2 aria-hidden="true" className="size-4 text-text-secondary" />
                          </div>
                          <span className="text-sm font-medium text-text-primary">
                            {job.company}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-primary">{job.title}</td>
                      <td className="px-4 py-4">
                        <MatchScoreBar matchScore={job.match_score} />
                      </td>
                      <td className="px-4 py-4 text-sm text-text-primary">
                        {job.salary ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-muted">
                        {new Date(job.found_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              Showing <span className="font-medium text-text-primary">1</span> to{" "}
              <span className="font-medium text-text-primary">{jobs.length}</span> of{" "}
              <span className="font-medium text-text-primary">{jobs.length}</span> results
            </p>
            <nav aria-label="Pagination" className="flex items-center gap-2">
              <button className={PAGINATION_BUTTON_CLASSES} disabled type="button">
                Previous
              </button>
              {PAGE_NUMBERS.map((page, index) => (
                <span className="flex items-center" key={page}>
                  {index === PAGE_NUMBERS.length - 1 && PAGE_NUMBERS.length > 1 ? (
                    <span className="px-1 text-sm text-text-muted" aria-hidden="true">
                      …
                    </span>
                  ) : null}
                  <button
                    aria-current={page === 1 ? "page" : undefined}
                    className={
                      page === 1
                        ? "rounded-md border border-accent bg-accent-light px-3 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        : PAGINATION_BUTTON_CLASSES
                    }
                    type="button"
                  >
                    {page}
                  </button>
                </span>
              ))}
              <button className={PAGINATION_BUTTON_CLASSES} type="button">
                Next
              </button>
            </nav>
          </div>
        </section>
      ) : null}
    </>
  );
}
