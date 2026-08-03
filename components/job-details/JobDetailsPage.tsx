import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { JSX } from "react";

import { CompanyResearchCard } from "@/components/job-details/CompanyResearchCard";
import { JobActions } from "@/components/job-details/JobActions";
import { JobDescriptionCard } from "@/components/job-details/JobDescriptionCard";
import { JobHeader } from "@/components/job-details/JobHeader";
import { JobInfoCards } from "@/components/job-details/JobInfoCards";
import { MatchReasoningCard } from "@/components/job-details/MatchReasoningCard";
import { SkillsCard } from "@/components/job-details/SkillsCard";
import {
  formatFoundAt,
  formatNullableText,
  normalizeStringList,
  resolveExternalJobUrl,
} from "@/lib/job-details";
import type { JobRow } from "@/types";

type JobDetailsPageProps = {
  job: JobRow;
  researchRemaining: { used: number; limit: number } | null;
};

export function JobDetailsPage({ job, researchRemaining }: JobDetailsPageProps): JSX.Element {
  const externalJobUrl = resolveExternalJobUrl(job);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-2 text-base font-medium text-text-secondary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/find-jobs"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to Jobs
      </Link>
      <JobHeader externalJobUrl={externalJobUrl} job={job} />
      <JobInfoCards
        foundAt={formatFoundAt(job.found_at)}
        jobType={formatNullableText(job.job_type)}
        location={formatNullableText(job.location)}
        salary={formatNullableText(job.salary)}
      />
      <MatchReasoningCard matchReason={job.match_reason} />
      <SkillsCard
        matchedSkills={normalizeStringList(job.matched_skills)}
        missingSkills={normalizeStringList(job.missing_skills)}
      />
      <JobDescriptionCard
        aboutCompany={job.about_company}
        aboutRole={job.about_role}
        benefits={normalizeStringList(job.benefits)}
        externalJobUrl={externalJobUrl}
        niceToHave={normalizeStringList(job.nice_to_have)}
        requirements={normalizeStringList(job.requirements)}
        responsibilities={normalizeStringList(job.responsibilities)}
      />
      <CompanyResearchCard company={job.company} dossier={job.company_research} jobId={job.id} researchRemaining={researchRemaining} />
      <JobActions company={job.company} externalJobUrl={externalJobUrl} />
    </div>
  );
}
