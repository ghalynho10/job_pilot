import { createAuthActions } from "@insforge/sdk/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAppOrigin } from "@/lib/auth-routing";

const OAUTH_VERIFIER_COOKIE = "insforge_code_verifier";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const appOrigin = getAppOrigin({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!code || !verifier) {
    const errorResponse = NextResponse.redirect(
      new URL("/login?error=oauth", appOrigin),
    );
    errorResponse.cookies.delete(OAUTH_VERIFIER_COOKIE);
    return errorResponse;
  }

  const response = NextResponse.redirect(new URL("/dashboard", appOrigin));
  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  try {
    const { error } = await auth.exchangeOAuthCode(code, verifier);

    if (error) {
      console.error("[auth/callback]", error);
      const errorResponse = NextResponse.redirect(
        new URL("/login?error=oauth", appOrigin),
      );
      errorResponse.cookies.delete(OAUTH_VERIFIER_COOKIE);
      return errorResponse;
    }
  } catch (error) {
    console.error("[auth/callback]", error);
    const errorResponse = NextResponse.redirect(
      new URL("/login?error=oauth", appOrigin),
    );
    errorResponse.cookies.delete(OAUTH_VERIFIER_COOKIE);
    return errorResponse;
  }

  response.cookies.delete(OAUTH_VERIFIER_COOKIE);
  return response;
}
