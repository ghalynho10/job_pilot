import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const sourceDirs = ["app", "components", "lib"];

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

async function collectSourceFiles(dir) {
  const dirUrl = new URL(`${dir}/`, projectRoot);
  const entries = await readdir(dirUrl);
  const files = [];

  for (const entry of entries) {
    const entryPath = `${dir}/${entry}`;
    const entryUrl = new URL(entryPath, projectRoot);
    const entryStat = await stat(entryUrl);

    if (entryStat.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(entryPath);
    }
  }

  return files;
}

test("mounts PostHog through the root client provider", async () => {
  const layout = await readProjectFile("app/layout.tsx");
  const provider = await readProjectFile("app/PostHogProvider.tsx");

  assert.match(layout, /<PostHogProvider>\{children\}<\/PostHogProvider>/);
  assert.match(provider, /"use client"/);
  assert.match(provider, /initPostHog\(\)/);
});

test("uses the documented PostHog environment variables", async () => {
  const client = await readProjectFile("lib/posthog-client.ts");
  const server = await readProjectFile("lib/posthog-server.ts");

  assert.match(client, /NEXT_PUBLIC_POSTHOG_KEY/);
  assert.match(client, /NEXT_PUBLIC_POSTHOG_HOST/);
  assert.match(server, /NEXT_PUBLIC_POSTHOG_KEY/);
  assert.match(server, /NEXT_PUBLIC_POSTHOG_HOST/);
  assert.doesNotMatch(server, /POSTHOG_PROJECT_TOKEN/);
});

test("does not capture analytics events outside the approved product event list", async () => {
  const allowedEvents = new Set([
    "job_search_started",
    "job_found",
    "profile_completed",
    "company_researched",
  ]);
  const files = (await Promise.all(sourceDirs.map(collectSourceFiles))).flat();

  for (const file of files) {
    const source = await readProjectFile(file);
    const captures = source.matchAll(/capture\(\s*["']([^"']+)["']/g);

    for (const capture of captures) {
      assert.ok(
        allowedEvents.has(capture[1]),
        `${file} captures unapproved event "${capture[1]}"`,
      );
    }
  }
});

test("the auth callback route no longer wires PostHog identify or capture", async () => {
  const route = await readProjectFile("app/(auth)/callback/route.ts");

  assert.doesNotMatch(route, /posthog-server/);
  assert.doesNotMatch(route, /posthog\.identify/);
  assert.doesNotMatch(route, /posthog\.capture/);
  assert.doesNotMatch(route, /posthog\.shutdown/);
});

test("OAuthButton and DashboardActions no longer import posthog-js", async () => {
  const oauthButton = await readProjectFile("components/auth/OAuthButton.tsx");
  const dashboardActions = await readProjectFile(
    "components/dashboard/DashboardActions.tsx",
  );

  assert.doesNotMatch(oauthButton, /from ["']posthog-js["']/);
  assert.doesNotMatch(dashboardActions, /from ["']posthog-js["']/);
});

test("Navbar still resets PostHog identity on sign out", async () => {
  const navbar = await readProjectFile("components/layout/Navbar.tsx");

  assert.match(navbar, /from ["']posthog-js["']/);
  assert.match(navbar, /posthog\.reset\(\)/);
  assert.doesNotMatch(navbar, /posthog\.capture/);
});

test("the server PostHog client is named createPostHogServer, not the old createPostHogClient name", async () => {
  const server = await readProjectFile("lib/posthog-server.ts");

  assert.match(server, /export function createPostHogServer\(/);
  assert.doesNotMatch(server, /createPostHogClient/);
});
