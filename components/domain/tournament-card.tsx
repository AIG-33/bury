import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { initialsOf } from "@/lib/mobile/format";
import type { PublicTournamentRow } from "@/app/[locale]/tournaments/actions";
import type { TournamentStatus } from "@/lib/tournaments/schema";

/**
 * Public tournament card — immersive branded card (mirrors the mobile
 * catalogue card): full-width, tournament's own banner/gradient background,
 * dark scrim for legibility, logo tile, white text, chips for format /
 * surface / participants, entry fee. Finished tournaments are desaturated.
 * Server component — resolves its own `tournamentsPublic` labels.
 */

// Pills sit on a dark branded backdrop, so tones differ from
// TournamentStatusPill (which is designed for the light page background).
const PILL_CLASS: Record<TournamentStatus, string> = {
  draft: "bg-[#E9C258] text-[#3A2E10]",
  registration: "bg-grass-500 text-white",
  in_progress: "bg-ball-500 text-[#22380F]",
  finished: "bg-white/25 text-white",
  cancelled: "bg-clay-500 text-white",
};

const DOT_CLASS: Record<TournamentStatus, string> = {
  draft: "text-[#3A2E10]",
  registration: "text-ball-500",
  in_progress: "text-[#22380F]",
  finished: "text-white/80",
  cancelled: "text-white/85",
};

export async function TournamentCard({
  tn,
  locale,
}: {
  tn: PublicTournamentRow;
  locale: string;
}) {
  const t = await getTranslations("tournamentsPublic");

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Minsk",
  });
  // "1 авг. 2026 г." → "1 авг 2026" (same style as the mobile card).
  const dateLabel = [
    dateFmt
      .format(new Date(tn.starts_on))
      .replace(/\s*г\.$/u, "")
      .replace(/\./gu, ""),
    tn.start_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" · ");

  const venue = tn.venues[0];
  const placeLabel = venue
    ? [venue.name, venue.city].filter(Boolean).join(" · ") +
      (tn.venues.length > 1 ? ` +${tn.venues.length - 1}` : "")
    : null;

  const priceLabel =
    tn.entry_fee_byn == null || tn.entry_fee_byn === 0
      ? t("entry_fee_free")
      : t("entry_fee_byn", { n: tn.entry_fee_byn });

  const theme = buildRoomTheme(tn.branding);
  const accent = theme.accentColor;
  const backgroundStyle =
    Object.keys(theme.backgroundStyle).length > 0
      ? theme.backgroundStyle
      : { background: "linear-gradient(150deg,#12331F 0%,#1C6B40 55%,#2A9556 100%)" };

  const muted = tn.status === "finished" || tn.status === "cancelled";
  const pulse = tn.status === "registration" || tn.status === "in_progress";

  return (
    <li className="lift-on-hover animate-ptFade list-none">
      <Link
        href={`/${locale}/tournaments/${tn.id}`}
        className="relative flex h-full flex-col overflow-hidden rounded-xl2 text-white shadow-[0_10px_24px_rgba(18,51,31,0.18)]"
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

        <div className="relative flex h-full flex-col p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-[14px] border-2 bg-white/95 object-contain"
                style={{ borderColor: accent ?? "rgba(255,255,255,0.55)" }}
              />
            ) : (
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] border-2 border-white/55 font-display text-[18px] font-extrabold text-white"
                style={{ background: accent ?? "rgba(255,255,255,0.14)" }}
              >
                {initialsOf(tn.name)}
              </span>
            )}

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold leading-none ${PILL_CLASS[tn.status]}`}
            >
              {pulse && <span className={`pulse-dot ${DOT_CLASS[tn.status]}`} aria-hidden />}
              {t(`status.${tn.status}`)}
            </span>
          </div>

          <h3 className="mt-4 font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.3px] md:text-[21px]">
            {tn.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] font-semibold text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="tabular-nums">{dateLabel}</span>
            </span>
            {placeLabel && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{placeLabel}</span>
              </span>
            )}
          </div>

          <div className="mt-4 flex items-end justify-between gap-2 pt-1 md:mt-5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-black/30 px-2.5 py-1.5 text-[11px] font-bold leading-none text-white/90">
                {t(`format.${tn.format}`)}
              </span>
              {tn.surface && (
                <span className="rounded-full bg-black/30 px-2.5 py-1.5 text-[11px] font-bold leading-none text-white/90">
                  {t(`surfaces.${tn.surface}`)}
                </span>
              )}
              {tn.discipline === "doubles" && (
                <span className="rounded-full bg-black/30 px-2.5 py-1.5 text-[11px] font-bold leading-none text-white/90">
                  {t("detail.discipline_doubles")}
                </span>
              )}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2.5 py-1.5 text-[11px] font-bold tabular-nums leading-none text-white/90">
                <Users className="h-3 w-3" strokeWidth={2.2} />
                {tn.participants_count}
                {tn.max_participants ? ` / ${tn.max_participants}` : ""}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[16px] font-bold tabular-nums leading-none">
              {priceLabel}
            </span>
          </div>
        </div>
      </Link>
    </li>
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
