import { notFound, redirect } from "next/navigation";
import type { JSX } from "react";

import { JobDetailsPage } from "@/components/job-details/JobDetailsPage";
import { Navbar } from "@/components/layout/Navbar";
import { createInsforgeServer } from "@/lib/insforge-server";
import { isValidUuid } from "@/lib/job-details";
import type { JobRow } from "@/types";

type FindJobDetailsRoutePageProps = {
  params: Promise<{ id: string }>;
};

export default async function FindJobDetailsRoutePage({
  params,
}: FindJobDetailsRoutePageProps): Promise<JSX.Element> {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  const { data: jobRow, error: jobError } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (jobError) {
    throw new Error("Job details could not be loaded.");
  }

  if (!jobRow) {
    notFound();
  }

  const job = jobRow as JobRow;

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        className="sr-only fixed start-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-text-primary shadow-sm focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        href="#main-content"
      >
        Skip to content
      </a>
      <Navbar authenticated />
      <main className="mx-auto max-w-[1440px] px-6 py-10 sm:px-8" id="main-content">
        <JobDetailsPage job={job} />
      </main>
    </div>
  );
}
