import { redirect } from "next/navigation";
import type { JSX } from "react";

import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { DashboardIdentity } from "@/components/dashboard/DashboardIdentity";
import { Navbar } from "@/components/layout/Navbar";
import { createInsforgeServer } from "@/lib/insforge-server";

export default async function DashboardPage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

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
        <header>
          <p className="text-base font-medium text-accent">
            Welcome back
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">
            Your JobPilot dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">
            Your job matches, company research, and recent activity will collect
            here as you build your search.
          </p>
        </header>

        <section className="rounded-md border border-border bg-surface p-6 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-text-primary">
              Set up your search profile
            </h2>
            <p className="mt-2 text-base leading-7 text-text-secondary">
              Add your experience and skills so JobPilot can score each role
              against what you actually bring.
            </p>
            <DashboardActions />
          </div>
        </section>
      </main>
    </div>
  );
}
