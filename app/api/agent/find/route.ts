import { NextRequest, NextResponse } from "next/server";

import { runJobSearch } from "@/agent/adzuna";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ActionResult, Profile, ProfileRow } from "@/types";

function mapRowToProfile(row: ProfileRow): Profile {
  return {
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    linkedinUrl: row.linkedin_url ?? "",
    portfolioUrl: row.portfolio_url ?? "",
    workAuthorization: (row.work_authorization as Profile["workAuthorization"]) ?? "",
    currentTitle: row.current_title ?? "",
    experienceLevel: (row.experience_level as Profile["experienceLevel"]) ?? "",
    yearsExperience: row.years_experience ?? "",
    skills: row.skills ?? [],
    industries: row.industries ?? [],
    workExperience: row.work_experience ?? [],
    education: row.education ?? {
      highestDegree: "",
      fieldOfStudy: "",
      institutionName: "",
      graduationYear: "",
    },
    jobTitlesSeeking: (row.job_titles_seeking ?? []).join(", "),
    remotePreference: (row.remote_preference as Profile["remotePreference"]) ?? "",
    salaryExpectation: row.salary_expectation ?? "",
    preferredLocations: (row.preferred_locations ?? []).join(", "),
  };
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ActionResult<{ jobsFound: number; strongMatches: number; message: string }>>> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to search for jobs." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;

    const body: unknown = await req.json();
    const jobTitle =
      typeof body === "object" && body !== null && "jobTitle" in body
        ? (body as { jobTitle: unknown }).jobTitle
        : undefined;
    const location =
      typeof body === "object" && body !== null && "location" in body
        ? (body as { location: unknown }).location
        : "";

    if (typeof jobTitle !== "string" || jobTitle.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a job title to search for." },
        { status: 400 },
      );
    }

    const { data: profileRow, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[api/agent/find]", profileError);
      return NextResponse.json(
        { success: false, error: "Something went wrong loading your profile. Please try again." },
        { status: 500 },
      );
    }

    if (!profileRow || !profileRow.skills || profileRow.skills.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Add your skills to your profile before searching for jobs.",
        },
        { status: 422 },
      );
    }

    const profile = mapRowToProfile(profileRow as ProfileRow);
    const result = await runJobSearch(
      insforge,
      userId,
      profile,
      jobTitle.trim(),
      typeof location === "string" ? location.trim() : "",
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const { jobsFound, strongMatches } = result.data;
    const message = `Found ${jobsFound} jobs and saved ${strongMatches} strong matches.`;

    return NextResponse.json({ success: true, jobsFound, strongMatches, message });
  } catch (error) {
    console.error("[api/agent/find]", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong searching for jobs. Please try again." },
      { status: 500 },
    );
  }
}
