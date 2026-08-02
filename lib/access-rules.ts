import type { InsForgeClient } from "@insforge/sdk";

import type { Subscription, SubscriptionRow, UserAccessRow } from "@/types";

// The half of the private beta gate that holds the actual rules, split out from
// lib/access.ts for one reason: this file has no runtime imports at all, so the
// test runner can import it directly. lib/access.ts cannot be imported by the
// tests because bare Node cannot resolve "next/server", which guardPaidRoute
// needs for NextResponse.
//
// Import these through lib/access.ts, which re-exports both. That keeps the
// gate a single named seam for the rest of the app, and keeps isUserApproved
// the one and only place that reads user_access.
// See docs/specs/0012-portfolio-private-access-gate/index.md.

export const DENIAL_MESSAGES = {
  signedOut: "You must be signed in to do that.",
  notApproved: "JobPilot is in private beta. Your account is not approved yet.",
  agentsPaused: "Job search and company research are temporarily paused.",
} as const;

/**
 * Whether the two agent routes may run, read from the ENABLE_AGENT_RUNS value.
 *
 * Takes the flag as an argument rather than reading process.env itself, the
 * same injectable shape as getAppOrigin in lib/auth-routing.ts, so it is unit
 * testable without mutating the process environment.
 *
 * Defaults to allowing. Only the exact string "false" disables, so a missing,
 * empty, or misspelled variable never silently breaks a working deployment.
 */
export function agentRunsEnabled(flag: string | undefined): boolean {
  return flag !== "false";
}

/**
 * Whether this user may use the paid parts of the app.
 *
 * The only place in the codebase that reads user_access. Never throws: a query
 * error is logged and denies, because failing open here costs money.
 *
 * A missing row is the ordinary case for every new signup, not an error, so it
 * denies on the same path but logs nothing.
 *
 * Billing (scope features 1 to 3) replaces this function body with a
 * subscription plus usage check. Because nothing else reads user_access, that
 * swap is this one function and no call sites.
 */
export async function isUserApproved(
  insforge: InsForgeClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await insforge.database
      .from("user_access")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle<Pick<UserAccessRow, "status">>();

    if (error) {
      console.error("[lib/access]", error);
      return false;
    }

    return data?.status === "approved";
  } catch (error) {
    console.error("[lib/access]", error);
    return false;
  }
}

/**
 * Read this account's subscription row, returning the free plan default when no
 * row exists yet. Never creates a row; only privileged writers (the webhook
 * handler in feature 2, or a usage increment path in feature 3) create one.
 *
 * Server side only. There is no client side read of this table at all, so no
 * browser caller should ever import this function directly.
 *
 * Never throws: a query error is logged and returns the free plan default,
 * because a transient database read should not block access.
 */
export async function getSubscription(
  insforge: InsForgeClient,
  userId: string,
): Promise<Subscription> {
  const freeDefault: Subscription = {
    plan: "free",
    status: "active",
    researchRunsUsed: 0,
    usagePeriodStart: new Date().toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };

  try {
    const { data, error } = await insforge.database
      .from("subscriptions")
      .select(
        "plan, status, research_runs_used, usage_period_start, stripe_customer_id, stripe_subscription_id",
      )
      .eq("user_id", userId)
      .maybeSingle<
        Pick<
          SubscriptionRow,
          | "plan"
          | "status"
          | "research_runs_used"
          | "usage_period_start"
          | "stripe_customer_id"
          | "stripe_subscription_id"
        >
      >();

    if (error) {
      console.error("[lib/access]", error);
      return freeDefault;
    }

    if (!data) {
      return freeDefault;
    }

    return {
      plan: data.plan,
      status: data.status,
      researchRunsUsed: data.research_runs_used,
      usagePeriodStart: data.usage_period_start,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
    };
  } catch (error) {
    console.error("[lib/access]", error);
    return freeDefault;
  }
}
