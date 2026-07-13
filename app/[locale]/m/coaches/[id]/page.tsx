import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Star } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MAvatar, MContent, MEmptyState, MSegment, MStatTile } from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCoachProfile, loadCoachUpcomingSlots } from "@/app/[locale]/coaches/actions";
import { getMobilePlayLabels, getMobileTabLabels } from "../../tab-labels";
import { CoachBooking } from "./coach-booking";

// =============================================================================
// Screen «Карточка тренера · запись» (design «PlayTennis Screens», экран C).
// Dark header: ring avatar, name, star rating + review count, tag chips.
// Stats 3-in-row, segment Расписание / О тренере / Отзывы. The schedule tab
// shows time-slot chips (free / selected / taken) and the venue card; the
// bottom CTA bar collects the choice: time · price + «Записаться на занятие».
// =============================================================================

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ seg?: string }>;
};

export default async function MobileCoachCardPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const seg = sp.seg === "about" ? "about" : sp.seg === "reviews" ? "reviews" : "schedule";

  const [
    {
      data: { user },
    },
    coach,
    slots,
  ] = await Promise.all([
    supabase.auth.getUser(),
    loadCoachProfile(id),
    loadCoachUpcomingSlots(id),
  ]);

  if (!coach) notFound();

  const segHref = (next: string) => `/m/coaches/${id}${next === "schedule" ? "" : `?seg=${next}`}`;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---- Dark header ---- */}
      <header
        className="relative overflow-hidden text-white"
        style={{
          background: "linear-gradient(135deg,#12331F,#1C6B40 60%,#2A9556)",
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
          paddingTop: "max(env(safe-area-inset-top), 14px)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(42% 48% at 92% 4%, rgba(195,232,79,0.3) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[430px] px-[18px] pb-5 pt-2">
          <Link
            href={"/m/coaches" as never}
            aria-label={t("common.back")}
            className="glass-on-dark grid h-10 w-10 place-items-center rounded-[12px] transition-opacity active:opacity-85"
          >
            <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </Link>

          <div className="mt-3 flex items-center gap-4">
            <MAvatar name={coach.display_name} url={coach.avatar_url} size={72} ring />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[21px] font-extrabold leading-tight tracking-[-0.5px]">
                {coach.display_name ?? t("common.player_unknown")}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/80">
                {coach.coach_avg_rating != null ? (
                  <>
                    <Star
                      className="h-[13px] w-[13px] text-ball-500"
                      fill="#C3E84F"
                      strokeWidth={0}
                    />
                    <span className="font-mono font-bold tabular-nums text-white">
                      {coach.coach_avg_rating.toFixed(1)}
                    </span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                {t("coaches.reviews_count", { count: coach.coach_reviews_count })}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {coach.city ? (
              <span className="glass-on-dark inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white/85">
                {coach.city}
              </span>
            ) : null}
            {coach.coach_hourly_rate_byn != null ? (
              <span className="glass-on-dark inline-flex items-center rounded-full px-3 py-1.5 font-mono text-[11.5px] font-bold tabular-nums text-ball-300">
                {coach.coach_hourly_rate_byn} BYN/{t("coaches.per_hour")}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <MContent className="flex-1 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <MStatTile value={slots.length} label={t("coach.stat_slots")} />
          <MStatTile
            value={coach.coach_avg_rating != null ? coach.coach_avg_rating.toFixed(1) : "—"}
            label={t("coach.stat_rating")}
            accent
          />
          <MStatTile value={coach.coach_reviews_count} label={t("coach.stat_reviews")} />
        </div>

        <div className="mt-4">
          <MSegment
            items={[
              {
                label: t("coach.seg_schedule"),
                href: segHref("schedule"),
                active: seg === "schedule",
              },
              { label: t("coach.seg_about"), href: segHref("about"), active: seg === "about" },
              {
                label: t("coach.seg_reviews"),
                href: segHref("reviews"),
                active: seg === "reviews",
              },
            ]}
          />
        </div>

        <div className="mt-4">
          {seg === "schedule" ? (
            slots.length === 0 ? (
              <MEmptyState
                title={t("coach.empty_slots_title")}
                body={t("coach.empty_slots_body")}
              />
            ) : (
              <CoachBooking
                slots={slots}
                authed={!!user}
                fallbackPrice={coach.coach_hourly_rate_byn}
                locale={locale}
                labels={{
                  slots_eyebrow: t("coach.slots_eyebrow"),
                  venue_eyebrow: t("coach.venue_eyebrow"),
                  book_cta: t("coach.book_cta"),
                  login_cta: t("common.login"),
                  hour_short: t("coach.hour_short"),
                  error: t("common.error_generic"),
                  success_title: t("coach.success_title"),
                  success_body: t("coach.success_body"),
                }}
              />
            )
          ) : seg === "about" ? (
            coach.coach_bio ? (
              <div className="rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
                <p className="whitespace-pre-line text-[13.5px] leading-[1.5] text-ink-700">
                  {coach.coach_bio}
                </p>
              </div>
            ) : (
              <MEmptyState
                title={t("coach.empty_about_title")}
                body={t("coach.empty_about_body")}
              />
            )
          ) : coach.reviews.length === 0 ? (
            <MEmptyState
              title={t("coach.empty_reviews_title")}
              body={t("coach.empty_reviews_body")}
            />
          ) : (
            <ul className="space-y-[10px]">
              {coach.reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                >
                  <div className="flex items-center gap-2.5">
                    <MAvatar name={review.reviewer_name} url={review.reviewer_avatar} size={34} />
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-ink-900">
                      {review.reviewer_name ?? t("common.player_unknown")}
                    </p>
                    <span className="flex items-center gap-1 font-mono text-[12.5px] font-bold tabular-nums text-ink-900">
                      <Star
                        className="h-[12px] w-[12px] text-sun-600"
                        fill="#B7811F"
                        strokeWidth={0}
                      />
                      {review.stars}
                    </span>
                  </div>
                  {review.text ? (
                    <p className="mt-2 text-[12.5px] leading-[1.45] text-ink-700">{review.text}</p>
                  ) : null}
                  <p className="mt-2 text-[10.5px] font-semibold text-[#8AA093]">
                    {dateFmt.format(new Date(review.created_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </MContent>

      {seg !== "schedule" || slots.length === 0 ? (
        <MTabBar
          labels={getMobileTabLabels(t)}
          playLabels={getMobilePlayLabels(t)}
          authed={!!user}
        />
      ) : null}
    </div>
  );
}
