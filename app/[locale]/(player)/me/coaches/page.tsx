import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Star, Award, MapPin, ArrowRight, CalendarPlus, MessageSquarePlus } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Surface, SectionTitle } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { loadCoaches, loadMyCoaches, loadVenueOptions } from "@/app/[locale]/coaches/actions";
import { getCountryOptions, isValidCountryCode } from "@/lib/geo/countries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ venue?: string; country?: string }>;
};

export default async function MyCoachesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("myCoaches");
  const tc = await getTranslations("coachesPublic");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/me/coaches`);

  const venueId = sp.venue ?? "";
  const rawCountry = sp.country?.trim().toUpperCase() ?? "";
  const country = isValidCountryCode(rawCountry) ? rawCountry : "";
  const countryOptions = getCountryOptions(locale);
  const hasFilter = Boolean(venueId || country);

  const [reviewable, allCoaches, venues] = await Promise.all([
    loadMyCoaches(),
    loadCoaches({
      venueId: venueId || null,
      country: venueId ? null : country || null,
    }),
    loadVenueOptions(),
  ]);
  const myEntries = reviewable ?? [];
  const reviewedCoachIds = new Set(myEntries.map((e) => e.coach.id));
  const otherCoaches = allCoaches.filter((c) => !reviewedCoachIds.has(c.id) && c.id !== user.id);

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-coaches"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {myEntries.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>{t("section_my")}</SectionTitle>
          <p className="text-sm text-ink-600">{t("section_my_hint")}</p>
          <ul className="space-y-3">
            {myEntries.map((entry) => {
              const c = entry.coach;
              const myReview = entry.my_review;
              return (
                <Surface
                  as="li"
                  variant="row"
                  className="lift-on-hover"
                  key={`${c.id}-${entry.eligibility.source_type}-${entry.eligibility.source_id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
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
                        <p className="mt-2 text-xs text-ball-700">{t("not_reviewed_yet")}</p>
                      )}
                    </div>
                    <Button asChild variant="primary" size="sm">
                      <Link
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        href={`/coaches/${c.id}` as any}
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        {myReview ? t("update_review") : t("write_review")}
                      </Link>
                    </Button>
                  </div>
                </Surface>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle>{t("section_all")}</SectionTitle>
          <Link href="/coaches" className="text-xs font-medium text-grass-700 hover:text-grass-800">
            {t("open_full_catalog")} →
          </Link>
        </div>
        <p className="text-sm text-ink-600">{t("section_all_hint")}</p>

        <form action={`/${locale}/me/coaches`} method="get" className="surface-card-flat grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {tc("controls.venue")}
            </span>
            <select
              name="venue"
              defaultValue={venueId}
              className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{tc("controls.any_venue")}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.city ? ` · ${v.city}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {tc("controls.country")}
            </span>
            <select
              name="country"
              defaultValue={country}
              className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500 disabled:bg-ink-50 disabled:text-ink-400"
              disabled={Boolean(venueId)}
            >
              <option value="">{tc("controls.any_country")}</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" size="sm">
              {tc("controls.apply")}
            </Button>
            {hasFilter && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/me/coaches">
                  {tc("controls.reset")}
                </Link>
              </Button>
            )}
          </div>
        </form>

        {otherCoaches.length === 0 && myEntries.length === 0 && !hasFilter ? (
          <EmptyState
            title={t("empty_title")}
            description={t("empty_body")}
            ctaLabel={t("browse_coaches")}
            ctaHref={`/${locale}/coaches`}
          />
        ) : otherCoaches.length === 0 ? (
          <Surface variant="soft" className="py-5 text-center">
            <p className="text-sm text-ink-600">{hasFilter ? tc("empty_filter_body") : t("no_more_coaches")}</p>
          </Surface>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherCoaches.map((c) => (
              <Surface as="li" variant="card" className="lift-on-hover" key={c.id}>
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
                        <span className="font-mono font-semibold tabular-nums">
                          {c.coach_avg_rating.toFixed(2)}
                        </span>
                        <span className="text-xs text-ink-500">
                          {t("reviews_count", {
                            count: c.coach_reviews_count,
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-500">{t("no_reviews_yet")}</span>
                    )}
                  </div>

                  {c.coach_bio && (
                    <p className="mt-2 line-clamp-3 text-sm text-ink-600">{c.coach_bio}</p>
                  )}

                  {c.coach_hourly_rate_byn != null && (
                    <p className="mt-2 text-xs tabular-nums text-ink-500">
                      {t("hourly_rate", {
                        amount: c.coach_hourly_rate_byn,
                      })}
                    </p>
                  )}
                </Link>

                <div className="mt-3 flex items-center justify-end">
                  <Button asChild variant="primary" size="sm">
                    <Link
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      href={`/coaches/${c.id}` as any}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      {t("see_slots")}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </Surface>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
