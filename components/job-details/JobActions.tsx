import type { JSX } from "react";

type JobActionsProps = {
  company: string;
  externalJobUrl: string | null;
};

export function JobActions({ company, externalJobUrl }: JobActionsProps): JSX.Element {
  if (!externalJobUrl) {
    return (
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-surface-secondary px-4 py-3 text-base font-medium text-text-muted disabled:cursor-not-allowed disabled:opacity-70"
        disabled
        type="button"
      >
        Apply link unavailable
      </button>
    );
  }

  return (
    <a
      className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      href={externalJobUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      Apply Now at {company}
    </a>
  );
}
