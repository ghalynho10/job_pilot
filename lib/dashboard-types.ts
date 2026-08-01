export type DashboardStat = {
  label: string;
  value: string;
  trend?: { direction: "up"; label: string };
  caption?: string;
};

export type DashboardActivityEntry = {
  id: string;
  dotColor: "accent" | "info" | "success";
  title: string;
  timestamp: string;
};

export type DashboardDayCount = {
  day: string;
  count: number;
};

export type DashboardScoreBand = {
  band: string;
  count: number;
};
