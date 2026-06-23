import { NextRequest, NextResponse } from "next/server";
import { updateSession, type CookieStore } from "@insforge/sdk/ssr/middleware";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/find-jobs"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const { accessToken } = await updateSession({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    requestCookies: {
      get: (name: string) => request.cookies.get(name)?.value,
    } as CookieStore,
    responseCookies: {
      get: (name: string) => response.cookies.get(name)?.value,
      set: (name: string, value: string, options?: object) =>
        response.cookies.set(name, value, (options ?? {}) as Parameters<typeof response.cookies.set>[2]),
      delete: (name: string) => response.cookies.delete(name),
    } as CookieStore,
  });

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!accessToken && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
