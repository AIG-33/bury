/**
 * «Требует внимания» — items the user must react to.
 *
 * Currently: incoming friendly-match proposals awaiting the user's answer
 * (matches with outcome = 'proposed', p2 = user, no response yet) plus the
 * fresh-notifications counter used across /m. Read with the caller's client
 * (RLS: the user sees their own matches and outbox rows).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type PendingProposal = {
  match_id: string;
  from_id: string;
  from_name: string | null;
  from_avatar: string | null;
  message: string | null;
  created_at: string;
};

export async function loadPendingProposals(
  supabase: AnySupabase,
  userId: string,
): Promise<PendingProposal[]> {
  const { data: rows } = (await supabase
    .from("matches")
    .select("id, p1_id, proposal_message, created_at")
    .eq("p2_id", userId)
    .eq("outcome", "proposed")
    .is("tournament_id", null)
    .is("proposal_responded_at", null)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: Array<{
      id: string;
      p1_id: string;
      proposal_message: string | null;
      created_at: string;
    }> | null;
  };
  if (!rows || rows.length === 0) return [];

  const initiatorIds = Array.from(new Set(rows.map((r) => r.p1_id)));
  const { data: profiles } = (await supabase
    .from("public_player_basic")
    .select("id, display_name, avatar_url")
    .in("id", initiatorIds)) as {
    data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null;
  };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    match_id: r.id,
    from_id: r.p1_id,
    from_name: byId.get(r.p1_id)?.display_name ?? null,
    from_avatar: byId.get(r.p1_id)?.avatar_url ?? null,
    message: r.proposal_message,
    created_at: r.created_at,
  }));
}

export async function countPendingProposals(
  supabase: AnySupabase,
  userId: string,
): Promise<number> {
  const { count } = (await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("p2_id", userId)
    .eq("outcome", "proposed")
    .is("tournament_id", null)
    .is("proposal_responded_at", null)) as { count: number | null };
  return count ?? 0;
}

/** Badge for the «Ещё» tab: pending proposals + notifications of the last 48 h. */
export async function countAttention(supabase: AnySupabase, userId: string): Promise<number> {
  const [proposals, outbox] = await Promise.all([
    countPendingProposals(supabase, userId),
    supabase
      .from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .gte("created_at", new Date(Date.now() - 48 * 3600_000).toISOString()) as unknown as Promise<{
      count: number | null;
    }>,
  ]);
  return proposals + (outbox.count ?? 0);
}
