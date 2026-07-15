"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  anonymizedProfileUpdate,
  decideAccountDeletion,
  isValidConfirmationWord,
  type AccountUsage,
  type OwnedClub,
  type OwnedTournament,
} from "./deletion";

// =============================================================================
// Full account deletion (App Store Guideline 5.1.1(v)).
//
// Flow: the signed-in user confirms by typing the confirmation word →
// this action (service role, bypasses RLS):
//   1. refuses while the user owns clubs or live tournaments (they must be
//      transferred or deleted first — returned as a structured "blocked"
//      result the dialog renders);
//   2. deletes all personal rows (bookings, applications, notifications,
//      quiz answers, rating history, reviews, memberships, …) and the
//      avatar / application files in storage;
//   3. purges or anonymizes the profiles row (tombstone keeps opponents'
//      match history and finished tournament brackets consistent);
//   4. destroys the auth.users row via auth.admin.deleteUser and signs the
//      session out.
// =============================================================================

const DeleteAccountSchema = z.object({
  confirmation: z.string().min(1),
});

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_payload" | "wrong_confirmation" | "not_authenticated" | "db_error";
    }
  | {
      ok: false;
      error: "blocked";
      clubs: string[];
      tournaments: string[];
    };

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export async function deleteAccount(input: unknown): Promise<DeleteAccountResult> {
  const parsed = DeleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  if (!isValidConfirmationWord(parsed.data.confirmation)) {
    return { ok: false, error: "wrong_confirmation" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();

  let usage: AccountUsage;
  try {
    usage = await collectAccountUsage(service, user.id);
  } catch {
    return { ok: false, error: "db_error" };
  }

  const decision = decideAccountDeletion(usage);
  if (decision.kind === "blocked") {
    return {
      ok: false,
      error: "blocked",
      clubs: decision.clubs.map((c) => c.name),
      tournaments: decision.tournaments.map((t) => t.name),
    };
  }

  try {
    await deletePersonalRows(service, user.id, decision.deletableTournamentIds);
    await deleteStorageFolders(service, user.id);

    if (decision.mode === "anonymize") {
      const { error } = await service
        .from("profiles")
        .update(anonymizedProfileUpdate() as never)
        .eq("id", user.id);
      if (error) throw error;
    } else {
      const { error } = await service.from("profiles").delete().eq("id", user.id);
      if (error) throw error;
    }

    const { error: authError } = await service.auth.admin.deleteUser(user.id);
    if (authError) throw authError;
  } catch (e) {
    console.error("deleteAccount failed", { userId: user.id, error: e });
    return { ok: false, error: "db_error" };
  }

  // The auth user is gone; clear the session cookies on this device.
  await supabase.auth.signOut();

  return { ok: true };
}

async function collectAccountUsage(service: ServiceClient, userId: string): Promise<AccountUsage> {
  const [clubsRes, tournamentsRes, matchesRes, participationsRes] = await Promise.all([
    service.from("clubs").select("id, name").eq("owner_id", userId),
    service.from("tournaments").select("id, name, status").eq("owner_id", userId),
    service
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(
        `p1_id.eq.${userId},p2_id.eq.${userId},p1_partner_id.eq.${userId},p2_partner_id.eq.${userId}`,
      ),
    service
      .from("tournament_participants")
      .select("id, tournaments!inner(status)")
      .eq("player_id", userId)
      .in("tournaments.status", ["in_progress", "finished", "cancelled"]),
  ]);

  if (clubsRes.error) throw clubsRes.error;
  if (tournamentsRes.error) throw tournamentsRes.error;
  if (matchesRes.error) throw matchesRes.error;
  if (participationsRes.error) throw participationsRes.error;

  return {
    ownedClubs: (clubsRes.data ?? []) as OwnedClub[],
    ownedTournaments: ((tournamentsRes.data ?? []) as Array<Record<string, unknown>>).map(
      (t) =>
        ({
          id: t.id,
          name: t.name,
          status: t.status,
        }) as OwnedTournament,
    ),
    matchesCount: matchesRes.count ?? 0,
    keptParticipationsCount: (participationsRes.data ?? []).length,
  };
}

async function deletePersonalRows(
  service: ServiceClient,
  userId: string,
  deletableTournamentIds: string[],
): Promise<void> {
  // Reviews the user WROTE affect other coaches' stored aggregates —
  // remember the targets, delete, then recompute each aggregate.
  const { data: authoredReviews } = await service
    .from("coach_reviews")
    .select("target_coach_id")
    .eq("reviewer_id", userId);
  const affectedCoachIds = Array.from(
    new Set(
      ((authoredReviews ?? []) as Array<{ target_coach_id: string }>)
        .map((r) => r.target_coach_id)
        .filter((id) => id !== userId),
    ),
  );

  const steps: Array<{ table: string; column: string }> = [
    { table: "coach_reviews", column: "reviewer_id" },
    { table: "coach_reviews", column: "target_coach_id" },
    // Venue comments the user wrote disappear with the account; venues they
    // created stay in the directory (venues.created_by → NULL via FK on purge).
    { table: "venue_comments", column: "author_id" },
    { table: "open_matches", column: "creator_id" }, // applications cascade
    { table: "open_match_applications", column: "applicant_id" },
    { table: "bookings", column: "player_id" },
    { table: "bookings", column: "coach_id" },
    { table: "slots", column: "owner_id" },
    { table: "coach_applications", column: "player_id" },
    { table: "club_members", column: "user_id" },
    { table: "club_member_ratings", column: "player_id" },
    { table: "club_rating_history", column: "player_id" },
    { table: "notifications_outbox", column: "recipient_id" },
    { table: "telegram_links", column: "player_id" },
    { table: "quiz_answers", column: "player_id" },
    { table: "invitations", column: "coach_id" },
    { table: "external_rating_history", column: "player_id" },
    { table: "external_ratings", column: "player_id" },
    { table: "rating_history", column: "player_id" },
    { table: "tournament_templates", column: "owner_id" },
  ];

  for (const step of steps) {
    const { error } = await service.from(step.table).delete().eq(step.column, userId);
    if (error) throw error;
  }

  // Draft tournaments are invisible to others — drop them entirely
  // (their matches / participants / groups cascade on tournament_id).
  if (deletableTournamentIds.length > 0) {
    const { error } = await service.from("tournaments").delete().in("id", deletableTournamentIds);
    if (error) throw error;
  }

  // Withdraw from tournaments that haven't started (draft/registration);
  // participations in started/finished tournaments are kept for bracket
  // consistency and end up pointing at the anonymized tombstone.
  const { data: openParticipations, error: participationsError } = await service
    .from("tournament_participants")
    .select("id, tournaments!inner(status)")
    .eq("player_id", userId)
    .in("tournaments.status", ["draft", "registration"]);
  if (participationsError) throw participationsError;
  const openIds = ((openParticipations ?? []) as Array<{ id: string }>).map((p) => p.id);
  if (openIds.length > 0) {
    const { error } = await service.from("tournament_participants").delete().in("id", openIds);
    if (error) throw error;
  }

  for (const coachId of affectedCoachIds) {
    await recomputeCoachAggregate(service, coachId);
  }
}

async function recomputeCoachAggregate(service: ServiceClient, coachId: string): Promise<void> {
  const { data: rows } = await service
    .from("coach_reviews")
    .select("stars")
    .eq("target_coach_id", coachId)
    .eq("status", "published");
  const arr = (rows ?? []) as Array<{ stars: number }>;
  const count = arr.length;
  const avg =
    count === 0 ? null : Math.round((arr.reduce((a, r) => a + r.stars, 0) / count) * 100) / 100;
  await service
    .from("profiles")
    .update({ coach_avg_rating: avg, coach_reviews_count: count } as never)
    .eq("id", coachId);
}

async function deleteStorageFolders(service: ServiceClient, userId: string): Promise<void> {
  for (const bucket of ["avatars", "coach-applications"]) {
    const { data: files } = await service.storage.from(bucket).list(userId, { limit: 100 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length > 0) {
      await service.storage.from(bucket).remove(paths);
    }
  }
}
