import { NextRequest, NextResponse } from "next/server";
import { createAuthActions, type CookieWriter } from "@insforge/sdk/ssr";

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("insforge_code");
  const verifier = request.cookies.get("pkce_verifier")?.value;

  if (!code || !verifier) {
    console.error("[callback] Missing code or pkce_verifier");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const redirectResponse = NextResponse.redirect(
    new URL("/dashboard", request.url),
  );

  try {
    const actions = createAuthActions({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      requestCookies: {
        get: (name: string) => request.cookies.get(name)?.value,
      },
      responseCookies: {
        set: (name: string, value: string, options?: object) =>
          redirectResponse.cookies.set(
            name,
            value,
            (options ?? {}) as Parameters<typeof redirectResponse.cookies.set>[2],
          ),
        delete: (name: string) => redirectResponse.cookies.delete(name),
      } as CookieWriter,
    });

    const { error } = await actions.exchangeOAuthCode(code, verifier);

    if (error) {
      console.error("[callback] Exchange failed:", error.message);
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch (err) {
    console.error("[callback]", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  redirectResponse.cookies.delete("pkce_verifier");
  return redirectResponse;
}
