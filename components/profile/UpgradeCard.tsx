import { CheckCircle } from "lucide-react";
import type { JSX } from "react";

import { UpgradeButton } from "@/components/profile/UpgradeButton";
import type { Subscription } from "@/types";

type UpgradeCardProps = {
  plan: Subscription["plan"];
  isApproved: boolean;
  errorMessage?: string;
};

export function UpgradeCard({
  plan,
  isApproved,
  errorMessage,
}: UpgradeCardProps): JSX.Element {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Plan</h2>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
            {plan === "pro"
              ? "You're on the Pro plan."
              : "You're on the free plan. Upgrade to Pro for $9/month."}
          </p>
        </div>

        {plan === "pro" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-success-lightest px-3 py-1.5 text-sm font-medium text-success-foreground">
            <CheckCircle aria-hidden="true" className="size-4" />
            Pro
          </span>
        ) : /* TEMPORARY: isApproved gates the Upgrade button behind the
             access allowlist. Remove once live Stripe is active. */
        isApproved ? (
          <UpgradeButton />
        ) : null}
      </div>

      {errorMessage ? (
        <p
          className="rounded-md border border-error bg-surface px-4 py-3 text-sm text-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
