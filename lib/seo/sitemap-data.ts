import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { LOCALES, SITE_URL } from "./site";

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

const STATIC_PUBLIC_PATHS: Array<{
  path: string;
  priority: number;
  changeFrequency: SitemapEntry["changeFrequency"];
}> = [
  { path: "", priority: 1.0, changeFrequency: "daily" },
  { path: "/open-matches", priority: 0.95, changeFrequency: "hourly" },
  { path: "/tournaments", priority: 0.95, changeFrequency: "daily" },
  { path: "/coaches", priority: 0.9, changeFrequency: "weekly" },
  { path: "/coaches/map", priority: 0.75, changeFrequency: "weekly" },
  { path: "/venues", priority: 0.9, changeFrequency: "weekly" },
  { path: "/clubs", priority: 0.85, changeFrequency: "weekly" },
  { path: "/matches", priority: 0.8, changeFrequency: "daily" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/guide", priority: 0.55, changeFrequency: "monthly" },
  { path: "/support", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

function localeUrl(locale: string, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

/**
 * Loads all indexable public URLs for sitemap.xml.
 * Uses the anon Supabase client — only rows visible to anonymous users are included.
 */
export async function loadSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const now = new Date();

  for (const locale of LOCALES) {
    for (const item of STATIC_PUBLIC_PATHS) {
      entries.push({
        url: localeUrl(locale, item.path),
        lastModified: now,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
      });
    }
  }

  try {
    const supabase = createSupabaseAnonClient();

    const [tournamentsRes, venuesRes, clubsRes, coachesRes, openMatchesRes] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id, updated_at")
        .eq("privacy", "public")
        .in("status", ["registration", "in_progress", "finished"])
        .limit(2000),
      supabase.from("venues").select("id, updated_at").eq("country", "BY").limit(500),
      supabase.from("clubs").select("slug, updated_at").limit(500),
      supabase.from("public_coach_directory").select("id").limit(500),
      supabase
        .from("open_matches")
        .select("id, updated_at")
        .in("status", ["open", "filled"])
        .limit(500),
    ]);

    const pushPaths = (
      paths: string[],
      priority: number,
      changeFrequency: SitemapEntry["changeFrequency"],
      lastModified = now,
    ) => {
      for (const path of paths) {
        for (const locale of LOCALES) {
          entries.push({ url: localeUrl(locale, path), lastModified, changeFrequency, priority });
        }
      }
    };

    type IdRow = { id: string };
    type SlugRow = { slug: string };

    const tournamentPaths = ((tournamentsRes.data ?? []) as IdRow[]).map(
      (r) => `/tournaments/${r.id}`,
    );
    const venuePaths = ((venuesRes.data ?? []) as IdRow[]).map((r) => `/venues/${r.id}`);
    const clubRows = (clubsRes.data ?? []) as SlugRow[];
    const clubPaths = clubRows.map((r) => `/clubs/${r.slug}`);
    const clubRatingPaths = clubRows.map((r) => `/clubs/${r.slug}/rating`);
    const coachPaths = ((coachesRes.data ?? []) as IdRow[]).map((r) => `/coaches/${r.id}`);
    const openMatchPaths = ((openMatchesRes.data ?? []) as IdRow[]).map(
      (r) => `/open-matches/${r.id}`,
    );

    pushPaths(tournamentPaths, 0.75, "weekly");
    pushPaths(venuePaths, 0.7, "monthly");
    pushPaths(clubPaths, 0.7, "weekly");
    pushPaths(clubRatingPaths, 0.6, "weekly");
    pushPaths(coachPaths, 0.65, "weekly");
    pushPaths(openMatchPaths, 0.7, "daily");
  } catch {
    // Sitemap still returns static routes if Supabase is unavailable at build time.
  }

  return entries;
}
