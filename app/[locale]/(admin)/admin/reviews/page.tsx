import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { HelpPanel } from "@/components/help/help-panel";
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="admin-reviews"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {rows!.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
        />
      ) : (
        <ReviewsModerationClient initialRows={rows!} initialFilter={filter} />
      )}
    </div>
  );
}
