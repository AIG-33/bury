"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourtSurface, CourtStatus, VenueIndoorStatus } from "@/lib/venues/schema";
import type { OpenMatchFeedRow } from "@/lib/open-matches/schema";

// =============================================================================
// Loaders for the public venue detail page (`/venues/[id]`).
//
// We split this out of the page component for two reasons:
//   1. The detail page lives alongside the catalog at /venues/, but the catalog
//      already does its own queries inline. Keeping detail loaders here makes
//      it obvious what data the new tabs depend on.
//   2. Server actions can be called from client components (later, e.g. from
//      a "refresh" button on the open-matches tab once D ships).
// =============================================================================

export type VenueDetail = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  indoor_status: VenueIndoorStatus;
  amenities: string[];
  created_by: string | null;
  website: string | null;
  phone: string | null;
  photos: string[];
  courts: Array<{
    id: string;
    number: number;
    name: string | null;
    surface: CourtSurface | null;
    status: CourtStatus;
    is_indoor: boolean;
  }>;
  tournaments: Array<{
    id: string;
    name: string;
    starts_on: string;
    ends_on: string | null;
    format: string;
    surface: CourtSurface | null;
    status: string;
  }>;
  open_matches: OpenMatchFeedRow[];
};

export async function loadVenueDetail(venueId: string): Promise<VenueDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: venue } = (await supabase
    .from("venues")
    .select(
      "id, name, city, country, address, lat, lng, indoor_status, amenities, " +
        "created_by, website, phone, photos",
    )
    .eq("id", venueId)
    .maybeSingle()) as {
    data: {
      id: string;
      name: string;
      city: string | null;
      country: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
      indoor_status: VenueIndoorStatus;
      amenities: string[];
      created_by: string | null;
      website: string | null;
      phone: string | null;
      photos: string[];
    } | null;
  };

  if (!venue) return null;

  const [courts, tournaments, openMatches] = await Promise.all([
    (async () => {
      const { data } = (await supabase
        .from("courts")
        .select("id, number, name, surface, status, is_indoor")
        .eq("venue_id", venueId)
        .order("number", { ascending: true })) as {
        data: VenueDetail["courts"] | null;
      };
      return data ?? [];
    })(),
    (async () => {
      // Tournaments hosted at this venue. RLS on `tournaments` already filters
      // to public + visible-to-user, so we don't need an explicit `privacy`
      // clause here — but we DO order by `starts_on` desc to put the most
      // recent / upcoming on top.
      const { data: links } = (await supabase
        .from("tournament_venues")
        .select(
          "tournament_id, tournaments!inner(id, name, starts_on, ends_on, format, surface, status, privacy)",
        )
        .eq("venue_id", venueId)) as {
        data: Array<{
          tournament_id: string;
          tournaments: {
            id: string;
            name: string;
            starts_on: string;
            ends_on: string | null;
            format: string;
            surface: CourtSurface | null;
            status: string;
            privacy: string;
          };
        }> | null;
      };
      const all = (links ?? [])
        .map((l) => l.tournaments)
        // Show only public-privacy entries on the public detail page; private
        // tournaments are filtered by RLS for anonymous users but a logged-in
        // owner can still see their own. We deliberately keep public-only here
        // to avoid leaking a club tournament to its own owner via this tab.
        .filter((t) => t.privacy === "public");
      all.sort((a, b) => (a.starts_on > b.starts_on ? -1 : 1));
      return all.map((t) => ({
        id: t.id,
        name: t.name,
        starts_on: t.starts_on,
        ends_on: t.ends_on,
        format: t.format,
        surface: t.surface,
        status: t.status,
      }));
    })(),
    (async (): Promise<OpenMatchFeedRow[]> => {
      const nowMinus1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = (await supabase
        .from("open_matches_feed")
        .select(
          "id, creator_id, creator_name, creator_avatar, creator_elo, creator_elo_status, " +
            "venue_id, venue_name, venue_city, venue_is_indoor, venue_indoor_status, " +
            "district_id, district_name, country, " +
            "starts_at, duration_min, format, level_band, slots_needed, notes, status, created_at, " +
            "pending_applications_count, accepted_applications_count",
        )
        .eq("venue_id", venueId)
        .eq("status", "open")
        .gte("starts_at", nowMinus1h)
        .order("starts_at", { ascending: true })
        .limit(20)) as { data: OpenMatchFeedRow[] | null };
      return data ?? [];
    })(),
  ]);

  return {
    ...venue,
    courts,
    tournaments,
    open_matches: openMatches,
  };
}
