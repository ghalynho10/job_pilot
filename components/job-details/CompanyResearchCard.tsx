"use client";

import { Building2, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";

import { StructuredList } from "@/components/job-details/StructuredList";
import type { ActionResult, CompanyResearchDossier } from "@/types";

type CompanyResearchCardProps = {
  jobId: string;
  company: string;
  dossier: CompanyResearchDossier | null;
};

type RequestStatus = "idle" | "loading" | "error";

export function CompanyResearchCard({ jobId, company, dossier }: CompanyResearchCardProps): JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleResearch(): Promise<void> {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const result: ActionResult<{ data: CompanyResearchDossier }> = await response.json();

      if (!result.success) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }

      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong researching this company. Please try again.");
    }
  }

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
        {dossier ? null : (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
            onClick={handleResearch}
            type="button"
          >
            {status === "loading" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Search aria-hidden="true" className="size-4" />
            )}
            {status === "loading" ? "Researching…" : "Research Company"}
          </button>
        )}
      </div>
      {dossier ? (
        <div className="space-y-6 p-6">
          <section>
            <h3 className="text-base font-semibold text-text-primary">Company Overview</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{dossier.companyOverview}</p>
          </section>
          <TagList items={dossier.techStack} label="Tech Stack" />
          <StructuredList items={dossier.culture} label="Culture" />
          <section>
            <h3 className="text-base font-semibold text-text-primary">Why This Role</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{dossier.whyThisRole}</p>
          </section>
          <StructuredList items={dossier.yourEdge} label="Your Edge" />
          <StructuredList items={dossier.gapsToAddress} label="Gaps to Address" />
          <StructuredList items={dossier.smartQuestions} label="Smart Questions" />
          <StructuredList items={dossier.interviewPrep} label="Interview Prep" />
          {dossier.sources.length > 0 ? (
            <section>
              <h3 className="text-base font-semibold text-text-primary">Sources</h3>
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {dossier.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
          {status === "error" ? (
            <>
              <div className="flex size-14 items-center justify-center rounded-xl bg-error/10">
                <Building2 aria-hidden="true" className="size-6 text-error" />
              </div>
              <p className="mt-5 text-base font-semibold text-text-primary">Research failed</p>
              <p className="mt-2 max-w-sm text-base leading-6 text-text-muted" role="alert">
                {errorMessage}
              </p>
            </>
          ) : (
            <>
              <div className="flex size-14 items-center justify-center rounded-xl bg-surface-secondary">
                <Building2 aria-hidden="true" className="size-6 text-text-muted" />
              </div>
              <p className="mt-5 text-base font-semibold text-text-primary">No research yet</p>
              <p className="mt-2 max-w-sm text-base leading-6 text-text-muted">
                Research {company} to see their overview, tech stack, culture, and how you stack up for this role.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TagList({ label, items }: { label: string; items: string[] }): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-base font-semibold text-text-primary">{label}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            className="inline-flex items-center rounded-full bg-accent-muted px-3 py-1 text-sm font-medium text-accent"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
