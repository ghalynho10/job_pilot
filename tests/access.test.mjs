import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  agentRunsEnabled,
  checkAndIncrementUsage,
  FREE_TIER_CAPS,
  getSubscription,
} from "../lib/access-rules.ts";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

// A stand in for the InsForge service role client that records RPC calls, so
// the tests can prove checkAndIncrementUsage calls the right function with the
// right arguments and handles every return shape correctly.
function fakeServiceInsforge({
  rpcData = null,
  rpcError = null,
  throwOnRpc = false,
} = {}) {
  const rpcCalls = [];

  return {
    rpcCalls,
    database: {
      async rpc(fnName, params) {
        rpcCalls.push({ fnName, params });
        if (throwOnRpc) {
          throw new Error("connection lost");
        }
        return { data: rpcData, error: rpcError };
      },
    },
  };
}

// console.error is part of the contract: a real RPC failure must be logged
// and fail closed.
async function captureErrors(run) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    return { result: await run(), logged };
  } finally {
    console.error = original;
  }
}

// ---------------------------------------------------------------------------
// agentRunsEnabled (unchanged from the old gate)
// ---------------------------------------------------------------------------

test("only the exact string false disables agent runs", () => {
  assert.equal(agentRunsEnabled("false"), false);
});

test("agent runs stay enabled when the flag is unset, empty, true, or misspelled", () => {
  assert.equal(agentRunsEnabled(undefined), true);
  assert.equal(agentRunsEnabled(""), true);
  assert.equal(agentRunsEnabled("true"), true);
  assert.equal(agentRunsEnabled("FALSE"), true);
  assert.equal(agentRunsEnabled("False"), true);
  assert.equal(agentRunsEnabled(" false "), true);
});

test("agentRunsEnabled reads nothing from the process environment", async () => {
  const source = await readProjectFile("lib/access-rules.ts");
  const body = source.slice(source.indexOf("export function agentRunsEnabled"));

  assert.ok(
    !body.includes("process.env"),
    "agentRunsEnabled must take the flag as an argument, not read it",
  );
});

// ---------------------------------------------------------------------------
// checkAndIncrementUsage (feature 3, AC-1 through AC-5)
// ---------------------------------------------------------------------------

test("a free user under the cap is allowed and the count is returned (AC-1)", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: true,
      plan: "free",
      used: 4,
      limit_val: 10,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  const result = await checkAndIncrementUsage(
    "user-1",
    "search",
    () => insforge,
  );

  assert.equal(result.allowed, true);
  assert.equal(result.plan, "free");
  assert.equal(result.used, 4);
  assert.equal(result.limit, 10);
});

test("a free user at the cap is denied without incrementing (AC-2)", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: false,
      plan: "free",
      used: 10,
      limit_val: 10,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  const result = await checkAndIncrementUsage(
    "user-1",
    "search",
    () => insforge,
  );

  assert.equal(result.allowed, false);
  assert.equal(result.used, 10);
  assert.equal(result.limit, 10);
});

test("a Pro user in good standing is always allowed and no counter is touched (AC-3)", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: true,
      plan: "pro",
      used: 0,
      limit_val: 0,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  const result = await checkAndIncrementUsage(
    "user-1",
    "research",
    () => insforge,
  );

  assert.equal(result.allowed, true);
  assert.equal(result.plan, "pro");
  assert.equal(result.used, 0);
  assert.equal(result.limit, 0);
});

test("an RPC error fails closed (allowed = false)", async () => {
  const insforge = fakeServiceInsforge({
    rpcError: { message: "function not found" },
  });
  const { result, logged } = await captureErrors(() =>
    checkAndIncrementUsage("user-1", "search", () => insforge),
  );

  assert.equal(result.allowed, false);
  assert.equal(result.plan, "free");
  assert.equal(result.limit, FREE_TIER_CAPS.search);
  assert.equal(logged.length, 1);
});

test("a thrown RPC call fails closed", async () => {
  const insforge = fakeServiceInsforge({ throwOnRpc: true });
  const { result, logged } = await captureErrors(() =>
    checkAndIncrementUsage("user-1", "search", () => insforge),
  );

  assert.equal(result.allowed, false);
  assert.equal(logged.length, 1);
});

test("checkAndIncrementUsage calls the RPC with the correct function name and caps (AC-1)", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: true,
      plan: "free",
      used: 1,
      limit_val: 3,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  await checkAndIncrementUsage("user-1", "research", () => insforge);

  assert.equal(insforge.rpcCalls.length, 1);
  assert.equal(insforge.rpcCalls[0].fnName, "check_and_increment_usage");
  assert.equal(insforge.rpcCalls[0].params.p_user_id, "user-1");
  assert.equal(insforge.rpcCalls[0].params.p_action, "research");
  assert.equal(
    insforge.rpcCalls[0].params.p_search_limit,
    FREE_TIER_CAPS.search,
  );
  assert.equal(
    insforge.rpcCalls[0].params.p_research_limit,
    FREE_TIER_CAPS.research,
  );
});

test("checkAndIncrementUsage passes the search cap for a search action and research cap for research", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: true,
      plan: "free",
      used: 1,
      limit_val: 10,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  await checkAndIncrementUsage("user-1", "search", () => insforge);

  assert.equal(insforge.rpcCalls[0].params.p_search_limit, 10);
  assert.equal(insforge.rpcCalls[0].params.p_research_limit, 3);
});

test("checkAndIncrementUsage returns denied when the client factory throws (AC-3)", async () => {
  const makeClient = () => {
    throw new Error("SERVICE_ROLE_KEY is not set");
  };
  const { result, logged } = await captureErrors(() =>
    checkAndIncrementUsage("user-1", "search", makeClient),
  );

  assert.equal(result.allowed, false);
  assert.equal(result.plan, "free");
  assert.equal(result.used, FREE_TIER_CAPS.search);
  assert.equal(result.limit, FREE_TIER_CAPS.search);
  assert.equal(logged.length, 1);
});

test("checkAndIncrementUsage returns denied when RPC data is null or empty", async () => {
  // The RPC returned no data (not an error, just no result).
  const insforge = fakeServiceInsforge({ rpcData: null });
  const { result, logged } = await captureErrors(() =>
    checkAndIncrementUsage("user-1", "search", () => insforge),
  );

  assert.equal(result.allowed, false);
  assert.equal(logged.length, 1);
});

test("checkAndIncrementUsage maps the RPC return fields correctly for both actions", async () => {
  const insforge = fakeServiceInsforge({
    rpcData: {
      allowed: true,
      plan: "free",
      used: 1,
      limit_val: 3,
      period_start: "2026-08-01T00:00:00Z",
    },
  });

  const researchResult = await checkAndIncrementUsage(
    "user-1",
    "research",
    () => insforge,
  );
  assert.equal(researchResult.used, 1);
  assert.equal(researchResult.limit, 3);
  assert.equal(researchResult.periodStart, "2026-08-01T00:00:00Z");

  const searchResult = await checkAndIncrementUsage(
    "user-1",
    "search",
    () => insforge,
  );
  assert.equal(searchResult.used, 1);
  assert.equal(searchResult.limit, 3);
  assert.equal(searchResult.periodStart, "2026-08-01T00:00:00Z");
});

// ---------------------------------------------------------------------------
// guardPaidRoute: status codes (feature 3, AC-2, AC-7)
// ---------------------------------------------------------------------------

test("the guard returns 401 for a signed out caller and 503 for the kill switch, but no longer checks approval", async () => {
  const source = await readProjectFile("lib/access.ts");

  assert.match(
    source,
    /if \(error \|\| !data\.user\) \{\s*return \{ ok: false, response: denial\(DENIAL_MESSAGES\.signedOut, 401\) \};/,
    "no session must be 401",
  );
  assert.match(
    source,
    /if \(requireAgentSwitch && !agentRunsEnabled\(process\.env\.ENABLE_AGENT_RUNS\)\) \{\s*return \{ ok: false, response: denial\(DENIAL_MESSAGES\.agentsPaused, 503\) \};/,
    "the kill switch must be 503 and must only apply when requireAgentSwitch is set",
  );
  // The old approval check must be gone (AC-7).
  assert.ok(
    !source.includes("isUserApproved"),
    "guardPaidRoute must not reference isUserApproved; the old private beta gate is removed",
  );
});

test("denial messages use the new usage cap wording, not the old private beta wording (AC-2, AC-7)", async () => {
  const source = await readProjectFile("lib/access-rules.ts");

  assert.match(
    source,
    /usageCapped: "You have used all your free searches for this cycle\. Upgrade to Pro for unlimited access\."/,
    "the cap message must mention the free tier cycle and upgrading to Pro",
  );
  // The old private beta message must be gone from DENIAL_MESSAGES.
  // The comment mentioning "private beta gate" is in the file header, not
  // in DENIAL_MESSAGES, so check only the constant block.
  const denialBlock = source.slice(
    source.indexOf("DENIAL_MESSAGES"),
    source.indexOf("} as const"),
  );
  assert.ok(
    !denialBlock.includes("private beta"),
    "DENIAL_MESSAGES must not mention private beta; the old gate is removed",
  );
});

// ---------------------------------------------------------------------------
// Old gate removal: no remaining references (AC-7)
// ---------------------------------------------------------------------------

test("user_access is never read outside lib/access-rules.ts", async () => {
  const searchRoots = ["app", "lib", "components", "actions", "agent"];
  const offenders = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(new URL(`${dir}/`, projectRoot), {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      // The types file has the type definition, which is inert; it's the
      // runtime reads that matter.
      if (path === "lib/access-rules.ts" || path === "types/index.ts") continue;

      const source = await readProjectFile(path);
      if (source.includes("user_access")) {
        offenders.push(path);
      }
    }
  }

  for (const root of searchRoots) {
    await walk(root);
  }

  assert.deepEqual(
    offenders,
    [],
    `user_access must only be defined in types and access-rules, found in: ${offenders.join(", ")}`,
  );
});

test("the private beta page is deleted (AC-7)", async () => {
  let exists = true;
  try {
    await readProjectFile("app/private-beta/page.tsx");
  } catch {
    exists = false;
  }

  assert.equal(exists, false, "app/private-beta/page.tsx must not exist");
});

test("the proxy no longer routes /private-beta (AC-7)", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.ok(
    !source.includes("/private-beta"),
    "the proxy matcher must not include /private-beta",
  );
});

// ---------------------------------------------------------------------------
// enforceUsageCap: cap enforcement response shape (AC-2)
// ---------------------------------------------------------------------------

test("enforceUsageCap exists and returns the usage_capped code on denial", async () => {
  const source = await readProjectFile("lib/access.ts");

  assert.match(
    source,
    /export async function enforceUsageCap/,
    "enforceUsageCap must be exported from lib/access.ts",
  );
  assert.match(
    source,
    /code: "usage_capped"/,
    "the capped denial must carry code usage_capped for the UI to detect",
  );
  assert.match(
    source,
    /used: usage\.used/,
    "the capped response must carry the used count",
  );
  assert.match(
    source,
    /limit: usage\.limit/,
    "the capped response must carry the limit",
  );
});

// ---------------------------------------------------------------------------
// Route wiring: enforceUsageCap is called in both metered routes (AC-6)
// ---------------------------------------------------------------------------

test("the find route calls enforceUsageCap after the profile check and before runJobSearch (AC-6)", async () => {
  const source = await readProjectFile("app/api/agent/find/route.ts");

  const profileCheckIndex = source.indexOf("!profileRow || !profileRow.skills");
  const capCheckIndex = source.indexOf('enforceUsageCap(userId, "search")');
  const runJobSearchIndex = source.indexOf("runJobSearch(");

  assert.ok(profileCheckIndex !== -1, "must check profile has skills");
  assert.ok(capCheckIndex !== -1, "must enforce usage cap");
  assert.ok(runJobSearchIndex !== -1, "must call runJobSearch");
  assert.ok(
    profileCheckIndex < capCheckIndex,
    "profile check must come before usage enforcement so invalid requests never spend quota",
  );
  assert.ok(
    capCheckIndex < runJobSearchIndex,
    "usage enforcement must come before the paid provider call",
  );
});

test("the research route calls enforceUsageCap after the job lookup and before runCompanyResearch (AC-6)", async () => {
  const source = await readProjectFile("app/api/agent/research/route.ts");

  const jobLookupIndex = source.indexOf("!jobRow");
  const capCheckIndex = source.indexOf('enforceUsageCap(userId, "research")');
  const runResearchIndex = source.indexOf("runCompanyResearch(");

  assert.ok(jobLookupIndex !== -1, "must check job exists");
  assert.ok(capCheckIndex !== -1, "must enforce usage cap");
  assert.ok(runResearchIndex !== -1, "must call runCompanyResearch");
  assert.ok(
    jobLookupIndex < capCheckIndex,
    "job lookup must come before usage enforcement so a missing job never spends quota",
  );
  assert.ok(
    capCheckIndex < runResearchIndex,
    "usage enforcement must come before the paid provider call",
  );
});

// ---------------------------------------------------------------------------
// remainingUsage: read only helper (AC-8)
// ---------------------------------------------------------------------------

import { remainingUsage } from "../lib/access-rules.ts";

test("remainingUsage is exported from access-rules", async () => {
  const source = await readProjectFile("lib/access-rules.ts");

  assert.match(
    source,
    /export async function remainingUsage/,
    "remainingUsage must be a named export",
  );
});

test("remainingUsage returns { used, limit } for a free user with some usage", async () => {
  const row = {
    plan: "free",
    status: "active",
    research_runs_used: 2,
    usage_period_start: new Date().toISOString(),
  };
  const insforge = fakeInsforge({ data: row });
  const makeClient = () => insforge;

  const result = await remainingUsage("user-1", "research", makeClient);

  assert.notEqual(result, null);
  assert.equal(result.used, 2);
  assert.equal(result.limit, FREE_TIER_CAPS.research);
});

test("remainingUsage returns search count for the search action and research count for research", async () => {
  const row = {
    plan: "free",
    status: "active",
    research_runs_used: 2,
    adzuna_searches_used: 5,
    usage_period_start: new Date().toISOString(),
  };
  const insforge = fakeInsforge({ data: row });
  const makeClient = () => insforge;

  const searchResult = await remainingUsage("user-1", "search", makeClient);
  assert.equal(searchResult.used, 5);
  assert.equal(searchResult.limit, FREE_TIER_CAPS.search);

  const researchResult = await remainingUsage("user-1", "research", makeClient);
  assert.equal(researchResult.used, 2);
  assert.equal(researchResult.limit, FREE_TIER_CAPS.research);
});

test("remainingUsage returns null for a Pro user in good standing, no cap to show (AC-8)", async () => {
  // Pro + active
  const activeRow = {
    plan: "pro",
    status: "active",
    research_runs_used: 20,
    usage_period_start: new Date().toISOString(),
  };
  const insforge = fakeInsforge({ data: activeRow });
  const result = await remainingUsage("user-1", "research", () => insforge);
  assert.equal(result, null, "Pro active must show no cap");

  // Pro + trialing
  const trialingRow = { ...activeRow, status: "trialing" };
  const insforge2 = fakeInsforge({ data: trialingRow });
  const result2 = await remainingUsage("user-1", "research", () => insforge2);
  assert.equal(result2, null, "Pro trialing must show no cap");
});

test("remainingUsage returns a count for a Pro user with lapsed status, capped like free (AC-3)", async () => {
  for (const lapsedStatus of [
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
  ]) {
    const row = {
      plan: "pro",
      status: lapsedStatus,
      research_runs_used: 3,
      adzuna_searches_used: 10,
      usage_period_start: new Date().toISOString(),
    };
    const insforge = fakeInsforge({ data: row });
    const result = await remainingUsage("user-1", "research", () => insforge);
    assert.notEqual(result, null, `Pro ${lapsedStatus} must show a cap`);
    assert.equal(result.used, 3);
    assert.equal(result.limit, FREE_TIER_CAPS.research);
  }
});

test("remainingUsage reports the full cap as remaining when the window has expired (AC-4)", async () => {
  const fortyDaysAgo = new Date(
    Date.now() - 40 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const row = {
    plan: "free",
    status: "active",
    research_runs_used: 3,
    adzuna_searches_used: 10,
    usage_period_start: fortyDaysAgo,
  };
  const insforge = fakeInsforge({ data: row });
  const makeClient = () => insforge;

  const result = await remainingUsage("user-1", "research", makeClient);
  assert.notEqual(result, null);
  assert.equal(
    result.used,
    0,
    "an expired window must report 0 used, not the stale count",
  );
  assert.equal(
    result.limit,
    FREE_TIER_CAPS.research,
    "the limit stays the same even after expiry",
  );
});

test("remainingUsage returns null when getSubscription fails", async () => {
  const insforge = fakeInsforge({ error: { message: "permission denied" } });
  const makeClient = () => insforge;

  const result = await remainingUsage("user-1", "search", makeClient);
  assert.equal(
    result,
    null,
    "a failed read must return null so the UI can hide the counter",
  );
});

test("remainingUsage never calls the RPC, it only reads the subscriptions table", async () => {
  const source = await readProjectFile("lib/access-rules.ts");
  const body = source.slice(
    source.indexOf("export async function remainingUsage"),
    source.indexOf("export async function getSubscription"),
  );

  assert.match(body, /getSubscription\b/);
  assert.doesNotMatch(body, /\binsert\b/i);
  assert.doesNotMatch(body, /\bupdate\b/i);
  assert.doesNotMatch(body, /\brpc\b/i);
  assert.doesNotMatch(body, /\bcheck_and_increment_usage\b/);
});

// ---------------------------------------------------------------------------
// getSubscription (billing foundation AC-3, feature 1a AC-2, AC-3, feature 3)
// ---------------------------------------------------------------------------

test("getSubscription includes adzuna_searches_used in its select (feature 3)", async () => {
  const source = await readProjectFile("lib/access-rules.ts");

  assert.match(
    source,
    /adzuna_searches_used/,
    "getSubscription must select adzuna_searches_used",
  );
});

test("the free plan default includes adzunaSearchesUsed set to 0", async () => {
  const source = await readProjectFile("lib/access-rules.ts");

  assert.match(
    source,
    /adzunaSearchesUsed: 0/,
    "the free plan default must initialize adzunaSearchesUsed to 0",
  );
});

// A stand in for the InsForge client that records what was asked for, so the
// getSubscription tests can prove the right table and columns are read.
function fakeInsforge({
  data = null,
  error = null,
  throwOnQuery = false,
} = {}) {
  const queries = [];
  let current;

  return {
    queries,
    database: {
      from(table) {
        current = { table, columns: undefined, filters: {} };
        queries.push(current);

        const builder = {
          select(columns) {
            current.columns = columns;
            return builder;
          },
          eq(column, value) {
            current.filters[column] = value;
            return builder;
          },
          async maybeSingle() {
            if (throwOnQuery) {
              throw new Error("connection lost");
            }
            return { data, error };
          },
        };

        return builder;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// getSubscription (unchanged from billing foundation, feature 1a)
//
// getSubscription is the only reader of the subscriptions table. It uses a
// service role client internally because the table is revoked from the
// authenticated role. It returns a discriminated result so callers can tell
// a failed read from a genuine free user.
// ---------------------------------------------------------------------------

test("getSubscription returns the free plan default when no row exists for the user (AC-3)", async () => {
  const insforge = fakeInsforge({ data: null });
  const makeClient = () => insforge;

  const result = await getSubscription(
    "00000000-0000-0000-0000-000000000000",
    makeClient,
  );

  assert.equal(result.ok, true);
  assert.equal(result.subscription.plan, "free");
  assert.equal(result.subscription.status, "active");
  assert.equal(result.subscription.researchRunsUsed, 0);
  assert.equal(result.subscription.stripeCustomerId, null);
  assert.equal(result.subscription.stripeSubscriptionId, null);
  assert.equal(typeof result.subscription.usagePeriodStart, "string");
});

test("getSubscription returns actual plan and Stripe identifiers when a row exists (AC-2)", async () => {
  const row = {
    plan: "pro",
    status: "active",
    research_runs_used: 7,
    usage_period_start: "2026-08-01T00:00:00.000Z",
    stripe_customer_id: "cus_test123",
    stripe_subscription_id: "sub_test456",
  };
  const insforge = fakeInsforge({ data: row });
  const makeClient = () => insforge;

  const result = await getSubscription("user-1", makeClient);

  assert.equal(result.ok, true);
  assert.equal(result.subscription.plan, "pro");
  assert.equal(result.subscription.status, "active");
  assert.equal(result.subscription.researchRunsUsed, 7);
  assert.equal(
    result.subscription.usagePeriodStart,
    "2026-08-01T00:00:00.000Z",
  );
  assert.equal(result.subscription.stripeCustomerId, "cus_test123");
  assert.equal(result.subscription.stripeSubscriptionId, "sub_test456");
});

test("getSubscription returns { ok: false } when the query returns an error, and logs it (AC-3)", async () => {
  const insforge = fakeInsforge({ error: { message: "permission denied" } });
  const makeClient = () => insforge;
  const { result, logged } = await captureErrors(() =>
    getSubscription("user-1", makeClient),
  );

  assert.equal(result.ok, false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "[lib/access]");
});

test("getSubscription returns { ok: false } when the query throws, rather than escaping to the caller (AC-3)", async () => {
  const insforge = fakeInsforge({ throwOnQuery: true });
  const makeClient = () => insforge;
  const { result, logged } = await captureErrors(() =>
    getSubscription("user-1", makeClient),
  );

  assert.equal(result.ok, false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "[lib/access]");
});

test("getSubscription returns { ok: false } when the client factory throws (AC-3)", async () => {
  const makeClient = () => {
    throw new Error("SERVICE_ROLE_KEY is not set");
  };
  const { result, logged } = await captureErrors(() =>
    getSubscription("user-1", makeClient),
  );

  assert.equal(result.ok, false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "[lib/access]");
});

test("getSubscription reads from subscriptions scoped to the one user id", async () => {
  const insforge = fakeInsforge({ data: null });
  const makeClient = () => insforge;
  await getSubscription("user-42", makeClient);

  assert.equal(insforge.queries.length, 1);
  assert.equal(insforge.queries[0].table, "subscriptions");
  assert.equal(insforge.queries[0].filters.user_id, "user-42");
});

test("getSubscription selects only the columns it needs, never the whole row", async () => {
  const insforge = fakeInsforge({ data: null });
  const makeClient = () => insforge;
  await getSubscription("user-1", makeClient);

  const columns = insforge.queries[0].columns;
  assert.ok(columns.includes("plan"));
  assert.ok(columns.includes("status"));
  assert.ok(columns.includes("research_runs_used"));
  assert.ok(columns.includes("usage_period_start"));
  assert.ok(columns.includes("stripe_customer_id"));
  assert.ok(columns.includes("stripe_subscription_id"));
  // It must never fetch user_id, created_at, or updated_at because the caller
  // does not need them and fetching extra columns is wasted bandwidth.
  assert.ok(!columns.includes("user_id"));
  assert.ok(!columns.includes("created_at"));
  assert.ok(!columns.includes("updated_at"));
});

test("getSubscription never creates a row: it only ever calls maybeSingle, not insert or upsert", async () => {
  // The only way for a row to appear in subscriptions is through a privileged
  // writer (webhook handler in feature 2, usage increment in feature 3).
  // getSubscription must never create one, or a read side effect would
  // silently promote a free user before checkout completes.
  const source = await readProjectFile("lib/access-rules.ts");
  const body = source.slice(
    source.indexOf("export async function getSubscription"),
  );

  assert.match(body, /maybeSingle/);
  assert.doesNotMatch(body, /\binsert\b/i);
  assert.doesNotMatch(body, /\bupsert\b/i);
  assert.doesNotMatch(body, /\bon conflict\b/i);
});

test("getSubscription returns a discriminated union: { ok: true, subscription } on success, { ok: false } on failure (AC-2, AC-3)", async () => {
  const source = await readProjectFile("lib/access-rules.ts");
  const body = source.slice(
    source.indexOf("export async function getSubscription"),
  );

  // The return type must include both branches of the discriminated union.
  assert.match(body, /\{ ok: true; subscription: Subscription \}/);
  assert.match(body, /\{ ok: false \}/);
  // A missing row is still ok: true with the free default, not a failure.
  assert.match(body, /ok: true, subscription: freeDefault/);
});

test("SERVICE_ROLE_KEY is never prefixed with NEXT_PUBLIC_, so it stays server only (AC-1)", async () => {
  for (const file of ["lib/insforge-service.ts", ".env.example"]) {
    const source = await readProjectFile(file);
    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_SERVICE_ROLE_KEY/,
      `${file} must never expose the service role key to the browser`,
    );
  }
});

test("createInsforgeServiceClient is never a client boundary (AC-1)", async () => {
  const source = await readProjectFile("lib/insforge-service.ts");
  // The file must not start with "use client" or have it as an early directive.
  // It's OK to mention it in a comment (the JSDoc warns against it).
  const firstLines = source.split("\n").slice(0, 5).join("\n");
  assert.doesNotMatch(firstLines, /^\s*"use client"/m);
  // Also, no React or browser import should be here.
  assert.doesNotMatch(source, /from "react"/);
  assert.doesNotMatch(source, /from "next\/navigation"/);
});

test("the subscriptions CHECK constraint migration exists and references research_runs_used (AC-5)", async () => {
  const entries = await readdir(new URL("migrations/", projectRoot));
  const name = entries.find((e) =>
    e.endsWith("_add-subscriptions-check-constraint.sql"),
  );
  assert.ok(name, "the CHECK constraint migration is missing from migrations/");
  const sql = await readProjectFile(`migrations/${name}`);
  assert.match(sql, /ADD CONSTRAINT subscriptions_research_runs_non_negative/);
  assert.match(sql, /CHECK \(research_runs_used >= 0\)/);
});

// ---------------------------------------------------------------------------
// subscriptions migration (billing foundation AC-1, AC-2)
// ---------------------------------------------------------------------------

async function readSubscriptionsMigration() {
  const entries = await readdir(new URL("migrations/", projectRoot));
  const name = entries.find((e) => e.endsWith("_create-subscriptions.sql"));
  assert.ok(name, "the subscriptions migration is missing from migrations/");
  return readProjectFile(`migrations/${name}`);
}

test("the migration creates subscriptions keyed to auth.users with all required columns (AC-1)", async () => {
  const sql = await readSubscriptionsMigration();

  assert.match(sql, /CREATE TABLE subscriptions/);
  assert.match(
    sql,
    /user_id uuid PRIMARY KEY REFERENCES auth\.users \(id\) ON DELETE CASCADE/,
  );
  assert.match(
    sql,
    /plan text NOT NULL DEFAULT 'free' CHECK \(plan IN \('free', 'pro'\)\)/,
  );
  assert.match(sql, /status text NOT NULL DEFAULT 'active'/);
  assert.match(sql, /stripe_customer_id text UNIQUE/);
  assert.match(sql, /stripe_subscription_id text UNIQUE/);
  assert.match(sql, /research_runs_used integer NOT NULL DEFAULT 0/);
  assert.match(sql, /usage_period_start timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(sql, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(sql, /updated_at timestamptz NOT NULL DEFAULT now\(\)/);
});

test("the migration creates the updated_at trigger (AC-1)", async () => {
  const sql = await readSubscriptionsMigration();

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.set_subscriptions_updated_at/,
  );
  assert.match(sql, /CREATE TRIGGER subscriptions_updated_at/);
  assert.match(sql, /BEFORE UPDATE ON subscriptions/);
  assert.match(
    sql,
    /FOR EACH ROW EXECUTE FUNCTION public\.set_subscriptions_updated_at/,
  );
});

test("the migration enables row level security with no policies at all (AC-2)", async () => {
  const sql = await readSubscriptionsMigration();

  assert.match(sql, /ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;/);

  // The spec demands zero policies. Unlike user_access, which grants owner
  // SELECT through a policy, subscriptions grants nothing, because nothing in
  // features 1 through 3 needs a client side read.
  assert.doesNotMatch(
    sql,
    /CREATE POLICY \w+ ON subscriptions/,
    "subscriptions must have no policies; any policy would open a client path",
  );
});

test("the migration revokes all privileges from anon and authenticated, and never grants anything back (AC-2)", async () => {
  const sql = await readSubscriptionsMigration();

  assert.match(sql, /REVOKE ALL ON subscriptions FROM anon, authenticated;/);

  // The revoke is load bearing. InsForge grants broad write privileges on
  // public tables to anon and authenticated by default; this revoke is what
  // removes them. There must be no GRANT that puts any privilege back, or the
  // revoke would be undone and row level security alone would be the only
  // defence against a direct client write.
  assert.doesNotMatch(
    sql,
    /GRANT[^;]*ON subscriptions/,
    "no privilege may be granted on subscriptions; the revoke must be the final word",
  );
});

test("the status check constraint includes paused, so feature 2 can write any Stripe issued status (AC-1)", async () => {
  const sql = await readSubscriptionsMigration();

  // Stripe can issue paused on a subscription, and if the check constraint
  // did not include it, a webhook delivery would fail on the constraint
  // rather than recording the status.
  assert.match(sql, /'paused'/);
  assert.match(sql, /'incomplete'/);
  assert.match(sql, /'incomplete_expired'/);
  assert.match(sql, /'unpaid'/);
});

// The migration is the layer nothing else can compensate for. If a later
// migration re-grants writes on user_access, every test above still passes and
// users can approve themselves. These lock the SQL itself. covers: AC-9
async function readUserAccessMigration() {
  const entries = await readdir(new URL("migrations/", projectRoot));
  const name = entries.find((e) => e.endsWith("_create-user-access.sql"));
  assert.ok(name, "the user_access migration is missing from migrations/");
  return readProjectFile(`migrations/${name}`);
}

test("the migration creates user_access keyed to auth.users with the three status values (AC-9)", async () => {
  const sql = await readUserAccessMigration();

  assert.match(sql, /CREATE TABLE user_access/);
  assert.match(
    sql,
    /user_id uuid PRIMARY KEY REFERENCES auth\.users \(id\) ON DELETE CASCADE/,
  );
  assert.match(sql, /CHECK \(status IN \('pending', 'approved', 'blocked'\)\)/);
  assert.match(sql, /status text NOT NULL DEFAULT 'pending'/);
});

test("the migration enables row level security with exactly one policy, and it only reads (AC-9)", async () => {
  const sql = await readUserAccessMigration();

  assert.match(sql, /ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;/);

  const policies = sql.match(/CREATE POLICY \w+ ON user_access/g) ?? [];
  assert.equal(
    policies.length,
    1,
    `expected exactly one policy, found ${policies.length}`,
  );
  assert.match(
    sql,
    /CREATE POLICY user_access_select ON user_access\s*FOR SELECT TO authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /FOR (INSERT|UPDATE|DELETE|ALL) ON user_access|ON user_access\s*FOR (INSERT|UPDATE|DELETE|ALL)/,
    "a write policy on user_access would make the approval flag self grantable",
  );
});

test("the migration revokes the broad default before granting, and grants only SELECT (AC-9)", async () => {
  const sql = await readUserAccessMigration();

  const revokeIndex = sql.indexOf(
    "REVOKE ALL ON user_access FROM anon, authenticated;",
  );
  const grantIndex = sql.indexOf(
    "GRANT SELECT ON user_access TO authenticated;",
  );

  assert.notEqual(
    revokeIndex,
    -1,
    "InsForge grants broad write privileges on public tables by default, so the revoke is what actually removes them",
  );
  assert.notEqual(
    grantIndex,
    -1,
    "authenticated still needs SELECT to read its own row",
  );
  assert.ok(
    revokeIndex < grantIndex,
    "the revoke must come first, or it would strip the SELECT grant straight back off again",
  );
  assert.doesNotMatch(
    sql,
    /GRANT[^;]*\b(INSERT|UPDATE|DELETE|ALL)\b[^;]*ON user_access/,
    "no write privilege may ever be granted on user_access",
  );
});

test("public pages never touch the gate, so a signed out visitor is unaffected (AC-1)", async () => {
  for (const page of ["app/page.tsx", "app/(auth)/login/page.tsx"]) {
    const source = await readProjectFile(page);

    assert.doesNotMatch(
      source,
      /requireApprovedPage|isUserApproved|guardPaidRoute|user_access/,
      `${page} is public and must not run an approval check`,
    );
  }
});

test("the kill switch and the new table are documented where the next person will look (AC-12)", async () => {
  const envExample = await readProjectFile(".env.example");
  const standards = await readProjectFile("context/code-standards.md");
  const architecture = await readProjectFile("context/architecture.md");
  const types = await readProjectFile("types/index.ts");

  assert.match(envExample, /^ENABLE_AGENT_RUNS=/m);
  assert.doesNotMatch(
    envExample,
    /NEXT_PUBLIC_ENABLE_AGENT_RUNS/,
    "the switch is server only; a NEXT_PUBLIC_ prefix would ship it to the browser",
  );
  assert.match(standards, /\|\s*`ENABLE_AGENT_RUNS`\s*\|/);
  assert.match(architecture, /### `user_access`/);
  assert.match(
    types,
    /export type UserAccessStatus = "pending" \| "approved" \| "blocked";/,
  );
  assert.match(types, /export type UserAccessRow = \{/);
});

test("the old private beta screen no longer exists (AC-7)", async () => {
  // The page was deleted in feature 3. The earlier test already proves
  // the file doesn't exist; this test remains as a named tombstone.
  let exists = true;
  try {
    await readProjectFile("app/private-beta/page.tsx");
  } catch {
    exists = false;
  }
  assert.equal(exists, false);
});

test("a denial never leaks who the caller is (AC-6)", async () => {
  const access = await readProjectFile("lib/access.ts");
  const denialBlock = access.slice(
    access.indexOf("export async function guardPaidRoute"),
  );

  // The denial bodies are built only from DENIAL_MESSAGES constants.
  const denials = denialBlock.match(/denial\([^)]*\)/g) ?? [];
  // guardPaidRoute now has 2 denials: signedOut (401) and agentsPaused (503).
  assert.ok(denials.length >= 2);
  for (const call of denials) {
    assert.match(
      call,
      /^denial\(DENIAL_MESSAGES\.\w+, \d{3}\)$/,
      `denial responses must use a fixed message, found: ${call}`,
    );
  }
});

test("every route that reaches a paid provider is guarded", async () => {
  // The failure this catches: someone adds a fifth route that calls an agent or
  // a resume module and forgets guardPaidRoute. Nothing else in the codebase
  // notices, and it costs real money on the first request.
  const paidModules = /@\/agent\/|resume-extractor|resume-generator/;
  const routes = [];

  async function walk(dir) {
    const entries = await readdir(new URL(`${dir}/`, projectRoot), {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name === "route.ts") {
        routes.push(path);
      }
    }
  }

  await walk("app/api");

  const unguarded = [];
  let guardedCount = 0;

  for (const path of routes) {
    const source = await readProjectFile(path);
    if (!paidModules.test(source)) continue;

    if (source.includes("guardPaidRoute")) {
      guardedCount += 1;
    } else {
      unguarded.push(path);
    }
  }

  assert.deepEqual(
    unguarded,
    [],
    `paid routes missing guardPaidRoute: ${unguarded.join(", ")}`,
  );
  assert.equal(
    guardedCount,
    4,
    "expected exactly the four known paid routes to be guarded",
  );
});

// ---------------------------------------------------------------------------
// AC-4: getSubscription re-exported from lib/access.ts
// ---------------------------------------------------------------------------

test("getSubscription is re-exported from lib/access.ts alongside other access functions (AC-4)", async () => {
  const source = await readProjectFile("lib/access.ts");

  // The import from access-rules must include getSubscription.
  assert.match(
    source,
    /import\s*\{[^}]*\bgetSubscription\b[^}]*\}\s*from\s*"@\/lib\/access-rules"/,
    "lib/access.ts must import getSubscription from access-rules",
  );

  // The re-export line must include getSubscription.
  assert.match(
    source,
    /export\s*\{[^}]*\bgetSubscription\b[^}]*\}/,
    "lib/access.ts must re-export getSubscription",
  );

  // checkAndIncrementUsage must also be exported in the same statement.
  const exportLine = source.match(/export\s*\{[^}]*\}/)[0];
  assert.match(exportLine, /\bagentRunsEnabled\b/);
  assert.match(exportLine, /\bgetSubscription\b/);
  assert.match(exportLine, /\bcheckAndIncrementUsage\b/);
});

// ---------------------------------------------------------------------------
// createInsforgeServiceClient (lib/insforge-service.ts)
// ---------------------------------------------------------------------------

test("createInsforgeServiceClient throws a clear error when SERVICE_ROLE_KEY is not set", async () => {
  const source = await readProjectFile("lib/insforge-service.ts");

  // The throw message must be informative enough to debug a missing env var.
  assert.match(
    source,
    /SERVICE_ROLE_KEY is not set/,
    "the error message must name the missing variable",
  );
  assert.match(
    source,
    /Add it to \.env\.local/,
    "the error message must tell where to set it",
  );
});

test("createInsforgeServiceClient reads SERVICE_ROLE_KEY from process.env, never a hardcoded value", async () => {
  const source = await readProjectFile("lib/insforge-service.ts");

  assert.match(
    source,
    /process\.env\.SERVICE_ROLE_KEY/,
    "the key must come from the environment, never hardcoded",
  );
});

test("createInsforgeServiceClient creates a client with the service role key as the anonKey, using the project base URL", async () => {
  const source = await readProjectFile("lib/insforge-service.ts");

  // The createClient call must pass anonKey (the service role key) and baseUrl.
  // It must never pass cookies or auth headers because the service role does not
  // authenticate as a specific user.
  assert.match(source, /createClient\(\{/);
  assert.match(source, /baseUrl: process\.env\.NEXT_PUBLIC_INSFORGE_URL/);
  assert.match(source, /anonKey: key/);

  // Check only the function body (after the opening brace), not the JSDoc which
  // mentions cookies in its explanation of createInsforgeServer.
  const body = source.slice(source.indexOf("export function"));
  assert.doesNotMatch(
    body,
    /\bcookies:/,
    "the service role client must not attach user cookies",
  );
  assert.doesNotMatch(
    body,
    /\bauth:/,
    "the service role client must not attach auth headers",
  );
});

// ---------------------------------------------------------------------------
// Subscription type (types/index.ts) — verifies the camelCase mapping
// ---------------------------------------------------------------------------

test("Subscription maps every relevant SubscriptionRow column, using camelCase for the JS side", async () => {
  const source = await readProjectFile("types/index.ts");

  // The Subscription type must include these camelCase fields.
  assert.match(source, /\bplan: SubscriptionRow\["plan"\]/);
  assert.match(source, /\bstatus: SubscriptionRow\["status"\]/);
  assert.match(source, /\bresearchRunsUsed: number/);
  assert.match(source, /\busagePeriodStart: string/);
  assert.match(source, /\bstripeCustomerId: string \| null/);
  assert.match(source, /\bstripeSubscriptionId: string \| null/);

  // The type must NOT include user_id, created_at, or updated_at (internal
  // columns the caller never needs).
  const subscriptionBlock = source.slice(
    source.indexOf("export type Subscription = {"),
    source.indexOf("};", source.indexOf("export type Subscription = {")) + 2,
  );
  assert.doesNotMatch(subscriptionBlock, /\buser_id\b/);
  assert.doesNotMatch(subscriptionBlock, /\bcreated_at\b/);
  assert.doesNotMatch(subscriptionBlock, /\bupdated_at\b/);
});
