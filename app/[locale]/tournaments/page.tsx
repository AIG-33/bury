import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Trophy, Calendar, Clock, Coins, MapPin, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { GuestNextStepBanner } from "@/components/landing/guest-next-step-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPublicTournaments, loadVenueCities } from "./actions";
import type { Surface, TournamentFormat } from "@/lib/tournaments/schema";

const TOURNAMENT_FORMATS: TournamentFormat[] = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "group_playoff",
  "swiss",
  "compass",
];
const SURFACES: Surface[] = ["hard", "clay", "grass", "carpet"];

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    format?: string;
    surface?: string;
    fee?: string;
    city?: string;
  }>;
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
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");

  const filter = ["upcoming", "in_progress", "finished"].includes(sp.status ?? "")
    ? (sp.status as "upcoming" | "in_progress" | "finished")
    : "upcoming";
  const format = TOURNAMENT_FORMATS.includes(sp.format as TournamentFormat)
    ? (sp.format as TournamentFormat)
    : null;
  const surface = SURFACES.includes(sp.surface as Surface) ? (sp.surface as Surface) : null;
  const fee = sp.fee === "free" || sp.fee === "paid" ? sp.fee : null;
  const city = sp.city && sp.city.trim().length > 0 ? sp.city.trim() : null;

  const [tournaments, cities, sessionUser] = await Promise.all([
    loadPublicTournaments({ status: filter, format, surface, fee, city }),
    loadVenueCities(),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })(),
  ]);
  const isGuest = !sessionUser;
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const hasFilter = Boolean(format || surface || fee || city);

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

      <GuestNextStepBanner isGuest={isGuest} current="tournaments" />

      {/* Filter tabs — preserve secondary filters in the URL */}
      <nav className="flex gap-2 border-b border-ink-100">
        {(["upcoming", "in_progress", "finished"] as const).map((s) => {
          const params = new URLSearchParams();
          params.set("status", s);
          if (format) params.set("format", format);
          if (surface) params.set("surface", surface);
          if (fee) params.set("fee", fee);
          if (city) params.set("city", city);
          return (
            <Link
              key={s}
              href={`/${locale}/tournaments?${params.toString()}`}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                filter === s
                  ? "border-leaf-700 text-leaf-700"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t(`tabs.${s}`)}
            </Link>
          );
        })}
      </nav>

      {/* Filter row — URL-driven so SSR + shareable links work. */}
      <form
        action={`/${locale}/tournaments`}
        method="get"
        className="grid gap-3 rounded-xl2 border border-ink-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="status" value={filter} />

        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filters.city")}
          </span>
          <select
            name="city"
            defaultValue={city ?? ""}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          >
            <option value="">{t("filters.any_city")}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filters.format_label")}
          </span>
          <select
            name="format"
            defaultValue={format ?? ""}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          >
            <option value="">{t("filters.any_format")}</option>
            {TOURNAMENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`format.${f}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filters.surface")}
          </span>
          <select
            name="surface"
            defaultValue={surface ?? ""}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          >
            <option value="">{t("filters.any_surface")}</option>
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {t(`surfaces.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filters.fee")}
          </span>
          <select
            name="fee"
            defaultValue={fee ?? ""}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          >
            <option value="">{t("filters.fee_options.any")}</option>
            <option value="free">{t("filters.fee_options.free")}</option>
            <option value="paid">{t("filters.fee_options.paid")}</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          <span className="mr-auto text-xs tabular-nums text-ink-500">
            {t("filters.results_count", { count: tournaments.length })}
          </span>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
          >
            {t("filters.apply")}
          </button>
          {hasFilter && (
            <Link
              href={`/${locale}/tournaments?status=${filter}`}
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {t("filters.reset")}
            </Link>
          )}
        </div>
      </form>

      {tournaments.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title={t("filters.empty_filtered_title")}
            description={t("filters.empty_filtered_body")}
            ctaLabel={t("filters.reset")}
            ctaHref={`/${locale}/tournaments?status=${filter}`}
          />
        ) : (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.description")}
            ctaLabel={t("empty.cta")}
            ctaHref="/me/tournaments"
          />
        )
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
