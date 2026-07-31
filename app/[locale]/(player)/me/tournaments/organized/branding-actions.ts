"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  UpdateTournamentBrandingSchema,
  tournamentBrandingFromRow,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * The tournament owner, an appointed co-organizer (tournament_admins) or a
 * platform admin may edit branding — the same gate as the tournament UPDATE
 * RLS, checked in code so we can return a friendly error code instead of a
 * silent RLS denial.
 */
async function requireTournamentManager(tournamentId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id")
    .eq("id", tournamentId)
    .maybeSingle()) as { data: { id: string; owner_id: string } | null };
  if (!t) return { ok: false as const, error: "not_found" as const };

  let allowed = t.owner_id === user.id;
  if (!allowed) {
    const { data: coAdmin } = (await supabase
      .from("tournament_admins")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", user.id)
      .maybeSingle()) as { data: { id: string } | null };
    allowed = !!coAdmin;
  }
  if (!allowed) {
    const { data: me } = (await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()) as { data: { is_admin: boolean } | null };
    allowed = me?.is_admin === true;
  }
  if (!allowed) return { ok: false as const, error: "not_owner" as const };

  return { ok: true as const, supabase, userId: user.id };
}

export async function loadTournamentBranding(
  tournamentId: string,
): Promise<TournamentBranding> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("tournaments")
    .select("branding")
    .eq("id", tournamentId)
    .maybeSingle()) as { data: { branding: unknown } | null };
  return tournamentBrandingFromRow(data?.branding);
}

export async function updateTournamentBranding(input: unknown): Promise<Result> {
  const parsed = UpdateTournamentBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { tournament_id, branding } = parsed.data;

  const auth = await requireTournamentManager(tournament_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("tournaments")
    .update({ branding } as never)
    .eq("id", tournament_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  revalidatePath(`/me/tournaments/organized/${tournament_id}`);
  return { ok: true };
}
