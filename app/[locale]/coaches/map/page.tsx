import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Map as MapIcon, List } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadCoachMapPins } from "../actions";
import { CoachMap } from "@/components/map/coach-map";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachesMapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachesMap");

  const pins = await loadCoachMapPins();

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-3xl font-bold text-ink-900">
              {t("title")}
            </h1>
            <HelpPanel
              pageId="coaches-map"
              variant="inline"
              why={t("help.why")}
              what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
              result={[t("help.result.1"), t("help.result.2")]}
            />
          </div>
          <p className="mt-1 text-ink-600">
            {t("subtitle", { count: pins.length })}
          </p>
        </div>
        <Link
          href="/coaches"
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          <List className="h-4 w-4" />
          {t("switch_to_list")}
        </Link>
      </header>

      {pins.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
          <CoachMap
            locale={locale}
            pins={pins}
            labels={{
              reviews_count: t("reviews_count"),
              no_reviews: t("no_reviews"),
              hourly_rate: t("hourly_rate"),
              view_profile: t("view_profile"),
            }}
          />
          <div className="flex items-center justify-between border-t border-ink-100 bg-grass-50/40 px-4 py-2 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1">
              <MapIcon className="h-3.5 w-3.5" />
              {t("attribution")}
            </span>
            <Link
              href="/coaches"
              className="font-medium text-grass-700 hover:underline"
            >
              {t("switch_to_list")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
