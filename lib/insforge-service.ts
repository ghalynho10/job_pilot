import type { InsForgeClient } from "@insforge/sdk";
import { createClient } from "@insforge/sdk";

/**
 * Create an InsForge client that runs as the service_role, bypassing all row
 * level security. Use only from server side code that the browser cannot reach:
 * never import this in a client component, a server action, or any file with
 * "use client".
 *
 * The service role key is powerful. It is never prefixed with NEXT_PUBLIC_,
 * so it stays on the server. A NEXT_PUBLIC_ prefix would ship it to the
 * browser and must be caught in review.
 *
 * The existing createInsforgeServer() wraps createServerClient from ssr with
 * the current request's cookies and runs as the authenticated role. This
 * factory wraps createClient directly, with no cookies, and runs as the
 * service_role. The two serve different privilege levels.
 */
export function createInsforgeServiceClient(): InsForgeClient {
  const key = process.env.SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SERVICE_ROLE_KEY is not set. Add it to .env.local from the InsForge dashboard (Project Settings → API).",
    );
  }

  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: key,
  });
}
