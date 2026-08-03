import type { InsForgeClient } from "@insforge/sdk";
import { NextResponse } from "next/server";

import {
  DENIAL_MESSAGES,
  agentRunsEnabled,
  checkAndIncrementUsage,
  getSubscription,
  remainingUsage,
  type MeteredAction,
  type UsageResult,
} from "@/lib/access-rules";
import { createInsforgeServer } from "@/lib/insforge-server";

// The usage gating seam. Every part of JobPilot that spends real money at
// Adzuna, Browserbase, or OpenAI passes through guardPaidRoute first.
//
// This file is the seam the rest of the app imports from. The rules themselves
// live in lib/access-rules.ts, which has no runtime imports so the tests can
// load it; both halves are re-exported here so no call site needs to know
// about the split.
// See docs/specs/0012-portfolio-private-access-gate/index.md and
// docs/specs/0018-free-tier-usage-gating.md.

export {
  agentRunsEnabled,
  checkAndIncrementUsage,
  getSubscription,
  remainingUsage,
};
export type { MeteredAction, UsageResult };

type DenialBody = { success: false; error: string };

type PaidRouteGuardResult =
  // userEmail rides along because the guard already holds the authenticated
  // user, and the research route needs it to build an empty profile when the
  // user has not saved one. Without it that route would have to make a second
  // identical auth call just to read one field.
  | { ok: true; insforge: InsForgeClient; userId: string; userEmail: string }
  | { ok: false; response: NextResponse<DenialBody> };

type GuardPaidRouteOptions = {
  // True for the two agent routes, which the ENABLE_AGENT_RUNS switch pauses.
  // The two resume routes pass false: they also reach GPT-4o, but the switch is
  // deliberately scoped to the expensive, long running agent paths.
  requireAgentSwitch: boolean;
};

function denial(error: string, status: number): NextResponse<DenialBody> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * The route handler guard. The actual security boundary for paid actions.
 *
 * Call it as the first statement of every route that reaches a paid provider,
 * before request body parsing and before any database read, so a denied caller
 * costs one auth call and one indexed primary key lookup and nothing else.
 *
 * Checks: valid session, then (for agent routes only) the kill switch.
 * Usage enforcement is done separately by each metered route after its own
 * validation, so a request that fails validation never burns quota.
 */
export async function guardPaidRoute({
  requireAgentSwitch,
}: GuardPaidRouteOptions): Promise<PaidRouteGuardResult> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    return { ok: false, response: denial(DENIAL_MESSAGES.signedOut, 401) };
  }

  const userId = data.user.id;

  if (requireAgentSwitch && !agentRunsEnabled(process.env.ENABLE_AGENT_RUNS)) {
    return { ok: false, response: denial(DENIAL_MESSAGES.agentsPaused, 503) };
  }

  return { ok: true, insforge, userId, userEmail: data.user.email };
}

/**
 * Check whether this user is under the usage cap for the given metered action.
 *
 * Returns an ok/false discriminated result. On denial (capped), the response
 * carries code "usage_capped" and the current usage/limit so the caller can
 * show how many remain. On ok, a full UsageResult is passed through so the
 * caller can read the remaining count.
 *
 * Call this after the route's own validation (profile has skills, job exists)
 * and right before the paid provider call. Quota is only spent on a request
 * that passes validation.
 */
export async function enforceUsageCap(
  userId: string,
  action: MeteredAction,
): Promise<
  | { ok: true; usage: UsageResult }
  | {
      ok: false;
      response: NextResponse<
        DenialBody & { code: string; used: number; limit: number }
      >;
    }
> {
  const usage = await checkAndIncrementUsage(userId, action);

  if (!usage.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: DENIAL_MESSAGES.usageCapped,
          code: "usage_capped",
          used: usage.used,
          limit: usage.limit,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, usage };
}
