import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="admin-rating"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <RatingListClient initialConfigs={result.configs} />
    </div>
  );
}
