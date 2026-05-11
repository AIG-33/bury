import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Trophy, Calendar, Clock, Coins, MapPin, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadPublicTournaments } from "./actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tournamentsPublic" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/tournaments`,
      languages: {
        ru: "/ru/tournaments",
        en: "/en/tournaments",
      },
    },
  };
}

export default async function PublicTournamentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status: rawStatus } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");

  const filter = ["upcoming", "in_progress", "finished"].includes(rawStatus ?? "")
    ? (rawStatus as "upcoming" | "in_progress" | "finished")
    : "upcoming";

  const tournaments = await loadPublicTournaments({ status: filter });
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="public-tournaments"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      {/* Filter tabs */}
      <nav className="flex gap-2 border-b border-ink-100">
        {(["upcoming", "in_progress", "finished"] as const).map((s) => (
          <Link
            key={s}
            href={`/${locale}/tournaments?status=${s}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              filter === s
                ? "border-leaf-700 text-leaf-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t(`tabs.${s}`)}
          </Link>
        ))}
      </nav>

      {tournaments.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          ctaLabel={t("empty.cta")}
          ctaHref="/me/tournaments"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((tn) => (
            <li
              key={tn.id}
              className="hover:border-leaf-300 group rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-md"
            >
              <Link href={`/${locale}/tournaments/${tn.id}`} className="flex items-start gap-3">
                <div className="bg-leaf-100 text-leaf-700 flex h-11 w-11 items-center justify-center rounded-full">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="group-hover:text-leaf-700 font-display text-lg font-semibold text-ink-900">
                    {tn.name}
                  </h3>
                  {tn.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-600">{tn.description}</p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmtDate.format(new Date(tn.starts_on))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {tn.participants_count}
                      {tn.max_participants ? ` / ${tn.max_participants}` : ""}
                    </div>
                    {tn.start_time && (
                      <div className="flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {tn.start_time.slice(0, 5)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 tabular-nums">
                      <Coins className="h-3.5 w-3.5" />
                      {tn.entry_fee_byn == null || tn.entry_fee_byn === 0
                        ? t("entry_fee_free")
                        : t("entry_fee_byn", { n: tn.entry_fee_byn })}
                    </div>
                    {tn.venues.length > 0 && (
                      <div className="col-span-2 inline-flex flex-wrap items-center gap-1 text-[11px] text-ink-600">
                        <MapPin className="text-leaf-700 h-3.5 w-3.5" />
                        {tn.venues.map((v) => (
                          <span
                            key={v.id}
                            className="bg-leaf-50 text-leaf-700 rounded-full px-2 py-0.5"
                          >
                            {v.name}
                            {v.city && <span className="text-ink-500">· {v.city}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="col-span-2 mt-1 inline-flex items-center gap-2">
                      <span className="bg-leaf-50 text-leaf-700 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
                        {t(`format.${tn.format}`)}
                      </span>
                      {tn.surface && (
                        <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[10px] font-medium uppercase text-clay-700">
                          {tn.surface}
                        </span>
                      )}
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-600">
                        {t(`status.${tn.status}`)}
                      </span>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
