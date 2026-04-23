import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  Star,
  Award,
  MapPin,
  ArrowRight,
  CalendarPlus,
  MessageSquarePlus,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import {
  loadCoaches,
  loadMyCoaches,
  loadVenueOptions,
  loadDistrictOptionsForCoaches,
} from "@/app/[locale]/coaches/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ venue?: string; district?: string }>;
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
  const districtId = sp.district ?? "";
  const hasFilter = Boolean(venueId || districtId);

  const [reviewable, allCoaches, venues, districts] = await Promise.all([
    loadMyCoaches(),
    loadCoaches({
      venueId: venueId || null,
      districtId: venueId ? null : districtId || null,
    }),
    loadVenueOptions(),
    loadDistrictOptionsForCoaches(),
  ]);
  const myEntries = reviewable ?? [];
  const reviewedCoachIds = new Set(myEntries.map((e) => e.coach.id));
  const otherCoaches = allCoaches.filter(
    (c) => !reviewedCoachIds.has(c.id) && c.id !== user.id,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">
            {t("title")}
          </h1>
          <HelpPanel
            pageId="me-coaches"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="mt-1 text-ink-600">{t("subtitle")}</p>
      </header>

      {myEntries.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("section_my")}
          </h2>
          <p className="text-sm text-ink-600">{t("section_my_hint")}</p>
          <ul className="space-y-3">
            {myEntries.map((entry) => {
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
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      {myReview ? t("update_review") : t("write_review")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("section_all")}
          </h2>
          <Link
            href="/coaches"
            className="text-xs font-medium text-grass-700 hover:text-grass-800"
          >
            {t("open_full_catalog")} →
          </Link>
        </div>
        <p className="text-sm text-ink-600">{t("section_all_hint")}</p>

        <form
          action={`/${locale}/me/coaches`}
          method="get"
          className="grid grid-cols-1 gap-2 rounded-xl2 border border-ink-100 bg-white p-3 shadow-card sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {tc("controls.venue")}
            </span>
            <select
              name="venue"
              defaultValue={venueId}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{tc("controls.any_venue")}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.district_name ? ` · ${v.district_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {tc("controls.district")}
            </span>
            <select
              name="district"
              defaultValue={districtId}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500 disabled:bg-ink-50 disabled:text-ink-400"
              disabled={Boolean(venueId)}
            >
              <option value="">{tc("controls.any_district")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city} · {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600"
            >
              {tc("controls.apply")}
            </button>
            {hasFilter && (
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/${locale}/me/coaches` as any}
                className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {tc("controls.reset")}
              </Link>
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
          <p className="rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-5 text-center text-sm text-ink-500">
            {hasFilter ? tc("empty_filter_body") : t("no_more_coaches")}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherCoaches.map((c) => (
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
                      <span className="text-xs text-ink-500">
                        {t("no_reviews_yet")}
                      </span>
                    )}
                  </div>

                  {c.coach_bio && (
                    <p className="mt-2 line-clamp-3 text-sm text-ink-600">
                      {c.coach_bio}
                    </p>
                  )}

                  {c.coach_hourly_rate_pln != null && (
                    <p className="mt-2 text-xs text-ink-500 tabular-nums">
                      {t("hourly_rate", {
                        amount: c.coach_hourly_rate_pln,
                      })}
                    </p>
                  )}
                </Link>

                <div className="mt-3 flex items-center justify-end">
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/coaches/${c.id}` as any}
                    className="inline-flex items-center gap-1 rounded-lg bg-grass-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-grass-600"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {t("see_slots")}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
