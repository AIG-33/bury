import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { loadRatingConfigs } from "./actions";
import { RatingListClient } from "./rating-list-client";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminRatingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminRating");

  const result = await loadRatingConfigs();
  if (!result.ok) {
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/admin/rating`);
    redirect(`/${locale}/admin`);
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Admin · Rating"
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="admin-rating"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <RatingListClient initialConfigs={result.configs} />
    </div>
  );
}
