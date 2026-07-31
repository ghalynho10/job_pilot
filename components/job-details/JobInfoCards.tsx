import { BriefcaseBusiness, CalendarDays, DollarSign, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type InfoItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
};

type JobInfoCardsProps = {
  salary: string;
  location: string;
  jobType: string;
  foundAt: string;
};

export function JobInfoCards({ salary, location, jobType, foundAt }: JobInfoCardsProps): JSX.Element {
  const items: InfoItem[] = [
    { label: "Salary Est.", value: salary, icon: DollarSign, tone: "bg-success-lightest text-success" },
    { label: "Location", value: location, icon: MapPin, tone: "bg-info-lightest text-info-foreground" },
    { label: "Job Type", value: jobType, icon: BriefcaseBusiness, tone: "bg-accent-muted text-accent" },
    { label: "Date Found", value: foundAt, icon: CalendarDays, tone: "bg-surface-secondary text-text-secondary" },
  ];

  return (
    <section aria-label="Job facts" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm" key={item.label}>
            <div className="flex items-center gap-3">
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                <Icon aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-text-primary">{item.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-text-muted">{item.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
