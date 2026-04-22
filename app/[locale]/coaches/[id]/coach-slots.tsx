"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { bookSlot } from "@/app/[locale]/(player)/me/bookings/actions";
import type { CoachUpcomingSlot } from "../actions";
import { EmptyState } from "@/components/help/empty-state";

type Props = {
  coachId: string;
  locale: string;
  slots: CoachUpcomingSlot[];
  /** True when the viewer is signed in. Drives "log in to book" hint. */
  viewerSignedIn: boolean;
  /** True when the viewer is the coach themselves (hide booking CTA). */
  viewerIsSelf: boolean;
};

export function CoachSlotsBookable({
  coachId,
  locale,
  slots,
  viewerSignedIn,
  viewerIsSelf,
}: Props) {
  const t = useTranslations("coachesPublic.detail.slots");

  if (slots.length === 0) {
    return (
      <EmptyState title={t("empty_title")} description={t("empty_body")} />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {slots.map((s) => (
        <SlotCard
          key={s.id}
          slot={s}
          coachId={coachId}
          locale={locale}
          viewerSignedIn={viewerSignedIn}
          viewerIsSelf={viewerIsSelf}
        />
      ))}
    </ul>
  );
}

function SlotCard({
  slot,
  coachId,
  locale,
  viewerSignedIn,
  viewerIsSelf,
}: {
  slot: CoachUpcomingSlot;
  coachId: string;
  locale: string;
  viewerSignedIn: boolean;
  viewerIsSelf: boolean;
}) {
  const t = useTranslations("coachesPublic.detail.slots");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errCode, setErrCode] = useState<string | null>(null);

  const seatsLeft = slot.max_participants - slot.bookings_count;
  const isFull = seatsLeft <= 0;

  const dateLabel = useMemo(() => {
    const d = new Date(slot.starts_at);
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(d);
  }, [slot.starts_at, locale]);

  const timeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fmt.format(new Date(slot.starts_at))}–${fmt.format(new Date(slot.ends_at))}`;
  }, [slot.starts_at, slot.ends_at, locale]);

  function onBook() {
    setStatus("idle");
    setErrCode(null);
    startT(async () => {
      const r = await bookSlot({ slot_id: slot.id, notes: null });
      if (r.ok) {
        setStatus("ok");
        router.refresh();
      } else {
        setStatus("error");
        setErrCode(r.error);
      }
    });
  }

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-ink-700">
          <p className="inline-flex items-center gap-1 font-semibold text-ink-900">
            <Calendar className="h-4 w-4 text-grass-700" />
            <span className="tabular-nums">{dateLabel}</span>
            <Clock className="ml-2 h-4 w-4 text-grass-700" />
            <span className="tabular-nums">{timeLabel}</span>
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-ink-600">
            <MapPin className="h-3.5 w-3.5" />
            {slot.venue_name} · {slot.court_label}
            {slot.district_name ? ` · ${slot.district_name}` : ""}
          </p>
          <p className="inline-flex items-center gap-3 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {t(`slot_type.${slot.slot_type}`)}
            </span>
            {slot.price_pln != null && (
              <span className="inline-flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {t("price", { amount: slot.price_pln })}
                </span>
              </span>
            )}
          </p>
          {slot.notes && (
            <p className="mt-1 text-xs text-ink-500">{slot.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={
              "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
              (isFull
                ? "bg-clay-50 text-clay-700"
                : "bg-grass-100 text-grass-800")
            }
          >
            {isFull
              ? t("full")
              : t("seats_left", { count: seatsLeft })}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {status === "ok" || slot.i_booked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-grass-50 px-3 py-1.5 text-xs font-semibold text-grass-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> {t("booked")}
          </span>
        ) : viewerIsSelf ? (
          <span className="text-xs text-ink-500">{t("self_hint")}</span>
        ) : !viewerSignedIn ? (
          <a
            href={`/${locale}/login?next=/${locale}/coaches/${coachId}`}
            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 transition hover:bg-ink-50"
          >
            {t("login_to_book")}
          </a>
        ) : (
          <button
            type="button"
            onClick={onBook}
            disabled={pending || isFull}
            className="inline-flex items-center gap-1 rounded-lg bg-grass-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-grass-600 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("booking")}
              </>
            ) : (
              t("book")
            )}
          </button>
        )}
      </div>

      {status === "error" && errCode && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-clay-50 px-3 py-1.5 text-xs text-clay-800">
          <AlertCircle className="h-3.5 w-3.5" /> {t(`errors.${errCode}`)}
        </p>
      )}
    </li>
  );
}
