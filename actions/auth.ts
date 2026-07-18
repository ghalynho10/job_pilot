"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppOrigin } from "@/lib/auth-routing";

type OAuthProvider = "google" | "github";

const OAUTH_VERIFIER_COOKIE = "insforge_code_verifier";

async function startOAuth(provider: OAuthProvider): Promise<never> {
  let oauthUrl: string | undefined;
  let codeVerifier: string | undefined;

  try {
    const cookieStore = await cookies();
    const auth = createAuthActions({ cookies: cookieStore });
    const { data, error } = await auth.signInWithOAuth(provider, {
      redirectTo: new URL(
        "/callback",
        getAppOrigin({
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
          nodeEnv: process.env.NODE_ENV,
        }),
      ).toString(),
      skipBrowserRedirect: true,
    });

    if (error) {
      console.error(`[actions/auth:${provider}]`, error);
    } else {
      oauthUrl = data.url;
      codeVerifier = data.codeVerifier;
    }

    if (oauthUrl && codeVerifier) {
      cookieStore.set(OAUTH_VERIFIER_COOKIE, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
    }
  } catch (error) {
    console.error(`[actions/auth:${provider}]`, error);
  }

  if (!oauthUrl || !codeVerifier) {
    redirect("/login?error=oauth_start");
  }

  redirect(oauthUrl);
}

export async function signInWithGoogle(): Promise<never> {
  return startOAuth("google");
}

export async function signInWithGitHub(): Promise<never> {
  return startOAuth("github");
}

export async function signOut(): Promise<never> {
  let failed = false;

  try {
    const auth = createAuthActions({ cookies: await cookies() });
    const { error } = await auth.signOut();

    if (error) {
      failed = true;
      console.error("[actions/auth:signOut]", error);
    }
  } catch (error) {
    failed = true;
    console.error("[actions/auth:signOut]", error);
  }

  redirect(failed ? "/login?error=sign_out" : "/login");
}
