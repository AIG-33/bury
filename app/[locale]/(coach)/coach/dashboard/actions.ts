"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CoachDashboardData = {
  kpi: {
    players_active_30d: number;
    tournaments_active: number;
    bookings_next_7d: number;
    pending_match_confirmations: number;
  };
  today: Array<{
    booking_id: string;
    player_name: string | null;
    starts_at: string;
    ends_at: string;
    venue: string;
    court: string;
    status: string;
  }>;
  next_7_days: Array<{
    date: string;
    bookings: number;
  }>;
  pending_matches: Array<{
    id: string;
    opponent_a_name: string | null;
    opponent_b_name: string | null;
    proposed_at: string | null;
    note: string | null;
  }>;
  recent_activity: Array<{
    kind: "booking" | "match" | "review";
    when: string;
    label: string;
  }>;
};

export async function loadCoachDashboard(): Promise<
  | { ok: true; data: CoachDashboardData }
  | { ok: false; error: "not_authenticated" | "not_a_coach" }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: me } = (await supabase
    .from("profiles")
    .select("id, is_coach, is_admin")
    .eq("id", user.id)
    .single()) as { data: { id: string; is_coach: boolean; is_admin: boolean } | null };
  if (!me || (!me.is_coach && !me.is_admin)) return { ok: false, error: "not_a_coach" };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const sevenDaysAhead = new Date(todayStart);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Slots owned by this coach in the relevant window.
  const { data: slots7d } = (await supabase
    .from("slots")
    .select("id, starts_at, ends_at, court_id")
    .eq("owner_id", me.id)
    .gte("starts_at", todayStart.toISOString())
    .lt("starts_at", sevenDaysAhead.toISOString())
    .order("starts_at", { ascending: true })) as {
    data: Array<{ id: string; starts_at: string; ends_at: string; court_id: string }> | null;
  };
  const slotIds = (slots7d ?? []).map((s) => s.id);
  const courtIds = Array.from(new Set((slots7d ?? []).map((s) => s.court_id)));

  // Bookings on those slots.
  const { data: bookings7d } = (await supabase
    .from("bookings")
    .select("id, slot_id, player_id, status, created_at")
    .in("slot_id", slotIds.length > 0 ? slotIds : ["00000000-0000-0000-0000-000000000000"])
    .neq("status", "cancelled")) as {
    data: Array<{
      id: string;
      slot_id: string;
      player_id: string;
      status: string;
      created_at: string;
    }> | null;
  };

  // Court → venue lookup.
  const { data: courts } = (await supabase
    .from("courts")
    .select("id, number, name, venues!inner(id, name)")
    .in("id", courtIds.length > 0 ? courtIds : ["00000000-0000-0000-0000-000000000000"])) as {
    data: Array<{
      id: string;
      number: number;
      name: string | null;
      venues: { id: string; name: string } | Array<{ id: string; name: string }>;
    }> | null;
  };
  const courtIndex = new Map<string, { label: string; venue: string }>();
  for (const c of courts ?? []) {
    const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
    courtIndex.set(c.id, {
      label: c.name ? `${c.name} (#${c.number})` : `Court #${c.number}`,
      venue: v?.name ?? "",
    });
  }

  // Player names.
  const playerIds = Array.from(new Set((bookings7d ?? []).map((b) => b.player_id)));
  const { data: players } = (await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", playerIds.length > 0 ? playerIds : ["00000000-0000-0000-0000-000000000000"])) as {
    data: Array<{ id: string; display_name: string | null }> | null;
  };
  const nameIndex = new Map((players ?? []).map((p) => [p.id, p.display_name] as const));

  const slotIndex = new Map((slots7d ?? []).map((s) => [s.id, s] as const));

  // Today's bookings (split out from 7-day list).
  const today: CoachDashboardData["today"] = [];
  const dayCounts = new Map<string, number>();
  for (const b of bookings7d ?? []) {
    const slot = slotIndex.get(b.slot_id);
    if (!slot) continue;
    const courtMeta = courtIndex.get(slot.court_id);
    const date = slot.starts_at.slice(0, 10);
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
    const start = new Date(slot.starts_at);
    if (start >= todayStart && start < todayEnd) {
      today.push({
        booking_id: b.id,
        player_name: nameIndex.get(b.player_id) ?? null,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        venue: courtMeta?.venue ?? "—",
        court: courtMeta?.label ?? "—",
        status: b.status,
      });
    }
  }
  today.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

  // 7-day strip data.
  const next_7_days: CoachDashboardData["next_7_days"] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    next_7_days.push({ date: iso, bookings: dayCounts.get(iso) ?? 0 });
  }

  // KPI: active players (booked or played in last 30 days).
  const { data: recentBookings } = (await supabase
    .from("bookings")
    .select("player_id, slots!inner(owner_id)")
    .eq("slots.owner_id", me.id)
    .gte("created_at", thirtyDaysAgo.toISOString())) as {
    data: Array<{ player_id: string }> | null;
  };
  const activePlayers = new Set((recentBookings ?? []).map((r) => r.player_id));

  // KPI: tournaments active.
  const { count: tournamentsActive } = (await supabase
    .from("tournaments")
    .select("id", { count: "exact", head: true })
    .eq("owner_coach_id", me.id)
    .in("status", ["registration", "in_progress", "draft"])) as { count: number | null };

  // Pending match confirmations: friendly matches where coach needs to step in
  // OR proposals targeted at this coach as a participant.
  const { data: pendingMatchesRaw } = (await supabase
    .from("matches")
    .select("id, p1_id, p2_id, outcome, proposal_message, proposal_responded_at, created_at")
    .eq("outcome", "proposed")
    .or(`p1_id.eq.${me.id},p2_id.eq.${me.id}`)
    .order("created_at", { ascending: false })
    .limit(10)) as {
    data: Array<{
      id: string;
      p1_id: string;
      p2_id: string;
      outcome: string;
      proposal_message: string | null;
      proposal_responded_at: string | null;
      created_at: string;
    }> | null;
  };
  const pendingPlayerIds = Array.from(
    new Set(
      (pendingMatchesRaw ?? []).flatMap((m) => [m.p1_id, m.p2_id]),
    ),
  );
  const { data: pendingNames } = (await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", pendingPlayerIds.length > 0 ? pendingPlayerIds : ["00000000-0000-0000-0000-000000000000"])) as {
    data: Array<{ id: string; display_name: string | null }> | null;
  };
  const pendingNameIndex = new Map((pendingNames ?? []).map((p) => [p.id, p.display_name] as const));
  const pending_matches: CoachDashboardData["pending_matches"] = (pendingMatchesRaw ?? []).map(
    (m) => ({
      id: m.id,
      opponent_a_name: pendingNameIndex.get(m.p1_id) ?? null,
      opponent_b_name: pendingNameIndex.get(m.p2_id) ?? null,
      proposed_at: m.created_at,
      note: m.proposal_message,
    }),
  );

  // Recent activity: last 10 bookings + last 5 reviews about this coach.
  const recent_activity: CoachDashboardData["recent_activity"] = [];
  for (const b of (bookings7d ?? []).slice(0, 5)) {
    recent_activity.push({
      kind: "booking",
      when: b.created_at,
      label: `${nameIndex.get(b.player_id) ?? "Player"} → ${b.status}`,
    });
  }
  const { data: recentReviews } = (await supabase
    .from("coach_reviews")
    .select("id, stars, created_at, reviewer_id")
    .eq("coach_id", me.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(5)) as {
    data: Array<{ id: string; stars: number; created_at: string; reviewer_id: string }> | null;
  };
  for (const r of recentReviews ?? []) {
    recent_activity.push({
      kind: "review",
      when: r.created_at,
      label: `★ ${r.stars}`,
    });
  }
  recent_activity.sort((a, b) => +new Date(b.when) - +new Date(a.when));

  return {
    ok: true,
    data: {
      kpi: {
        players_active_30d: activePlayers.size,
        tournaments_active: tournamentsActive ?? 0,
        bookings_next_7d: bookings7d?.length ?? 0,
        pending_match_confirmations: pending_matches.length,
      },
      today,
      next_7_days,
      pending_matches,
      recent_activity: recent_activity.slice(0, 10),
    },
  };
}
