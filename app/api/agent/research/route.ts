import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { runCompanyResearch } from "@/agent/research";
import { guardPaidRoute } from "@/lib/access";
import { buildEmptyProfile, mapProfileRowToProfile } from "@/lib/profile-mapping";
import { createPostHogServer } from "@/lib/posthog-server";
import type { ActionResult, CompanyResearchDossier, JobRow, ProfileRow } from "@/types";

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ActionResult<{ data: CompanyResearchDossier }>>> {
  try {
    const guard = await guardPaidRoute({ requireAgentSwitch: true });

    if (!guard.ok) {
      return guard.response;
    }

    const { insforge, userId, userEmail } = guard;

    const body: unknown = await req.json();
    const jobId =
      typeof body === "object" && body !== null && "jobId" in body
        ? (body as { jobId: unknown }).jobId
        : undefined;

    if (typeof jobId !== "string" || jobId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "A valid job is required to run research." },
        { status: 400 },
      );
    }

    const { data: jobRow, error: jobError } = await insforge.database
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (jobError) {
      console.error("[api/agent/research]", jobError);
      return NextResponse.json(
        { success: false, error: "Something went wrong loading this job. Please try again." },
        { status: 500 },
      );
    }

    if (!jobRow) {
      return NextResponse.json(
        { success: false, error: "Something went wrong loading this job. Please try again." },
        { status: 500 },
      );
    }

    const job = jobRow as JobRow;

    const { data: profileRow, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[api/agent/research]", profileError);
      return NextResponse.json(
        { success: false, error: "Something went wrong loading your profile. Please try again." },
        { status: 500 },
      );
    }

    const profile = profileRow
      ? mapProfileRowToProfile(profileRow as ProfileRow)
      : buildEmptyProfile(userEmail);

    const result = await runCompanyResearch(job, profile);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const completedAt = new Date().toISOString();

    const { error: updateError } = await insforge.database
      .from("jobs")
      .update({ company_research: result.data, company_research_completed_at: completedAt })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[api/agent/research]", updateError);
      return NextResponse.json(
        { success: false, error: "Research completed, but it could not be saved. Please try again." },
        { status: 500 },
      );
    }

    const posthog = createPostHogServer();
    posthog.capture({
      distinctId: userId,
      event: "company_researched",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    revalidatePath(`/find-jobs/${jobId}`);

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("[api/agent/research]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong researching this company. Please try again." },
      { status: 500 },
    );
  }
}
