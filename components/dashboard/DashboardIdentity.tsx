"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

type DashboardIdentityProps = {
  userId: string;
};

export function DashboardIdentity({ userId }: DashboardIdentityProps) {
  useEffect(() => {
    posthog.identify(userId);
  }, [userId]);

  return null;
}
