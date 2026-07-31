import { ExternalLink, FileText } from "lucide-react";
import type { JSX } from "react";

import { StructuredList } from "@/components/job-details/StructuredList";
import { isLikelyTruncatedDescription } from "@/lib/job-details";

type JobDescriptionCardProps = {
  aboutRole: string | null;
  externalJobUrl: string | null;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  aboutCompany: string | null;
};

export function JobDescriptionCard({
  aboutRole,
  externalJobUrl,
  responsibilities,
  requirements,
  niceToHave,
  benefits,
  aboutCompany,
}: JobDescriptionCardProps): JSX.Element {
  const description = aboutRole?.trim();
  const companyText = aboutCompany?.trim();
  const isPreviewDescription = isLikelyTruncatedDescription(description ?? null);

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="job-description">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-surface-secondary">
          <FileText aria-hidden="true" className="size-4 text-text-secondary" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary" id="job-description">
          Job Description
        </h2>
      </div>
      {description ? (
        <>
          <p className="mt-6 whitespace-pre-line text-base font-medium leading-7 text-text-primary">{description}</p>
          {isPreviewDescription ? (
            <div className="mt-5 rounded-lg border border-border bg-surface-secondary p-4">
              <p className="text-sm leading-6 text-text-secondary">
                This saved description ends where the job source preview stops.
              </p>
              {externalJobUrl ? (
                <a
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  href={externalJobUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Read the full job post
                </a>
              ) : (
                <p className="mt-3 text-sm font-medium text-text-muted">No source link was saved for this job.</p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-text-muted">No job description was saved for this role.</p>
      )}
      <div className="mt-6 space-y-6">
        <StructuredList label="Responsibilities" items={responsibilities} />
        <StructuredList label="Requirements" items={requirements} />
        <StructuredList label="Nice to have" items={niceToHave} />
        <StructuredList label="Benefits" items={benefits} />
        {companyText ? (
          <section>
            <h3 className="text-base font-semibold text-text-primary">About the company</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{companyText}</p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
