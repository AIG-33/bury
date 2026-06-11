import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { loadAdminReviews } from "@/app/[locale]/coaches/actions";
import { ReviewsModerationClient } from "./reviews-client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminReviewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("adminReviews");

  const filter = sp.filter === "flagged" ? "flagged" : "all";
  const rows = await loadAdminReviews(filter);
  if (rows === null) redirect(`/${locale}/login?next=/admin/reviews`);

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="admin-reviews"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {rows!.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
          ctaLabel={t("empty_cta")}
          ctaHref={`/${locale}/coaches`}
        />
      ) : (
        <ReviewsModerationClient initialRows={rows!} initialFilter={filter} />
      )}
    </div>
  );
}
