// =============================================================================
// External-rating Server Action implementations.
//
// Why this file exists separately from `lib/rating/external/liga-tennisa.ts`:
//   * `liga-tennisa.ts` is pure logic + thin upstream IO (testable, no DB).
//   * This file does the PlayTennis.by side: writes to `external_ratings`,
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
      /** Whether the singles or doubles value actually changed since last refresh. */
      changed: boolean;
    }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "no_external_rating"
        | "rate_limited"
        | "upstream_unreachable"
        | "upstream_error"
        | "player_not_found"
        | "db_error";
      message?: string;
      /** When `error === "rate_limited"`: seconds to wait before retrying. */
      retry_after_seconds?: number;
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
  let { data: existingProfile } = (await service
    .from("profiles")
    .select(
      "current_elo, first_name, last_name, avatar_url, dominant_hand, " +
        "backhand_style, date_of_birth, city, social_links",
    )
    .eq("id", user.id)
    .maybeSingle()) as {
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

  // Recover from the (rare) case where an authenticated auth.users row
  // has no matching profiles row — this happens when the
  // `handle_new_user` trigger was missing or failed at signup time. The
  // FK on external_ratings.player_id would otherwise blow up the import
  // with a generic "save failed". We re-run the same insert
  // `handle_new_user` does, idempotently, so the rest of the flow has
  // a profile to attach to.
  if (!existingProfile) {
    console.warn("[import-lt] profile row missing for authenticated user — creating one", {
      user_id: user.id,
    });
    const { error: profCreateErr } = await service.from("profiles").insert(
      {
        id: user.id,
        email_local: user.email ? user.email.split("@")[0] : null,
        locale: "ru",
      } as never,
      { count: "exact" },
    );
    if (profCreateErr && !/duplicate key/i.test(profCreateErr.message)) {
      console.error("[import-lt] could not create missing profile row", {
        user_id: user.id,
        message: profCreateErr.message,
      });
      return { ok: false, error: "db_error", message: profCreateErr.message };
    }
    // Re-fetch so the rest of the function operates on a real row.
    const { data: created } = (await service
      .from("profiles")
      .select(
        "current_elo, first_name, last_name, avatar_url, dominant_hand, " +
          "backhand_style, date_of_birth, city, social_links",
      )
      .eq("id", user.id)
      .maybeSingle()) as { data: typeof existingProfile };
    existingProfile = created;
  }

  const oldElo = existingProfile?.current_elo ?? 1000;

  // Look up whether the player already has an external_ratings row so we know
  // whether this is a true first-time connect (writes initial_import history)
  // or a re-import (just bumps the snapshot, no history row — the dedicated
  // refreshExternalRating action is the right channel for refresh tracking).
  const { data: prevExt } = (await service
    .from("external_ratings")
    .select("id, external_elo, external_elo_doubles, display_tier, is_calibrating_singles, is_calibrating_doubles")
    .eq("player_id", user.id)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as {
    data: {
      id: string;
      external_elo: number;
      external_elo_doubles: number | null;
      display_tier: string;
      is_calibrating_singles: boolean;
      is_calibrating_doubles: boolean;
    } | null;
  };

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
    console.error("[import-lt] external_ratings upsert failed", {
      user_id: user.id,
      external_id: safe.id,
      message: erErr?.message,
    });
    return { ok: false, error: "db_error", message: erErr?.message };
  }

  // First-time connect → seed external_rating_history with one point per
  // discipline so the chart has an anchor. For re-imports (prevExt != null)
  // we skip these — refresh tracking lives in refreshExternalRating().
  if (!prevExt) {
    const histRows: Array<Record<string, unknown>> = [];
    histRows.push({
      player_id: user.id,
      external_rating_id: erRow.id,
      source: "liga_tennisa",
      external_id: String(safe.id),
      old_elo: null,
      new_elo: safe.elo_points ?? 0,
      discipline: "singles",
      display_tier_old: null,
      display_tier_new: tier,
      is_calibrating: safe.is_calibrating_singles,
      reason: "initial_import",
      raw_payload: safe,
    });
    if (safe.doubles_elo_points != null) {
      histRows.push({
        player_id: user.id,
        external_rating_id: erRow.id,
        source: "liga_tennisa",
        external_id: String(safe.id),
        old_elo: null,
        new_elo: safe.doubles_elo_points,
        discipline: "doubles",
        display_tier_old: null,
        display_tier_new: tier,
        is_calibrating: safe.is_calibrating_doubles,
        reason: "initial_import",
        raw_payload: safe,
      });
    }
    const { error: ehErr } = await service
      .from("external_rating_history")
      .insert(histRows as never);
    if (ehErr) {
      // Non-fatal: badge/seed already work; only the chart loses its anchor.
      console.error(
        "[import-lt] external_rating_history initial_import insert failed (non-fatal)",
        {
          user_id: user.id,
          external_id: safe.id,
          message: ehErr.message,
        },
      );
    }
  }

  // Internal current_elo is seeded from LT *only* during onboarding. Once
  // the player has finished onboarding (either via the quiz or a previous
  // LT import) their internal Elo evolves independently from match results.
  // Re-importing or refreshing must never overwrite it. See chat decision:
  // "единственное где рейтинг ЛТ влияет на рейтинг внутренний это при создании
  // пользователя".
  const onboardingDone = !!(existingProfile as { onboarding_completed_at?: string | null } | null)
    ?.onboarding_completed_at;

  // Build the profile patch. current_elo + onboarding_completed_at are
  // touched only on the first import; other empty-field copies happen any
  // time (they only fill blanks, never overwrite).
  const patch: Record<string, unknown> = {};
  if (!onboardingDone) {
    patch.current_elo = conv.elo;
    patch.elo_status = "provisional";
    patch.onboarding_completed_at = new Date().toISOString();
  }

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

  if (Object.keys(patch).length > 0) {
    const { error: profErr } = await service
      .from("profiles")
      .update(patch as never)
      .eq("id", user.id);
    if (profErr) {
      console.error("[import-lt] profiles update failed", {
        user_id: user.id,
        patch_keys: Object.keys(patch),
        message: profErr.message,
      });
      return { ok: false, error: "db_error", message: profErr.message };
    }
  }

  // Audit row: rating_history with reason 'external_import'. Only written on
  // the very first import (when current_elo was actually seeded). For
  // subsequent re-imports we don't touch the internal Elo timeline.
  if (!onboardingDone) {
    const { error: histErr } = await service.from("rating_history").insert({
      player_id: user.id,
      match_id: null,
      old_elo: oldElo,
      new_elo: conv.elo,
      k_factor: 0,
      multiplier: 1.0,
      reason: "external_import",
    } as never);
    if (histErr) {
      console.error("[import-lt] rating_history insert failed (non-fatal)", {
        user_id: user.id,
        old_elo: oldElo,
        new_elo: conv.elo,
        message: histErr.message,
      });
    }
  }

  return {
    ok: true,
    external_rating_id: erRow.id,
    new_local_elo: onboardingDone ? oldElo : conv.elo,
    old_local_elo: oldElo,
  };
}

// ---------------------------------------------------------------------------
// REFRESH — re-fetch upstream and update external_ratings ONLY.
//
// Does NOT touch `profiles.current_elo`: by design the PlayTennis.by rating
// evolves independently after the initial import. The badge stays in sync
// with LT via this manual refresh.
//
// Rate limited: at most one refresh per `REFRESH_COOLDOWN_SECONDS` per
// player. The cooldown is checked against `external_ratings.last_refreshed_at`
// so it survives server restarts (no in-process state).
//
// History tracking: when the value actually changes, a row is inserted into
// `external_rating_history` for each affected discipline (singles/doubles).
// If neither value changed, we still update `last_refreshed_at` so the UI
// can display "checked just now, no changes".
// ---------------------------------------------------------------------------

const REFRESH_COOLDOWN_SECONDS = 60;

export async function refreshExternalRating(): Promise<RefreshResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();

  const { data: existing } = (await service
    .from("external_ratings")
    .select(
      "id, external_id, external_elo, external_elo_doubles, display_tier, " +
        "is_calibrating_singles, is_calibrating_doubles, last_refreshed_at",
    )
    .eq("player_id", user.id)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as {
    data: {
      id: string;
      external_id: string;
      external_elo: number;
      external_elo_doubles: number | null;
      display_tier: string;
      is_calibrating_singles: boolean;
      is_calibrating_doubles: boolean;
      last_refreshed_at: string;
    } | null;
  };
  if (!existing) return { ok: false, error: "no_external_rating" };

  // Rate-limit guard.
  const sinceLast = Date.now() - Date.parse(existing.last_refreshed_at);
  if (sinceLast < REFRESH_COOLDOWN_SECONDS * 1000) {
    return {
      ok: false,
      error: "rate_limited",
      retry_after_seconds: Math.ceil(
        (REFRESH_COOLDOWN_SECONDS * 1000 - sinceLast) / 1000,
      ),
    };
  }

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
  const newSinglesElo = safe.elo_points ?? 0;
  const newDoublesElo = safe.doubles_elo_points;
  const tier = ltTierForElo(safe.elo_points);
  const nowIso = new Date().toISOString();

  const { error: upErr } = await service
    .from("external_ratings")
    .update({
      display_tier: tier,
      external_elo: newSinglesElo,
      external_elo_doubles: newDoublesElo,
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

  // History: only insert points for disciplines whose value actually moved.
  // This keeps the chart clean (the user pressing ↻ five times in a row
  // doesn't pile on five identical points).
  const histRows: Array<Record<string, unknown>> = [];
  if (newSinglesElo !== existing.external_elo) {
    histRows.push({
      player_id: user.id,
      external_rating_id: existing.id,
      source: "liga_tennisa",
      external_id: String(safe.id),
      old_elo: existing.external_elo,
      new_elo: newSinglesElo,
      discipline: "singles",
      display_tier_old: existing.display_tier,
      display_tier_new: tier,
      is_calibrating: safe.is_calibrating_singles,
      reason: "manual_refresh",
      raw_payload: safe,
    });
  }
  if (newDoublesElo != null && newDoublesElo !== existing.external_elo_doubles) {
    histRows.push({
      player_id: user.id,
      external_rating_id: existing.id,
      source: "liga_tennisa",
      external_id: String(safe.id),
      old_elo: existing.external_elo_doubles,
      new_elo: newDoublesElo,
      discipline: "doubles",
      // Tier is keyed on singles Elo upstream; we track the same string for
      // visual continuity in the doubles series.
      display_tier_old: existing.display_tier,
      display_tier_new: tier,
      is_calibrating: safe.is_calibrating_doubles,
      reason: "manual_refresh",
      raw_payload: safe,
    });
  }
  let changed = false;
  if (histRows.length > 0) {
    const { error: ehErr } = await service
      .from("external_rating_history")
      .insert(histRows as never);
    if (ehErr) {
      console.error(
        "[refresh-lt] external_rating_history insert failed (non-fatal)",
        {
          user_id: user.id,
          rows: histRows.length,
          message: ehErr.message,
        },
      );
    } else {
      changed = true;
    }
  }

  return {
    ok: true,
    external_elo: safe.elo_points,
    display_tier: tier,
    last_refreshed_at: nowIso,
    changed,
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
