"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  computeReviewEligibility,
  type ExistingReviewRow,
  type InteractionRow,
  type ReviewEligibility,
} from "@/lib/reviews/eligibility";

// =============================================================================
// Public coach catalogue.
// =============================================================================

export type CoachListItem = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  coach_bio: string | null;
  coach_hourly_rate_pln: number | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
};

export type CoachMapPin = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
  coach_hourly_rate_pln: number | null;
  lat: number;
  lng: number;
};

export async function loadCoachMapPins(): Promise<CoachMapPin[]> {
  const supabase = await createSupabaseServerClient();
  // Public view bypasses RLS on `profiles` and exposes only safe coach
  // fields. See migration 20260422000400_public_profile_views.sql.
  const { data } = (await supabase
    .from("public_coach_directory")
    .select(
      "id, display_name, avatar_url, city, coach_avg_rating, " +
        "coach_reviews_count, coach_hourly_rate_pln, coach_lat, coach_lng",
    )
    .eq("coach_show_on_map", true)
    .not("coach_lat", "is", null)
    .not("coach_lng", "is", null)
    .limit(500)) as {
    data: Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      city: string | null;
      coach_avg_rating: number | null;
      coach_reviews_count: number;
      coach_hourly_rate_pln: number | null;
      coach_lat: number;
      coach_lng: number;
    }> | null;
  };
  return (data ?? []).map((c) => ({
    id: c.id,
    display_name: c.display_name,
    avatar_url: c.avatar_url,
    city: c.city,
    coach_avg_rating: c.coach_avg_rating,
    coach_reviews_count: c.coach_reviews_count,
    coach_hourly_rate_pln: c.coach_hourly_rate_pln,
    lat: Number(c.coach_lat),
    lng: Number(c.coach_lng),
  }));
}

export type CoachFilter = {
  /** Restrict to coaches who currently have at least one open slot at this venue. */
  venueId?: string | null;
  /** Restrict to coaches whose `profiles.district_id` matches OR who have slots in the district. */
  districtId?: string | null;
};

export async function loadCoaches(
  filter: CoachFilter = {},
): Promise<CoachListItem[]> {
  const supabase = await createSupabaseServerClient();

  // If venue/district filter is set, first resolve the set of coach ids that
  // have open upcoming slots matching the filter. Two-step query keeps the
  // Supabase join syntax simple and works without RLS gymnastics.
  let restrictToIds: string[] | null = null;
  if (filter.venueId || filter.districtId) {
    let courtIdsQ = supabase.from("courts").select("id, venue_id");
    if (filter.venueId) {
      courtIdsQ = courtIdsQ.eq("venue_id", filter.venueId);
    } else if (filter.districtId) {
      // Need venues in this district first.
      const { data: venuesInDistrict } = (await supabase
        .from("venues")
        .select("id")
        .eq("district_id", filter.districtId)) as {
        data: Array<{ id: string }> | null;
      };
      const venueIds = (venuesInDistrict ?? []).map((v) => v.id);
      if (venueIds.length === 0) return [];
      courtIdsQ = courtIdsQ.in("venue_id", venueIds);
    }
    const { data: courts } = (await courtIdsQ) as {
      data: Array<{ id: string; venue_id: string }> | null;
    };
    const courtIds = (courts ?? []).map((c) => c.id);
    if (courtIds.length === 0) return [];

    const { data: slots } = (await supabase
      .from("slots")
      .select("owner_id")
      .in("court_id", courtIds)
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())) as {
      data: Array<{ owner_id: string }> | null;
    };
    restrictToIds = Array.from(
      new Set((slots ?? []).map((s) => s.owner_id)),
    );
    if (restrictToIds.length === 0) return [];
  }

  // Public view bypasses RLS on `profiles` and exposes only safe coach
  // fields. See migration 20260422000400_public_profile_views.sql.
  let q = supabase
    .from("public_coach_directory")
    .select(
      "id, display_name, avatar_url, city, coach_bio, coach_hourly_rate_pln, " +
        "coach_avg_rating, coach_reviews_count",
    );
  if (restrictToIds) q = q.in("id", restrictToIds);
  const { data } = (await q
    .order("coach_avg_rating", { ascending: false, nullsFirst: false })
    .limit(120)) as { data: CoachListItem[] | null };
  return data ?? [];
}

// =============================================================================
// Venue + district options for filter dropdowns.
// =============================================================================

export type VenueOption = {
  id: string;
  name: string;
  city: string | null;
  district_id: string | null;
  district_name: string | null;
};

export async function loadVenueOptions(): Promise<VenueOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data: venues } = (await supabase
    .from("venues")
    .select("id, name, city, district_id")
    .order("name", { ascending: true })) as {
    data: Array<{
      id: string;
      name: string;
      city: string | null;
      district_id: string | null;
    }> | null;
  };
  const list = venues ?? [];
  const districtIds = Array.from(
    new Set(
      list
        .map((v) => v.district_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const d of ds ?? []) districtMap.set(d.id, d.name);
  }
  return list.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    district_id: v.district_id,
    district_name: v.district_id
      ? (districtMap.get(v.district_id) ?? null)
      : null,
  }));
}

export type DistrictOption = { id: string; name: string; city: string };

export async function loadDistrictOptionsForCoaches(): Promise<DistrictOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("city", { ascending: true })
    .order("name", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  return data ?? [];
}

export type CoachReview = {
  id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
  stars: number;
  text: string | null;
  categories: Record<string, number> | null;
  status: "published" | "hidden" | "flagged" | "removed";
  source_type: "booking" | "tournament" | "manual";
  coach_reply: string | null;
  created_at: string;
};

export type CoachProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  coach_bio: string | null;
  coach_hourly_rate_pln: number | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
  reviews: CoachReview[];
  /** Eligibility entry for the *current viewer* against this coach (if any). */
  my_eligibility: ReviewEligibility | null;
  /** True when the viewer is the coach themselves. */
  viewer_is_self: boolean;
};

export async function loadCoachProfile(coachId: string): Promise<CoachProfile | null> {
  const supabase = await createSupabaseServerClient();

  // Public view bypasses RLS on `profiles`. Rows in the view already
  // satisfy `is_coach = true`, so a `maybeSingle()` miss means either
  // the id doesn't exist or the user is no longer a coach.
  const { data: coach } = (await supabase
    .from("public_coach_directory")
    .select(
      "id, display_name, avatar_url, city, coach_bio, coach_hourly_rate_pln, " +
        "coach_avg_rating, coach_reviews_count",
    )
    .eq("id", coachId)
    .maybeSingle()) as {
    data: CoachListItem | null;
  };
  if (!coach) return null;

  const { data: rawReviews } = (await supabase
    .from("coach_reviews")
    .select(
      "id, reviewer_id, stars, text, categories, status, source_type, " +
        "coach_reply, created_at",
    )
    .eq("target_coach_id", coachId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(40)) as {
    data: Array<{
      id: string;
      reviewer_id: string;
      stars: number;
      text: string | null;
      categories: Record<string, number> | null;
      status: CoachReview["status"];
      source_type: CoachReview["source_type"];
      coach_reply: string | null;
      created_at: string;
    }> | null;
  };

  const reviewerIds = Array.from(
    new Set((rawReviews ?? []).map((r) => r.reviewer_id)),
  );
  const reviewerById = new Map<
    string,
    { display_name: string | null; avatar_url: string | null }
  >();
  if (reviewerIds.length > 0) {
    // Public basic view exposes id/display_name/avatar_url across all
    // profiles, bypassing RLS so reviewer cards render for any viewer.
    const { data: reviewers } = (await supabase
      .from("public_profile_basic")
      .select("id, display_name, avatar_url")
      .in("id", reviewerIds)) as {
      data: Array<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
      }> | null;
    };
    for (const r of reviewers ?? []) {
      reviewerById.set(r.id, {
        display_name: r.display_name,
        avatar_url: r.avatar_url,
      });
    }
  }

  const reviews: CoachReview[] = (rawReviews ?? []).map((r) => {
    const reviewer = reviewerById.get(r.reviewer_id);
    return {
      id: r.id,
      reviewer_id: r.reviewer_id,
      reviewer_name: reviewer?.display_name ?? null,
      reviewer_avatar: reviewer?.avatar_url ?? null,
      stars: r.stars,
      text: r.text,
      categories: r.categories,
      status: r.status,
      source_type: r.source_type,
      coach_reply: r.coach_reply,
      created_at: r.created_at,
    };
  });

  // Eligibility for the current viewer (if signed in).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewer_is_self = user?.id === coachId;

  // Eligibility model: any signed-in non-self viewer can leave an `open`
  // review. If they additionally have a confirmed booking/tournament with
  // the coach, we prefer that as the proof source so the review carries the
  // higher-trust badge ("verified by booking" vs "open"). On top of that we
  // need to detect an existing review of any kind so the form switches to
  // edit mode.
  let my_eligibility: ReviewEligibility | null = null;
  if (user && !viewer_is_self) {
    const ms = await loadMyInteractionsWithCoach(supabase, user.id, coachId);
    const allEligibility = computeReviewEligibility(ms.interactions, ms.reviews);
    const interactionEligibility =
      allEligibility.find((e) => e.coach_id === coachId) ?? null;

    if (interactionEligibility) {
      my_eligibility = interactionEligibility;
    } else {
      // Any prior `open` review by this viewer for this coach?
      const openExisting = ms.reviews.find(
        (r) => r.coach_id === coachId && r.source_type === "open",
      );
      my_eligibility = {
        coach_id: coachId,
        source_type: "open",
        source_id: null,
        has_existing_review: Boolean(openExisting),
        existing_status: openExisting?.status ?? null,
      };
    }
  }

  return {
    id: coach.id,
    display_name: coach.display_name,
    avatar_url: coach.avatar_url,
    city: coach.city,
    coach_bio: coach.coach_bio,
    coach_hourly_rate_pln: coach.coach_hourly_rate_pln,
    coach_avg_rating: coach.coach_avg_rating,
    coach_reviews_count: coach.coach_reviews_count,
    reviews,
    my_eligibility,
    viewer_is_self,
  };
}

// =============================================================================
// Upcoming open slots for a coach (used by coach profile + booking CTA).
// =============================================================================

export type CoachUpcomingSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  slot_type: "individual" | "pair" | "group";
  max_participants: number;
  bookings_count: number;
  price_pln: number | null;
  notes: string | null;
  court_label: string;
  venue_name: string;
  venue_id: string;
  city: string | null;
  district_name: string | null;
  /** True when the current viewer already holds a non-cancelled booking. */
  i_booked: boolean;
};

const UPCOMING_SLOT_LIMIT = 30;

export async function loadCoachUpcomingSlots(
  coachId: string,
): Promise<CoachUpcomingSlot[]> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data: rawSlots } = (await supabase
    .from("slots")
    .select(
      "id, starts_at, ends_at, slot_type, max_participants, price_pln, notes, court_id",
    )
    .eq("owner_id", coachId)
    .eq("status", "open")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(UPCOMING_SLOT_LIMIT)) as {
    data:
      | Array<{
          id: string;
          starts_at: string;
          ends_at: string;
          slot_type: "individual" | "pair" | "group";
          max_participants: number;
          price_pln: number | null;
          notes: string | null;
          court_id: string;
        }>
      | null;
  };
  if (!rawSlots || rawSlots.length === 0) return [];

  const courtIds = Array.from(new Set(rawSlots.map((s) => s.court_id)));
  const slotIds = rawSlots.map((s) => s.id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: courtsRaw }, { data: bookingsRaw }, mineRes] =
    await Promise.all([
      supabase
        .from("courts")
        .select(
          "id, number, name, venues!inner(id, name, city, district_id)",
        )
        .in("id", courtIds) as unknown as Promise<{
        data:
          | Array<{
              id: string;
              number: number;
              name: string | null;
              venues:
                | {
                    id: string;
                    name: string;
                    city: string | null;
                    district_id: string | null;
                  }
                | Array<{
                    id: string;
                    name: string;
                    city: string | null;
                    district_id: string | null;
                  }>;
            }>
          | null;
      }>,
      supabase
        .from("bookings")
        .select("slot_id, status")
        .in("slot_id", slotIds) as unknown as Promise<{
        data: Array<{ slot_id: string; status: string }> | null;
      }>,
      user
        ? (supabase
            .from("bookings")
            .select("slot_id, status")
            .eq("player_id", user.id)
            .in("slot_id", slotIds) as unknown as Promise<{
            data: Array<{ slot_id: string; status: string }> | null;
          }>)
        : Promise.resolve({ data: null } as {
            data: Array<{ slot_id: string; status: string }> | null;
          }),
    ]);

  const districtIds = Array.from(
    new Set(
      (courtsRaw ?? [])
        .map((c) => {
          const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
          return v?.district_id ?? null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const d of ds ?? []) districtMap.set(d.id, d.name);
  }

  const courtIndex = new Map<
    string,
    {
      label: string;
      venue_name: string;
      venue_id: string;
      city: string | null;
      district_id: string | null;
    }
  >();
  for (const c of courtsRaw ?? []) {
    const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
    if (!v) continue;
    courtIndex.set(c.id, {
      label: c.name ? `${c.name} (#${c.number})` : `Court #${c.number}`,
      venue_name: v.name,
      venue_id: v.id,
      city: v.city,
      district_id: v.district_id,
    });
  }

  const counts = new Map<string, number>();
  for (const b of bookingsRaw ?? []) {
    if (b.status === "cancelled") continue;
    counts.set(b.slot_id, (counts.get(b.slot_id) ?? 0) + 1);
  }

  const mineSet = new Set<string>();
  for (const b of mineRes.data ?? []) {
    if (b.status === "cancelled") continue;
    mineSet.add(b.slot_id);
  }

  const out: CoachUpcomingSlot[] = [];
  for (const s of rawSlots) {
    const c = courtIndex.get(s.court_id);
    if (!c) continue;
    out.push({
      id: s.id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      slot_type: s.slot_type,
      max_participants: s.max_participants,
      bookings_count: counts.get(s.id) ?? 0,
      price_pln: s.price_pln,
      notes: s.notes,
      court_label: c.label,
      venue_name: c.venue_name,
      venue_id: c.venue_id,
      city: c.city,
      district_name: c.district_id
        ? (districtMap.get(c.district_id) ?? null)
        : null,
      i_booked: mineSet.has(s.id),
    });
  }
  return out;
}

// =============================================================================
// Interaction lookup (bookings + tournaments) for a player ↔ coach pair.
// Used both by the coach detail page and by /me/coaches.
// =============================================================================

// Loose Supabase client type that fits both the SSR and service-role flavours.
// We keep it generic so we can pass either to the helpers below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function loadMyInteractionsWithCoach(
  supabase: AnySupabase,
  playerId: string,
  coachId?: string,
): Promise<{ interactions: InteractionRow[]; reviews: ExistingReviewRow[] }> {
  let bookingsQ = supabase
    .from("bookings")
    .select("id, coach_id, slot_id, slots(starts_at)")
    .eq("player_id", playerId)
    .in("status", ["confirmed", "attended"]);
  if (coachId) bookingsQ = bookingsQ.eq("coach_id", coachId);
  const { data: bookings } = (await bookingsQ) as {
    data: Array<{
      id: string;
      coach_id: string;
      slot_id: string;
      slots: { starts_at: string } | null;
    }> | null;
  };

  let tournamentsQ = supabase
    .from("tournament_participants")
    .select(
      "tournament_id, withdrawn, " +
        "tournaments(owner_coach_id, starts_on, ends_on)",
    )
    .eq("player_id", playerId)
    .eq("withdrawn", false);
  const { data: tps } = (await tournamentsQ) as {
    data: Array<{
      tournament_id: string;
      withdrawn: boolean;
      tournaments: {
        owner_coach_id: string;
        starts_on: string;
        ends_on: string | null;
      } | null;
    }> | null;
  };

  const interactions: InteractionRow[] = [
    ...(bookings ?? []).map<InteractionRow>((b) => ({
      coach_id: b.coach_id,
      source_type: "booking",
      source_id: b.id,
      occurred_at: b.slots?.starts_at ?? null,
    })),
    ...((tps ?? [])
      .filter((t) => t.tournaments != null)
      .filter((t) => !coachId || t.tournaments!.owner_coach_id === coachId)
      .map<InteractionRow>((t) => ({
        coach_id: t.tournaments!.owner_coach_id,
        source_type: "tournament",
        source_id: t.tournament_id,
        occurred_at: t.tournaments!.starts_on,
      }))),
  ];

  let reviewsQ = supabase
    .from("coach_reviews")
    .select("source_type, source_id, target_coach_id, status")
    .eq("reviewer_id", playerId);
  if (coachId) reviewsQ = reviewsQ.eq("target_coach_id", coachId);
  const { data: reviews } = (await reviewsQ) as {
    data: Array<{
      source_type: ExistingReviewRow["source_type"];
      source_id: string | null;
      target_coach_id: string;
      status: ExistingReviewRow["status"];
    }> | null;
  };
  const existingReviews: ExistingReviewRow[] = (reviews ?? []).map((r) => ({
    coach_id: r.target_coach_id,
    source_type: r.source_type,
    source_id: r.source_id,
    status: r.status,
  }));

  return { interactions, reviews: existingReviews };
}

// =============================================================================
// Submit / update / delete a review.
// =============================================================================

const SubmitSchema = z
  .object({
    coach_id: z.string().uuid(),
    // 'open' = any signed-in user, no source_id required.
    // 'booking' / 'tournament' = proof-backed, source_id is the row id.
    source_type: z.enum(["booking", "tournament", "open"]),
    source_id: z.string().uuid().nullable().optional(),
    stars: z.coerce.number().int().min(1).max(5),
    text: z.string().trim().max(1000).optional().nullable(),
    categories: z
      .record(z.string().min(1), z.coerce.number().int().min(1).max(5))
      .optional()
      .nullable(),
  })
  .refine(
    (v) => v.source_type === "open" || (v.source_id != null && v.source_id.length > 0),
    { message: "source_id required for booking/tournament", path: ["source_id"] },
  );

export type SubmitReviewResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "not_eligible"
        | "self_review"
        | "db_error";
      message?: string;
    };

export async function submitReview(input: unknown): Promise<SubmitReviewResult> {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const v = parsed.data;
  if (v.coach_id === user.id) return { ok: false, error: "self_review" };

  // Source-specific verification:
  //   * 'open'  – any signed-in user; no source row required.
  //   * 'booking' / 'tournament' – the client-passed source_id must match a
  //     real interaction this player had with this coach. Trusting the
  //     client to set source_type='booking' on a random UUID would let an
  //     attacker forge "verified by booking" badges.
  if (v.source_type !== "open") {
    const { interactions } = await loadMyInteractionsWithCoach(
      supabase,
      user.id,
      v.coach_id,
    );
    const eligible = interactions.some(
      (i) =>
        i.coach_id === v.coach_id &&
        i.source_type === v.source_type &&
        i.source_id === v.source_id,
    );
    if (!eligible) return { ok: false, error: "not_eligible" };
  }

  const service = createSupabaseServiceClient();

  // Two upsert paths:
  //   * For 'open' rows source_id is NULL, and Postgres treats NULLs as
  //     distinct under the table-level UNIQUE. We rely on the partial
  //     unique index `coach_reviews_one_open_per_pair` to enforce one
  //     'open' row per (reviewer, coach), and we manually look up the
  //     existing row id to perform an UPDATE-or-INSERT instead of upsert
  //     (which can't see the partial index conflict target).
  //   * For booking/tournament rows the (reviewer, coach, source_type,
  //     source_id) UNIQUE works fine and we use the original onConflict.
  let inserted: { id: string } | null = null;
  let error: { message: string } | null = null;

  if (v.source_type === "open") {
    const { data: existing } = (await service
      .from("coach_reviews")
      .select("id")
      .eq("reviewer_id", user.id)
      .eq("target_coach_id", v.coach_id)
      .eq("source_type", "open")
      .maybeSingle()) as { data: { id: string } | null };

    if (existing) {
      const { data, error: e } = (await service
        .from("coach_reviews")
        .update({
          stars: v.stars,
          text: v.text ?? null,
          categories: v.categories ?? {},
          status: "published",
        } as never)
        .eq("id", existing.id)
        .select("id")
        .single()) as {
        data: { id: string } | null;
        error: { message: string } | null;
      };
      inserted = data;
      error = e;
    } else {
      const { data, error: e } = (await service
        .from("coach_reviews")
        .insert({
          reviewer_id: user.id,
          target_coach_id: v.coach_id,
          source_type: "open",
          source_id: null,
          stars: v.stars,
          text: v.text ?? null,
          categories: v.categories ?? {},
          status: "published",
        } as never)
        .select("id")
        .single()) as {
        data: { id: string } | null;
        error: { message: string } | null;
      };
      inserted = data;
      error = e;
    }
  } else {
    const { data, error: e } = (await service
      .from("coach_reviews")
      .upsert(
        {
          reviewer_id: user.id,
          target_coach_id: v.coach_id,
          source_type: v.source_type,
          source_id: v.source_id,
          stars: v.stars,
          text: v.text ?? null,
          categories: v.categories ?? {},
          status: "published",
        } as never,
        { onConflict: "reviewer_id,target_coach_id,source_type,source_id" },
      )
      .select("id")
      .single()) as {
      data: { id: string } | null;
      error: { message: string } | null;
    };
    inserted = data;
    error = e;
  }

  if (error || !inserted) return { ok: false, error: "db_error", message: error?.message };

  // Suppress prior reviewer entry: ignore.
  await recomputeCoachAggregate(service, v.coach_id);

  revalidatePath(`/coaches/${v.coach_id}`);
  revalidatePath("/coaches");
  revalidatePath("/me/coaches");
  return { ok: true, id: inserted.id };
}

async function recomputeCoachAggregate(supabase: AnySupabase, coachId: string) {
  const { data: rows } = (await supabase
    .from("coach_reviews")
    .select("stars")
    .eq("target_coach_id", coachId)
    .eq("status", "published")) as { data: Array<{ stars: number }> | null };
  const arr = rows ?? [];
  const count = arr.length;
  const avg =
    count === 0
      ? null
      : Math.round((arr.reduce((a, r) => a + r.stars, 0) / count) * 100) / 100;
  await supabase
    .from("profiles")
    .update({ coach_avg_rating: avg, coach_reviews_count: count } as never)
    .eq("id", coachId);
}

// =============================================================================
// Player view: list of all coaches I've worked with + my review state.
// =============================================================================

export type MyCoachEntry = {
  coach: CoachListItem;
  eligibility: ReviewEligibility;
  my_review: {
    stars: number;
    text: string | null;
    categories: Record<string, number> | null;
    status: ExistingReviewRow["status"];
  } | null;
};

export async function loadMyCoaches(): Promise<MyCoachEntry[] | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { interactions, reviews } = await loadMyInteractionsWithCoach(
    supabase,
    user.id,
  );
  const eligibility = computeReviewEligibility(interactions, reviews);
  if (eligibility.length === 0) return [];

  const coachIds = eligibility.map((e) => e.coach_id);
  const { data: coachRows } = (await supabase
    .from("public_coach_directory")
    .select(
      "id, display_name, avatar_url, city, coach_bio, coach_hourly_rate_pln, " +
        "coach_avg_rating, coach_reviews_count",
    )
    .in("id", coachIds)) as { data: CoachListItem[] | null };
  const coachById = new Map((coachRows ?? []).map((c) => [c.id, c] as const));

  // Fetch my actual reviews (including hidden/flagged) so we can show status.
  const { data: myReviewRows } = (await supabase
    .from("coach_reviews")
    .select("target_coach_id, source_type, source_id, stars, text, categories, status")
    .eq("reviewer_id", user.id)) as {
    data: Array<{
      target_coach_id: string;
      source_type: ExistingReviewRow["source_type"];
      source_id: string | null;
      stars: number;
      text: string | null;
      categories: Record<string, number> | null;
      status: ExistingReviewRow["status"];
    }> | null;
  };
  const myReviewByKey = new Map<string, MyCoachEntry["my_review"]>();
  for (const r of myReviewRows ?? []) {
    if (!r.source_id) continue;
    myReviewByKey.set(`${r.target_coach_id}|${r.source_type}|${r.source_id}`, {
      stars: r.stars,
      text: r.text,
      categories: r.categories,
      status: r.status,
    });
  }

  return eligibility
    .map<MyCoachEntry | null>((e) => {
      const coach = coachById.get(e.coach_id);
      if (!coach) return null;
      const my_review =
        myReviewByKey.get(`${e.coach_id}|${e.source_type}|${e.source_id}`) ?? null;
      return { coach, eligibility: e, my_review };
    })
    .filter((x): x is MyCoachEntry => x !== null);
}

// =============================================================================
// Admin: moderation queue.
// =============================================================================

export type AdminReviewRow = CoachReview & {
  target_coach_id: string;
  target_coach_name: string | null;
  source_id: string | null;
};

export async function loadAdminReviews(filter: "all" | "flagged" = "all"): Promise<AdminReviewRow[] | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) return null;

  let q = supabase
    .from("coach_reviews")
    .select(
      "id, reviewer_id, target_coach_id, stars, text, categories, status, " +
        "source_type, source_id, coach_reply, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "flagged") q = q.in("status", ["flagged", "hidden"]);

  const { data: rows } = (await q) as {
    data: Array<{
      id: string;
      reviewer_id: string;
      target_coach_id: string;
      stars: number;
      text: string | null;
      categories: Record<string, number> | null;
      status: CoachReview["status"];
      source_type: CoachReview["source_type"];
      source_id: string | null;
      coach_reply: string | null;
      created_at: string;
    }> | null;
  };
  const list = rows ?? [];

  const ids = Array.from(
    new Set([...list.map((r) => r.reviewer_id), ...list.map((r) => r.target_coach_id)]),
  );
  const { data: people } = (await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids)) as {
    data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null;
  };
  const peopleById = new Map((people ?? []).map((p) => [p.id, p] as const));

  return list.map((r) => ({
    id: r.id,
    reviewer_id: r.reviewer_id,
    reviewer_name: peopleById.get(r.reviewer_id)?.display_name ?? null,
    reviewer_avatar: peopleById.get(r.reviewer_id)?.avatar_url ?? null,
    target_coach_id: r.target_coach_id,
    target_coach_name: peopleById.get(r.target_coach_id)?.display_name ?? null,
    stars: r.stars,
    text: r.text,
    categories: r.categories,
    status: r.status,
    source_type: r.source_type,
    source_id: r.source_id,
    coach_reply: r.coach_reply,
    created_at: r.created_at,
  }));
}

const ModerateSchema = z.object({
  review_id: z.string().uuid(),
  action: z.enum(["publish", "hide", "remove"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

export async function moderateReview(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = ModerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) return { ok: false, error: "not_admin" };

  const status =
    parsed.data.action === "publish"
      ? "published"
      : parsed.data.action === "hide"
        ? "hidden"
        : "removed";

  const service = createSupabaseServiceClient();
  const { data: row, error } = (await service
    .from("coach_reviews")
    .update({
      status,
      flagged_reason: parsed.data.reason ?? null,
    } as never)
    .eq("id", parsed.data.review_id)
    .select("target_coach_id")
    .single()) as { data: { target_coach_id: string } | null; error: { message: string } | null };
  if (error || !row) return { ok: false, error: error?.message ?? "not_found" };

  await recomputeCoachAggregate(service, row.target_coach_id);

  revalidatePath("/admin/reviews");
  revalidatePath(`/coaches/${row.target_coach_id}`);
  return { ok: true };
}
