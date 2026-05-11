// =============================================================================
// External-rating Server Action implementations.
//
// Why this file exists separately from `lib/rating/external/liga-tennisa.ts`:
//   * `liga-tennisa.ts` is pure logic + thin upstream IO (testable, no DB).
//   * This file does the OpenCourt.by side: writes to `external_ratings`,
//     updates `profiles`, appends to `rating_history`. It must NEVER be
//     called directly from the browser — it is wrapped by per-page
//     `"use server"` modules (see
//     `app/[locale]/onboarding/import-lt/actions.ts` and
//     `app/[locale]/(player)/me/profile/external-rating-actions.ts`).
//
// Privacy / safety
//   * The user's email and phone from the upstream profile are NEVER copied
//     into our `profiles` row. Only fields the player can already see and
//     edit themselves are touched.
//   * `password_hash` and `last_password_reset` are dropped at the validator
//     boundary in `lib/validators/external-ratings.ts`.
//   * Imports are explicit per-call: we re-fetch the upstream detail on
//     every confirm/refresh so the value can never be tampered with from
//     the browser.
// =============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  fetchLtPlayer,
  ltBackhandToStyle,
  ltDisplayName,
  ltEloToLocalElo,
  ltForehandToHand,
  ltProfileUrl,
  ltTierForElo,
  searchLtByName,
  LtUpstreamError,
  type LtSearchCandidate,
} from "@/lib/rating/external/liga-tennisa";
import { sanitiseLtPayload } from "@/lib/validators/external-ratings";

// ---------------------------------------------------------------------------
// Types returned to the UI.
// ---------------------------------------------------------------------------

export type LtPreview = {
  external_id: number;
  external_url: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  city: string | null;
  country: string | null;
  date_of_birth: string | null;
  insta_link: string | null;
  in_tennis_from: string | null;
  height: number | null;
  forehand_label: string | null;
  backhand_label: string | null;
  hand_code: "R" | "L" | null;
  backhand_code: "one_handed" | "two_handed" | null;
  /** LT singles Elo (raw upstream value). */
  external_elo: number | null;
  external_elo_doubles: number | null;
  /** Tier label derived from external_elo. */
  display_tier: string;
  is_calibrating_singles: boolean;
  is_calibrating_doubles: boolean;
  ranking_position: number | null;
  singles_wins: number | null;
  /**
   * What our `profiles.current_elo` would become if the player confirms.
   * Pre-computed here so the UI can show "Your Elo will start at 1630".
   */
  proposed_local_elo: number;
  proposed_local_elo_clamped: boolean;
  proposed_local_elo_fallback: boolean;
};

export type SearchResult =
  | { ok: true; candidates: LtSearchCandidate[] }
  | {
      ok: false;
      error: "invalid_query" | "upstream_unreachable" | "upstream_error";
      message?: string;
    };

export type PreviewResult =
  | { ok: true; preview: LtPreview }
  | {
      ok: false;
      error: "invalid_payload" | "upstream_unreachable" | "upstream_error" | "player_not_found";
      message?: string;
    };

export type ImportResult =
  | {
      ok: true;
      external_rating_id: string;
      new_local_elo: number;
      old_local_elo: number;
    }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "upstream_unreachable"
        | "upstream_error"
        | "player_not_found"
        | "already_claimed_by_other_user"
        | "already_imported"
        | "db_error";
      message?: string;
    };

export type RefreshResult =
  | {
      ok: true;
      external_elo: number | null;
      display_tier: string;
      last_refreshed_at: string;
    }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "no_external_rating"
        | "upstream_unreachable"
        | "upstream_error"
        | "player_not_found"
        | "db_error";
      message?: string;
    };

export type DisconnectResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "no_external_rating" | "db_error"; message?: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPreview(detail: Awaited<ReturnType<typeof fetchLtPlayer>>): LtPreview {
  const display = ltDisplayName(detail.first_name, detail.last_name);
  const tier = ltTierForElo(detail.elo_points);
  const conv = ltEloToLocalElo(detail.elo_points);
  return {
    external_id: detail.id,
    external_url: ltProfileUrl(detail.id),
    display_name: display,
    first_name: detail.first_name,
    last_name: detail.last_name,
    avatar: detail.avatar,
    city: detail.city,
    country: detail.country,
    date_of_birth: detail.date_of_birth,
    insta_link: detail.insta_link,
    in_tennis_from: detail.in_tennis_from,
    height: detail.height,
    forehand_label: detail.forehand,
    backhand_label: detail.backhand,
    hand_code: ltForehandToHand(detail.forehand),
    backhand_code: ltBackhandToStyle(detail.backhand),
    external_elo: detail.elo_points,
    external_elo_doubles: detail.doubles_elo_points,
    display_tier: tier,
    is_calibrating_singles: detail.metadata?.singles?.isCalibrating ?? false,
    is_calibrating_doubles: detail.metadata?.doubles?.isCalibrating ?? false,
    ranking_position: detail.ranking_position,
    singles_wins: detail.singles_wins,
    proposed_local_elo: conv.elo,
    proposed_local_elo_clamped: conv.clamped,
    proposed_local_elo_fallback: conv.fallback,
  };
}

// ---------------------------------------------------------------------------
// SEARCH — onboarding flow only. No write side-effects.
// ---------------------------------------------------------------------------

export async function searchLtCandidates(
  rawQuery: unknown,
  rawCity: unknown,
): Promise<SearchResult> {
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const city = typeof rawCity === "string" ? rawCity.trim() : null;
  if (query.length < 2) return { ok: false, error: "invalid_query" };

  try {
    const candidates = await searchLtByName(query, { city, limit: 8 });
    return { ok: true, candidates };
  } catch (err) {
    if (err instanceof LtUpstreamError) {
      const code = err.status === 0 ? "upstream_unreachable" : "upstream_error";
      return { ok: false, error: code, message: err.message };
    }
    return {
      ok: false,
      error: "upstream_error",
      message: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ---------------------------------------------------------------------------
// PREVIEW — fetch a single LT profile and build the confirm-card payload.
// ---------------------------------------------------------------------------

export async function previewLtPlayer(rawExternalId: unknown): Promise<PreviewResult> {
  const id = Number(rawExternalId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "invalid_payload" };
  }

  try {
    const detail = await fetchLtPlayer(id);
    return { ok: true, preview: buildPreview(detail) };
  } catch (err) {
    if (err instanceof LtUpstreamError) {
      if (err.status === 404) return { ok: false, error: "player_not_found" };
      const code = err.status === 0 ? "upstream_unreachable" : "upstream_error";
      return { ok: false, error: code, message: err.message };
    }
    return {
      ok: false,
      error: "upstream_error",
      message: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ---------------------------------------------------------------------------
// CONFIRM IMPORT — persist external_ratings + seed profile + history row.
//
// Inputs:
//   externalId       — id from the LT detail endpoint
//   copyEmptyFields  — whether to fill our blank profile fields (name,
//                      avatar, hand/backhand, dob, city, instagram) from LT.
//                      Defaults to true; the UI shows a checkbox.
// ---------------------------------------------------------------------------

export async function confirmImportFromLt(
  rawExternalId: unknown,
  copyEmptyFields: boolean = true,
): Promise<ImportResult> {
  const id = Number(rawExternalId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "invalid_payload" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Re-fetch from upstream so the persisted snapshot is fresh (and so we
  // never trust an externalId that was tampered with on the client).
  let detail;
  try {
    detail = await fetchLtPlayer(id);
  } catch (err) {
    if (err instanceof LtUpstreamError) {
      if (err.status === 404) return { ok: false, error: "player_not_found" };
      return {
        ok: false,
        error: err.status === 0 ? "upstream_unreachable" : "upstream_error",
        message: err.message,
      };
    }
    return {
      ok: false,
      error: "upstream_error",
      message: err instanceof Error ? err.message : "unknown",
    };
  }

  const safe = sanitiseLtPayload(detail);
  const conv = ltEloToLocalElo(safe.elo_points);
  const tier = ltTierForElo(safe.elo_points);

  const service = createSupabaseServiceClient();

  // Guard: another user already claimed this LT id?
  const { data: clash } = (await service
    .from("external_ratings")
    .select("id, player_id")
    .eq("source", "liga_tennisa")
    .eq("external_id", String(safe.id))
    .maybeSingle()) as {
    data: { id: string; player_id: string } | null;
  };
  if (clash && clash.player_id !== user.id) {
    return { ok: false, error: "already_claimed_by_other_user" };
  }

  // Read existing profile so we know which fields are blank and what the
  // "old" Elo was for the rating_history entry.
  const { data: existingProfile } = (await service
    .from("profiles")
    .select(
      "current_elo, first_name, last_name, avatar_url, dominant_hand, " +
        "backhand_style, date_of_birth, city, social_links",
    )
    .eq("id", user.id)
    .single()) as {
    data: {
      current_elo: number | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      dominant_hand: "R" | "L" | null;
      backhand_style: "one_handed" | "two_handed" | null;
      date_of_birth: string | null;
      city: string | null;
      social_links: Record<string, unknown> | null;
    } | null;
  };

  const oldElo = existingProfile?.current_elo ?? 1000;

  // Upsert external_ratings (one row per (player, source)).
  const { data: erRow, error: erErr } = (await service
    .from("external_ratings")
    .upsert(
      {
        player_id: user.id,
        source: "liga_tennisa",
        external_id: String(safe.id),
        external_url: ltProfileUrl(safe.id),
        display_tier: tier,
        external_elo: safe.elo_points ?? 0,
        external_elo_doubles: safe.doubles_elo_points,
        is_calibrating_singles: safe.is_calibrating_singles,
        is_calibrating_doubles: safe.is_calibrating_doubles,
        raw_payload: safe,
        imported_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
        last_refresh_error: null,
      } as never,
      { onConflict: "player_id,source" },
    )
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { message: string } | null;
  };
  if (erErr || !erRow) {
    return { ok: false, error: "db_error", message: erErr?.message };
  }

  // Build the profile patch. We always update current_elo (per product
  // decision: LT.Elo is the seed). Other fields only when the user opted
  // in AND our existing value is empty.
  const patch: Record<string, unknown> = {
    current_elo: conv.elo,
    elo_status: "provisional",
    onboarding_completed_at: new Date().toISOString(),
  };

  if (copyEmptyFields && existingProfile) {
    if (!existingProfile.first_name && safe.first_name) patch.first_name = safe.first_name;
    if (!existingProfile.last_name && safe.last_name) patch.last_name = safe.last_name;
    if (!existingProfile.avatar_url && safe.avatar) patch.avatar_url = safe.avatar;
    if (!existingProfile.date_of_birth && safe.date_of_birth) {
      patch.date_of_birth = safe.date_of_birth;
    }
    if (!existingProfile.city && safe.city) patch.city = safe.city;

    const handCode = ltForehandToHand(safe.forehand);
    if (!existingProfile.dominant_hand && handCode) patch.dominant_hand = handCode;
    const bhCode = ltBackhandToStyle(safe.backhand);
    if (!existingProfile.backhand_style && bhCode) patch.backhand_style = bhCode;

    if (safe.insta_link) {
      const social = (existingProfile.social_links ?? {}) as Record<string, unknown>;
      if (!social.instagram) {
        patch.social_links = { ...social, instagram: safe.insta_link };
      }
    }
  }

  const { error: profErr } = await service
    .from("profiles")
    .update(patch as never)
    .eq("id", user.id);
  if (profErr) {
    return { ok: false, error: "db_error", message: profErr.message };
  }

  // Audit row: rating_history with reason 'external_import'. Mirrors the
  // shape used by the onboarding quiz so the player's rating timeline stays
  // consistent in /me/rating.
  await service.from("rating_history").insert({
    player_id: user.id,
    match_id: null,
    old_elo: oldElo,
    new_elo: conv.elo,
    k_factor: 0,
    multiplier: 1.0,
    reason: "external_import",
  } as never);

  return {
    ok: true,
    external_rating_id: erRow.id,
    new_local_elo: conv.elo,
    old_local_elo: oldElo,
  };
}

// ---------------------------------------------------------------------------
// REFRESH — re-fetch upstream and update external_ratings ONLY.
//
// Does NOT touch `profiles.current_elo`: by design the OpenCourt.by rating
// evolves independently after the initial import. The badge stays in sync
// with LT via this manual refresh.
// ---------------------------------------------------------------------------

export async function refreshExternalRating(): Promise<RefreshResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();

  const { data: existing } = (await service
    .from("external_ratings")
    .select("id, external_id")
    .eq("player_id", user.id)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as {
    data: { id: string; external_id: string } | null;
  };
  if (!existing) return { ok: false, error: "no_external_rating" };

  let detail;
  try {
    detail = await fetchLtPlayer(existing.external_id);
  } catch (err) {
    // On upstream failure, keep the cached row but record the error so the
    // player sees "last refresh failed" instead of a silent stale value.
    if (err instanceof LtUpstreamError) {
      const code: "player_not_found" | "upstream_unreachable" | "upstream_error" =
        err.status === 404
          ? "player_not_found"
          : err.status === 0
            ? "upstream_unreachable"
            : "upstream_error";
      await service
        .from("external_ratings")
        .update({ last_refresh_error: err.message } as never)
        .eq("id", existing.id);
      return { ok: false, error: code, message: err.message };
    }
    const msg = err instanceof Error ? err.message : "unknown";
    await service
      .from("external_ratings")
      .update({ last_refresh_error: msg } as never)
      .eq("id", existing.id);
    return { ok: false, error: "upstream_error", message: msg };
  }

  const safe = sanitiseLtPayload(detail);
  const tier = ltTierForElo(safe.elo_points);
  const nowIso = new Date().toISOString();

  const { error: upErr } = await service
    .from("external_ratings")
    .update({
      display_tier: tier,
      external_elo: safe.elo_points ?? 0,
      external_elo_doubles: safe.doubles_elo_points,
      is_calibrating_singles: safe.is_calibrating_singles,
      is_calibrating_doubles: safe.is_calibrating_doubles,
      raw_payload: safe,
      last_refreshed_at: nowIso,
      last_refresh_error: null,
    } as never)
    .eq("id", existing.id);
  if (upErr) {
    return { ok: false, error: "db_error", message: upErr.message };
  }

  return {
    ok: true,
    external_elo: safe.elo_points,
    display_tier: tier,
    last_refreshed_at: nowIso,
  };
}

// ---------------------------------------------------------------------------
// DISCONNECT — drop the external_ratings row. Profile fields are left
// untouched (the player can edit them via the normal profile form).
// ---------------------------------------------------------------------------

export async function disconnectExternalRating(): Promise<DisconnectResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();
  const { data: existing } = (await service
    .from("external_ratings")
    .select("id")
    .eq("player_id", user.id)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as { data: { id: string } | null };
  if (!existing) return { ok: false, error: "no_external_rating" };

  const { error } = await service.from("external_ratings").delete().eq("id", existing.id);
  if (error) return { ok: false, error: "db_error", message: error.message };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// LOAD — read the current player's external rating (server components).
// ---------------------------------------------------------------------------

export type ExternalRatingSnapshot = {
  id: string;
  source: "liga_tennisa";
  external_id: string;
  external_url: string;
  display_tier: string;
  external_elo: number;
  external_elo_doubles: number | null;
  is_calibrating_singles: boolean;
  is_calibrating_doubles: boolean;
  imported_at: string;
  last_refreshed_at: string;
  last_refresh_error: string | null;
};

export async function loadMyExternalRating(): Promise<ExternalRatingSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = (await supabase
    .from("external_ratings")
    .select(
      "id, source, external_id, external_url, display_tier, external_elo, " +
        "external_elo_doubles, is_calibrating_singles, is_calibrating_doubles, " +
        "imported_at, last_refreshed_at, last_refresh_error",
    )
    .eq("player_id", user.id)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as { data: ExternalRatingSnapshot | null };
  return data;
}

/** Public-read helper: fetch a player's external rating for badges/cards. */
export async function loadExternalRatingForPlayer(
  playerId: string,
): Promise<ExternalRatingSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("external_ratings")
    .select(
      "id, source, external_id, external_url, display_tier, external_elo, " +
        "external_elo_doubles, is_calibrating_singles, is_calibrating_doubles, " +
        "imported_at, last_refreshed_at, last_refresh_error",
    )
    .eq("player_id", playerId)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as { data: ExternalRatingSnapshot | null };
  return data;
}
