import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// All user-facing routes live under `/{locale}/...` because next-intl is set
// to `localePrefix: "always"`. Robots patterns must include the `*` wildcard
// so they match every locale (e.g. both `/en/admin/...` and `/ru/admin/...`),
// otherwise Googlebot crawls private pages and marks them as
// "Discovered, currently not indexed" in Search Console.
const PROTECTED_PATHS = [
  // Role areas (auth-gated layouts).
  "admin/",
  "coach/",
  "me/",
  // Auth & onboarding flows.
  "auth/",
  "login",
  "onboarding/",
  "invite/",
  // Single auth-gated public actions / token landings.
  "open-matches/new",
  "clubs/join/",
  // Internal developer reference page.
  "help-demo",
  // Player directory — auth-gated (redirects unauth users to /login).
  "players",
];

export default function robots(): MetadataRoute.Robots {
  // Every protected path is emitted twice:
  //   /{locale}/path  → catches the real production URL Googlebot follows
  //   /path           → catches any legacy or non-prefixed crawl attempt
  const disallow = [
    "/api/",
    ...PROTECTED_PATHS.flatMap((p) => [`/*/${p}`, `/${p}`]),
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
