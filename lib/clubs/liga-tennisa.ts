// =============================================================================
// Liga Tennisa ↔ club bridge.
//
// Product rule: the club /clubs/liga-tennisa mirrors the real Liga Tennisa
// community. When a player connects (or refreshes) their ligatennisa.com
// rating, they automatically become an approved member of that club and
// their LT points are mirrored into the club's internal rating table
// (club_member_ratings) for both disciplines. The player's profile then
// shows the club + their LT-based club rating.
//
// All writes go through the service role (called from the external-rating
// Server Actions only). Every step is idempotent and non-fatal for the
// import flow: a missing club or a DB hiccup must never break the import.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const LIGA_TENNISA_CLUB_SLUG = "liga-tennisa";

export type LtClubSnapshot = {
  /** Raw LT singles points (external_ratings.external_elo). */
  singlesElo: number | null;
  /** Raw LT doubles points, when the player has a doubles rating. */
  doublesElo: number | null;
  calibratingSingles: boolean;
  calibratingDoubles: boolean;
};

/**
 * Ensure the player is an approved member of the Liga Tennisa club and
 * mirror their LT points into the club rating (singles + doubles ladders).
 *
 * – No club with the `liga-tennisa` slug → silent no-op.
 * – Existing `rejected` membership is respected (the club admin's decision
 *   is not overridden).
 * – `pending` membership is promoted to `approved` — a confirmed LT profile
 *   is the proof of membership in the real league.
 */
export async function syncLigaTennisaClubMembership(
  service: SupabaseClient,
  playerId: string,
  snapshot: LtClubSnapshot,
): Promise<void> {
  const { data: club } = (await service
    .from("clubs")
    .select("id")
    .eq("slug", LIGA_TENNISA_CLUB_SLUG)
    .maybeSingle()) as { data: { id: string } | null };
  if (!club) return;

  // ── Membership ─────────────────────────────────────────────────────────
  const { data: membership } = (await service
    .from("club_members")
    .select("id, status")
    .eq("club_id", club.id)
    .eq("user_id", playerId)
    .maybeSingle()) as {
    data: { id: string; status: "pending" | "approved" | "rejected" } | null;
  };

  if (!membership) {
    const nowIso = new Date().toISOString();
    const { error } = await service.from("club_members").insert({
      club_id: club.id,
      user_id: playerId,
      status: "approved",
      role: "member",
      is_primary: false,
      message: null,
      applied_at: nowIso,
      decided_at: nowIso,
    } as never);
    if (error) {
      console.error("[lt-club] club_members insert failed", {
        player_id: playerId,
        message: error.message,
      });
      return;
    }
  } else if (membership.status === "pending") {
    const { error } = await service
      .from("club_members")
      .update({ status: "approved", decided_at: new Date().toISOString() } as never)
      .eq("id", membership.id);
    if (error) {
      console.error("[lt-club] club_members approve failed", {
        player_id: playerId,
        message: error.message,
      });
    }
  } else if (membership.status === "rejected") {
    // Explicit admin decision — don't auto-readd, and don't touch ratings.
    return;
  }

  // ── Mirror LT points into the club ladders ────────────────────────────
  const targets: Array<{
    discipline: "singles" | "doubles";
    rating: number;
    calibrating: boolean;
  }> = [];
  if (snapshot.singlesElo != null) {
    targets.push({
      discipline: "singles",
      rating: snapshot.singlesElo,
      calibrating: snapshot.calibratingSingles,
    });
  }
  if (snapshot.doublesElo != null) {
    targets.push({
      discipline: "doubles",
      rating: snapshot.doublesElo,
      calibrating: snapshot.calibratingDoubles,
    });
  }
  if (targets.length === 0) return;

  const { data: existingRatings } = (await service
    .from("club_member_ratings")
    .select("id, discipline, rating")
    .eq("club_id", club.id)
    .eq("player_id", playerId)) as {
    data: Array<{ id: string; discipline: "singles" | "doubles"; rating: number }> | null;
  };
  const existingByDiscipline = new Map(
    (existingRatings ?? []).map((r) => [r.discipline, r] as const),
  );

  for (const target of targets) {
    const existing = existingByDiscipline.get(target.discipline);
    const ratingStatus = target.calibrating ? "provisional" : "established";

    if (!existing) {
      const { error } = await service.from("club_member_ratings").insert({
        club_id: club.id,
        player_id: playerId,
        discipline: target.discipline,
        rating: target.rating,
        rating_status: ratingStatus,
      } as never);
      if (error) {
        console.error("[lt-club] club_member_ratings insert failed", {
          player_id: playerId,
          discipline: target.discipline,
          message: error.message,
        });
        continue;
      }
      await service.from("club_rating_history").insert({
        club_id: club.id,
        player_id: playerId,
        match_id: null,
        old_rating: target.rating,
        new_rating: target.rating,
        reason: "seed",
        note: "liga_tennisa import",
        discipline: target.discipline,
      } as never);
    } else if (existing.rating !== target.rating) {
      const { error } = await service
        .from("club_member_ratings")
        .update({ rating: target.rating, rating_status: ratingStatus } as never)
        .eq("id", existing.id);
      if (error) {
        console.error("[lt-club] club_member_ratings update failed", {
          player_id: playerId,
          discipline: target.discipline,
          message: error.message,
        });
        continue;
      }
      await service.from("club_rating_history").insert({
        club_id: club.id,
        player_id: playerId,
        match_id: null,
        old_rating: existing.rating,
        new_rating: target.rating,
        reason: "seed",
        note: "liga_tennisa refresh",
        discipline: target.discipline,
      } as never);
    }
  }
}
