import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Trophy, Calendar, Clock, Coins, MapPin, Users } from "lucide-react";
import { TournamentStatusPill } from "./tournament-status-pill";
import type { PublicTournamentRow } from "@/app/[locale]/tournaments/actions";

/**
 * Public tournament card (redesign spec §2.3 / §4.2): white card, radius 20px,
 * lime-gradient icon preview, pill tags, icon meta rows, hover lift.
 * Server component — resolves its own `tournamentsPublic` labels.
 */
export async function TournamentCard({
  tn,
  locale,
}: {
  tn: PublicTournamentRow;
  locale: string;
}) {
  const t = await getTranslations("tournamentsPublic");
  const fmtDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <li className="lift-on-hover animate-ptFade list-none rounded-xl2 border border-[rgba(20,60,30,0.07)] bg-white shadow-card">
      <Link
        href={`/${locale}/tournaments/${tn.id}`}
        className="flex h-full flex-col gap-3 p-4 md:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="icon-preview">
            <Trophy className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[16px] font-extrabold leading-snug text-ink-900 md:text-[17px]">
              {tn.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="chip chip-grass uppercase">{t(`format.${tn.format}`)}</span>
              {tn.surface && (
                <span className="chip chip-clay uppercase">{t(`surfaces.${tn.surface}`)}</span>
              )}
            </div>
          </div>
          <TournamentStatusPill status={tn.status} label={t(`status.${tn.status}`)} />
        </div>

        {tn.description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-500">
            {tn.description}
          </p>
        )}

        <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-grass-600" />
            <span className="font-mono font-medium text-ink-700 tabular-nums">
              {fmtDate.format(new Date(tn.starts_on))}
            </span>
            {tn.start_time && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="h-3 w-3" />
                {tn.start_time.slice(0, 5)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-grass-600" />
            <span className="font-mono font-medium text-ink-700 tabular-nums">
              {tn.participants_count}
              {tn.max_participants ? ` / ${tn.max_participants}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-grass-600" />
            <span className="font-mono font-medium text-ink-700 tabular-nums">
              {tn.entry_fee_byn == null || tn.entry_fee_byn === 0
                ? t("entry_fee_free")
                : t("entry_fee_byn", { n: tn.entry_fee_byn })}
            </span>
          </div>
          {tn.venues.length > 0 && (
            <div className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-grass-600" />
              <span className="truncate">
                {tn.venues[0].name}
                {tn.venues[0].city ? ` · ${tn.venues[0].city}` : ""}
                {tn.venues.length > 1 ? ` +${tn.venues.length - 1}` : ""}
              </span>
            </div>
          )}
        </dl>
      </Link>
    </li>
  );
}
