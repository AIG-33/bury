import { setRequestLocale, getTranslations } from "next-intl/server";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MContent, MEmptyState, MRow, MSegment, MStickyHeader } from "@/components/mobile/m-ui";
import { MSearchTool } from "@/components/mobile/m-header-tools";
import { loadClubs, type ClubListItem } from "@/app/[locale]/clubs/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initialsOf } from "@/lib/mobile/format";
import { getMobileMenuLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen 04 — Список клубов (ТЗ Mobile §7.04).
// Sticky light header «Клубы» + search, segment Все / Мои / Рядом.
// Rows: 48px logo-abbr (radius 14, lime gradient, border), name 15/800,
// «город · N участников», right — avg ELO (Space Grotesk, #1C7A46) + access
// badge (По заявке / Открытый / Закрытый).
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default async function MobileClubsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");

  const tab = sp.tab === "my" ? "my" : sp.tab === "near" ? "near" : "all";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clubs, myClubIds, myCity] = await Promise.all([
    loadClubs({}),
    (async () => {
      if (!user) return new Set<string>();
      const { data } = (await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .eq("status", "approved")) as { data: Array<{ club_id: string }> | null };
      return new Set((data ?? []).map((r) => r.club_id));
    })(),
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
  let visible = clubs;
  if (tab === "my") visible = clubs.filter((c) => myClubIds.has(c.id));
  if (tab === "near")
    visible = myCity
      ? clubs.filter((c) => c.city && c.city.toLowerCase() === myCity.toLowerCase())
      : [];
  if (q) visible = visible.filter((c) => c.name.toLowerCase().includes(q));

  const segHref = (nextTab: string) => {
    const next = new URLSearchParams();
    if (nextTab !== "all") next.set("tab", nextTab);
    if (sp.q) next.set("q", sp.q);
    const qs = next.toString();
    return `/m/clubs${qs ? `?${qs}` : ""}`;
  };

  const emptyProps =
    tab === "my"
      ? user
        ? {
            title: t("clubs.empty_my_title"),
            body: t("clubs.empty_my_body"),
            cta: t("clubs.seg_all"),
            href: "/m/clubs",
          }
        : {
            title: t("common.login_required_title"),
            body: t("common.login_required_body"),
            cta: t("common.login"),
            href: "/login",
          }
      : tab === "near"
        ? user
          ? {
              title: t("clubs.empty_near_title"),
              body: t("clubs.empty_near_body"),
              cta: t("clubs.seg_all"),
              href: "/m/clubs",
            }
          : {
              title: t("common.login_required_title"),
              body: t("common.login_required_body"),
              cta: t("common.login"),
              href: "/login",
            }
        : { title: t("clubs.empty_all_title"), body: t("clubs.empty_all_body") };

  return (
    <div className="flex min-h-dvh flex-col">
      <MStickyHeader
        title={t("clubs.title")}
        actions={
          <MSearchTool placeholder={t("clubs.search_placeholder")} ariaLabel={t("common.search")} />
        }
      >
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("clubs.seg_all"), href: segHref("all"), active: tab === "all" },
              { label: t("clubs.seg_my"), href: segHref("my"), active: tab === "my" },
              { label: t("clubs.seg_near"), href: segHref("near"), active: tab === "near" },
            ]}
          />
        </div>
      </MStickyHeader>

      <MContent className="flex-1 pt-4">
        {visible.length === 0 ? (
          <MEmptyState {...emptyProps} />
        ) : (
          <ul className="space-y-[10px]">
            {visible.map((club) => (
              <li key={club.id}>
                <ClubRow club={club} t={t} />
              </li>
            ))}
          </ul>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} menuLabels={getMobileMenuLabels(t)} authed={!!user} />
    </div>
  );
}

function ClubRow({
  club,
  t,
}: {
  club: ClubListItem;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  const meta = [club.city, t("clubs.members_count", { count: club.members_total })]
    .filter(Boolean)
    .join(" · ");

  return (
    <MRow href={`/m/clubs/${club.slug}`}>
      <span
        className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-[rgba(20,60,30,0.1)] font-display text-[15px] font-extrabold text-grass-700"
        style={{ background: "linear-gradient(135deg,#E7F4D9,#D3ECC4)" }}
      >
        {club.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(club.name)
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold leading-tight text-ink-900">
          {club.name}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">{meta}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {club.top5_avg_elo > 0 ? (
          <span className="font-mono text-[15px] font-bold tabular-nums text-grass-600">
            {Math.round(club.top5_avg_elo)}
          </span>
        ) : null}
        <AccessBadge policy={club.join_policy} t={t} />
      </div>
    </MRow>
  );
}

function AccessBadge({
  policy,
  t,
}: {
  policy: ClubListItem["join_policy"];
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  if (policy === "open") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-1 text-[10.5px] font-extrabold leading-none text-grass-600">
        <LockOpen className="h-3 w-3" strokeWidth={2.2} />
        {t("clubs.policy_open")}
      </span>
    );
  }
  if (policy === "approval") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sun-50 px-2 py-1 text-[10.5px] font-extrabold leading-none text-sun-600">
        <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
        {t("clubs.policy_approval")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-1 text-[10.5px] font-extrabold leading-none text-[#7A8C7F]">
      <Lock className="h-3 w-3" strokeWidth={2.2} />
      {t("clubs.policy_closed")}
    </span>
  );
}
