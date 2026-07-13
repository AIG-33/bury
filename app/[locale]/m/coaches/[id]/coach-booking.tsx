"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { MapPin } from "lucide-react";
import type { CoachUpcomingSlot } from "@/app/[locale]/coaches/actions";
import { bookSlot } from "@/app/[locale]/(player)/me/bookings/actions";
import { MCtaBar, MEyebrow } from "@/components/mobile/m-ui";

// =============================================================================
// «Расписание» tab of the coach card: time slots as chips (free — white,
// selected — accent, already booked by me — struck-through), the venue card
// of the selected slot and a fixed CTA bar «time · price + Записаться»
// (design «PlayTennis Screens», экран C).
// =============================================================================

type Labels = {
  slots_eyebrow: string;
  venue_eyebrow: string;
  book_cta: string;
  login_cta: string;
  hour_short: string;
  error: string;
  success_title: string;
  success_body: string;
};

type Props = {
  slots: CoachUpcomingSlot[];
  authed: boolean;
  fallbackPrice: number | null;
  locale: string;
  labels: Labels;
};

export function CoachBooking({ slots, authed, fallbackPrice, locale, labels }: Props) {
  const firstFree = slots.find((s) => !s.i_booked && s.bookings_count < s.max_participants) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(firstFree?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = slots.find((s) => s.id === selectedId) ?? null;

  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Minsk",
      }),
    [locale],
  );
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Minsk",
      }),
    [locale],
  );

  // Group slots by (Minsk) day, preserving chronological order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const byDay = new Map<string, CoachUpcomingSlot[]>();
    for (const slot of slots) {
      const key = dayFmt.format(new Date(slot.starts_at));
      if (!byDay.has(key)) {
        order.push(key);
        byDay.set(key, []);
      }
      byDay.get(key)!.push(slot);
    }
    return order.map((key) => ({ day: key, items: byDay.get(key)! }));
  }, [slots, dayFmt]);

  const price = selected?.price_byn ?? fallbackPrice;

  const submit = () => {
    if (!selected) return;
    if (!authed) {
      router.push("/login" as never);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await bookSlot({ slot_id: selected.id });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(labels.error);
      }
    });
  };

  if (done) {
    return (
      <div className="rounded-[16px] border border-ball-600/40 bg-ball-100 p-5 text-center">
        <p className="font-display text-[15px] font-extrabold text-grass-800">
          {labels.success_title}
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.4] text-ink-700">{labels.success_body}</p>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <MEyebrow className="mb-2.5">{labels.slots_eyebrow}</MEyebrow>

      <div className="space-y-3.5">
        {groups.map((group) => (
          <div key={group.day}>
            <p className="mb-1.5 text-[11px] font-bold text-ink-500">{group.day}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((slot) => {
                const isSelected = slot.id === selectedId;
                const taken = slot.i_booked || slot.bookings_count >= slot.max_participants;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={taken}
                    onClick={() => setSelectedId(slot.id)}
                    className={[
                      "rounded-[13px] border px-4 py-2.5 font-mono text-[13.5px] font-bold tabular-nums transition-opacity active:opacity-85",
                      taken
                        ? "border-transparent bg-ink-50 text-[#A7B5A9] line-through"
                        : isSelected
                          ? "border-transparent bg-pt-primary text-white shadow-[0_8px_18px_rgba(28,122,70,0.32)]"
                          : "border-[rgba(20,60,30,0.1)] bg-white text-ink-900",
                    ].join(" ")}
                  >
                    {timeFmt.format(new Date(slot.starts_at))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <>
          <MEyebrow className="mb-2 mt-5">{labels.venue_eyebrow}</MEyebrow>
          <div className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-pt-icon text-grass-600">
              <MapPin className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-extrabold text-ink-900">
                {selected.venue_name} · {selected.court_label}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                {[selected.city, selected.district_name].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-[12px] bg-clay-100 px-3 py-2 text-[12px] font-bold text-clay-600">
          {error}
        </p>
      ) : null}

      <MCtaBar
        left={
          selected ? (
            <div>
              <p className="text-[10.5px] font-bold text-[#8AA093]">
                {timeFmt.format(new Date(selected.starts_at))} · 1 {labels.hour_short}
              </p>
              {price != null ? (
                <p className="font-mono text-[17px] font-bold tabular-nums leading-tight text-ink-900">
                  {price} BYN
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <button
          type="button"
          disabled={!selected || pending}
          onClick={submit}
          className="flex h-[50px] w-full items-center justify-center rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85 disabled:opacity-50"
        >
          {authed ? labels.book_cta : labels.login_cta}
        </button>
      </MCtaBar>
    </div>
  );
}
