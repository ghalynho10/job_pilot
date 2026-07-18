import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogHost) {
      return [];
    }

    const assetsHost = posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com");

    return [
      {
        source: "/ingest/static/:path*",
        destination: `${assetsHost}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${assetsHost}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
