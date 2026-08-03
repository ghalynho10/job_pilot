import { CheckCircle } from "lucide-react";
import type { JSX } from "react";

export function UpgradeSuccessBanner(): JSX.Element {
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-success-lightest px-4 py-3 text-sm font-medium text-success-foreground"
      role="status"
    >
      <CheckCircle aria-hidden="true" className="size-4 shrink-0" />
      <span>
        You&apos;re on the Pro plan now. It may take a few seconds to fully
        activate.
      </span>
    </div>
  );
}
