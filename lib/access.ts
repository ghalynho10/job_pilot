import type { InsForgeClient } from "@insforge/sdk";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { DENIAL_MESSAGES, agentRunsEnabled, isUserApproved } from "@/lib/access-rules";
import { createInsforgeServer } from "@/lib/insforge-server";

// The temporary private beta gate. Every part of JobPilot that spends real
// money at Adzuna, Browserbase, or OpenAI passes through here first.
//
// This file is the seam the rest of the app imports from. The rules themselves
// live in lib/access-rules.ts, which has no runtime imports so the tests can
// load it; both halves are re-exported here so no call site needs to know
// about the split.
// See docs/specs/0012-portfolio-private-access-gate/index.md.

export { agentRunsEnabled, isUserApproved };

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
 * The route handler guard. The actual security boundary of this feature.
 *
 * Call it as the first statement of every route that reaches a paid provider,
 * before request body parsing and before any database read, so a denied caller
 * costs one auth call and one indexed primary key lookup and nothing else.
 *
 * The page gate is user experience only. A hand crafted request with a valid
 * session cookie never renders a page, which is why each paid route re-checks
 * here on its own rather than trusting the redirect.
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

  // Identical message whether the row is missing, pending, or blocked, so the
  // response never reveals the owner's decision about a specific account.
  if (!(await isUserApproved(insforge, userId))) {
    return { ok: false, response: denial(DENIAL_MESSAGES.notApproved, 403) };
  }

  if (requireAgentSwitch && !agentRunsEnabled(process.env.ENABLE_AGENT_RUNS)) {
    return { ok: false, response: denial(DENIAL_MESSAGES.agentsPaused, 503) };
  }

  return { ok: true, insforge, userId, userEmail: data.user.email };
}

/**
 * The page level counterpart: send an unapproved user to the private beta
 * screen instead of showing them an app they cannot use.
 *
 * Assumes the caller already checked the session, so it takes the client and
 * user id the page has already fetched rather than making its own auth call.
 *
 * Never wrap this in a try block. Next.js's redirect works by throwing, so a
 * catch would swallow the redirect and let the page render anyway.
 */
export async function requireApprovedPage(
  insforge: InsForgeClient,
  userId: string,
): Promise<void> {
  const approved = await isUserApproved(insforge, userId);

  if (!approved) {
    redirect("/private-beta");
  }
}
