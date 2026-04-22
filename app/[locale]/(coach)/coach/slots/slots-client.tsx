"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Banknote,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { cancelSlot, type CoachSlotRow, type CourtOption } from "./actions";
import { SlotFormDialog, type SlotDialogCopy } from "./slot-form-dialog";
import type { SlotType, IsoWeekday } from "@/lib/slots/schema";

export type SlotsListCopy = {
  empty_title: string;
  empty_description: string;
  empty_cta: string;
  add: string;
  cancel: string;
  cancel_confirm: string;
  cancelling: string;
  range_label: string;
  prev_week: string;
  next_week: string;
  today: string;
  slot_type_options: Record<SlotType, string>;
  status_options: Record<"open" | "closed" | "cancelled", string>;
  participants: string;
  free: string;
  full: string;
  no_courts_title: string;
  no_courts_description: string;
  no_courts_cta: string;
  weekday_short: Record<IsoWeekday, string>;
  dialog: SlotDialogCopy;
  locale: string;
};

export function SlotsClient({
  initialSlots,
  courts,
  copy,
}: {
  initialSlots: CoachSlotRow[];
  courts: CourtOption[];
  copy: SlotsListCopy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [_, startT] = useTransition();

  const grouped = useMemo(() => groupByDay(initialSlots, copy.locale), [initialSlots, copy.locale]);

  function onCancel(slot: CoachSlotRow) {
    if (!confirm(copy.cancel_confirm)) return;
    setBusyId(slot.id);
    startT(async () => {
      const r = await cancelSlot(slot.id);
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  if (courts.length === 0) {
    return (
      <EmptyState
        title={copy.no_courts_title}
        description={copy.no_courts_description}
        ctaLabel={copy.no_courts_cta}
        ctaHref={`/${copy.locale}/venues`}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
        >
          <Plus className="h-4 w-4" /> {copy.add}
        </button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title={copy.empty_title}
          description={copy.empty_description}
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
            >
              <Plus className="h-4 w-4" /> {copy.empty_cta}
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((day) => (
            <section key={day.dateLabel}>
              <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
                <Calendar className="h-4 w-4 text-grass-700" />
                {day.dateLabel}
              </h3>
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
                {day.slots.map((s) => (
                  <li
                    key={s.id}
                    className={
                      "flex flex-wrap items-center gap-3 px-4 py-3 text-sm " +
                      (s.status === "cancelled" ? "opacity-50" : "")
                    }
                  >
                    <span className="inline-flex h-9 min-w-[88px] items-center justify-center rounded-md bg-grass-50 px-2 font-mono font-semibold text-grass-800">
                      {formatTimeRange(s, copy.locale)}
                    </span>
                    <span className="text-ink-700">
                      {s.venue_name} · {s.court_label}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-700">
                      {copy.slot_type_options[s.slot_type]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                      <Users className="h-3 w-3" />
                      {s.bookings_count}/{s.max_participants}
                      <span className="ml-1 text-[10px] text-ink-400">
                        {s.bookings_count >= s.max_participants ? copy.full : copy.free}
                      </span>
                    </span>
                    {s.price_pln != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                        <Banknote className="h-3 w-3" />
                        {s.price_pln} PLN
                      </span>
                    )}
                    {s.notes && <span className="text-xs text-ink-500">«{s.notes}»</span>}
                    {s.status === "cancelled" ? (
                      <span className="ml-auto rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-clay-700">
                        {copy.status_options.cancelled}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCancel(s)}
                        disabled={busyId === s.id}
                        className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                      >
                        {busyId === s.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        {busyId === s.id ? copy.cancelling : copy.cancel}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <SlotFormDialog
        open={open}
        onClose={() => setOpen(false)}
        courts={courts}
        copy={copy.dialog}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByDay(slots: CoachSlotRow[], locale: string) {
  const map = new Map<string, CoachSlotRow[]>();
  for (const s of slots) {
    const dateKey = new Date(s.starts_at).toLocaleDateString("en-CA", {
      timeZone: "Europe/Warsaw",
    });
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(s);
  }
  return Array.from(map.entries()).map(([dateKey, slots]) => ({
    dateKey,
    dateLabel: new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Warsaw",
    }),
    slots,
  }));
}

function formatTimeRange(s: CoachSlotRow, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
    hour12: false,
  });
  return `${fmt.format(new Date(s.starts_at))}–${fmt.format(new Date(s.ends_at))}`;
}

// ─── Date-range nav (server-side via querystring) ─────────────────────────────

export function WeekNav({ fromIso, copy }: { fromIso: string; copy: SlotsListCopy }) {
  const from = new Date(fromIso);
  const prev = new Date(from.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const next = new Date(from.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <a
        href={`?from=${prev}`}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 font-medium text-ink-700 transition hover:bg-ink-50"
      >
        <ChevronLeft className="h-4 w-4" /> {copy.prev_week}
      </a>
      <a
        href={`?from=${todayIso}`}
        className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white px-3 font-medium text-ink-700 transition hover:bg-ink-50"
      >
        {copy.today}
      </a>
      <a
        href={`?from=${next}`}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 font-medium text-ink-700 transition hover:bg-ink-50"
      >
        {copy.next_week} <ChevronRight className="h-4 w-4" />
      </a>
    </div>
  );
}
