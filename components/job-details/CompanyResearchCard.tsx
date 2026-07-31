import { Building2, Search } from "lucide-react";
import type { JSX } from "react";

type CompanyResearchCardProps = {
  company: string;
};

export function CompanyResearchCard({ company }: CompanyResearchCardProps): JSX.Element {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm" aria-labelledby="company-research">
      <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-accent-muted">
            <Building2 aria-hidden="true" className="size-4 text-accent" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary" id="company-research">
            Company Research
          </h2>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-70"
          disabled
          type="button"
        >
          <Search aria-hidden="true" className="size-4" />
          Research Company
        </button>
      </div>
      <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-surface-secondary">
          <Building2 aria-hidden="true" className="size-6 text-text-muted" />
        </div>
        <p className="mt-5 text-base font-semibold text-text-primary">No research yet</p>
        <p className="mt-2 max-w-sm text-base leading-6 text-text-muted">
          Company research for {company} arrives in the next feature.
        </p>
      </div>
    </section>
  );
}
