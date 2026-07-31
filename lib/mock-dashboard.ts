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

export const mockCompanyResearchActivity: DashboardDayCount[] = [
  { day: "Mon", count: 2 },
  { day: "Tue", count: 5 },
  { day: "Wed", count: 3 },
  { day: "Thu", count: 8 },
  { day: "Fri", count: 12 },
  { day: "Sat", count: 4 },
  { day: "Sun", count: 1 },
];

export const mockJobsFoundOverTime: DashboardDayCount[] = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 45 },
  { day: "Wed", count: 32 },
  { day: "Thu", count: 55 },
  { day: "Fri", count: 88 },
  { day: "Sat", count: 60 },
  { day: "Sun", count: 15 },
];

export const mockMatchScoreDistribution: DashboardScoreBand[] = [
  { band: "50-60%", count: 2 },
  { band: "60-70%", count: 12 },
  { band: "70-80%", count: 45 },
  { band: "80-90%", count: 85 },
  { band: "90-100%", count: 32 },
];
