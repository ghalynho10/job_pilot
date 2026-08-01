import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { agentRunsEnabled, isUserApproved } from "../lib/access-rules.ts";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

// A stand in for the InsForge client that records what was asked for, so the
// tests can prove isUserApproved reads user_access scoped to one user id and
// nothing else.
function fakeInsforge({ data = null, error = null, throwOnQuery = false } = {}) {
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

// console.error is part of the contract here: a real query failure must be
// logged, and a missing row must not be, because a missing row is the ordinary
// state of every new signup rather than a fault worth paging anyone about.
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

test("an approved row is the only thing that opens the app", async () => {
  const insforge = fakeInsforge({ data: { status: "approved" } });

  assert.equal(await isUserApproved(insforge, "user-1"), true);
});

test("a pending row denies", async () => {
  const insforge = fakeInsforge({ data: { status: "pending" } });

  assert.equal(await isUserApproved(insforge, "user-1"), false);
});

test("a blocked row denies", async () => {
  const insforge = fakeInsforge({ data: { status: "blocked" } });

  assert.equal(await isUserApproved(insforge, "user-1"), false);
});

test("a missing row denies quietly, because that is every new signup", async () => {
  const insforge = fakeInsforge({ data: null });
  const { result, logged } = await captureErrors(() => isUserApproved(insforge, "user-1"));

  assert.equal(result, false);
  assert.deepEqual(logged, [], "a missing row is not an error and must not be logged");
});

test("a query error denies and is logged rather than thrown, so a failure never opens the gate", async () => {
  const insforge = fakeInsforge({ error: { message: "permission denied" } });
  const { result, logged } = await captureErrors(() => isUserApproved(insforge, "user-1"));

  assert.equal(result, false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "[lib/access]");
});

test("a thrown query denies and is logged rather than escaping to the caller", async () => {
  const insforge = fakeInsforge({ throwOnQuery: true });
  const { result, logged } = await captureErrors(() => isUserApproved(insforge, "user-1"));

  assert.equal(result, false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "[lib/access]");
});

test("approval is read from user_access, scoped to the one user id", async () => {
  const insforge = fakeInsforge({ data: { status: "approved" } });
  await isUserApproved(insforge, "user-42");

  assert.equal(insforge.queries.length, 1);
  assert.equal(insforge.queries[0].table, "user_access");
  assert.equal(insforge.queries[0].filters.user_id, "user-42");
});

test("isUserApproved is the only place in the app that reads user_access", async () => {
  const searchRoots = ["app", "lib", "components", "actions", "agent"];
  const offenders = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(new URL(`${dir}/`, projectRoot), { withFileTypes: true });
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
      if (path === "lib/access-rules.ts") continue;

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
    `user_access must only be read through isUserApproved, found in: ${offenders.join(", ")}`,
  );
});

test("the guard returns the documented status code for each way of being turned away", async () => {
  const source = await readProjectFile("lib/access.ts");

  assert.match(
    source,
    /if \(error \|\| !data\.user\) \{\s*return \{ ok: false, response: denial\(DENIAL_MESSAGES\.signedOut, 401\) \};/,
    "no session must be 401",
  );
  assert.match(
    source,
    /if \(!\(await isUserApproved\(insforge, userId\)\)\) \{\s*return \{ ok: false, response: denial\(DENIAL_MESSAGES\.notApproved, 403\) \};/,
    "signed in but not approved must be 403",
  );
  assert.match(
    source,
    /if \(requireAgentSwitch && !agentRunsEnabled\(process\.env\.ENABLE_AGENT_RUNS\)\) \{\s*return \{ ok: false, response: denial\(DENIAL_MESSAGES\.agentsPaused, 503\) \};/,
    "the kill switch must be 503 and must only apply when requireAgentSwitch is set",
  );
});

test("approval is checked before the kill switch, so an unapproved caller is never told the agents are merely paused", async () => {
  const source = await readProjectFile("lib/access.ts");

  const approvalIndex = source.indexOf("isUserApproved(insforge, userId)");
  const switchIndex = source.indexOf("requireAgentSwitch && !agentRunsEnabled");

  assert.ok(approvalIndex !== -1 && switchIndex !== -1);
  assert.ok(approvalIndex < switchIndex);
});

test("denial messages give away nothing about why access was refused", async () => {
  const source = await readProjectFile("lib/access-rules.ts");

  assert.match(source, /notApproved: "JobPilot is in private beta\. Your account is not approved yet\."/);
  // One message for missing, pending, and blocked alike. Anything that named
  // the status would leak the owner's decision about a specific account.
  assert.ok(!/pending|blocked/.test(source.slice(source.indexOf("DENIAL_MESSAGES"), source.indexOf("} as const"))));
});

test("the page gate redirects to the private beta screen and is never wrapped in a try block", async () => {
  const source = await readProjectFile("lib/access.ts");

  const fnIndex = source.indexOf("export async function requireApprovedPage");
  const body = source.slice(fnIndex);

  assert.match(body, /redirect\("\/private-beta"\)/);
  assert.ok(
    !body.includes("try {"),
    "redirect works by throwing, so a try block here would swallow it and render the page anyway",
  );
});

test("the private beta screen sends an approved user away, so the two redirects cannot loop", async () => {
  const source = await readProjectFile("app/private-beta/page.tsx");

  assert.match(source, /if \(await isUserApproved\(insforge, data\.user\.id\)\) \{\s*redirect\("\/dashboard"\);/);
  assert.match(source, /redirect\("\/login\?error=session"\)/);
  assert.doesNotMatch(
    source,
    /await requireApprovedPage\(/,
    "the private beta screen must do the opposite check, or it would redirect into itself",
  );
  assert.ok(
    !/from "@\/components\/layout\/Navbar"/.test(source),
    "the shared Navbar always renders the app links, so this screen must not use it",
  );
});

test("the private beta screen is behind the session proxy", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /"\/private-beta"/);
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
  assert.match(sql, /user_id uuid PRIMARY KEY REFERENCES auth\.users \(id\) ON DELETE CASCADE/);
  assert.match(sql, /CHECK \(status IN \('pending', 'approved', 'blocked'\)\)/);
  assert.match(sql, /status text NOT NULL DEFAULT 'pending'/);
});

test("the migration enables row level security with exactly one policy, and it only reads (AC-9)", async () => {
  const sql = await readUserAccessMigration();

  assert.match(sql, /ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;/);

  const policies = sql.match(/CREATE POLICY \w+ ON user_access/g) ?? [];
  assert.equal(policies.length, 1, `expected exactly one policy, found ${policies.length}`);
  assert.match(sql, /CREATE POLICY user_access_select ON user_access\s*FOR SELECT TO authenticated/);
  assert.doesNotMatch(
    sql,
    /FOR (INSERT|UPDATE|DELETE|ALL) ON user_access|ON user_access\s*FOR (INSERT|UPDATE|DELETE|ALL)/,
    "a write policy on user_access would make the approval flag self grantable",
  );
});

test("the migration revokes the broad default before granting, and grants only SELECT (AC-9)", async () => {
  const sql = await readUserAccessMigration();

  const revokeIndex = sql.indexOf("REVOKE ALL ON user_access FROM anon, authenticated;");
  const grantIndex = sql.indexOf("GRANT SELECT ON user_access TO authenticated;");

  assert.notEqual(
    revokeIndex,
    -1,
    "InsForge grants broad write privileges on public tables by default, so the revoke is what actually removes them",
  );
  assert.notEqual(grantIndex, -1, "authenticated still needs SELECT to read its own row");
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
  assert.match(types, /export type UserAccessStatus = "pending" \| "approved" \| "blocked";/);
  assert.match(types, /export type UserAccessRow = \{/);
});

test("the private beta screen names the account and offers the shared sign out (AC-4)", async () => {
  const source = await readProjectFile("app/private-beta/page.tsx");

  assert.match(source, /\{data\.user\.email\}/, "the visitor must be able to see which account they are on");
  assert.match(source, /import \{ signOut \} from "@\/actions\/auth"/);
  assert.match(source, /<form action=\{signOut\}/, "sign out must be a real action, not a dead button");
  assert.match(source, /title: "Private beta \| JobPilot"/);
});

test("a denial never leaks who the caller is (AC-6)", async () => {
  const access = await readProjectFile("lib/access.ts");
  const denialBlock = access.slice(access.indexOf("export async function guardPaidRoute"));

  // The denial bodies are built only from the fixed DENIAL_MESSAGES constants.
  // Interpolating a user id, an email, or a status into them would turn the
  // gate into an account enumeration tool.
  const denials = denialBlock.match(/denial\([^)]*\)/g) ?? [];
  assert.ok(denials.length >= 3);
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
    const entries = await readdir(new URL(`${dir}/`, projectRoot), { withFileTypes: true });

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

  assert.deepEqual(unguarded, [], `paid routes missing guardPaidRoute: ${unguarded.join(", ")}`);
  assert.equal(guardedCount, 4, "expected exactly the four known paid routes to be guarded");
});
