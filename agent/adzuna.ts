import type { InsForgeClient } from "@insforge/sdk";

import { scoreJobMatch } from "@/agent/matcher";
import { detectCountry, searchJobs, type AdzunaJob } from "@/lib/adzuna";
import { jobSignature } from "@/lib/job-signature";
import { MATCH_THRESHOLD } from "@/lib/match-score";
import { createPostHogServer } from "@/lib/posthog-server";
import type { Profile } from "@/types";

function formatSalary(job: AdzunaJob): string | null {
  if (!job.salary_min) {
    return null;
  }

  const min = Math.round(job.salary_min / 1000);
  const max = job.salary_max ? Math.round(job.salary_max / 1000) : min;
  // Adzuna often predicts a single figure rather than a band, and rounding to
  // the nearest thousand collapses narrow bands too. Rendering "$103k - $103k"
  // reads as a broken range, so a point estimate prints as one number.
  return min === max ? `$${min}k` : `$${min}k - $${max}k`;
}

export async function runJobSearch(
  insforge: InsForgeClient,
  userId: string,
  profile: Profile,
  jobTitle: string,
  location: string,
): Promise<
  | { success: true; data: { jobsFound: number; strongMatches: number; resultsReturned: number } }
  | { success: false; error: string }
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

  // Adzuna routinely lists one opening several times under different ids, so
  // external_id alone cannot catch them: the same role at the same company for
  // the same money arrives as two distinct rows. This second check keys on the
  // content a user would compare by eye, and is seeded with what they already
  // have so a repeat search does not re-add yesterday's duplicates. Scoped to
  // the companies in this batch rather than the user's whole history.
  const existingSignatures = new Set<string>();

  if (adzunaJobs.length > 0) {
    const { data: signatureRows, error: signatureError } = await insforge.database
      .from("jobs")
      .select("company, title, location, salary")
      .eq("user_id", userId)
      .in("company", [
        ...new Set(adzunaJobs.map((job) => job.company.display_name)),
      ]);

    if (signatureError) {
      console.error("[agent/adzuna]", signatureError);
    }

    for (const row of signatureRows ?? []) {
      existingSignatures.add(
        jobSignature(
          (row.company as string | null) ?? "",
          (row.title as string | null) ?? "",
          (row.location as string | null) ?? "",
          (row.salary as string | null) ?? null,
        ),
      );
    }
  }

  const posthog = createPostHogServer();
  let jobsFound = 0;
  let strongMatches = 0;

  for (const adzunaJob of adzunaJobs) {
    if (existingExternalIds.has(adzunaJob.id)) {
      continue;
    }

    const salary = formatSalary(adzunaJob);
    const signature = jobSignature(
      adzunaJob.company.display_name,
      adzunaJob.title,
      adzunaJob.location.display_name,
      salary,
    );

    // Added to the set on insert below, so duplicates inside this one Adzuna
    // response are caught too, not only ones already in the database.
    if (existingSignatures.has(signature)) {
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
        salary,
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

    existingSignatures.add(signature);
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

  // resultsReturned lets the caller tell "Adzuna found nothing" apart from
  // "everything Adzuna found, you already had". Both leave jobsFound at 0, but
  // only the second one means the results were already in the user's list.
  return {
    success: true,
    data: { jobsFound, strongMatches, resultsReturned: adzunaJobs.length },
  };
}
