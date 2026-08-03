/**
 * Cron worker — drains notifications_outbox.
 *
 * Triggered by Vercel Cron (configured in vercel.json) every 5 minutes.
 * Also triggers booking reminder enqueue for sessions starting in ~24 h
 * that don't yet have a reminder queued.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 *       In dev, set `?secret=<CRON_SECRET>` for manual triggering.
 */

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { drainOutbox } from "@/lib/notifications/outbox";
import { notifyUser } from "@/lib/notifications/notify";
import type { Locale } from "@/lib/notifications/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → allow only in dev.
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  const enqueued = await enqueueBookingReminders(supabase);
  const enqueuedTournaments = await enqueueTournamentReminders(supabase);
  const drained = await drainOutbox(supabase, { limit: 100 });

  return NextResponse.json({
    ok: true,
    booking_reminders_enqueued: enqueued,
    tournament_reminders_enqueued: enqueuedTournaments,
    drained,
  });
}

// ---------------------------------------------------------------------------
// Find bookings starting in 23–25 h with no booking_reminder_24h yet — enqueue.
// ---------------------------------------------------------------------------

type AnySupabase = ReturnType<typeof createSupabaseServiceClient>;

async function enqueueBookingReminders(supabase: AnySupabase): Promise<number> {
  const now = Date.now();
  const fromIso = new Date(now + 23 * 3600 * 1000).toISOString();
  const toIso = new Date(now + 25 * 3600 * 1000).toISOString();

  const { data: slots } = (await supabase
    .from("slots")
    .select("id, starts_at, court_id")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)
    .eq("status", "open")) as {
    data: Array<{ id: string; starts_at: string; court_id: string }> | null;
  };
  if (!slots || slots.length === 0) return 0;

  const slotIds = slots.map((s) => s.id);

  const { data: bookings } = (await supabase
    .from("bookings")
    .select("id, slot_id, player_id")
    .in("slot_id", slotIds)
    .eq("status", "confirmed")) as {
    data: Array<{ id: string; slot_id: string; player_id: string }> | null;
  };
  if (!bookings || bookings.length === 0) return 0;

  // Court → venue lookup.
  const courtIds = Array.from(new Set(slots.map((s) => s.court_id)));
  const { data: courts } = (await supabase
    .from("courts")
    .select("id, number, name, venues!inner(id, name)")
    .in("id", courtIds)) as {
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

  // Player locales.
  const playerIds = Array.from(new Set(bookings.map((b) => b.player_id)));
  const { data: profiles } = (await supabase
    .from("profiles")
    .select("id, locale, notification_email")
    .in("id", playerIds)) as {
    data: Array<{ id: string; locale: Locale; notification_email: boolean }> | null;
  };
  const profileIndex = new Map((profiles ?? []).map((p) => [p.id, p] as const));

  // Avoid duplicates: check existing reminders.
  const { data: existing } = (await supabase
    .from("notifications_outbox")
    .select("recipient_id, payload")
    .eq("template", "booking_reminder_24h")
    .in("recipient_id", playerIds)) as {
    data: Array<{ recipient_id: string; payload: Record<string, unknown> }> | null;
  };
  const existingPairs = new Set<string>();
  for (const r of existing ?? []) {
    const bid = r.payload?.booking_id;
    if (bid) existingPairs.add(`${r.recipient_id}|${bid}`);
  }

  const slotIndex = new Map(slots.map((s) => [s.id, s] as const));
  let enqueued = 0;
  for (const b of bookings) {
    if (!profileIndex.has(b.player_id)) continue;
    if (existingPairs.has(`${b.player_id}|${b.id}`)) continue;
    const slot = slotIndex.get(b.slot_id);
    if (!slot) continue;
    const court = courtIndex.get(slot.court_id);
    await notifyUser(supabase, {
      recipientId: b.player_id,
      template: "booking_reminder_24h",
      payload: {
        booking_id: b.id,
        starts_at: slot.starts_at,
        venue: court?.venue ?? "",
        court: court?.label ?? "",
      },
      linkUrl: "/me/bookings",
    });
    enqueued++;
  }
  return enqueued;
}

// ---------------------------------------------------------------------------
// Tournament reminders: T-24 h emails to all confirmed participants.
// ---------------------------------------------------------------------------

async function enqueueTournamentReminders(supabase: AnySupabase): Promise<number> {
  // Tournament rows store the *date* of play in `starts_on` (not `starts_at`)
  // and an optional `start_time` (HH:MM in Europe/Minsk). To pick up
  // tomorrow's tournaments we just match on `starts_on` = today + 1 day.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  const { data: tournaments } = (await supabase
    .from("tournaments")
    .select("id, name, starts_on, start_time, format")
    .eq("starts_on", tomorrowIso)) as {
    data: Array<{
      id: string;
      name: string;
      starts_on: string;
      start_time: string | null;
      format: string;
    }> | null;
  };
  if (!tournaments || tournaments.length === 0) return 0;

  const tournamentIds = tournaments.map((t) => t.id);
  // Only approved + non-withdrawn participants get the reminder.
  const { data: participants } = (await supabase
    .from("tournament_participants")
    .select("tournament_id, player_id, status, withdrawn")
    .in("tournament_id", tournamentIds)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      tournament_id: string;
      player_id: string;
      status: string;
      withdrawn: boolean;
    }> | null;
  };
  if (!participants || participants.length === 0) return 0;

  const playerIds = Array.from(new Set(participants.map((p) => p.player_id)));
  const { data: profiles } = (await supabase
    .from("profiles")
    .select("id, locale, notification_email")
    .in("id", playerIds)) as {
    data: Array<{ id: string; locale: Locale; notification_email: boolean }> | null;
  };
  const profileIndex = new Map((profiles ?? []).map((p) => [p.id, p] as const));

  const { data: existing } = (await supabase
    .from("notifications_outbox")
    .select("recipient_id, payload")
    .eq("template", "tournament_starting_24h")
    .in("recipient_id", playerIds)) as {
    data: Array<{ recipient_id: string; payload: Record<string, unknown> }> | null;
  };
  const existingPairs = new Set<string>();
  for (const r of existing ?? []) {
    const tid = r.payload?.tournament_id;
    if (tid) existingPairs.add(`${r.recipient_id}|${tid}`);
  }

  const tIndex = new Map(tournaments.map((t) => [t.id, t] as const));
  let enqueued = 0;
  for (const p of participants) {
    const t = tIndex.get(p.tournament_id);
    if (!t) continue;
    if (!profileIndex.has(p.player_id)) continue;
    if (existingPairs.has(`${p.player_id}|${t.id}`)) continue;
    await notifyUser(supabase, {
      recipientId: p.player_id,
      template: "tournament_starting_24h",
      payload: {
        tournament_id: t.id,
        tournament_name: t.name,
        starts_at: t.start_time
          ? `${t.starts_on}T${t.start_time.slice(0, 5)}:00`
          : t.starts_on,
      },
      linkUrl: `/tournaments/${t.id}`,
    });
    enqueued++;
  }
  return enqueued;
}
