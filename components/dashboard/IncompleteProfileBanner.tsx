import { AlertCircle } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

export function IncompleteProfileBanner(): JSX.Element {
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-warning px-4 py-3 text-sm font-medium text-warning-foreground"
      role="status"
    >
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      <span>
        Your profile is incomplete.{" "}
        <Link
          className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/profile"
        >
          Complete your profile
        </Link>{" "}
        to get better job matches and research.
      </span>
    </div>
  );
}
