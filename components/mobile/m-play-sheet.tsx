"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/i18n/routing";
import { CalendarDays, ChevronRight, GraduationCap } from "lucide-react";
import { ScoreboardIcon, TennisBallIcon } from "./m-icons";

// =============================================================================
// Central «Играть» FAB of the tab bar (design «PlayTennis Navigation»):
// a raised lime circle over the bar; tap opens an action-sheet over a dimmed
// backdrop — two big scenario cards (Матч — accent gradient, Занятие — white)
// and secondary rows («записать счёт», «бронь корта») under an «ещё» divider.
// Rendered through a portal — the tab bar's backdrop-blur creates a containing
// block that would otherwise trap the fixed overlay.
// =============================================================================

export type MPlaySheetLabels = {
  open: string;
  title: string;
  subtitle: string;
  match_title: string;
  match_sub: string;
  lesson_title: string;
  lesson_sub: string;
  more_divider: string;
  record_score: string;
  book_court: string;
  cancel: string;
};

type Props = {
  /** Caption under the FAB («Играть»). */
  label: string;
  labels: MPlaySheetLabels;
  authed: boolean;
};

export function MPlayFab({ label, labels, authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close after in-app navigation (Link click keeps the component mounted).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const overlay = (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={labels.cancel}
        className="absolute inset-0 bg-grass-900/45"
        onClick={() => setOpen(false)}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[26px] bg-[#F6FAF1] px-[18px] pt-3"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          animation: "mPlaySheetUp 250ms cubic-bezier(.4,0,.2,1) both",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-100" aria-hidden />
        <h2 className="text-center font-display text-[21px] font-extrabold tracking-[-0.5px] text-grass-900">
          {labels.title}
        </h2>
        <p className="mt-1 text-center text-[12.5px] font-semibold text-ink-500">
          {labels.subtitle}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {/* Primary scenario — accent gradient card */}
          <Link
            href={"/m/game" as never}
            onClick={() => setOpen(false)}
            className="relative overflow-hidden rounded-[18px] p-4 text-white shadow-[0_14px_28px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
            style={{ background: "linear-gradient(135deg,#1C6B40,#2A9556)" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 60% at 90% 0%, rgba(195,232,79,0.3) 0%, transparent 70%)",
              }}
            />
            <span className="relative grid h-10 w-10 place-items-center rounded-[12px] bg-ball-500 text-grass-900">
              <TennisBallIcon className="h-[21px] w-[21px]" />
            </span>
            <span className="relative mt-5 block font-display text-[16px] font-extrabold leading-tight">
              {labels.match_title}
            </span>
            <span className="relative mt-1 block text-[11.5px] font-semibold leading-[1.35] text-white/75">
              {labels.match_sub}
            </span>
          </Link>

          {/* Secondary scenario — white card */}
          <Link
            href={"/m/coaches" as never}
            onClick={() => setOpen(false)}
            className="rounded-[18px] border border-[rgba(20,60,30,0.07)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-pt-icon text-grass-600">
              <GraduationCap className="h-[21px] w-[21px]" strokeWidth={1.8} />
            </span>
            <span className="mt-5 block font-display text-[16px] font-extrabold leading-tight text-ink-900">
              {labels.lesson_title}
            </span>
            <span className="mt-1 block text-[11.5px] font-semibold leading-[1.35] text-ink-500">
              {labels.lesson_sub}
            </span>
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-[rgba(20,60,30,0.08)]" />
          <span className="text-[10.5px] font-bold lowercase tracking-[0.5px] text-[#8AA093]">
            {labels.more_divider}
          </span>
          <span className="h-px flex-1 bg-[rgba(20,60,30,0.08)]" />
        </div>

        <div className="mt-3 space-y-2">
          <SheetRow
            href={authed ? "/m/record" : "/login"}
            label={labels.record_score}
            onNavigate={() => setOpen(false)}
          >
            <ScoreboardIcon className="h-[17px] w-[17px]" />
          </SheetRow>
          <SheetRow href="/venues" label={labels.book_court} onNavigate={() => setOpen(false)}>
            <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </SheetRow>
        </div>

        <button
          type="button"
          className="mt-2 flex h-12 w-full items-center justify-center font-display text-[14px] font-bold text-ink-500 transition-opacity active:opacity-85"
          onClick={() => setOpen(false)}
        >
          {labels.cancel}
        </button>
      </div>
      <style>{`@keyframes mPlaySheetUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label={labels.open}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="relative flex flex-1 flex-col items-center justify-end gap-[3px] pb-1 pt-0.5"
      >
        <span
          className="absolute -top-[30px] grid h-[54px] w-[54px] place-items-center rounded-full border-[3px] border-white text-grass-900 shadow-[0_10px_24px_rgba(163,203,56,0.55)] transition-transform active:scale-95"
          style={{ background: "linear-gradient(135deg,#D4F16C,#B7E23F)" }}
        >
          <TennisBallIcon className="h-[25px] w-[25px]" />
        </span>
        <span className="font-display text-[10px] font-bold leading-none text-grass-600">
          {label}
        </span>
        {/* Spacer keeps the caption aligned with the glow-dot slot of other tabs. */}
        <span className="h-[3px] w-[3px]" aria-hidden />
      </button>

      {open && mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}

function SheetRow({
  href,
  label,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.07)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
    >
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-pt-icon text-grass-600">
        {children}
      </span>
      <span className="flex-1 font-display text-[14px] font-bold text-ink-900">{label}</span>
      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#A7B5A9]" strokeWidth={2} />
    </Link>
  );
}
