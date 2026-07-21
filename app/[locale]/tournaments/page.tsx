import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { GuestNextStepBanner } from "@/components/landing/guest-next-step-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { TournamentCard } from "@/components/domain/tournament-card";
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

      {/* Filter tabs — pill segmented control (spec §4.2). Horizontal scroll
          on narrow screens so the row never wraps into overlap. */}
      <nav
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
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
              className={`inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-colors duration-200 ${
                filter === s
                  ? "bg-pt-primary text-white shadow-glow"
                  : "border border-[rgba(20,60,30,0.12)] bg-white text-[#3A5445] hover:border-grass-300 hover:text-grass-700"
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
        <SectionedList tournaments={tournaments} locale={locale} t={t} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tournaments.map((tn) => (
            <TournamentCard key={tn.id} tn={tn} locale={locale} />
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
}: {
  tournaments: PublicTournamentRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"tournamentsPublic">>>;
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
      />
      <SectionedGroup
        title={t("sections.upcoming")}
        accent="ball"
        items={inProgress}
        locale={locale}
      />
      <SectionedGroup
        title={t("sections.finished")}
        accent="ink"
        items={finished}
        locale={locale}
      />
    </div>
  );
}

function SectionedGroup({
  title,
  accent,
  items,
  locale,
}: {
  title: string;
  accent: "grass" | "ball" | "ink";
  items: PublicTournamentRow[];
  locale: string;
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
        <h2 className="section-title text-[18px] md:text-[20px]">{title}</h2>
        <span className="font-mono text-xs tabular-nums text-ink-400">·&nbsp;{items.length}</span>
      </header>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((tn) => (
          <TournamentCard key={tn.id} tn={tn} locale={locale} />
        ))}
      </ul>
    </section>
  );
}
