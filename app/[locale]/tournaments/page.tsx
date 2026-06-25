import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { Trophy, Calendar, Clock, Coins, MapPin, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { GuestNextStepBanner } from "@/components/landing/guest-next-step-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadPublicTournaments,
  loadVenueCities,
  type PublicTournamentRow,
  type PublicTournamentStatusFilter,
} from "./actions";
import type { Surface as CourtSurface, TournamentFormat } from "@/lib/tournaments/schema";

const TOURNAMENT_FORMATS: TournamentFormat[] = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "group_playoff",
  "swiss",
  "compass",
];
const SURFACES: CourtSurface[] = ["hard", "clay", "grass", "carpet"];

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
  return buildPageMetadata({
    locale,
    path: "/tournaments",
    title: t("title"),
    description: t("subtitle"),
  });
}

export default async function PublicTournamentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const filter: PublicTournamentStatusFilter = (
    ["all", "registration", "upcoming", "in_progress", "finished"] as const
  ).includes(sp.status as PublicTournamentStatusFilter)
    ? (sp.status as PublicTournamentStatusFilter)
    : "all";
  const format = TOURNAMENT_FORMATS.includes(sp.format as TournamentFormat)
    ? (sp.format as TournamentFormat)
    : null;
  const surface = SURFACES.includes(sp.surface as CourtSurface) ? (sp.surface as CourtSurface) : null;
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
    <div className="page-shell space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("tournaments"), path: "/tournaments" },
        ]}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="public-tournaments"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <GuestNextStepBanner isGuest={isGuest} current="tournaments" />

      {/* Filter tabs — preserve secondary filters in the URL */}
      <nav className="flex flex-wrap gap-2 border-b border-ink-100">
        {(["all", "registration", "upcoming", "in_progress", "finished"] as const).map((s) => {
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
                  ? "border-grass-700 text-grass-700"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t(`tabs.${s}`)}
            </Link>
          );
        })}
      </nav>

      {/* Filter row — URL-driven so SSR + shareable links work. */}
      <Surface variant="flat">
        <form
          action={`/${locale}/tournaments`}
          method="get"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="status" value={filter} />

          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <Button type="submit" variant="primary" size="sm">
              {t("filters.apply")}
            </Button>
            {hasFilter && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/${locale}/tournaments?status=${filter}`}>
                  {t("filters.reset")}
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Surface>

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
      ) : filter === "all" ? (
        <SectionedList tournaments={tournaments} locale={locale} t={t} fmtDate={fmtDate} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((tn) => (
            <TournamentCard key={tn.id} tn={tn} locale={locale} t={t} fmtDate={fmtDate} />
          ))}
        </ul>
      )}
    </div>
  );
}

// =============================================================================
// Sectioned list ("All" tab) — registration first, then upcoming, then finished.
// =============================================================================

function SectionedList({
  tournaments,
  locale,
  t,
  fmtDate,
}: {
  tournaments: PublicTournamentRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"tournamentsPublic">>>;
  fmtDate: Intl.DateTimeFormat;
}) {
  // Drafts are filtered out server-side (loadPublicTournaments) and never
  // reach the public catalogue.
  const registration = tournaments.filter((r) => r.status === "registration");
  const inProgress = tournaments.filter((r) => r.status === "in_progress");
  const finished = tournaments
    .filter((r) => r.status === "finished")
    .sort((a, b) => (a.starts_on > b.starts_on ? -1 : 1));

  return (
    <div className="space-y-8">
      <SectionedGroup
        title={t("sections.registration")}
        accent="grass"
        items={registration}
        locale={locale}
        t={t}
        fmtDate={fmtDate}
      />
      <SectionedGroup
        title={t("sections.upcoming")}
        accent="ball"
        items={inProgress}
        locale={locale}
        t={t}
        fmtDate={fmtDate}
      />
      <SectionedGroup
        title={t("sections.finished")}
        accent="ink"
        items={finished}
        locale={locale}
        t={t}
        fmtDate={fmtDate}
      />
    </div>
  );
}

function SectionedGroup({
  title,
  accent,
  items,
  locale,
  t,
  fmtDate,
}: {
  title: string;
  accent: "grass" | "ball" | "ink";
  items: PublicTournamentRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"tournamentsPublic">>>;
  fmtDate: Intl.DateTimeFormat;
}) {
  if (items.length === 0) return null;
  const dotCls =
    accent === "grass"
      ? "bg-grass-500"
      : accent === "ball"
        ? "bg-ball-500"
        : "bg-ink-300";
  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
        <h2 className="font-display text-lg font-bold text-grass-900">{title}</h2>
        <span className="text-xs tabular-nums text-ink-500">·&nbsp;{items.length}</span>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((tn) => (
          <TournamentCard key={tn.id} tn={tn} locale={locale} t={t} fmtDate={fmtDate} />
        ))}
      </ul>
    </section>
  );
}

function TournamentCard({
  tn,
  locale,
  t,
  fmtDate,
}: {
  tn: PublicTournamentRow;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"tournamentsPublic">>>;
  fmtDate: Intl.DateTimeFormat;
}) {
  return (
    <li className="surface-row lift-on-hover group hover:border-grass-300">
      <Link href={`/${locale}/tournaments/${tn.id}`} className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-grass-100 text-grass-700">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold text-ink-900 group-hover:text-grass-700">
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
                <MapPin className="h-3.5 w-3.5 text-grass-700" />
                {tn.venues.map((v) => (
                  <span key={v.id} className="rounded-full bg-grass-50 px-2 py-0.5 text-grass-700">
                    {v.name}
                    {v.city && <span className="text-ink-500">· {v.city}</span>}
                  </span>
                ))}
              </div>
            )}
            <div className="col-span-2 mt-1 inline-flex items-center gap-2">
              <span className="chip chip-grass text-[10px] font-medium uppercase">
                {t(`format.${tn.format}`)}
              </span>
              {tn.surface && (
                <span className="chip chip-clay text-[10px] font-medium uppercase">
                  {tn.surface}
                </span>
              )}
              <span className="chip chip-ink text-[10px] font-medium uppercase">
                {t(`status.${tn.status}`)}
              </span>
            </div>
          </dl>
        </div>
      </Link>
    </li>
  );
}
