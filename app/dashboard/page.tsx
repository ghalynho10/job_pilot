import { redirect } from "next/navigation";
import type { JSX } from "react";

import { CompanyResearchActivityChart } from "@/components/dashboard/CompanyResearchActivityChart";
import { DashboardIdentity } from "@/components/dashboard/DashboardIdentity";
import { IncompleteProfileBanner } from "@/components/dashboard/IncompleteProfileBanner";
import { JobsFoundOverTimeChart } from "@/components/dashboard/JobsFoundOverTimeChart";
import { MatchScoreDistributionChart } from "@/components/dashboard/MatchScoreDistributionChart";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Navbar } from "@/components/layout/Navbar";
import { computeRecentActivity } from "@/lib/dashboard-activity";
import {
  computeCompanyResearchActivity,
  computeJobsFoundOverTime,
  computeMatchScoreDistribution,
  type ChartsSourceJob,
} from "@/lib/dashboard-charts";
import { computeDashboardStats, type DashboardStatsJob } from "@/lib/dashboard-stats";
import { createInsforgeServer } from "@/lib/insforge-server";
import { isProfileComplete } from "@/lib/profile-completion";
import type { ProfileRow } from "@/types";

export default async function DashboardPage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  const [
    { data: row, error: profileError },
    { data: statsJobs, error: statsJobsError },
    { data: agentRunRows, error: agentRunsError },
    { data: researchedJobRows, error: researchedJobsError },
  ] = await Promise.all([
    insforge.database.from("profiles").select("*").eq("id", data.user.id).maybeSingle<ProfileRow>(),
    insforge.database
      .from("jobs")
      .select("match_score, company_research, found_at, company_research_completed_at")
      .eq("user_id", data.user.id),
    insforge.database
      .from("agent_runs")
      .select("id, job_title_searched, jobs_found, completed_at")
      .eq("user_id", data.user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
    insforge.database
      .from("jobs")
      .select("id, company, company_research_completed_at")
      .eq("user_id", data.user.id)
      .not("company_research_completed_at", "is", null)
      .order("company_research_completed_at", { ascending: false })
      .limit(10),
  ]);

  if (profileError) {
    console.error("[app/dashboard]", profileError);
  }
  if (statsJobsError) {
    console.error("[app/dashboard]", statsJobsError);
  }
  if (agentRunsError) {
    console.error("[app/dashboard]", agentRunsError);
  }
  if (researchedJobsError) {
    console.error("[app/dashboard]", researchedJobsError);
  }

  const profileComplete = isProfileComplete({
    fullName: row?.full_name ?? "",
    phone: row?.phone ?? "",
    location: row?.location ?? "",
    currentTitle: row?.current_title ?? "",
    experienceLevel: row?.experience_level ?? "",
    yearsExperience: row?.years_experience ?? null,
    skills: row?.skills ?? [],
    workExperience: row?.work_experience ?? [],
    education: row?.education ?? {
      highestDegree: "",
      fieldOfStudy: "",
      institutionName: "",
      graduationYear: "",
    },
    jobTitlesSeeking: row?.job_titles_seeking ?? [],
  });

  const rows = (statsJobs ?? []) as (DashboardStatsJob & ChartsSourceJob)[];
  const stats = computeDashboardStats(rows);
  const jobsFoundOverTime = computeJobsFoundOverTime(rows);
  const matchScoreDistribution = computeMatchScoreDistribution(rows);
  const companyResearchActivity = computeCompanyResearchActivity(rows);

  const activity = computeRecentActivity(agentRunRows ?? [], researchedJobRows ?? []);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        className="sr-only fixed start-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-text-primary shadow-sm focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        href="#main-content"
      >
        Skip to content
      </a>
      <DashboardIdentity userId={data.user.id} />
      <Navbar authenticated />
      <main
        className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10 sm:px-8"
        id="main-content"
      >
        {!profileComplete ? <IncompleteProfileBanner /> : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecentActivityCard activity={activity} />
          <CompanyResearchActivityChart data={companyResearchActivity} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <JobsFoundOverTimeChart data={jobsFoundOverTime} />
          <MatchScoreDistributionChart data={matchScoreDistribution} />
        </div>
      </main>
    </div>
  );
}
