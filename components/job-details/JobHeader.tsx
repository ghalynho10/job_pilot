import { Building2, ExternalLink } from "lucide-react";
import type { JSX } from "react";

import type { JobRow } from "@/types";

type JobHeaderProps = {
  job: JobRow;
  externalJobUrl: string | null;
};

export function JobHeader({ job, externalJobUrl }: JobHeaderProps): JSX.Element {
  const matchLabel = job.match_score === null ? "Match unavailable" : `${job.match_score}% Match Score`;
  const matchClasses =
    job.match_score === null
      ? "bg-surface-secondary text-text-secondary"
      : "bg-success-lightest text-success-foreground";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-secondary">
            <Building2 aria-hidden="true" className="size-7 text-text-muted" />
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold leading-tight text-text-primary">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-base font-medium text-text-secondary">
              <span>{job.company}</span>
              <span aria-hidden="true">•</span>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${matchClasses}`}>{matchLabel}</span>
            </div>
          </div>
        </div>
        {externalJobUrl ? (
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={externalJobUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            View Job Post
          </a>
        ) : (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted disabled:cursor-not-allowed disabled:opacity-70"
            disabled
            type="button"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            View Job Post
          </button>
        )}
      </div>
    </section>
  );
}
