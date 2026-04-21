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

export async function loadCoaches(): Promise<CoachListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, city, coach_bio, coach_hourly_rate_pln, " +
        "coach_avg_rating, coach_reviews_count",
    )
    .eq("is_coach", true)
    .order("coach_avg_rating", { ascending: false, nullsFirst: false })
    .limit(120)) as { data: CoachListItem[] | null };
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

  const { data: coach } = (await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, city, coach_bio, coach_hourly_rate_pln, " +
        "coach_avg_rating, coach_reviews_count, is_coach",
    )
    .eq("id", coachId)
    .maybeSingle()) as {
    data:
      | (CoachListItem & {
          is_coach: boolean;
        })
      | null;
  };
  if (!coach || !coach.is_coach) return null;

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
    const { data: reviewers } = (await supabase
      .from("profiles")
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

  let my_eligibility: ReviewEligibility | null = null;
  if (user && !viewer_is_self) {
    const ms = await loadMyInteractionsWithCoach(supabase, user.id, coachId);
    const allEligibility = computeReviewEligibility(ms.interactions, ms.reviews);
    my_eligibility = allEligibility.find((e) => e.coach_id === coachId) ?? null;
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

const SubmitSchema = z.object({
  coach_id: z.string().uuid(),
  source_type: z.enum(["booking", "tournament"]),
  source_id: z.string().uuid(),
  stars: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(1000).optional().nullable(),
  categories: z
    .record(z.string().min(1), z.coerce.number().int().min(1).max(5))
    .optional()
    .nullable(),
});

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

  // Re-verify eligibility on the server. Trusting the client-passed source is
  // not an option — anyone could craft any UUID.
  const { interactions, reviews } = await loadMyInteractionsWithCoach(
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

  const service = createSupabaseServiceClient();
  // Upsert by unique (reviewer_id, target_coach_id, source_type, source_id).
  const { data: inserted, error } = (await service
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
    .single()) as { data: { id: string } | null; error: { message: string } | null };

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
    .from("profiles")
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
