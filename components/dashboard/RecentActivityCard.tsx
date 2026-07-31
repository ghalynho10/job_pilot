import type { JSX } from "react";

import type { DashboardActivityEntry } from "@/lib/mock-dashboard";

type RecentActivityCardProps = {
  activity: DashboardActivityEntry[];
};

const DOT_CLASS: Record<DashboardActivityEntry["dotColor"], string> = {
  accent: "bg-accent",
  info: "bg-info-medium",
  success: "bg-success",
};

export function RecentActivityCard({ activity }: RecentActivityCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Recent Activity</h2>
      <ul className="mt-4 divide-y divide-border">
        {activity.map((entry) => (
          <li className="flex items-start gap-3 py-4 first:pt-4 last:pb-0" key={entry.id}>
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_CLASS[entry.dotColor]}`}
            />
            <div>
              <p className="text-sm font-medium text-text-primary">{entry.title}</p>
              <p className="mt-1 text-xs text-text-muted">{entry.timestamp}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
