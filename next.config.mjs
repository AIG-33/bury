import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Client router cache: revisiting a recently opened screen (e.g. switching
    // between /m tabs) renders instantly from cache instead of re-fetching.
    staleTimes: {
      dynamic: 30,
      static: 60,
    },
  },
  // Apex → www so sitemap, canonical and Search Console stay on one host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "playtennis.by" }],
        destination: "https://www.playtennis.by/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
