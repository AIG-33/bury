import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Star, Award, MapPin, ArrowRight } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyCoaches } from "@/app/[locale]/coaches/actions";

type Props = { params: Promise<{ locale: string }> };

export default async function MyCoachesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myCoaches");

  const entries = await loadMyCoaches();
  if (entries === null) redirect(`/${locale}/login?next=/me/coaches`);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="me-coaches"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {entries!.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
          ctaLabel={t("browse_coaches")}
          ctaHref={`/${locale}/coaches`}
        />
      ) : (
        <ul className="space-y-3">
          {entries!.map((entry) => {
            const c = entry.coach;
            const myReview = entry.my_review;
            return (
              <li
                key={`${c.id}-${entry.eligibility.source_type}-${entry.eligibility.source_id}`}
                className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Award className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-ink-900">
                      {c.display_name ?? "—"}
                    </p>
                    {c.city && (
                      <p className="inline-flex items-center gap-1 text-xs text-ink-500">
                        <MapPin className="h-3 w-3" />
                        {c.city}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-600">
                      {t(`source.${entry.eligibility.source_type}`)}
                    </p>

                    {myReview ? (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={
                                i < myReview.stars
                                  ? "h-3.5 w-3.5 fill-ball-400 text-ball-500"
                                  : "h-3.5 w-3.5 text-ink-200"
                              }
                            />
                          ))}
                        </span>
                        <span className="text-xs text-ink-500">
                          {t(`status.${myReview.status}`)}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-ball-700">
                        {t("not_reviewed_yet")}
                      </p>
                    )}
                  </div>
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/coaches/${c.id}` as any}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-grass-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-grass-600"
                  >
                    {myReview ? t("update_review") : t("write_review")}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
