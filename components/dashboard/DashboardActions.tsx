"use client";

import Link from "next/link";
import posthog from "posthog-js";

export function DashboardActions() {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        className="rounded-md bg-accent px-4 py-3 text-base font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/profile"
        onClick={() => posthog.capture("dashboard_profile_setup_selected")}
      >
        Complete profile
      </Link>
      <Link
        className="rounded-md border border-border bg-surface px-4 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/find-jobs"
        onClick={() => posthog.capture("dashboard_job_search_selected")}
      >
        Find jobs
      </Link>
    </div>
  );
}
