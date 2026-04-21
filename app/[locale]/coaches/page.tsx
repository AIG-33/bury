import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Award, MapPin, Star } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadCoaches } from "./actions";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachesPublic");

  const coaches = await loadCoaches();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coaches-public"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {coaches.length === 0 ? (
        <EmptyState title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coaches.map((c) => (
            <li
              key={c.id}
              className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:shadow-ace"
            >
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/coaches/${c.id}` as any}
                className="block"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
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
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                  {c.coach_avg_rating != null ? (
                    <>
                      <Star className="h-4 w-4 fill-ball-400 text-ball-500" />
                      <span className="font-mono font-semibold">
                        {c.coach_avg_rating.toFixed(2)}
                      </span>
                      <span className="text-xs text-ink-500">
                        {t("reviews_count", { count: c.coach_reviews_count })}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-500">{t("no_reviews_yet")}</span>
                  )}
                </div>

                {c.coach_bio && (
                  <p className="mt-2 line-clamp-3 text-sm text-ink-600">{c.coach_bio}</p>
                )}

                {c.coach_hourly_rate_pln != null && (
                  <p className="mt-2 text-xs text-ink-500">
                    {t("hourly_rate", { amount: c.coach_hourly_rate_pln })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
