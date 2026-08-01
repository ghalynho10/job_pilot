"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardDayCount } from "@/lib/mock-dashboard";

type JobsFoundOverTimeChartProps = {
  data: DashboardDayCount[];
};

export function JobsFoundOverTimeChart({ data }: JobsFoundOverTimeChartProps): JSX.Element {
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Jobs Found Over Time</h2>
      {total === 0 ? (
        <div
          className="mt-4 rounded-lg bg-surface-secondary px-4 py-3 text-sm font-medium text-text-secondary"
          role="status"
        >
          No jobs found in the last 30 days.
        </div>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="jobsFoundOverTimeFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-light)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="day"
                interval="preserveStartEnd"
                stroke="var(--color-text-muted)"
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              />
              <YAxis
                axisLine={false}
                stroke="var(--color-text-muted)"
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                dataKey="count"
                fill="url(#jobsFoundOverTimeFill)"
                stroke="var(--color-accent)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
