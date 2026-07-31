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
import { createInsforgeServer } from "@/lib/insforge-server";
import { isProfileComplete } from "@/lib/profile-completion";
import {
  mockActivity,
  mockCompanyResearchActivity,
  mockJobsFoundOverTime,
  mockMatchScoreDistribution,
  mockStats,
} from "@/lib/mock-dashboard";
import type { ProfileRow } from "@/types";

export default async function DashboardPage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  const { data: row } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();

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
          {mockStats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecentActivityCard activity={mockActivity} />
          <CompanyResearchActivityChart data={mockCompanyResearchActivity} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <JobsFoundOverTimeChart data={mockJobsFoundOverTime} />
          <MatchScoreDistributionChart data={mockMatchScoreDistribution} />
        </div>
      </main>
    </div>
  );
}
