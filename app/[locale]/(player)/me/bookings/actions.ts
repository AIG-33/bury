"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingFormSchema, type SlotType } from "@/lib/slots/schema";

// =============================================================================
// Types
// =============================================================================

export type AvailableSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  slot_type: SlotType;
  max_participants: number;
  bookings_count: number;
  price_pln: number | null;
  notes: string | null;
  court_label: string;
  venue_name: string;
  venue_id: string;
  district_id: string | null;
  district_name: string | null;
  city: string | null;
  coach_id: string;
  coach_name: string | null;
  coach_avatar: string | null;
  coach_whatsapp: string | null;
};

export type MyBookingRow = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "attended" | "no_show";
  paid_status: "unpaid" | "paid" | "comped";
  notes: string | null;
  created_at: string;
  slot: AvailableSlot;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

// =============================================================================
// Search available slots in a date window. Optional district filter.
// =============================================================================

export async function searchAvailableSlots(opts: {
  fromIso: string;
  toIso: string;
  districtId?: string | null;
}): Promise<{ ok: true; slots: AvailableSlot[] } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: rawSlots } = (await supabase
    .from("slots")
    .select(
      "id, starts_at, ends_at, slot_type, max_participants, price_pln, notes, court_id, owner_id",
    )
    .eq("status", "open")
    .gte("starts_at", opts.fromIso)
    .lte("starts_at", opts.toIso)
    .order("starts_at", { ascending: true })) as {
    data:
      | Array<{
          id: string;
          starts_at: string;
          ends_at: string;
          slot_type: SlotType;
          max_participants: number;
          price_pln: number | null;
          notes: string | null;
          court_id: string;
          owner_id: string;
        }>
      | null;
  };

  if (!rawSlots || rawSlots.length === 0) return { ok: true, slots: [] };

  const courtIds = Array.from(new Set(rawSlots.map((s) => s.court_id)));
  const ownerIds = Array.from(new Set(rawSlots.map((s) => s.owner_id)));
  const slotIds = rawSlots.map((s) => s.id);

  const [
    { data: courtsRaw },
    { data: profilesRaw },
    { data: bookingsRaw },
  ] = await Promise.all([
    supabase
      .from("courts")
      .select(
        "id, number, name, venue_id, venues!inner(id, name, city, district_id)",
      )
      .in("id", courtIds) as unknown as Promise<{
      data:
        | Array<{
            id: string;
            number: number;
            name: string | null;
            venue_id: string;
            venues:
              | {
                  id: string;
                  name: string;
                  city: string | null;
                  district_id: string | null;
                }
              | Array<{
                  id: string;
                  name: string;
                  city: string | null;
                  district_id: string | null;
                }>;
          }>
        | null;
    }>,
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, whatsapp")
      .in("id", ownerIds) as unknown as Promise<{
      data:
        | Array<{
            id: string;
            display_name: string | null;
            avatar_url: string | null;
            whatsapp: string | null;
          }>
        | null;
    }>,
    supabase
      .from("bookings")
      .select("slot_id, status")
      .in("slot_id", slotIds) as unknown as Promise<{
      data: Array<{ slot_id: string; status: string }> | null;
    }>,
  ]);

  const districtIds = Array.from(
    new Set(
      (courtsRaw ?? [])
        .map((c) => {
          const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
          return v?.district_id ?? null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const d of ds ?? []) districtMap.set(d.id, d.name);
  }

  const courtIndex = new Map<
    string,
    {
      label: string;
      venue_name: string;
      venue_id: string;
      city: string | null;
      district_id: string | null;
    }
  >();
  for (const c of courtsRaw ?? []) {
    const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
    if (!v) continue;
    courtIndex.set(c.id, {
      label: c.name ? `${c.name} (#${c.number})` : `Court #${c.number}`,
      venue_name: v.name,
      venue_id: v.id,
      city: v.city,
      district_id: v.district_id,
    });
  }

  const profileIndex = new Map(
    (profilesRaw ?? []).map((p) => [p.id, p] as const),
  );

  const counts = new Map<string, number>();
  for (const b of bookingsRaw ?? []) {
    if (b.status === "cancelled") continue;
    counts.set(b.slot_id, (counts.get(b.slot_id) ?? 0) + 1);
  }

  const slots: AvailableSlot[] = [];
  for (const s of rawSlots) {
    const c = courtIndex.get(s.court_id);
    if (!c) continue;
    if (opts.districtId && c.district_id !== opts.districtId) continue;
    const occupied = counts.get(s.id) ?? 0;
    if (occupied >= s.max_participants) continue;

    const owner = profileIndex.get(s.owner_id);
    slots.push({
      id: s.id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      slot_type: s.slot_type,
      max_participants: s.max_participants,
      bookings_count: occupied,
      price_pln: s.price_pln,
      notes: s.notes,
      court_label: c.label,
      venue_name: c.venue_name,
      venue_id: c.venue_id,
      city: c.city,
      district_id: c.district_id,
      district_name: c.district_id
        ? (districtMap.get(c.district_id) ?? null)
        : null,
      coach_id: s.owner_id,
      coach_name: owner?.display_name ?? null,
      coach_avatar: owner?.avatar_url ?? null,
      coach_whatsapp: owner?.whatsapp ?? null,
    });
  }

  return { ok: true, slots };
}

// =============================================================================
// Book a slot.
// =============================================================================

export type BookResult =
  | { ok: true; bookingId: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "slot_not_found"
        | "slot_full"
        | "slot_cancelled"
        | "already_booked"
        | "db_error";
      message?: string;
    };

export async function bookSlot(input: unknown): Promise<BookResult> {
  const parsed = BookingFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: slot } = (await supabase
    .from("slots")
    .select("id, status, max_participants, owner_id")
    .eq("id", parsed.data.slot_id)
    .single()) as {
    data:
      | {
          id: string;
          status: "open" | "closed" | "cancelled";
          max_participants: number;
          owner_id: string;
        }
      | null;
  };
  if (!slot) return { ok: false, error: "slot_not_found" };
  if (slot.status === "cancelled") return { ok: false, error: "slot_cancelled" };

  // Existing non-cancelled booking by this user?
  const { data: mine } = (await supabase
    .from("bookings")
    .select("id, status")
    .eq("slot_id", slot.id)
    .eq("player_id", userId)
    .neq("status", "cancelled")
    .maybeSingle()) as { data: { id: string; status: string } | null };
  if (mine) return { ok: false, error: "already_booked" };

  // Capacity check (note: race-prone; acceptable for MVP).
  const { data: bk } = (await supabase
    .from("bookings")
    .select("status")
    .eq("slot_id", slot.id)
    .neq("status", "cancelled")) as { data: Array<{ status: string }> | null };
  if ((bk?.length ?? 0) >= slot.max_participants) {
    return { ok: false, error: "slot_full" };
  }

  const { data, error } = (await supabase
    .from("bookings")
    .insert({
      slot_id: slot.id,
      player_id: userId,
      coach_id: slot.owner_id,
      status: "confirmed",
      paid_status: "unpaid",
      notes: parsed.data.notes,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: "db_error", message: error?.message };

  revalidatePath("/me/bookings");
  return { ok: true, bookingId: data.id };
}

// =============================================================================
// Cancel my own booking.
// =============================================================================

export async function cancelMyBooking(
  bookingId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancel_reason: reason?.trim() || "player_cancelled",
    } as never)
    .eq("id", bookingId)
    .eq("player_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/bookings");
  return { ok: true };
}

// =============================================================================
// Load my upcoming and past bookings.
// =============================================================================

export async function loadMyBookings(): Promise<
  | { ok: true; upcoming: MyBookingRow[]; past: MyBookingRow[] }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: rawBookings } = (await supabase
    .from("bookings")
    .select(
      "id, status, paid_status, notes, created_at, slot_id",
    )
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)) as {
    data:
      | Array<{
          id: string;
          status: MyBookingRow["status"];
          paid_status: MyBookingRow["paid_status"];
          notes: string | null;
          created_at: string;
          slot_id: string;
        }>
      | null;
  };
  if (!rawBookings || rawBookings.length === 0) {
    return { ok: true, upcoming: [], past: [] };
  }

  const slotIds = rawBookings.map((b) => b.slot_id);
  const { data: rawSlots } = (await supabase
    .from("slots")
    .select(
      "id, starts_at, ends_at, slot_type, max_participants, price_pln, notes, court_id, owner_id",
    )
    .in("id", slotIds)) as {
    data:
      | Array<{
          id: string;
          starts_at: string;
          ends_at: string;
          slot_type: SlotType;
          max_participants: number;
          price_pln: number | null;
          notes: string | null;
          court_id: string;
          owner_id: string;
        }>
      | null;
  };

  const courtIds = Array.from(new Set((rawSlots ?? []).map((s) => s.court_id)));
  const ownerIds = Array.from(new Set((rawSlots ?? []).map((s) => s.owner_id)));

  const { data: courtsRaw } = (await supabase
    .from("courts")
    .select(
      "id, number, name, venues!inner(id, name, city, district_id)",
    )
    .in("id", courtIds)) as {
    data:
      | Array<{
          id: string;
          number: number;
          name: string | null;
          venues:
            | { id: string; name: string; city: string | null; district_id: string | null }
            | Array<{
                id: string;
                name: string;
                city: string | null;
                district_id: string | null;
              }>;
        }>
      | null;
  };

  const { data: ownersRaw } = (await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, whatsapp")
    .in("id", ownerIds)) as {
    data:
      | Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          whatsapp: string | null;
        }>
      | null;
  };

  const districtIds = Array.from(
    new Set(
      (courtsRaw ?? [])
        .map((c) => {
          const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
          return v?.district_id ?? null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) districtMap.set(d.id, d.name);
  }

  // Capacity counts so the player sees how many seats are left.
  const { data: bkAll } = (await supabase
    .from("bookings")
    .select("slot_id, status")
    .in("slot_id", slotIds)) as {
    data: Array<{ slot_id: string; status: string }> | null;
  };
  const capacity = new Map<string, number>();
  for (const b of bkAll ?? []) {
    if (b.status === "cancelled") continue;
    capacity.set(b.slot_id, (capacity.get(b.slot_id) ?? 0) + 1);
  }

  const courtIndex = new Map<
    string,
    {
      label: string;
      venue_name: string;
      venue_id: string;
      city: string | null;
      district_id: string | null;
    }
  >();
  for (const c of courtsRaw ?? []) {
    const v = Array.isArray(c.venues) ? c.venues[0] : c.venues;
    if (!v) continue;
    courtIndex.set(c.id, {
      label: c.name ? `${c.name} (#${c.number})` : `Court #${c.number}`,
      venue_name: v.name,
      venue_id: v.id,
      city: v.city,
      district_id: v.district_id,
    });
  }

  const ownerIndex = new Map((ownersRaw ?? []).map((p) => [p.id, p] as const));
  const slotIndex = new Map((rawSlots ?? []).map((s) => [s.id, s] as const));

  const now = new Date();
  const upcoming: MyBookingRow[] = [];
  const past: MyBookingRow[] = [];

  for (const b of rawBookings) {
    const s = slotIndex.get(b.slot_id);
    if (!s) continue;
    const c = courtIndex.get(s.court_id);
    const owner = ownerIndex.get(s.owner_id);
    const slot: AvailableSlot = {
      id: s.id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      slot_type: s.slot_type,
      max_participants: s.max_participants,
      bookings_count: capacity.get(s.id) ?? 0,
      price_pln: s.price_pln,
      notes: s.notes,
      court_label: c?.label ?? "—",
      venue_name: c?.venue_name ?? "—",
      venue_id: c?.venue_id ?? "",
      city: c?.city ?? null,
      district_id: c?.district_id ?? null,
      district_name: c?.district_id
        ? (districtMap.get(c.district_id) ?? null)
        : null,
      coach_id: s.owner_id,
      coach_name: owner?.display_name ?? null,
      coach_avatar: owner?.avatar_url ?? null,
      coach_whatsapp: owner?.whatsapp ?? null,
    };
    const row: MyBookingRow = {
      id: b.id,
      status: b.status,
      paid_status: b.paid_status,
      notes: b.notes,
      created_at: b.created_at,
      slot,
    };
    if (new Date(s.ends_at) >= now && b.status !== "cancelled") {
      upcoming.push(row);
    } else {
      past.push(row);
    }
  }

  upcoming.sort((a, b) => +new Date(a.slot.starts_at) - +new Date(b.slot.starts_at));
  past.sort((a, b) => +new Date(b.slot.starts_at) - +new Date(a.slot.starts_at));

  return { ok: true, upcoming, past };
}

// =============================================================================
// Districts list (for the search filter).
// =============================================================================

export async function loadDistrictsForBooking(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("city", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  return (data ?? []).map((d) => ({ id: d.id, name: `${d.city} · ${d.name}` }));
}
