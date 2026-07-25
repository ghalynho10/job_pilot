import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The resumes Server Action path validates PDFs up to 5MB itself
      // (actions/profile.ts, MAX_RESUME_SIZE_BYTES). Next's own default
      // Server Action body limit is 1MB, well under that, so a legitimate
      // 1 to 5MB resume was rejected by the framework before that check
      // ever ran. Raised with headroom above the app's own 5MB ceiling.
      bodySizeLimit: "6mb",
    },
  },
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
