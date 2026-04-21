/**
 * Database type stub. Will be regenerated from Supabase schema after migrations:
 *   npx supabase gen types typescript --local > lib/supabase/types.ts
 *
 * For now we hand-write the minimal `profiles` shape we depend on so server
 * components type-check.
 */

export type ProfileRow = {
  id: string;
  is_admin: boolean;
  is_coach: boolean;
  is_player: boolean;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email_local: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram_username: string | null;
  social_links: Record<string, unknown>;
  country: string;
  city: string | null;
  district_id: string | null;
  dominant_hand: "R" | "L" | null;
  backhand_style: "one_handed" | "two_handed" | null;
  favorite_surface: "hard" | "clay" | "grass" | "carpet" | null;
  favorite_player: string | null;
  motto: string | null;
  availability: Record<string, unknown>;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  coach_bio: string | null;
  coach_hourly_rate_pln: number | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
  coach_slug: string | null;
  visible_in_find_player: boolean;
  visible_in_leaderboard: boolean;
  notification_email: boolean;
  notification_telegram: boolean;
  locale: "pl" | "en" | "ru";
  timezone: string;
  health_notes: string | null;
  emergency_contact: string | null;
  consent_terms_at: string | null;
  consent_privacy_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvitationRow = {
  id: string;
  coach_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  token_hash: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuizVersionRow = {
  id: string;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type QuizQuestionRow = {
  id: string;
  version_id: string;
  position: number;
  code: string;
  type: "single_choice" | "multi_choice" | "scale" | "number";
  question: Record<string, string>;
  options: Array<{ value: string; label: Record<string, string>; weight: number }> | { min: number; max: number } | null;
  weight_formula: Record<string, unknown> | null;
  required: boolean;
};

export type RatingAlgorithmConfigRow = {
  id: string;
  version: number;
  is_active: boolean;
  config: {
    start_elo: { base: number; clamp: [number, number]; experience_per_year: number; tournaments_bonus_per_5: number };
    k_factors: { provisional: number; intermediate: number; established: number; provisional_until_n_matches: number; intermediate_until_n_matches: number };
    multipliers: { friendly: number; tournament: number; tournament_final: number };
    season: {
      default_length_days: number;
      scoring: Record<string, number>;
      top_n_for_prizes: number;
    };
    margin_of_victory_enabled?: boolean;
  };
  notes: string | null;
  created_at: string;
};

type AnyRow = Record<string, unknown>;

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string }; Update: Partial<ProfileRow> };
      invitations: { Row: InvitationRow; Insert: Partial<InvitationRow> & { coach_id: string; email: string; token_hash: string; expires_at: string }; Update: Partial<InvitationRow> };
      quiz_versions: { Row: QuizVersionRow; Insert: Partial<QuizVersionRow>; Update: Partial<QuizVersionRow> };
      quiz_questions: { Row: QuizQuestionRow; Insert: Partial<QuizQuestionRow>; Update: Partial<QuizQuestionRow> };
      quiz_answers: {
        Row: { id: string; player_id: string; version_id: string; answers: Record<string, unknown>; computed_elo: number; computed_at: string };
        Insert: { player_id: string; version_id: string; answers: Record<string, unknown>; computed_elo: number };
        Update: AnyRow;
      };
      rating_algorithm_config: { Row: RatingAlgorithmConfigRow; Insert: Partial<RatingAlgorithmConfigRow>; Update: Partial<RatingAlgorithmConfigRow> };
      rating_history: {
        Row: { id: string; player_id: string; match_id: string | null; old_elo: number; new_elo: number; delta: number; k_factor: number; multiplier: number; reason: string; created_at: string };
        Insert: AnyRow;
        Update: AnyRow;
      };
      [table: string]: { Row: AnyRow; Insert: AnyRow; Update: AnyRow };
    };
    Views: { [view: string]: { Row: AnyRow } };
    Functions: {
      accept_invitation: { Args: { p_token_hash: string; p_user_id: string }; Returns: { coach_id: string; invitation_id: string }[] };
      recalc_match_elo: { Args: { p_match_id: string }; Returns: void };
      [fn: string]: { Args: AnyRow; Returns: unknown };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, AnyRow>;
  };
};
