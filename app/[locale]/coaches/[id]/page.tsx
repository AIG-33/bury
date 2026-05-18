import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildCoachJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Award, MapPin, Star, MessageCircle, CalendarClock } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { loadCoachProfile, loadCoachUpcomingSlots } from "../actions";
import { ReviewFormCard } from "./review-form-card";
import { CoachSlotsBookable } from "./coach-slots";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const coach = await loadCoachProfile(id);
  if (!coach) return { title: "—", robots: { index: false } };
  const t = await getTranslations({ locale, namespace: "coachesPublic" });
  const name = coach.display_name ?? t("title");
  const description =
    coach.coach_bio?.slice(0, 160) ??
    (locale === "en"
      ? `Tennis coach in Belarus — book a session on PlayTennis.by`
      : `Тренер по теннису в Беларуси — запись на PlayTennis.by`);
  return buildPageMetadata({
    locale,
    path: `/coaches/${id}`,
    title: name,
    description,
  });
}

export default async function CoachProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachesPublic");

  const coach = await loadCoachProfile(id);
  if (!coach) notFound();

  const slots = await loadCoachUpcomingSlots(id);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jsonLd = buildCoachJsonLd({
    id,
    locale,
    name: coach.display_name ?? "—",
    bio: coach.coach_bio,
    image: coach.avatar_url,
    city: coach.city,
  });

  return (
    <div className="page-shell space-y-6">
      <JsonLdScript data={jsonLd} />
      {/* Hero: large portrait on the left spans PageHeader + bio on desktop.
          Without a bio it just spans the header. Mobile stacks naturally. */}
      <section className="grid gap-4 md:grid-cols-[minmax(240px,280px)_1fr] md:items-start">
        <div className="relative md:row-span-2 mx-auto w-full max-w-[420px] md:max-w-none aspect-square md:aspect-auto md:h-full md:min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-grass-100 via-ball-50 to-grass-50 ring-1 ring-grass-200/60 shadow-sm">
          {coach.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coach.avatar_url}
              alt={coach.display_name ?? ""}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              {coach.display_name ? (
                <span className="select-none font-display text-7xl font-bold tracking-tight text-grass-600/40">
                  {initialsOf(coach.display_name)}
                </span>
              ) : (
                <Award className="h-20 w-20 text-grass-400" />
              )}
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-grass-700/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm backdrop-blur">
            <Award className="h-3 w-3" />
            {t("title")}
          </div>
        </div>

        <div className="min-w-0">
          <PageHeader
            title={coach.display_name ?? "—"}
            subtitle={
              <span className="flex flex-wrap items-center gap-3">
                {coach.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {coach.city}
                  </span>
                )}
                {coach.coach_avg_rating != null ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-ball-400 text-ball-500" />
                    <span className="font-mono font-semibold">{coach.coach_avg_rating.toFixed(2)}</span>
                    <span className="text-xs">
                      {t("reviews_count", { count: coach.coach_reviews_count })}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs">{t("no_reviews_yet")}</span>
                )}
                {coach.coach_hourly_rate_byn != null && (
                  <span className="text-xs">
                    {t("hourly_rate", { amount: coach.coach_hourly_rate_byn })}
                  </span>
                )}
              </span>
            }
            help={
              <HelpPanel
                pageId={`coach-detail-${coach.id}`}
                variant="inline"
                why={t("detail.help.why")}
                what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
                result={[t("detail.help.result.1"), t("detail.help.result.2")]}
              />
            }
          />
        </div>

        {coach.coach_bio ? (
          <Surface variant="card" as="div">
            <h2 className="font-display text-base font-bold text-grass-900">{t("detail.about")}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{coach.coach_bio}</p>
          </Surface>
        ) : (
          <span aria-hidden className="hidden md:block" />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-grass-900">
            <CalendarClock className="h-5 w-5 text-grass-700" />
            {t("detail.slots.heading")}
          </h2>
          <p className="text-xs text-ink-500">{t("detail.slots.hint")}</p>
        </div>
        <CoachSlotsBookable
          coachId={coach.id}
          locale={locale}
          slots={slots}
          viewerSignedIn={Boolean(user)}
          viewerIsSelf={coach.viewer_is_self}
        />
      </section>

      {!coach.viewer_is_self && coach.my_eligibility && (
        <ReviewFormCard coachId={coach.id} eligibility={coach.my_eligibility} />
      )}
      {coach.viewer_is_self && (
        <Surface variant="flat" className="text-sm text-ink-500">
          {t("detail.self_view_hint")}
        </Surface>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-grass-900">
          {t("detail.reviews_heading", { count: coach.coach_reviews_count })}
        </h2>
        {coach.reviews.length === 0 ? (
          <EmptyState
            title={t("detail.empty_reviews_title")}
            description={t("detail.empty_reviews_body")}
          />
        ) : (
          <ul className="space-y-3">
            {coach.reviews.map((r) => (
              <li key={r.id} className="surface-row lift-on-hover">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-ink-50 text-ink-600">
                    {r.reviewer_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.reviewer_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold">
                        {(r.reviewer_name ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {r.reviewer_name ?? t("detail.anonymous")}
                    </p>
                    <p className="text-xs text-ink-500">
                      {new Date(r.created_at).toLocaleDateString(locale)}
                      {" · "}
                      {t(`detail.source.${r.source_type}`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={
                          i < r.stars
                            ? "h-4 w-4 fill-ball-400 text-ball-500"
                            : "h-4 w-4 text-ink-200"
                        }
                      />
                    ))}
                  </div>
                </div>
                {r.text && (
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{r.text}</p>
                )}
                {r.coach_reply && (
                  <div className="mt-3 rounded-lg border border-grass-100 bg-grass-50/60 p-3">
                    <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-grass-700">
                      <MessageCircle className="h-3 w-3" />
                      {t("detail.coach_reply")}
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink-700">{r.coach_reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
