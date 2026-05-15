import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Map as MapIcon, List } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { loadCoachMapPins } from "../actions";
import { CoachMap } from "@/components/map/coach-map";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachesMapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachesMap");

  const pins = await loadCoachMapPins();

  return (
    <div className="page-shell-wide space-y-5">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: pins.length })}
        help={
          <HelpPanel
            pageId="coaches-map"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/coaches">
              <List className="h-4 w-4" />
              {t("switch_to_list")}
            </Link>
          </Button>
        }
      />

      {pins.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
        />
      ) : (
        <Surface variant="card" className="overflow-hidden p-0 md:p-0">
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
        </Surface>
      )}
    </div>
  );
}
