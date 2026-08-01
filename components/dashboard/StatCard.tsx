import type { JSX } from "react";

import type { DashboardStat } from "@/lib/dashboard-types";

type StatCardProps = {
  stat: DashboardStat;
};

export function StatCard({ stat }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-sm font-medium text-text-secondary">{stat.label}</p>
      <p className="mt-2 text-3xl font-semibold text-text-primary">{stat.value}</p>
      {stat.trend ? (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-success-lightest px-2 py-0.5 font-medium text-success-foreground">
            {stat.caption}
          </span>
          <span className="text-text-secondary">{stat.trend.label}</span>
        </p>
      ) : stat.caption ? (
        <p className="mt-3 text-sm text-text-secondary">{stat.caption}</p>
      ) : null}
    </div>
  );
}
