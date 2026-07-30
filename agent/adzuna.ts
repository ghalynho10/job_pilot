import type { InsForgeClient } from "@insforge/sdk";

import { scoreJobMatch } from "@/agent/matcher";
import { detectCountry, searchJobs, type AdzunaJob } from "@/lib/adzuna";
import { createPostHogServer } from "@/lib/posthog-server";
import type { Profile } from "@/types";

const STRONG_MATCH_THRESHOLD = 70;

function formatSalary(job: AdzunaJob): string | null {
  if (!job.salary_min) {
    return null;
  }

  const min = Math.round(job.salary_min / 1000);
  const max = job.salary_max ? Math.round(job.salary_max / 1000) : min;
  return `$${min}k - $${max}k`;
}

export async function runJobSearch(
  insforge: InsForgeClient,
  userId: string,
  profile: Profile,
  jobTitle: string,
  location: string,
): Promise<
  { success: true; data: { jobsFound: number; strongMatches: number } } | { success: false; error: string }
> {
  const { data: run, error: runInsertError } = await insforge.database
    .from("agent_runs")
    .insert([
      {
        user_id: userId,
        status: "running",
        job_title_searched: jobTitle,
        location_searched: location || null,
      },
    ])
    .select()
    .single();

  if (runInsertError || !run) {
    console.error("[agent/adzuna]", runInsertError);
    return { success: false, error: "Could not start the search. Please try again." };
  }

  const runId = run.id as string;

  let adzunaJobs: AdzunaJob[];
  try {
    const country = detectCountry(location);
    adzunaJobs = await searchJobs(jobTitle, location, country);
  } catch (error) {
    console.error("[agent/adzuna]", error);
    await insforge.database
      .from("agent_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", runId);
    return { success: false, error: "Something went wrong searching for jobs. Please try again." };
  }

  const posthog = createPostHogServer();
  let jobsFound = 0;
  let strongMatches = 0;

  for (const adzunaJob of adzunaJobs) {
    const scoreResult = await scoreJobMatch(
      {
        title: adzunaJob.title,
        company: adzunaJob.company.display_name,
        description: adzunaJob.description,
      },
      profile,
    );

    const match = scoreResult.success
      ? scoreResult.data
      : { matchScore: null, matchReason: null, matchedSkills: null, missingSkills: null };

    const { error: jobInsertError } = await insforge.database.from("jobs").insert([
      {
        run_id: runId,
        user_id: userId,
        source: "search",
        source_url: adzunaJob.redirect_url,
        external_apply_url: adzunaJob.redirect_url,
        title: adzunaJob.title,
        company: adzunaJob.company.display_name,
        location: adzunaJob.location.display_name,
        salary: formatSalary(adzunaJob),
        job_type: adzunaJob.contract_type || "fulltime",
        about_role: adzunaJob.description,
        match_score: match.matchScore,
        match_reason: match.matchReason,
        matched_skills: match.matchedSkills,
        missing_skills: match.missingSkills,
      },
    ]);

    if (jobInsertError) {
      console.error("[agent/adzuna]", jobInsertError);
      continue;
    }

    jobsFound += 1;
    if ((match.matchScore ?? 0) >= STRONG_MATCH_THRESHOLD) {
      strongMatches += 1;
    }

    posthog.capture({
      distinctId: userId,
      event: "job_found",
      properties: { userId, source: "search", matchScore: match.matchScore },
    });
  }

  await posthog.shutdown();

  await insforge.database
    .from("agent_runs")
    .update({
      status: "completed",
      jobs_found: jobsFound,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  return { success: true, data: { jobsFound, strongMatches } };
}
