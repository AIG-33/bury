import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { ClubLogo } from "@/components/clubs/club-logo";
import { ClubRatingTable } from "@/components/clubs/club-rating-table";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { loadClubBySlug, loadClubRatingBoard } from "../../actions";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "clubRating" });
  const res = await loadClubBySlug(slug);
  if (!res.ok) return { title: t("title") };
  return buildPageMetadata({
    locale,
    path: `/clubs/${slug}/rating`,
    title: `${res.club.name} — ${t("title")}`,
    description: t("meta_description", { club: res.club.name }),
  });
}

export default async function ClubRatingPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("clubRating");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const res = await loadClubBySlug(slug);
  if (!res.ok) notFound();
  const { club } = res;
  const accent = club.brand_color ?? null;

  const board = await loadClubRatingBoard(club.id);

  const labels = {
    rank: t("table.rank"),
    player: t("table.player"),
    rating: t("table.rating"),
    matches: t("table.matches"),
    record: t("table.record"),
    provisional: t("table.provisional"),
  };

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("clubs"), path: "/clubs" },
          { name: club.name, path: `/clubs/${slug}` },
          { name: board.label || t("title"), path: `/clubs/${slug}/rating` },
        ]}
      />
      <Link
        href={`/${locale}/clubs/${slug}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {club.name}
      </Link>

      <Surface variant="card">
        {accent && (
          <div
            className="mb-4 -mt-1 h-1.5 w-16 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <div className="flex flex-wrap items-start gap-4">
          <ClubLogo url={club.logo_url} name={club.name} size="lg" />
          <div className="min-w-0 flex-1">
            <PageHeader
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6" style={accent ? { color: accent } : undefined} />
                  {board.label || t("title")}
                </span>
              }
              subtitle={t("subtitle", { club: club.name })}
              help={
                <HelpPanel
                  pageId="public-club-rating"
                  variant="inline"
                  why={t("help.why")}
                  what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
                  result={[t("help.result.1"), t("help.result.2")]}
                />
              }
            />
          </div>
        </div>
      </Surface>

      <Surface variant="card" as="section">
        {!board.enabled ? (
          <EmptyState title={t("title")} description={t("disabled")} />
        ) : board.standings.length === 0 ? (
          <EmptyState title={t("title")} description={t("empty")} />
        ) : (
          <ClubRatingTable
            rows={board.standings}
            locale={locale}
            labels={labels}
            brandColor={accent}
          />
        )}
      </Surface>
    </div>
  );
}
