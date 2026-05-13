import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { ClubCard } from "@/components/clubs/club-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JoinPolicy } from "@/lib/clubs/schema";
import {
  loadClubs,
  loadCityOptionsForClubs,
  loadDistrictOptionsForClubs,
} from "./actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ city?: string; district?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clubsCatalog" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/clubs`,
      languages: { ru: "/ru/clubs", en: "/en/clubs" },
    },
  };
}

export default async function ClubsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("clubsCatalog");
  const tCommon = await getTranslations("clubsCommon");

  const city = sp.city && sp.city.trim().length > 0 ? sp.city.trim() : null;
  const districtId =
    sp.district && sp.district.trim().length > 0 ? sp.district.trim() : null;

  const [clubs, cities, districts, sessionUser] = await Promise.all([
    loadClubs({ city, districtId }),
    loadCityOptionsForClubs(),
    loadDistrictOptionsForClubs(),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })(),
  ]);
  const isAuthenticated = !!sessionUser;
  const hasFilter = Boolean(city || districtId);

  const joinPolicyLabels: Record<JoinPolicy, string> = {
    approval: tCommon("join_policy.approval"),
    open: tCommon("join_policy.open"),
    closed: tCommon("join_policy.closed"),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
            <HelpPanel
              pageId="public-clubs"
              variant="inline"
              why={t("help.why")}
              what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
              result={[t("help.result.1"), t("help.result.2")]}
            />
          </div>
          <p className="max-w-2xl text-ink-600">{t("subtitle")}</p>
        </div>
        <Link
          href={`/${locale}/${isAuthenticated ? "me/clubs/owned" : "login"}`}
          className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
        >
          {isAuthenticated ? t("create_cta") : t("login_to_create")}
        </Link>
      </header>

      <form
        action={`/${locale}/clubs`}
        method="get"
        className="grid gap-3 rounded-xl2 border border-ink-100 bg-white p-4 shadow-card sm:grid-cols-3"
      >
        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filters.city_label")}
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
            {t("filters.district_label")}
          </span>
          <select
            name="district"
            defaultValue={districtId ?? ""}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          >
            <option value="">{t("filters.any_district")}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.city})
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
          >
            {t("filters.apply")}
          </button>
          {hasFilter && (
            <Link
              href={`/${locale}/clubs`}
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {t("filters.reset")}
            </Link>
          )}
        </div>
      </form>

      {clubs.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title={t("empty_filter.title")}
            description={t("empty_filter.body")}
            ctaLabel={t("empty_filter.cta")}
            ctaHref={`/${locale}/clubs`}
          />
        ) : (
          <EmptyState
            title={t("empty.title")}
            description={t("empty.body")}
            ctaLabel={isAuthenticated ? t("empty.cta") : t("login_to_create")}
            ctaHref={`/${locale}/${isAuthenticated ? "me/clubs/owned" : "login"}`}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              labels={{
                members_count: (n: number) => t("members_count", { n }),
                coaches_count: (n: number) => t("coaches_count", { n }),
                top5_avg_elo: t("top5_avg_elo"),
                no_elo_yet: t("no_elo_yet"),
                join_policy: joinPolicyLabels,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
