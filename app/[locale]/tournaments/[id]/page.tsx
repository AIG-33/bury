import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Coins, MapPin, Users, Trophy } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { Chip } from "@/components/ui/surface";
import { loadPublicTournamentDetail } from "../actions";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const detail = await loadPublicTournamentDetail(id);
  if (!detail) return { title: "Tournament" };
  const description =
    detail.tournament.description ??
    `${detail.tournament.format} · ${detail.tournament.participants_count} participants`;
  return {
    title: detail.tournament.name,
    description,
    alternates: { canonical: `/${locale}/tournaments/${id}` },
    openGraph: {
      title: detail.tournament.name,
      description,
      type: "article",
    },
  };
}

export default async function PublicTournamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");

  const detail = await loadPublicTournamentDetail(id);
  if (!detail) notFound();

  const { tournament, participants, matches } = detail;
  const fmtDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
  });

  return (
    <div className="page-shell space-y-6">
      <Link
        href={`/${locale}/tournaments`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <PageHeader
        title={tournament.name}
        subtitle={tournament.description ?? undefined}
        help={
          <HelpPanel
            pageId="public-tournament-detail"
            variant="inline"
            why={t("detail.help.why")}
            what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
            result={[t("detail.help.result.1")]}
          />
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Chip tone="grass" className="font-medium uppercase">
          {t(`format.${tournament.format}`)}
        </Chip>
        {tournament.surface && (
          <Chip tone="clay" className="font-medium uppercase">
            {tournament.surface}
          </Chip>
        )}
        <Chip tone="ink" className="font-medium uppercase">
          {t(`status.${tournament.status}`)}
        </Chip>
      </div>

      {/* Meta strip */}
      <dl className="grid gap-4 sm:grid-cols-3">
        <Surface variant="row">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.starts")}
          </dt>
          <dd className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink-900">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4 text-grass-700" />
              {fmtDate.format(new Date(tournament.starts_on))}
            </span>
            {tournament.start_time && (
              <span className="inline-flex items-center gap-1 text-sm tabular-nums text-ink-700">
                <Clock className="h-3.5 w-3.5 text-grass-700" />
                {tournament.start_time.slice(0, 5)}
              </span>
            )}
          </dd>
        </Surface>
        <Surface variant="row">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.participants")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
            <Users className="h-4 w-4 text-grass-700" />
            {tournament.participants_count}
            {tournament.max_participants ? ` / ${tournament.max_participants}` : ""}
          </dd>
        </Surface>
        <Surface variant="row">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.entry_fee")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium tabular-nums text-ink-900">
            <Coins className="h-4 w-4 text-grass-700" />
            {tournament.entry_fee_byn == null || tournament.entry_fee_byn === 0
              ? t("entry_fee_free")
              : t("entry_fee_byn", { n: tournament.entry_fee_byn })}
          </dd>
        </Surface>
        <Surface variant="row">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.organizer")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
            <Trophy className="h-4 w-4 text-grass-700" />
            {tournament.organizer_name ?? "—"}
          </dd>
        </Surface>
        {tournament.venues.length > 0 && (
          <Surface variant="row" className="sm:col-span-2">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
              {t("detail.venues")}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-900">
              {tournament.venues.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-0.5 text-xs text-grass-700"
                >
                  <MapPin className="h-3 w-3" />
                  {v.name}
                  {v.city && <span className="text-ink-500">· {v.city}</span>}
                </span>
              ))}
            </dd>
          </Surface>
        )}
      </dl>

      {/* Participants */}
      <Surface variant="card" as="section">
        <h2 className="mb-3 font-display text-lg font-bold text-grass-900">
          {t("detail.participants_title")}
        </h2>
        {participants.length === 0 ? (
          <p className="text-sm text-ink-500">{t("detail.participants_empty")}</p>
        ) : (
          <ol className="grid gap-1 sm:grid-cols-2">
            {participants
              .filter((p) => !p.withdrawn)
              .map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm odd:bg-ink-50/50"
                >
                  <span className="text-ink-700">
                    <span className="mr-2 font-mono text-xs tabular-nums text-ink-400">
                      {p.seed ?? i + 1}.
                    </span>
                    {p.name ?? "?"}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-500">Elo {p.elo}</span>
                </li>
              ))}
          </ol>
        )}
      </Surface>

      {/* Matches */}
      <Surface variant="card" as="section">
        <h2 className="mb-3 font-display text-lg font-bold text-grass-900">
          {t("detail.matches_title")}
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-ink-500">{t("detail.matches_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const winnerLabel =
                m.winner_id === m.p1_id ? "p1" : m.winner_id === m.p2_id ? "p2" : null;
              const score =
                m.sets && m.sets.length > 0
                  ? m.sets.map((s) => `${s.p1}-${s.p2}`).join(" · ")
                  : m.outcome === "scheduled"
                    ? t("detail.scheduled")
                    : "—";
              return (
                <li
                  key={m.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-ink-100 px-3 py-2 text-sm"
                >
                  <Chip tone="grass" className="text-[10px] font-medium uppercase">
                    R{m.round ?? "?"}
                  </Chip>
                  <div className="min-w-0">
                    <div
                      className={`truncate ${winnerLabel === "p1" ? "font-semibold text-ink-900" : "text-ink-700"}`}
                    >
                      {m.p1_name ?? "—"}
                    </div>
                    <div
                      className={`truncate ${winnerLabel === "p2" ? "font-semibold text-ink-900" : "text-ink-700"}`}
                    >
                      {m.p2_name ?? "—"}
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-ink-700">{score}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </div>
  );
}
