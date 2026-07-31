import { FileText } from "lucide-react";
import type { JSX } from "react";

import { StructuredList } from "@/components/job-details/StructuredList";

type JobDescriptionCardProps = {
  aboutRole: string | null;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  aboutCompany: string | null;
};

export function JobDescriptionCard({
  aboutRole,
  responsibilities,
  requirements,
  niceToHave,
  benefits,
  aboutCompany,
}: JobDescriptionCardProps): JSX.Element {
  const description = aboutRole?.trim();
  const companyText = aboutCompany?.trim();

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
        <p className="mt-6 whitespace-pre-line text-base font-medium leading-7 text-text-primary">{description}</p>
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
