import { redirect } from "next/navigation";
import type { JSX } from "react";

import { FindJobsPage } from "@/components/find-jobs/FindJobsPage";
import { Navbar } from "@/components/layout/Navbar";
import { remainingUsage } from "@/lib/access";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { JobRow } from "@/types";

export default async function FindJobsRoutePage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  const { data: profileRow } = await insforge.database
    .from("profiles")
    .select("skills")
    .eq("id", data.user.id)
    .maybeSingle();

  const hasSkills = Boolean(profileRow?.skills && profileRow.skills.length > 0);

  const { data: jobRows } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("user_id", data.user.id)
    .order("found_at", { ascending: false });

  const initialJobs = (jobRows ?? []) as JobRow[];

  const searchRemaining = await remainingUsage(data.user.id, "search");

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        className="sr-only fixed start-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-text-primary shadow-sm focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        href="#main-content"
      >
        Skip to content
      </a>
      <Navbar authenticated />
      <main
        className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10 sm:px-8"
        id="main-content"
      >
        <FindJobsPage
          hasSkills={hasSkills}
          initialJobs={initialJobs}
          searchRemaining={searchRemaining}
          userId={data.user.id}
        />
      </main>
    </div>
  );
}
