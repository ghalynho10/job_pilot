"use client";

import { Building2, Search, Sparkles } from "lucide-react";
import { useState, type JSX } from "react";

import { getMatchScoreTier, mockJobs, type MatchScoreTier } from "@/lib/mock-jobs";

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
  "w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const SELECT_CLASSES =
  "appearance-none rounded-md border border-border bg-surface py-2 pl-4 pr-9 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PAGINATION_BUTTON_CLASSES =
  "rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

function MatchScoreBar({ matchScore }: { matchScore: number }): JSX.Element {
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

export function FindJobsPage(): JSX.Element {
  const [hasSearched, setHasSearched] = useState(false);

  return (
    <>
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <form
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setHasSearched(true);
          }}
        >
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
                id="job-title"
                name="jobTitle"
                placeholder="Frontend Engineer"
                type="text"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className={FIELD_LABEL_CLASSES} htmlFor="location">
              Location
            </label>
            <div className="relative mt-2">
              <input
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                id="location"
                name="location"
                placeholder="Remote, New York..."
                type="text"
              />
            </div>
          </div>
          <button
            className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            Find Jobs
          </button>
        </form>

        {hasSearched ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-success-lightest px-4 py-3 text-sm font-medium text-success-foreground"
            role="status"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Found 8 jobs and saved 4 strong matches.
          </div>
        ) : null}
      </section>

      {hasSearched ? (
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
                {mockJobs.map((job) => {
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
                        <MatchScoreBar matchScore={job.matchScore} />
                      </td>
                      <td className="px-4 py-4 text-sm text-text-primary">{job.salary}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-muted">{job.foundAtLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              Showing <span className="font-medium text-text-primary">1</span> to{" "}
              <span className="font-medium text-text-primary">6</span> of{" "}
              <span className="font-medium text-text-primary">24</span> results
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
