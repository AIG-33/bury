// =============================================================================
// Account deletion domain logic (App Store Guideline 5.1.1(v)).
//
// Pure decision module — no I/O. The server action gathers the user's
// footprint, this module decides what happens:
//
//   * blocked    — the user owns clubs or tournaments that other people
//                  depend on right now. Deletion must not silently destroy
//                  those, so the user is asked to transfer/delete them first
//                  (an allowed confirmation step per 5.1.1(v); no support
//                  contact required).
//   * purge      — no shared history at all → the profiles row is deleted,
//                  public-schema FK cascades clean the rest.
//   * anonymize  — the user appears in matches or brackets other players
//                  rely on → personal data is stripped from the profiles row
//                  («Удалённый игрок» tombstone), shared records stay intact.
//
// In both non-blocked outcomes the auth.users row is destroyed — the account
// itself is always really deleted, never deactivated.
// =============================================================================

export type OwnedClub = { id: string; name: string };

export type TournamentStatus = "draft" | "registration" | "in_progress" | "finished" | "cancelled";

export type OwnedTournament = { id: string; name: string; status: TournamentStatus };

export type AccountUsage = {
  ownedClubs: OwnedClub[];
  ownedTournaments: OwnedTournament[];
  /** Matches where the user is p1 / p2 / either partner (any outcome). */
  matchesCount: number;
  /** Participations in tournaments that are in_progress / finished / cancelled. */
  keptParticipationsCount: number;
};

export type DeletionDecision =
  | { kind: "blocked"; clubs: OwnedClub[]; tournaments: OwnedTournament[] }
  | { kind: "proceed"; mode: "anonymize" | "purge"; deletableTournamentIds: string[] };

/**
 * Tournament states in which other players actively depend on the organizer:
 * a live draw / open registration cannot lose its owner.
 */
export const BLOCKING_TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  "registration",
  "in_progress",
];

export function decideAccountDeletion(usage: AccountUsage): DeletionDecision {
  const blockingTournaments = usage.ownedTournaments.filter((t) =>
    BLOCKING_TOURNAMENT_STATUSES.includes(t.status),
  );

  if (usage.ownedClubs.length > 0 || blockingTournaments.length > 0) {
    return { kind: "blocked", clubs: usage.ownedClubs, tournaments: blockingTournaments };
  }

  // Drafts are invisible to other players — safe to drop with the account.
  const deletableTournamentIds = usage.ownedTournaments
    .filter((t) => t.status === "draft")
    .map((t) => t.id);

  // Finished/cancelled tournaments stay (results belong to all participants),
  // so their owner must survive as a tombstone.
  const keptOwnedTournaments = usage.ownedTournaments.filter(
    (t) => t.status === "finished" || t.status === "cancelled",
  );

  const mustAnonymize =
    usage.matchesCount > 0 || usage.keptParticipationsCount > 0 || keptOwnedTournaments.length > 0;

  return {
    kind: "proceed",
    mode: mustAnonymize ? "anonymize" : "purge",
    deletableTournamentIds,
  };
}

/** display_name is generated from first/last name → «Удалённый игрок». */
export const ANONYMIZED_FIRST_NAME = "Удалённый";
export const ANONYMIZED_LAST_NAME = "игрок";

/**
 * Update payload for the profiles tombstone: every personal / contact /
 * coach / privacy column is cleared, the row is hidden from all directories.
 * Elo columns are intentionally kept — opponents' rating history references
 * the matches this row anchors.
 */
export function anonymizedProfileUpdate(): Record<string, unknown> {
  return {
    first_name: ANONYMIZED_FIRST_NAME,
    last_name: ANONYMIZED_LAST_NAME,
    email_local: null,
    avatar_url: null,
    date_of_birth: null,
    gender: null,
    phone: null,
    whatsapp: null,
    telegram_username: null,
    social_links: {},
    city: null,
    district_id: null,
    lat: null,
    lng: null,
    dominant_hand: null,
    backhand_style: null,
    favorite_surface: null,
    favorite_player: null,
    motto: null,
    availability: {},
    is_admin: false,
    is_coach: false,
    coach_bio: null,
    coach_hourly_rate_byn: null,
    coach_avg_rating: null,
    coach_reviews_count: 0,
    coach_slug: null,
    coach_lat: null,
    coach_lng: null,
    coach_show_on_map: false,
    visible_in_find_player: false,
    visible_in_leaderboard: false,
    notification_email: false,
    notification_telegram: false,
    notification_whatsapp: false,
    health_notes: null,
    emergency_contact: null,
  };
}

/**
 * Confirmation words accepted by the server (typed by the user in the
 * confirm dialog). Locale-dependent on the client, both accepted here.
 */
export const CONFIRMATION_WORDS = ["УДАЛИТЬ", "DELETE"] as const;

export function isValidConfirmationWord(input: string): boolean {
  const normalized = input.trim().toUpperCase();
  return CONFIRMATION_WORDS.some((w) => w === normalized);
}
