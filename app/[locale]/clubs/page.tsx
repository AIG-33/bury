import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { ClubCard } from "@/components/clubs/club-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
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
  return buildPageMetadata({
    locale,
    path: "/clubs",
    title: t("title"),
    description: t("subtitle"),
  });
}

export default async function ClubsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("clubsCatalog");
  const tCommon = await getTranslations("clubsCommon");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

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
    <div className="page-shell-wide space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("clubs"), path: "/clubs" },
        ]}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="public-clubs"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href={`/${locale}/${isAuthenticated ? "me/clubs/owned" : "login"}`}>
              {isAuthenticated ? t("create_cta") : t("login_to_create")}
            </Link>
          </Button>
        }
      />

      <Surface variant="flat">
        <form
          action={`/${locale}/clubs`}
          method="get"
          className="grid gap-3 sm:grid-cols-3"
        >
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <Button type="submit" variant="primary" size="sm">
              {t("filters.apply")}
            </Button>
            {hasFilter && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/${locale}/clubs`}>
                  {t("filters.reset")}
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Surface>

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
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
