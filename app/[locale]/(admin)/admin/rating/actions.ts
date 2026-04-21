"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AlgorithmConfigSchema,
  DEFAULT_ALGORITHM_CONFIG,
  type AlgorithmConfig,
} from "@/lib/quiz/schema";
import {
  computeMatchEloDelta,
  type MatchKind,
  type RatingConfig,
} from "@/lib/rating/elo";
import type { RatingAlgorithmConfigRow } from "@/lib/supabase/types";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  const { data } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!data?.is_admin) return { ok: false as const, error: "not_admin" as const };
  return { ok: true as const, supabase, userId: user.id };
}

export type RatingConfigListItem = RatingAlgorithmConfigRow;

export async function loadRatingConfigs(): Promise<
  { ok: true; configs: RatingConfigListItem[] } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data } = (await supabase
    .from("rating_algorithm_config")
    .select("id, version, is_active, config, notes, created_at")
    .order("version", { ascending: false })) as {
    data: RatingAlgorithmConfigRow[] | null;
  };
  return { ok: true, configs: data ?? [] };
}

export async function loadRatingConfigDetail(
  id: string,
): Promise<
  { ok: true; row: RatingAlgorithmConfigRow } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;
  const { data } = (await supabase
    .from("rating_algorithm_config")
    .select("id, version, is_active, config, notes, created_at")
    .eq("id", id)
    .maybeSingle()) as { data: RatingAlgorithmConfigRow | null };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, row: data };
}

const CreateSchema = z.object({
  source_id: z.string().uuid().nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function createRatingConfig(input: unknown): Promise<
  { ok: true; id: string; version: number } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  const { supabase, userId } = auth;

  const { data: maxRow } = (await supabase
    .from("rating_algorithm_config")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { version: number } | null };
  const nextVersion = (maxRow?.version ?? 0) + 1;

  let baseConfig: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG;
  if (parsed.data.source_id) {
    const { data: src } = (await supabase
      .from("rating_algorithm_config")
      .select("config")
      .eq("id", parsed.data.source_id)
      .maybeSingle()) as { data: { config: AlgorithmConfig } | null };
    if (src?.config) baseConfig = src.config;
  }

  const { data, error } = (await supabase
    .from("rating_algorithm_config")
    .insert({
      version: nextVersion,
      is_active: false,
      config: baseConfig,
      notes: parsed.data.notes,
      created_by: userId,
    } as never)
    .select("id, version")
    .single()) as {
    data: { id: string; version: number } | null;
    error: { message: string } | null;
  };
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

  revalidatePath("/admin/rating");
  return { ok: true, id: data.id, version: data.version };
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  config: AlgorithmConfigSchema,
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateRatingConfig(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { supabase } = auth;

  const { data: row } = (await supabase
    .from("rating_algorithm_config")
    .select("is_active")
    .eq("id", parsed.data.id)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (!row) return { ok: false, error: "not_found" };
  if (row.is_active) return { ok: false, error: "active_config_locked" };

  const { error } = await supabase
    .from("rating_algorithm_config")
    .update({
      config: parsed.data.config,
      notes: parsed.data.notes,
    } as never)
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/rating");
  revalidatePath(`/admin/rating/${parsed.data.id}`);
  return { ok: true };
}

export async function activateRatingConfig(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { error: e1 } = await supabase
    .from("rating_algorithm_config")
    .update({ is_active: false } as never)
    .neq("id", id);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase
    .from("rating_algorithm_config")
    .update({ is_active: true } as never)
    .eq("id", id);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/admin/rating");
  revalidatePath(`/admin/rating/${id}`);
  return { ok: true };
}

export async function deleteRatingConfig(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: row } = (await supabase
    .from("rating_algorithm_config")
    .select("is_active")
    .eq("id", id)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (!row) return { ok: false, error: "not_found" };
  if (row.is_active) return { ok: false, error: "cannot_delete_active" };

  const { error } = await supabase
    .from("rating_algorithm_config")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/rating");
  return { ok: true };
}

// =============================================================================
// Simulator: estimate Elo delta for a hypothetical match using the SAVED config
// of the row being edited. Pure compute — no DB writes.
// =============================================================================

const SimulatorSchema = z.object({
  config: AlgorithmConfigSchema,
  p1Elo: z.coerce.number().int().min(100).max(3000),
  p2Elo: z.coerce.number().int().min(100).max(3000),
  p1Matches: z.coerce.number().int().min(0).max(500),
  p2Matches: z.coerce.number().int().min(0).max(500),
  winnerSide: z.enum(["p1", "p2"]),
  kind: z.enum(["friendly", "tournament", "tournament_final", "league"]),
});

/**
 * Build a `RatingConfig` (engine type) from the admin-facing
 * `AlgorithmConfig` (DB type). The two are intentionally separate:
 *   – AlgorithmConfig is broader (includes start_elo, season),
 *   – RatingConfig is the narrow input the per-match engine accepts.
 */
function configToEngine(c: AlgorithmConfig): RatingConfig {
  return {
    divisor: 400,
    floor: 100,
    provisional_threshold: c.k_factors.provisional_until_n_matches,
    k_provisional: c.k_factors.provisional,
    k_intermediate: c.k_factors.intermediate,
    k_established: c.k_factors.established,
    elite_elo_threshold: 2200,
    k_elite: Math.max(8, Math.round(c.k_factors.established * 0.8)),
    multipliers: {
      friendly: c.multipliers.friendly,
      tournament: c.multipliers.tournament,
      tournament_final: c.multipliers.tournament_final,
      league: c.multipliers.tournament,
    },
  };
}

export async function simulateMatch(input: unknown): Promise<
  | {
      ok: true;
      p1Delta: number;
      p2Delta: number;
      k1: number;
      k2: number;
      multiplier: number;
      p1Expected: number;
    }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = SimulatorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;
  const cfg = configToEngine(v.config);
  const u = computeMatchEloDelta({
    p1Elo: v.p1Elo,
    p2Elo: v.p2Elo,
    p1Matches: v.p1Matches,
    p2Matches: v.p2Matches,
    winnerSide: v.winnerSide,
    kind: v.kind as MatchKind,
    cfg,
  });
  return {
    ok: true,
    p1Delta: u.p1Delta,
    p2Delta: u.p2Delta,
    k1: u.k1,
    k2: u.k2,
    multiplier: u.multiplier,
    p1Expected: u.p1Expected,
  };
}
