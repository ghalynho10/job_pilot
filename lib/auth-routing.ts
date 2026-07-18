type AppOriginOptions = {
  appUrl?: string;
  nodeEnv?: string;
};

export function getAppOrigin({
  appUrl,
  nodeEnv,
}: AppOriginOptions): string {
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
