"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAppOrigin,
  getRequestOriginFromHeaders,
} from "@/lib/auth-routing";
import type { ActionResult } from "@/types";

type OAuthProvider = "google" | "github";

/* ------------------------------------------------------------------ */
/*  Dev-only password auth — gated so production never ships these.   */
/*  Exists so CI and /check verify can sign in without a browser and   */
/*  without OAuth.                                                     */
/* ------------------------------------------------------------------ */

export async function signUp(
  email: string,
  password: string,
): Promise<ActionResult<{ userId: string }>> {
  if (process.env.NODE_ENV === "production") {
    return {
      success: false,
      error: "Password auth is disabled in production.",
    };
  }

  try {
    const auth = createAuthActions({ cookies: await cookies() });
    const { data, error } = await auth.signUp({ email, password });

    if (error) {
      console.error("[actions/auth:signUp]", error);
      return { success: false, error: error.message };
    }

    if (!data?.user) {
      return { success: false, error: "Sign-up did not return a user." };
    }

    return { success: true, userId: data.user.id };
  } catch (error) {
    console.error("[actions/auth:signUp]", error);
    return { success: false, error: "Sign-up failed." };
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ActionResult<{ userId: string }>> {
  if (process.env.NODE_ENV === "production") {
    return {
      success: false,
      error: "Password auth is disabled in production.",
    };
  }

  try {
    const auth = createAuthActions({ cookies: await cookies() });
    const { data, error } = await auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[actions/auth:signInWithPassword]", error);
      return { success: false, error: error.message };
    }

    if (!data?.user) {
      return { success: false, error: "Sign-in did not return a user." };
    }

    return { success: true, userId: data.user.id };
  } catch (error) {
    console.error("[actions/auth:signInWithPassword]", error);
    return { success: false, error: "Sign-in failed." };
  }
}

/* ------------------------------------------------------------------ */
/*  Production OAuth — the only auth path available in production.    */
/* ------------------------------------------------------------------ */

const OAUTH_VERIFIER_COOKIE = "insforge_code_verifier";

async function startOAuth(provider: OAuthProvider): Promise<never> {
  let oauthUrl: string | undefined;
  let codeVerifier: string | undefined;

  try {
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const auth = createAuthActions({ cookies: cookieStore });
    const { data, error } = await auth.signInWithOAuth(provider, {
      redirectTo: new URL(
        "/callback",
        getAppOrigin({
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
          nodeEnv: process.env.NODE_ENV,
          requestOrigin: getRequestOriginFromHeaders(requestHeaders),
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
