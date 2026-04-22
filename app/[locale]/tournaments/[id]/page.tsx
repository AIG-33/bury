import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Coins, MapPin, Users, Trophy } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href={`/${locale}/tournaments`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-ink-900">{tournament.name}</h1>
        {tournament.description && <p className="text-ink-600">{tournament.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-leaf-50 px-2 py-0.5 font-medium uppercase text-leaf-700">
            {t(`format.${tournament.format}`)}
          </span>
          {tournament.surface && (
            <span className="rounded-full bg-clay-50 px-2 py-0.5 font-medium uppercase text-clay-700">
              {tournament.surface}
            </span>
          )}
          <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium uppercase text-ink-600">
            {t(`status.${tournament.status}`)}
          </span>
        </div>
      </header>

      <HelpPanel
        pageId="public-tournament-detail"
        why={t("detail.help.why")}
        what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
        result={[t("detail.help.result.1")]}
      />

      {/* Meta strip */}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-ink-100 bg-white p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.starts")}
          </dt>
          <dd className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink-900">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4 text-leaf-700" />
              {fmtDate.format(new Date(tournament.starts_on))}
            </span>
            {tournament.start_time && (
              <span className="inline-flex items-center gap-1 text-sm text-ink-700 tabular-nums">
                <Clock className="h-3.5 w-3.5 text-leaf-700" />
                {tournament.start_time.slice(0, 5)}
              </span>
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-ink-100 bg-white p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.participants")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
            <Users className="h-4 w-4 text-leaf-700" />
            {tournament.participants_count}
            {tournament.max_participants ? ` / ${tournament.max_participants}` : ""}
          </dd>
        </div>
        <div className="rounded-lg border border-ink-100 bg-white p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.entry_fee")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900 tabular-nums">
            <Coins className="h-4 w-4 text-leaf-700" />
            {tournament.entry_fee_pln == null || tournament.entry_fee_pln === 0
              ? t("entry_fee_free")
              : t("entry_fee_pln", { n: tournament.entry_fee_pln })}
          </dd>
        </div>
        <div className="rounded-lg border border-ink-100 bg-white p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {t("detail.coach")}
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
            <Trophy className="h-4 w-4 text-leaf-700" />
            {tournament.coach_name ?? "—"}
          </dd>
        </div>
        {tournament.venues.length > 0 && (
          <div className="rounded-lg border border-ink-100 bg-white p-3 sm:col-span-2">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
              {t("detail.venues")}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-900">
              {tournament.venues.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-xs text-leaf-700"
                >
                  <MapPin className="h-3 w-3" />
                  {v.name}
                  {v.city && <span className="text-ink-500">· {v.city}</span>}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* Participants */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
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
                  <span className="font-mono text-xs tabular-nums text-ink-500">
                    Elo {p.elo}
                  </span>
                </li>
              ))}
          </ol>
        )}
      </section>

      {/* Matches */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
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
                  <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-medium uppercase text-leaf-700">
                    R{m.round ?? "?"}
                  </span>
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
      </section>
    </div>
  );
}
