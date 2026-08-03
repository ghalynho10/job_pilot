"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

import { startCheckout } from "@/actions/billing";

export function UpgradeButton(): JSX.Element {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function resetPending(): void {
      setPending(false);
    }

    window.addEventListener("pageshow", resetPending);

    return () => window.removeEventListener("pageshow", resetPending);
  }, []);

  async function handleClick(): Promise<void> {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      const result = await startCheckout();

      if (result.success) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      window.location.assign("/profile?error=checkout");
    } catch (error) {
      console.error("[UpgradeButton]", error);
      window.location.assign("/profile?error=checkout");
    }
  }

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      onClick={handleClick}
      type="button"
    >
      {pending ? "Starting checkout…" : "Upgrade to Pro"}
    </button>
  );
}
