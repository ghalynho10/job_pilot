type AppOriginOptions = {
  appUrl?: string;
  nodeEnv?: string;
  requestOrigin?: string;
};

export function getAppOrigin({
  appUrl,
  nodeEnv,
  requestOrigin,
}: AppOriginOptions): string {
  if (nodeEnv !== "production" && requestOrigin?.trim()) {
    const url = new URL(requestOrigin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("requestOrigin must use http or https");
    }

    return url.origin;
  }

  const configuredUrl = appUrl?.trim();

  if (configuredUrl) {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_APP_URL must use http or https");
    }

    return url.origin;
  }

  if (nodeEnv !== "production") {
    return "http://localhost:3000";
  }

  throw new Error("NEXT_PUBLIC_APP_URL is required in production");
}

export function createLoginUrl(
  appOrigin: string,
  showSessionError: boolean,
): URL {
  const loginUrl = new URL("/login", appOrigin);

  if (showSessionError) {
    loginUrl.searchParams.set("error", "session");
  }

  return loginUrl;
}

export function getRequestOriginFromHeaders(headersList: Headers): string | undefined {
  const origin = headersList.get("origin");

  if (origin) {
    return origin;
  }

  const host = headersList.get("host");

  if (!host) {
    return undefined;
  }

  const forwardedProto = headersList.get("x-forwarded-proto");
  const protocol =
    forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}
