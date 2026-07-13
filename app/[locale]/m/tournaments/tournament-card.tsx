import { CalendarDays, MapPin, Users } from "lucide-react";
import { Link } from "@/i18n/routing";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { initialsOf } from "@/lib/mobile/format";
import type { TournamentBranding } from "@/lib/validators/tournament-branding";

// =============================================================================
// Immersive tournament card («Tournaments List» mockup, июль 2026).
// Full-width card with the tournament's own branding: banner + scrim or
// background gradient, logo tile / initials, brand accent. White text over a
// dark backdrop; compact footer with format + participants chips and the
// entry fee. Finished tournaments are desaturated ("завершённые слегка
// приглушены" per the design notes).
// =============================================================================

export type CardPillTone = "registration" | "live" | "soon" | "finished" | "danger";

// Pills sit on a dark branded backdrop, so tones differ from MStatusPill
// (which is designed for the light page background).
const PILL_CLASS: Record<CardPillTone, string> = {
  registration: "bg-grass-500 text-white",
  live: "bg-ball-500 text-[#22380F]",
  soon: "bg-[#E9C258] text-[#3A2E10]",
  finished: "bg-white/25 text-white",
  danger: "bg-clay-500 text-white",
};

const DOT_CLASS: Record<CardPillTone, string> = {
  registration: "text-ball-500",
  live: "text-[#22380F]",
  soon: "text-[#3A2E10]",
  finished: "text-white/80",
  danger: "text-white/85",
};

export type TournamentCardProps = {
  href: string;
  name: string;
  branding: TournamentBranding;
  pill: { tone: CardPillTone; label: string; pulse?: boolean };
  /** "1 авг 2026 · 11:00" */
  dateLabel: string;
  /** "ГЦОР · Минск" (falls back handled by the page). */
  placeLabel: string;
  formatLabel: string;
  /** "3 / 16" — omitted when max is not set. */
  participantsLabel: string | null;
  /** "50 BYN" or the localized "Бесплатно". */
  priceLabel: string;
  /** Optional extra meta line («Мои»: next match / application context). */
  extraMeta?: string | null;
  /** Finished / cancelled / withdrawn — desaturate and dim. */
  muted?: boolean;
};

export function TournamentCard({
  href,
  name,
  branding,
  pill,
  dateLabel,
  placeLabel,
  formatLabel,
  participantsLabel,
  priceLabel,
  extraMeta = null,
  muted = false,
}: TournamentCardProps) {
  const theme = buildRoomTheme(branding);
  const accent = theme.accentColor;

  const backgroundStyle =
    Object.keys(theme.backgroundStyle).length > 0
      ? theme.backgroundStyle
      : { background: "linear-gradient(150deg,#12331F 0%,#1C6B40 55%,#2A9556 100%)" };

  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className="relative block overflow-hidden rounded-[20px] text-white shadow-[0_10px_24px_rgba(18,51,31,0.18)] transition-opacity active:opacity-90"
      style={{
        ...backgroundStyle,
        ...(muted ? { filter: "saturate(0.35)", opacity: 0.88 } : null),
      }}
    >
      {theme.bannerImageStyle ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: theme.bannerImageStyle }}
          />
          {/* Scrim from the left/bottom keeps white text legible over any banner. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(100deg, rgba(0,0,0,${theme.scrimOpacity}) 30%, rgba(0,0,0,${Math.max(
                0,
                theme.scrimOpacity - 0.3,
              )}) 100%), linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,0) 55%)`,
            }}
          />
        </>
      ) : (
        <CardCourtLines />
      )}

      <div className="relative p-[14px]">
        <div className="flex items-start justify-between gap-3">
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.logoUrl}
              alt=""
              className="h-[52px] w-[52px] shrink-0 rounded-[14px] border-2 bg-white/95 object-contain"
              style={{ borderColor: accent ?? "rgba(255,255,255,0.55)" }}
            />
          ) : (
            <span
              className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] border-2 border-white/55 font-display text-[17px] font-extrabold text-white"
              style={{ background: accent ?? "rgba(255,255,255,0.14)" }}
            >
              {initialsOf(name)}
            </span>
          )}

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-[10px] py-[5px] text-[10.5px] font-extrabold leading-none ${PILL_CLASS[pill.tone]}`}
          >
            {pill.pulse ? (
              <span className={`pulse-dot ${DOT_CLASS[pill.tone]}`} aria-hidden />
            ) : null}
            {pill.label}
          </span>
        </div>

        <h3 className="mt-3 font-display text-[17px] font-extrabold leading-[1.15] tracking-[-0.3px]">
          {name}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-white/85">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-[13px] w-[13px] shrink-0" strokeWidth={2} />
            {dateLabel}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-[13px] w-[13px] shrink-0" strokeWidth={2} />
            <span className="truncate">{placeLabel}</span>
          </span>
        </div>

        {extraMeta ? (
          <p className="mt-1 truncate text-[11.5px] font-semibold text-white/75">{extraMeta}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate rounded-full bg-black/30 px-[9px] py-[5px] text-[10.5px] font-bold leading-none text-white/90">
              {formatLabel}
            </span>
            {participantsLabel ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-[9px] py-[5px] text-[10.5px] font-bold tabular-nums leading-none text-white/90">
                <Users className="h-[11px] w-[11px]" strokeWidth={2.2} />
                {participantsLabel}
              </span>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-[15px] font-bold tabular-nums leading-none">
            {priceLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Faint court-line overlay for cards without an uploaded banner. */
function CardCourtLines() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.1]"
      viewBox="0 0 402 170"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.5"
    >
      <rect x="150" y="-30" width="300" height="200" />
      <line x1="150" y1="70" x2="450" y2="70" />
      <line x1="300" y1="-30" x2="300" y2="170" />
      <line x1="225" y1="-30" x2="225" y2="170" />
      <line x1="375" y1="-30" x2="375" y2="170" />
      <line x1="225" y1="130" x2="375" y2="130" />
    </svg>
  );
}
