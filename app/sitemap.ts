import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const LOCALES = ["pl", "en", "ru"] as const;

const PUBLIC_PATHS = [
  "",
  "/coaches",
  "/coaches/map",
  "/tournaments",
  "/tournaments?status=upcoming",
  "/tournaments?status=in_progress",
  "/tournaments?status=finished",
  "/help",
  "/login",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    for (const path of PUBLIC_PATHS) {
      entries.push({
        url: `${SITE}/${locale}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: path === "" ? 1.0 : 0.6,
      });
    }
  }
  return entries;
}
