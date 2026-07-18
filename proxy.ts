import {
  DEFAULT_ACCESS_TOKEN_COOKIE,
  DEFAULT_REFRESH_TOKEN_COOKIE,
  updateSession,
} from "@insforge/sdk/ssr/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createLoginUrl, getAppOrigin } from "@/lib/auth-routing";

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse,
): void {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie);
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const hadSession = Boolean(
    request.cookies.get(DEFAULT_ACCESS_TOKEN_COOKIE) ||
      request.cookies.get(DEFAULT_REFRESH_TOKEN_COOKIE),
  );

  try {
    const { accessToken, error } = await updateSession({
      requestCookies: {
        get: (name: string) => request.cookies.get(name),
      },
      responseCookies: response.cookies,
    });

    if (error || !accessToken) {
      const redirectResponse = NextResponse.redirect(
        createLoginUrl(
          getAppOrigin({
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
            nodeEnv: process.env.NODE_ENV,
          }),
          hadSession || Boolean(error),
        ),
      );
      copyResponseCookies(response, redirectResponse);
      return redirectResponse;
    }
  } catch (error) {
    console.error("[proxy/auth]", error);
    return NextResponse.redirect(
      createLoginUrl(
        getAppOrigin({
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
          nodeEnv: process.env.NODE_ENV,
        }),
        true,
      ),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/find-jobs/:path*",
  ],
};
