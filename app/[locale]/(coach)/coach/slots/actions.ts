"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SlotFormSchema, type SlotType } from "@/lib/slots/schema";
import { expandRecurrence } from "@/lib/slots/expand";

// =============================================================================
// Types
// =============================================================================

export type CoachSlotRow = {
  id: string;
  court_id: string;
  court_label: string;
  venue_name: string;
  starts_at: string;
  ends_at: string;
  slot_type: SlotType;
  max_participants: number;
  bookings_count: number;
  price_pln: number | null;
  notes: string | null;
  status: "open" | "closed" | "cancelled";
};

export type CourtOption = {
  id: string;
  number: number;
  name: string | null;
  venue_id: string;
  venue_name: string;
};

// =============================================================================
// Auth helper
// =============================================================================

async function requireCoach() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, is_coach, is_admin")
    .eq("id", user.id)
    .single()) as { data: { id: string; is_coach: boolean; is_admin: boolean } | null };

  if (!profile) return { ok: false as const, error: "no_profile" as const };
  if (!profile.is_coach && !profile.is_admin) {
    return { ok: false as const, error: "not_a_coach" as const };
  }
  return { ok: true as const, supabase, userId: profile.id };
}

// =============================================================================
// Load slots in a date window for the current coach + their courts list.
// =============================================================================

export async function loadCoachSlots(opts: { fromIso: string; toIso: string }): Promise<
  | {
      ok: true;
      slots: CoachSlotRow[];
      courts: CourtOption[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireCoach();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Venues are now an admin-curated directory: any coach picks any court
  // when scheduling. We load every active court for the dropdown, then
  // restrict the slot list to slots owned by this coach.
  const { data: venuesRaw } = (await supabase
    .from("venues")
    .select("id, name, courts(id, number, name)")
    .order("name", { ascending: true })) as {
    data: Array<{
      id: string;
      name: string;
      courts: Array<{ id: string; number: number; name: string | null }>;
    }> | null;
  };

  const courts: CourtOption[] = [];
  for (const v of venuesRaw ?? []) {
    for (const c of v.courts ?? []) {
      courts.push({
        id: c.id,
        number: c.number,
        name: c.name,
        venue_id: v.id,
        venue_name: v.name,
      });
    }
  }
  courts.sort((a, b) => a.venue_name.localeCompare(b.venue_name) || a.number - b.number);

  const { data: slotsRaw } = (await supabase
    .from("slots")
    .select(
      "id, court_id, starts_at, ends_at, slot_type, max_participants, price_pln, notes, status",
    )
    .eq("owner_id", userId)
    .gte("starts_at", opts.fromIso)
    .lte("starts_at", opts.toIso)
    .order("starts_at", { ascending: true })) as {
    data: Array<{
      id: string;
      court_id: string;
      starts_at: string;
      ends_at: string;
      slot_type: SlotType;
      max_participants: number;
      price_pln: number | null;
      notes: string | null;
      status: "open" | "closed" | "cancelled";
    }> | null;
  };

  const slotIds = (slotsRaw ?? []).map((s) => s.id);
  const counts = new Map<string, number>();
  if (slotIds.length > 0) {
    const { data: bk } = (await supabase
      .from("bookings")
      .select("slot_id, status")
      .in("slot_id", slotIds)) as {
      data: Array<{ slot_id: string; status: string }> | null;
    };
    for (const b of bk ?? []) {
      if (b.status === "cancelled") continue;
      counts.set(b.slot_id, (counts.get(b.slot_id) ?? 0) + 1);
    }
  }

  const courtIndex = new Map(courts.map((c) => [c.id, c]));
  const slots: CoachSlotRow[] = (slotsRaw ?? []).map((s) => {
    const c = courtIndex.get(s.court_id);
    return {
      id: s.id,
      court_id: s.court_id,
      court_label: c ? (c.name ? `${c.name} (#${c.number})` : `Court #${c.number}`) : "Court",
      venue_name: c?.venue_name ?? "—",
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      slot_type: s.slot_type,
      max_participants: s.max_participants,
      price_pln: s.price_pln,
      notes: s.notes,
      status: s.status,
      bookings_count: counts.get(s.id) ?? 0,
    };
  });

  return { ok: true, slots, courts };
}

// =============================================================================
// Create slots from a SlotForm (single or weekly).
// We expand to occurrences in JS, then INSERT them in a single batch.
// Conflicts (gist EXCLUDE) are caught and reported per occurrence.
// =============================================================================

export type CreateSlotsResult =
  | {
      ok: true;
      created: number;
      conflicts: Array<{ local_date: string; local_start_time: string }>;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createSlots(input: unknown): Promise<CreateSlotsResult> {
  const parsed = SlotFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const form = parsed.data;

  // Venues are an admin-curated directory now — coaches just pick any
  // existing court. We only verify the court row exists; the GIST exclude
  // constraint on slots prevents double-booking the same physical court.
  const { data: court } = (await supabase
    .from("courts")
    .select("id")
    .eq("id", form.court_id)
    .single()) as { data: { id: string } | null };
  if (!court) return { ok: false, error: "court_not_found" };

  const occurrences = expandRecurrence(form);
  if (occurrences.length === 0) {
    return { ok: false, error: "no_occurrences" };
  }

  // Insert one-by-one so we can collect per-occurrence conflicts.
  // The gist EXCLUDE constraint will reject overlapping rows.
  let created = 0;
  const conflicts: Array<{ local_date: string; local_start_time: string }> = [];
  for (const occ of occurrences) {
    // Postgres can compute starts_at = '<date>T<time>' AT TIME ZONE 'Europe/Warsaw'
    // — we use a single round-trip with a tiny RPC-less expression: insert and let
    // the DB convert via timestamp + interval. Easiest path: pass an ISO timestamp
    // built in JS using Europe/Warsaw via Intl.
    const startsUtc = warsawWallClockToUtcIso(occ.local_date, occ.local_start_time);
    const endsUtc = new Date(
      new Date(startsUtc).getTime() + occ.duration_minutes * 60_000,
    ).toISOString();

    const { error } = await supabase.from("slots").insert({
      court_id: form.court_id,
      template_id: null,
      owner_id: userId,
      starts_at: startsUtc,
      ends_at: endsUtc,
      slot_type: form.slot_type,
      max_participants: form.max_participants,
      price_pln: form.price_pln,
      notes: form.notes,
      status: "open",
    } as never);
    if (error) {
      if (error.code === "23P01" || error.message.toLowerCase().includes("exclude")) {
        conflicts.push({
          local_date: occ.local_date,
          local_start_time: occ.local_start_time,
        });
      } else {
        return { ok: false, error: error.message };
      }
    } else {
      created++;
    }
  }

  revalidatePath("/coach/slots");
  return { ok: true, created, conflicts };
}

// =============================================================================
// Cancel a single slot. Bookings receive the cancellation cascade via UI.
// =============================================================================

export async function cancelSlot(
  slotId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(slotId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { error: slotErr } = await supabase
    .from("slots")
    .update({ status: "cancelled" } as never)
    .eq("id", slotId)
    .eq("owner_id", userId);
  if (slotErr) return { ok: false, error: slotErr.message };

  const { error: bkErr } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: "slot_cancelled" } as never)
    .eq("slot_id", slotId);
  if (bkErr) return { ok: false, error: bkErr.message };

  revalidatePath("/coach/slots");
  return { ok: true };
}

// =============================================================================
// Helper: convert a Europe/Warsaw wall-clock (date + time) into a UTC ISO string.
// Uses Intl.DateTimeFormat to learn the offset for that local instant.
// =============================================================================

function warsawWallClockToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);

  // 1. Tentative UTC instant assuming local==UTC.
  let utcGuess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);

  // 2. Find the actual offset Europe/Warsaw has at that instant and adjust.
  for (let i = 0; i < 3; i++) {
    const localStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcGuess));

    const get = (t: string) => Number(localStr.find((p) => p.type === t)?.value);
    const localY = get("year");
    const localM = get("month");
    const localD = get("day");
    const localH = get("hour") % 24;
    const localMin = get("minute");

    const localUtcEquivalent = Date.UTC(localY, localM - 1, localD, localH, localMin);
    const offset = localUtcEquivalent - utcGuess; // local - UTC
    const desiredLocal = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
    const newGuess = desiredLocal - offset;
    if (newGuess === utcGuess) break;
    utcGuess = newGuess;
  }
  return new Date(utcGuess).toISOString();
}
