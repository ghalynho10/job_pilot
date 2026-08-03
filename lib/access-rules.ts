import type { InsForgeClient } from "@insforge/sdk";

import { createInsforgeServiceClient } from "./insforge-service.ts";
import type { Subscription, SubscriptionRow } from "@/types";

// Usage caps and enforcement for the two metered actions. Replaces the old
// private beta gate (isUserApproved, user_access) with subscription based
// usage gating. See docs/specs/0018-free-tier-usage-gating.md.
//
// The rules live here so the test runner can import them directly; the seam
// the rest of the app imports is lib/access.ts, which re-exports everything.
// See docs/specs/0012-portfolio-private-access-gate/index.md for the original
// split rationale, which still applies.

export const DENIAL_MESSAGES = {
  signedOut: "You must be signed in to do that.",
  usageCapped:
    "You have used all your free searches for this cycle. Upgrade to Pro for unlimited access.",
  agentsPaused: "Job search and company research are temporarily paused.",
} as const;

/** Free tier caps: 10 Adzuna job searches, 3 company research runs per rolling 30 day window. */
export const FREE_TIER_CAPS = {
  search: 10,
  research: 3,
} as const;

export type MeteredAction = keyof typeof FREE_TIER_CAPS;

export type UsageResult = {
  /** Whether the action is allowed (under cap, or Pro in good standing). */
  allowed: boolean;
  /** The plan at the time of the check ("free" or "pro"). */
  plan: "free" | "pro";
  /** How many units of this action have been used in the current window. */
  used: number;
  /** The cap for this action on the free plan. */
  limit: number;
  /** When the current rolling 30 day window started. */
  periodStart: string;
};

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
 * Atomically check whether this account is allowed to run one unit of the
 * given metered action, and if so, increment the counter.
 *
 * Calls the SECURITY DEFINER Postgres function check_and_increment_usage
 * through the service role client. The check and the increment happen as one
 * database statement, so two simultaneous requests cannot both read "under
 * cap" before either writes.
 *
 * Always returns exactly one UsageResult. A database error or a thrown
 * exception fails closed (allowed = false) rather than silently opening
 * the gate.
 *
 * Server side only. Never import this in a client component or server action.
 */
export async function checkAndIncrementUsage(
  userId: string,
  action: MeteredAction,
  _createClient: () => InsForgeClient = createInsforgeServiceClient,
): Promise<UsageResult> {
  let insforge: InsForgeClient;
  try {
    insforge = _createClient();
  } catch (error) {
    console.error("[lib/access]", error);
    return {
      allowed: false,
      plan: "free",
      used: FREE_TIER_CAPS[action],
      limit: FREE_TIER_CAPS[action],
      periodStart: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await insforge.database.rpc(
      "check_and_increment_usage",
      {
        p_user_id: userId,
        p_action: action,
        p_search_limit: FREE_TIER_CAPS.search,
        p_research_limit: FREE_TIER_CAPS.research,
      },
    );

    if (error || !data) {
      console.error("[lib/access]", error);
      return {
        allowed: false,
        plan: "free",
        used: FREE_TIER_CAPS[action],
        limit: FREE_TIER_CAPS[action],
        periodStart: new Date().toISOString(),
      };
    }

    const result = data as {
      allowed: boolean;
      plan: string;
      used: number;
      limit_val: number;
      period_start: string;
    };

    return {
      allowed: result.allowed,
      plan: result.plan as "free" | "pro",
      used: result.used,
      limit: result.limit_val,
      periodStart: result.period_start,
    };
  } catch (error) {
    console.error("[lib/access]", error);
    return {
      allowed: false,
      plan: "free",
      used: FREE_TIER_CAPS[action],
      limit: FREE_TIER_CAPS[action],
      periodStart: new Date().toISOString(),
    };
  }
}

/**
 * Read only helper: how many units of the given action remain in the current
 * 30 day window, without touching the counter.
 *
 * Reads the current subscription row through the service role client, which is
 * a plain SELECT with no side effects. When the usage_period_start is more
 * than 30 days old, reports the full cap as remaining (the window will reset
 * on the next actual action, not on this read).
 *
 * Returns null when the read itself fails, so the caller can decide whether to
 * show a counter at all.
 */
export async function remainingUsage(
  userId: string,
  action: MeteredAction,
  _createClient: () => InsForgeClient = createInsforgeServiceClient,
): Promise<{ used: number; limit: number } | null> {
  const result = await getSubscription(userId, _createClient);

  if (!result.ok) {
    return null;
  }

  const sub = result.subscription;
  const limit = FREE_TIER_CAPS[action];
  const used =
    action === "search" ? sub.adzunaSearchesUsed : sub.researchRunsUsed;

  // A Pro account in good standing has no cap to show.
  if (
    sub.plan === "pro" &&
    (sub.status === "active" || sub.status === "trialing")
  ) {
    return null;
  }

  // If the window has expired, the next action will reset both counters, so
  // report the full cap as remaining rather than a stale count.
  const periodStart = new Date(sub.usagePeriodStart);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (periodStart < thirtyDaysAgo) {
    return { used: 0, limit };
  }

  return { used, limit };
}

/**
 * Read this account's subscription row through the service role, returning the
 * free plan default when no row exists yet. Never creates a row; only privileged
 * writers (the webhook handler in feature 2, or a usage increment path in
 * feature 3) create one.
 *
 * Uses a service role client internally because the subscriptions table is
 * revoked from the authenticated role. No outside caller passes a client in,
 * and the privilege boundary is explicit: nothing outside this function needs
 * to know which client it uses.
 *
 * Server side only. There is no client side read of this table at all, so no
 * browser caller should ever import this function directly.
 *
 * Returns a discriminated result so callers can tell a failed read from a
 * genuine free user. A missing row (the ordinary state of every new signup) is
 * still { ok: true } with the free plan default, never a failure.
 *
 * @param _createClient - Internal testing seam. Do not pass in production code.
 */
export async function getSubscription(
  userId: string,
  _createClient: () => InsForgeClient = createInsforgeServiceClient,
): Promise<{ ok: true; subscription: Subscription } | { ok: false }> {
  const freeDefault: Subscription = {
    plan: "free",
    status: "active",
    researchRunsUsed: 0,
    adzunaSearchesUsed: 0,
    usagePeriodStart: new Date().toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };

  let insforge: InsForgeClient;
  try {
    insforge = _createClient();
  } catch (error) {
    console.error("[lib/access]", error);
    return { ok: false };
  }

  try {
    const { data, error } = await insforge.database
      .from("subscriptions")
      .select(
        "plan, status, research_runs_used, adzuna_searches_used, usage_period_start, stripe_customer_id, stripe_subscription_id",
      )
      .eq("user_id", userId)
      .maybeSingle<
        Pick<
          SubscriptionRow,
          | "plan"
          | "status"
          | "research_runs_used"
          | "adzuna_searches_used"
          | "usage_period_start"
          | "stripe_customer_id"
          | "stripe_subscription_id"
        >
      >();

    if (error) {
      console.error("[lib/access]", error);
      return { ok: false };
    }

    if (!data) {
      return { ok: true, subscription: freeDefault };
    }

    return {
      ok: true,
      subscription: {
        plan: data.plan,
        status: data.status,
        researchRunsUsed: data.research_runs_used,
        adzunaSearchesUsed: data.adzuna_searches_used,
        usagePeriodStart: data.usage_period_start,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
      },
    };
  } catch (error) {
    console.error("[lib/access]", error);
    return { ok: false };
  }
}
