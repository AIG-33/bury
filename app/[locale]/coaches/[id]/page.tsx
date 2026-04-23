import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Award, MapPin, Star, MessageCircle, CalendarClock } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadCoachProfile, loadCoachUpcomingSlots } from "../actions";
import { ReviewFormCard } from "./review-form-card";
import { CoachSlotsBookable } from "./coach-slots";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string; id: string }> };

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <header className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
          {coach.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coach.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Award className="h-7 w-7" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {coach.display_name ?? "—"}
            </h1>
            <HelpPanel
              pageId={`coach-detail-${coach.id}`}
              variant="inline"
              why={t("detail.help.why")}
              what={[
                t("detail.help.what.1"),
                t("detail.help.what.2"),
                t("detail.help.what.3"),
              ]}
              result={[t("detail.help.result.1"), t("detail.help.result.2")]}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-600">
            {coach.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {coach.city}
              </span>
            )}
            {coach.coach_avg_rating != null ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-ball-400 text-ball-500" />
                <span className="font-mono font-semibold">
                  {coach.coach_avg_rating.toFixed(2)}
                </span>
                <span className="text-xs">
                  {t("reviews_count", { count: coach.coach_reviews_count })}
                </span>
              </span>
            ) : (
              <span className="text-xs">{t("no_reviews_yet")}</span>
            )}
            {coach.coach_hourly_rate_pln != null && (
              <span className="text-xs">
                {t("hourly_rate", { amount: coach.coach_hourly_rate_pln })}
              </span>
            )}
          </div>
        </div>
      </header>

      {coach.coach_bio && (
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-semibold text-ink-900">
            {t("detail.about")}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
            {coach.coach_bio}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
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

      {/* Review form (only when viewer is eligible). */}
      {!coach.viewer_is_self && coach.my_eligibility && (
        <ReviewFormCard
          coachId={coach.id}
          eligibility={coach.my_eligibility}
        />
      )}
      {coach.viewer_is_self && (
        <p className="rounded-xl2 border border-ink-100 bg-white px-4 py-3 text-sm text-ink-500">
          {t("detail.self_view_hint")}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
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
              <li
                key={r.id}
                className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-ink-50 text-ink-600">
                    {r.reviewer_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.reviewer_avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
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
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
                    {r.text}
                  </p>
                )}
                {r.coach_reply && (
                  <div className="mt-3 rounded-lg border border-grass-100 bg-grass-50/60 p-3">
                    <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-grass-700">
                      <MessageCircle className="h-3 w-3" />
                      {t("detail.coach_reply")}
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink-700">
                      {r.coach_reply}
                    </p>
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
