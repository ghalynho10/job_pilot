"use client";

import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardScoreBand } from "@/lib/mock-dashboard";

type MatchScoreDistributionChartProps = {
  data: DashboardScoreBand[];
};

export function MatchScoreDistributionChart({
  data,
}: MatchScoreDistributionChartProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Match Score Distribution</h2>
      <div className="mt-4 h-72">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--color-border-light)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="band"
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
            <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
