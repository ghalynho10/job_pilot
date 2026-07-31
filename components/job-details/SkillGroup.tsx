import { Check, X } from "lucide-react";
import type { JSX } from "react";

type SkillGroupProps = {
  emptyText: string;
  icon: "check" | "x";
  label: string;
  skills: string[];
  variant: "matched" | "missing";
};

export function SkillGroup({ emptyText, icon, label, skills, variant }: SkillGroupProps): JSX.Element {
  const pillClasses =
    variant === "matched" ? "bg-success-lightest text-success-foreground" : "bg-accent-muted text-accent";

  return (
    <div>
      <h3 className="text-sm font-medium text-text-muted">{label}</h3>
      {skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${pillClasses}`}
              key={skill}
            >
              {icon === "check" ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <X aria-hidden="true" className="size-3.5" />
              )}
              {skill}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-text-muted">{emptyText}</p>
      )}
    </div>
  );
}
