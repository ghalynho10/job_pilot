import type { JSX } from "react";

import { SkillGroup } from "@/components/job-details/SkillGroup";

type SkillsCardProps = {
  matchedSkills: string[];
  missingSkills: string[];
};

export function SkillsCard({ matchedSkills, missingSkills }: SkillsCardProps): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="skills-fit">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary" id="skills-fit">
        Required Skills vs Your Profile
      </h2>
      <div className="mt-5 space-y-5">
        <SkillGroup
          emptyText="No matched skills were saved for this job."
          icon="check"
          label="You have"
          skills={matchedSkills}
          variant="matched"
        />
        <SkillGroup
          emptyText="No gap skills were saved for this job."
          icon="x"
          label="Gap skills"
          skills={missingSkills}
          variant="missing"
        />
      </div>
    </section>
  );
}
