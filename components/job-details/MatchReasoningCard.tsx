import { Sparkles } from "lucide-react";
import type { JSX } from "react";

type MatchReasoningCardProps = {
  matchReason: string | null;
};

export function MatchReasoningCard({ matchReason }: MatchReasoningCardProps): JSX.Element {
  const reason = matchReason?.trim();

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="match-reasoning">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-success-lightest">
          <Sparkles aria-hidden="true" className="size-4 text-success" />
        </div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary" id="match-reasoning">
          AI Match Reasoning
        </h2>
      </div>
      {reason ? (
        <p className="mt-5 text-base font-medium leading-7 text-text-primary">{reason}</p>
      ) : (
        <p className="mt-5 text-sm text-text-muted">Match reasoning is unavailable for this job.</p>
      )}
    </section>
  );
}
