import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Star } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MAvatar, MContent, MEmptyState, MSegment, MSubHeader } from "@/components/mobile/m-ui";
import { MSearchTool } from "@/components/mobile/m-header-tools";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCoaches, type CoachListItem } from "@/app/[locale]/coaches/actions";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen «Тренеры · список» (design «PlayTennis Screens», экран B).
// Sticky header with back (opened from «Ещё» or the «Играть» sheet) + search;
// segment Все / Рядом / Топ. A coach is one row: avatar, name, specialisation
// line, star rating + review count — price per hour and «Записаться» on the
// right, so the choice happens without opening the card.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ seg?: string; q?: string }>;
};

export default async function MobileCoachesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const seg = sp.seg === "near" ? "near" : sp.seg === "top" ? "top" : "all";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [coaches, myCity] = await Promise.all([
    loadCoaches({}),
    (async () => {
      if (!user) return null;
      const { data } = (await supabase
        .from("profiles")
        .select("city")
        .eq("id", user.id)
        .maybeSingle()) as { data: { city: string | null } | null };
      return data?.city ?? null;
    })(),
  ]);

  const q = sp.q?.trim().toLowerCase() ?? "";
  let visible = coaches;
  if (seg === "near") {
    visible = myCity
      ? coaches.filter((c) => c.city && c.city.toLowerCase() === myCity.toLowerCase())
      : [];
  }
  if (seg === "top") {
    visible = coaches.filter((c) => c.coach_avg_rating != null).slice(0, 10);
  }
  if (q) visible = visible.filter((c) => (c.display_name ?? "").toLowerCase().includes(q));

  const segHref = (next: string) => {
    const params = new URLSearchParams();
    if (next !== "all") params.set("seg", next);
    if (sp.q) params.set("q", sp.q);
    const qs = params.toString();
    return `/m/coaches${qs ? `?${qs}` : ""}`;
  };

  const emptyProps =
    seg === "near" && !user
      ? {
          title: t("common.login_required_title"),
          body: t("common.login_required_body"),
          cta: t("common.login"),
          href: "/login",
        }
      : seg === "near"
        ? {
            title: t("coaches.empty_near_title"),
            body: t("coaches.empty_near_body"),
            cta: t("coaches.seg_all"),
            href: "/m/coaches",
          }
        : { title: t("coaches.empty_title"), body: t("coaches.empty_body") };

  return (
    <div className="flex min-h-dvh flex-col">
      <MSubHeader
        title={t("coaches.title")}
        backHref="/m/more"
        backLabel={t("common.back")}
        actions={
          <MSearchTool
            placeholder={t("coaches.search_placeholder")}
            ariaLabel={t("common.search")}
          />
        }
      >
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("coaches.seg_all"), href: segHref("all"), active: seg === "all" },
              { label: t("coaches.seg_near"), href: segHref("near"), active: seg === "near" },
              { label: t("coaches.seg_top"), href: segHref("top"), active: seg === "top" },
            ]}
          />
        </div>
      </MSubHeader>

      <MContent className="flex-1 pt-4">
        {visible.length === 0 ? (
          <MEmptyState {...emptyProps} />
        ) : (
          <ul className="space-y-[10px]">
            {visible.map((coach) => (
              <li key={coach.id}>
                <CoachRow coach={coach} t={t} />
              </li>
            ))}
          </ul>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}

/** One-line specialisation: the first sentence of the bio, clamped. */
function specialityOf(coach: CoachListItem): string | null {
  const bio = coach.coach_bio?.trim();
  if (!bio) return coach.city;
  const firstSentence = bio.split(/[.!\n]/)[0]?.trim() ?? "";
  if (!firstSentence) return coach.city;
  return firstSentence.length > 40 ? `${firstSentence.slice(0, 39)}…` : firstSentence;
}

function CoachRow({
  coach,
  t,
}: {
  coach: CoachListItem;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  return (
    <Link
      href={`/m/coaches/${coach.id}` as never}
      className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[13px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
    >
      <MAvatar name={coach.display_name} url={coach.avatar_url} size={52} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold leading-tight text-ink-900">
          {coach.display_name ?? t("common.player_unknown")}
        </p>
        {specialityOf(coach) ? (
          <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
            {specialityOf(coach)}
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-ink-500">
          {coach.coach_avg_rating != null ? (
            <>
              <Star className="h-[12px] w-[12px] text-sun-600" fill="#B7811F" strokeWidth={0} />
              <span className="font-mono font-bold tabular-nums text-ink-900">
                {coach.coach_avg_rating.toFixed(1)}
              </span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          {t("coaches.reviews_count", { count: coach.coach_reviews_count })}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {coach.coach_hourly_rate_byn != null ? (
          <span className="font-mono text-[14px] font-bold tabular-nums text-ink-900">
            {coach.coach_hourly_rate_byn}
            <span className="text-[10.5px] font-semibold text-ink-500">
              {" "}
              BYN/{t("coaches.per_hour")}
            </span>
          </span>
        ) : null}
        <span className="rounded-[11px] bg-pt-primary px-3.5 py-2 font-display text-[12px] font-extrabold leading-none text-white shadow-[0_6px_14px_rgba(28,122,70,0.3)]">
          {t("coaches.book")}
        </span>
      </div>
    </Link>
  );
}
