import type { InsForgeClient } from "@insforge/sdk";

import { scoreJobMatch } from "@/agent/matcher";
import { detectCountry, searchJobs, type AdzunaJob } from "@/lib/adzuna";
import { MATCH_THRESHOLD } from "@/lib/match-score";
import { createPostHogServer } from "@/lib/posthog-server";
import type { Profile } from "@/types";

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

  // Adzuna's own job id, so a repeat search for the same title/location can
  // recognize and skip a job this user already has instead of inserting a
  // duplicate row. jobs_user_id_external_id_key (a unique index) is the real
  // guarantee under a race between two concurrent searches; this check just
  // avoids the wasted GPT-4o scoring call in the common, non-racing case.
  const existingExternalIds = new Set<string>();

  if (adzunaJobs.length > 0) {
    const { data: existingRows, error: existingError } = await insforge.database
      .from("jobs")
      .select("external_id")
      .eq("user_id", userId)
      .in(
        "external_id",
        adzunaJobs.map((job) => job.id),
      );

    if (existingError) {
      console.error("[agent/adzuna]", existingError);
    }

    for (const row of existingRows ?? []) {
      if (row.external_id !== null) {
        existingExternalIds.add(row.external_id as string);
      }
    }
  }

  const posthog = createPostHogServer();
  let jobsFound = 0;
  let strongMatches = 0;

  for (const adzunaJob of adzunaJobs) {
    if (existingExternalIds.has(adzunaJob.id)) {
      continue;
    }

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
        external_id: adzunaJob.id,
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
    if ((match.matchScore ?? 0) >= MATCH_THRESHOLD) {
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
