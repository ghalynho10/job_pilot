import { AlertCircle, CheckCircle } from "lucide-react";
import type { JSX } from "react";

import type { ProfileCompletion } from "@/types";

interface CompletionIndicatorProps {
  completion: ProfileCompletion;
}

const RING_SIZE = 128;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function CompletionIndicator({
  completion,
}: CompletionIndicatorProps): JSX.Element {
  const { percentage, missingFields } = completion;
  const isComplete = missingFields.length === 0;
  const offset = RING_CIRCUMFERENCE * (1 - percentage / 100);
  const ringColorClass = isComplete ? "text-success" : "text-error";

  return (
    <section className="flex items-center justify-between gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle aria-hidden="true" className="size-5 text-success" />
          ) : (
            <AlertCircle aria-hidden="true" className="size-5 text-error" />
          )}
          <h2 className="text-lg font-semibold text-text-primary">
            {isComplete ? "Profile complete" : "Profile needs attention"}
          </h2>
        </div>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          {isComplete
            ? "Your profile is fully filled out and ready for tailored matches and quality resumes."
            : "Complete the missing fields to improve your chance of getting tailored matches and generating quality resumes."}
        </p>
        {missingFields.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {missingFields.map((field) => (
              <li
                className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-error"
                key={field}
              >
                {field}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="relative shrink-0" style={{ height: RING_SIZE, width: RING_SIZE }}>
        <svg
          className="-rotate-90"
          height={RING_SIZE}
          role="img"
          aria-label={`Profile ${percentage}% complete`}
          width={RING_SIZE}
        >
          <circle
            className={`${ringColorClass}/15`}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke="currentColor"
            strokeWidth={RING_STROKE}
          />
          <circle
            className={ringColorClass}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke="currentColor"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-text-primary">
          {percentage}%
        </span>
      </div>
    </section>
  );
}
