import type { InsForgeClient } from "@insforge/sdk";
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

export async function createInsforgeServer(): Promise<InsForgeClient> {
  return createServerClient({ cookies: await cookies() });
}
