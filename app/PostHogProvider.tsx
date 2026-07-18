"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { initPostHog } from "@/lib/posthog-client";

type PostHogProviderProps = {
  children: ReactNode;
};

export function PostHogProvider({ children }: PostHogProviderProps): ReactNode {
  useEffect(() => {
    initPostHog();
  }, []);

  return children;
}
