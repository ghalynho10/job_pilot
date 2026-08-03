"use client";

import type { JSX } from "react";
import { useFormStatus } from "react-dom";

export function UpgradeButton(): JSX.Element {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Starting checkout…" : "Upgrade to Pro"}
    </button>
  );
}
