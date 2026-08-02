/**
 * Test authentication helpers.
 *
 * These functions exist ONLY for automated verification scripts and CI.
 * They are never imported by application code (pages, components, actions).
 */

import { createAdminClient } from "@insforge/sdk";
import type { InsForgeClient } from "@insforge/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let cachedAdmin: InsForgeClient | null = null;

function findInsforgeApiKey(): string {
  // Check env first
  if (process.env.INSFORGE_API_KEY) {
    return process.env.INSFORGE_API_KEY;
  }

  // Fall back to .insforge/project.json (local dev only)
  try {
    const projectJson = readFileSync(
      resolve(process.cwd(), ".insforge/project.json"),
      "utf8",
    );
    const parsed = JSON.parse(projectJson);
    if (parsed.api_key) {
      return parsed.api_key;
    }
  } catch {
    // not found or unreadable
  }

  throw new Error(
    "Cannot find InsForge API key. Set INSFORGE_API_KEY env var or ensure " +
      ".insforge/project.json exists with an api_key field.",
  );
}

/**
 * Returns a cached admin client. Uses the API key from
 * INSFORGE_API_KEY env var or .insforge/project.json.
 */
export function getTestAdmin(): InsForgeClient {
  if (!cachedAdmin) {
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_INSFORGE_URL is not set.");
    }

    cachedAdmin = createAdminClient({
      baseUrl,
      apiKey: findInsforgeApiKey(),
    });
  }

  return cachedAdmin;
}

/**
 * A user UUID that must exist in auth.users (the FK on profiles.id
 * references it). We reuse one of the project's real OAuth users.
 * The verification script backs up and restores this user's data.
 */
export const TEST_USER_ID = "0c15dc08-4ac4-41f0-9dfa-39269b05f06e";
export const TEST_USER_EMAIL = "dopejoe4@gmail.com";
