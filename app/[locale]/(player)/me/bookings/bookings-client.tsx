"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Users,
  Banknote,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageCircle,
  Inbox,
} from "lucide-react";
import {
  searchAvailableSlots,
  bookSlot,
  cancelMyBooking,
  type AvailableSlot,
  type MyBookingRow,
} from "./actions";
import { whatsappLink } from "@/lib/contact/whatsapp";
import type { SlotType } from "@/lib/slots/schema";

export type BookingsCopy = {
  search: {
    title: string;
    intro: string;
    from: string;
    to: string;
    district: string;
    any_district: string;
    submit: string;
    searching: string;
    empty_title: string;
    empty_description: string;
    no_results: string;
  };
  upcoming_title: string;
  past_title: string;
  no_upcoming: string;
  no_past: string;
  card: {
    book: string;
    booking: string;
    booked: string;
    cancel: string;
    cancelling: string;
    cancel_confirm: string;
    full: string;
    error: string;
    free_seats: string;
    contact_coach: string;
    no_whatsapp: string;
    notes_label: string;
    notes_placeholder: string;
    /** Template with `{name}` placeholder; replaced on the client. */
    whatsapp_prefill: string;
  };
  status_options: Record<MyBookingRow["status"], string>;
  paid_options: Record<MyBookingRow["paid_status"], string>;
  slot_type_options: Record<SlotType, string>;
  locale: string;
};

export function BookingsClient({
  copy,
  districts,
  upcoming,
  past,
}: {
  copy: BookingsCopy;
  districts: Array<{ id: string; name: string }>;
  upcoming: MyBookingRow[];
  past: MyBookingRow[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in14days = new Date(Date.now() + 14 * 86400_000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in14days);
  const [districtId, setDistrictId] = useState<string>("");
  const [results, setResults] = useState<AvailableSlot[] | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  function onSearch() {
    setSearchError(null);
    startSearch(async () => {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59`).toISOString();
      const r = await searchAvailableSlots({
        fromIso,
        toIso,
        districtId: districtId || null,
      });
      if (r.ok) setResults(r.slots);
      else setSearchError(r.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* My bookings */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {copy.upcoming_title}
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-5 text-center text-sm text-ink-500">
            {copy.no_upcoming}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} copy={copy} />
            ))}
          </ul>
        )}
      </section>

      {/* Search */}
      <section className="space-y-3 rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Search className="h-5 w-5 text-grass-700" />
            {copy.search.title}
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">{copy.search.intro}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              {copy.search.from}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              {copy.search.to}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              {copy.search.district}
            </label>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className={inputCls}
            >
              <option value="">{copy.search.any_district}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onSearch}
            disabled={isSearching}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {copy.search.searching}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> {copy.search.submit}
              </>
            )}
          </button>
        </div>

        {searchError && (
          <p className="inline-flex items-center gap-1 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
            <AlertCircle className="h-4 w-4" /> {searchError}
          </p>
        )}

        {results === null ? (
          <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-5 text-center text-sm text-ink-500">
            <Inbox className="mx-auto mb-1 h-5 w-5 text-ink-400" />
            {copy.search.empty_description}
          </div>
        ) : results.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-5 text-center text-sm text-ink-500">
            {copy.search.no_results}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {results.map((s) => (
              <SlotCard key={s.id} slot={s} copy={copy} onBooked={() => onSearch()} />
            ))}
          </ul>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {copy.past_title}
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {past.slice(0, 8).map((b) => (
              <BookingCard key={b.id} booking={b} copy={copy} archived />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  copy,
  onBooked,
}: {
  slot: AvailableSlot;
  copy: BookingsCopy;
  onBooked: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, startT] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errCode, setErrCode] = useState<string | null>(null);

  const seatsLeft = slot.max_participants - slot.bookings_count;

  function onConfirm() {
    setStatus("idle");
    setErrCode(null);
    startT(async () => {
      const r = await bookSlot({ slot_id: slot.id, notes });
      if (r.ok) {
        setStatus("ok");
        onBooked();
        router.refresh();
      } else {
        setStatus("error");
        setErrCode(r.error);
      }
    });
  }

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:shadow-pop">
      <SlotMeta slot={slot} copy={copy} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-grass-800">
          <Users className="h-3.5 w-3.5" />
          {seatsLeft} {copy.card.free_seats}
        </span>
        {status === "ok" ? (
          <span className="inline-flex items-center gap-1 text-sm text-grass-700">
            <CheckCircle2 className="h-4 w-4" /> {copy.card.booked}
          </span>
        ) : open ? (
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={copy.card.notes_placeholder}
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-ink-200 px-2 py-1 text-xs outline-none focus:border-grass-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 items-center rounded-md border border-ink-200 px-2 text-xs"
              >
                ×
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-grass-500 px-3 text-xs font-medium text-white transition hover:bg-grass-600 disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> {copy.card.booking}
                  </>
                ) : (
                  copy.card.book
                )}
              </button>
            </div>
            {status === "error" && errCode && (
              <p className="text-[11px] text-clay-700">
                {copy.card.error}: {errCode}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-grass-500 px-3 text-xs font-medium text-white shadow-card transition hover:bg-grass-600"
          >
            <Calendar className="h-3.5 w-3.5" /> {copy.card.book}
          </button>
        )}
      </div>
    </li>
  );
}

function BookingCard({
  booking,
  copy,
  archived = false,
}: {
  booking: MyBookingRow;
  copy: BookingsCopy;
  archived?: boolean;
}) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const slot = booking.slot;
  const wa = whatsappLink(
    slot.coach_whatsapp,
    copy.card.whatsapp_prefill.replace("{name}", slot.coach_name ?? ""),
  );

  function onCancel() {
    if (!confirm(copy.card.cancel_confirm)) return;
    startT(async () => {
      const r = await cancelMyBooking(booking.id);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  return (
    <li
      className={
        "rounded-xl2 border border-ink-100 bg-white p-4 shadow-card " +
        (archived ? "opacity-70" : "")
      }
    >
      <SlotMeta slot={slot} copy={copy} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={
            "rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider " +
            statusPillCls(booking.status)
          }
        >
          {copy.status_options[booking.status]}
        </span>
        <span className="text-ink-500">{copy.paid_options[booking.paid_status]}</span>
      </div>
      {!archived && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-50 px-2 text-xs font-medium text-grass-800 ring-1 ring-grass-200 transition hover:bg-grass-100"
            >
              <MessageCircle className="h-3 w-3" />
              {copy.card.contact_coach}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
              {copy.card.no_whatsapp}
            </span>
          )}
          {booking.status !== "cancelled" && (
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> {copy.card.cancelling}
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" /> {copy.card.cancel}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function SlotMeta({ slot, copy }: { slot: AvailableSlot; copy: BookingsCopy }) {
  const t = useTranslations("bookings");
  const dateLabel = useMemo(() => {
    return new Date(slot.starts_at).toLocaleDateString(copy.locale, {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Warsaw",
    });
  }, [slot.starts_at, copy.locale]);
  const timeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(copy.locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
      hour12: false,
    });
    return `${fmt.format(new Date(slot.starts_at))}–${fmt.format(new Date(slot.ends_at))}`;
  }, [slot.starts_at, slot.ends_at, copy.locale]);

  return (
    <div className="space-y-1">
      <p className="font-display text-base font-semibold text-ink-900">
        {slot.coach_name ?? t("unknown_coach")}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {dateLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {slot.venue_name}
          {slot.court_label ? ` · ${slot.court_label}` : ""}
          {slot.district_name ? ` · ${slot.district_name}` : ""}
        </span>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-700">
          {copy.slot_type_options[slot.slot_type]}
        </span>
        {slot.price_pln != null && (
          <span className="inline-flex items-center gap-1 text-grass-800">
            <Banknote className="h-3 w-3" />
            {slot.price_pln} PLN
          </span>
        )}
      </div>
      {slot.notes && <p className="text-xs text-ink-500">«{slot.notes}»</p>}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30";

function statusPillCls(s: MyBookingRow["status"]): string {
  switch (s) {
    case "confirmed":
      return "bg-grass-100 text-grass-800 ring-1 ring-grass-200";
    case "pending":
      return "bg-ball-100 text-ball-800 ring-1 ring-ball-200";
    case "attended":
      return "bg-ink-200 text-ink-800";
    case "no_show":
      return "bg-clay-100 text-clay-700 ring-1 ring-clay-200";
    case "cancelled":
      return "bg-ink-100 text-ink-500";
    default:
      return "bg-ink-100 text-ink-700";
  }
}
