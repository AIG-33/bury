import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MapPin } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import {
  MAvatar,
  MContent,
  MEmptyState,
  MEyebrow,
  MSegment,
  MStatusPill,
  MStickyHeader,
} from "@/components/mobile/m-ui";
import { MFilterTool } from "@/components/mobile/m-header-tools";
import { loadOpenMatches } from "@/app/[locale]/open-matches/actions";
import {
  OPEN_MATCH_LEVEL_BANDS,
  type OpenMatchFeedRow,
  type OpenMatchApplicationStatus,
  type OpenMatchStatus,
} from "@/lib/open-matches/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMobileTabLabels } from "../tab-labels";
import { PlayButton } from "./play-button";

// =============================================================================
// Screen 07 — Спарринги · поиск игры (ТЗ Mobile §7.07).
// Sticky header «Игра» + filter, segment Найти / Мои заявки, filter chips,
// dark invite card («Ищешь соперника?» + lime button), list rows with
// avatar 44 + «Играть» buttons.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; level?: string; when?: string }>;
};

export default async function MobileGamePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tab = sp.tab === "mine" ? "mine" : "find";
  const level = (OPEN_MATCH_LEVEL_BANDS as readonly string[]).includes(sp.level ?? "")
    ? (sp.level as (typeof OPEN_MATCH_LEVEL_BANDS)[number])
    : undefined;
  const when = sp.when === "today" || sp.when === "tomorrow" ? sp.when : null;

  // Date window for the "when" chip (Europe/Minsk ≈ UTC+3, coarse enough here).
  let from: string | undefined;
  let to: string | undefined;
  if (when) {
    const base = new Date();
    if (when === "tomorrow") base.setDate(base.getDate() + 1);
    const dayStart = new Date(base);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(base);
    dayEnd.setHours(23, 59, 59, 999);
    from = (when === "today" ? new Date() : dayStart).toISOString();
    to = dayEnd.toISOString();
  }

  const { rows } = await loadOpenMatches({
    level_band: level && level !== "any" ? level : undefined,
    from,
    to,
  });

  // My application ids to mark rows as already-applied.
  let myApplications = new Map<string, OpenMatchApplicationStatus>();
  let myOpenMatches: OpenMatchFeedRow[] = [];
  if (user) {
    const { data: apps } = (await supabase
      .from("open_match_applications")
      .select("open_match_id, status, created_at")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)) as {
      data: Array<{
        open_match_id: string;
        status: OpenMatchApplicationStatus;
        created_at: string;
      }> | null;
    };
    myApplications = new Map((apps ?? []).map((a) => [a.open_match_id, a.status]));

    if (tab === "mine") {
      const { data: mine } = (await supabase
        .from("open_matches_feed")
        .select(
          "id, creator_id, creator_name, creator_avatar, creator_elo, creator_elo_status, " +
            "venue_id, venue_name, venue_city, venue_is_indoor, venue_indoor_status, " +
            "district_id, district_name, " +
            "starts_at, duration_min, format, level_band, slots_needed, notes, status, created_at, " +
            "pending_applications_count, accepted_applications_count",
        )
        .eq("creator_id", user.id)
        .order("starts_at", { ascending: false })
        .limit(30)) as {
        data: Array<Omit<OpenMatchFeedRow, "creator_external_rating">> | null;
      };
      myOpenMatches = (mine ?? []).map((r) => ({
        ...r,
        creator_external_rating: null,
      }));
    }
  }

  // Rows for the "mine" tab: matches I applied to (from the public feed).
  const appliedRows = tab === "mine" ? rows.filter((r) => myApplications.has(r.id)) : [];

  const findRows = user ? rows.filter((r) => r.creator_id !== user.id) : rows;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Minsk",
  });

  const segHref = (nextTab: string) => {
    const next = new URLSearchParams();
    if (nextTab !== "find") next.set("tab", nextTab);
    if (sp.level) next.set("level", sp.level);
    if (sp.when) next.set("when", sp.when);
    const qs = next.toString();
    return `/m/game${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <MStickyHeader
        title={t("game.title")}
        actions={
          <MFilterTool
            title={t("common.filters")}
            applyLabel={t("common.apply")}
            resetLabel={t("common.reset")}
            anyLabel={t("common.any")}
            ariaLabel={t("common.filters")}
            groups={[
              {
                param: "level",
                label: t("game.filter_level"),
                options: OPEN_MATCH_LEVEL_BANDS.filter((b) => b !== "any").map((b) => ({
                  value: b,
                  label: t(`levels_short.${b}` as never),
                })),
              },
              {
                param: "when",
                label: t("game.filter_when"),
                options: [
                  { value: "today", label: t("game.when_today") },
                  { value: "tomorrow", label: t("game.when_tomorrow") },
                ],
              },
            ]}
          />
        }
      >
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("game.seg_find"), href: segHref("find"), active: tab === "find" },
              { label: t("game.seg_mine"), href: segHref("mine"), active: tab === "mine" },
            ]}
          />
        </div>
      </MStickyHeader>

      <MContent className="flex-1 pt-4">
        {tab === "find" ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <FilterChipLabel
                active={!!level}
                label={level ? t(`levels_short.${level}` as never) : t("game.filter_level")}
              />
              <FilterChipLabel
                active={!!when}
                label={
                  when === "today"
                    ? t("game.when_today")
                    : when === "tomorrow"
                      ? t("game.when_tomorrow")
                      : t("game.filter_when")
                }
              />
              <FilterChipLabel
                active
                label={t("game.chip_near")}
                icon={<MapPin className="h-3 w-3" strokeWidth={2.2} />}
              />
            </div>

            <div
              className="relative mt-3 overflow-hidden rounded-[16px] p-4 text-white"
              style={{ background: "linear-gradient(135deg,#12331F,#1C6B40 70%,#2A9556)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(45% 55% at 95% 0%, rgba(195,232,79,0.22) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-extrabold leading-tight">
                    {t("game.invite_title")}
                  </p>
                  <p className="mt-1 text-[11.5px] font-semibold leading-[1.35] text-white/70">
                    {t("game.invite_body")}
                  </p>
                </div>
                <Link
                  href={(user ? "/open-matches/new" : "/login") as never}
                  className="shrink-0 rounded-[12px] bg-ball-500 px-4 py-2.5 font-display text-[13px] font-extrabold text-grass-900 transition-opacity active:opacity-85"
                >
                  {t("game.invite_cta")}
                </Link>
              </div>
            </div>

            <MEyebrow className="mb-2.5 mt-5">{t("game.list_eyebrow")}</MEyebrow>

            {findRows.length === 0 ? (
              <MEmptyState
                title={t("game.empty_title")}
                body={t("game.empty_body")}
                cta={t("game.invite_cta")}
                href={user ? "/open-matches/new" : "/login"}
              />
            ) : (
              <ul className="space-y-[9px]">
                {findRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                  >
                    <MAvatar name={row.creator_name} url={row.creator_avatar} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-extrabold text-ink-900">
                        {row.creator_name ?? t("common.player_unknown")}
                        <span className="ml-1.5 font-mono text-[12.5px] font-bold tabular-nums text-grass-600">
                          {row.creator_elo}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                        {[
                          dateFmt.format(new Date(row.starts_at)),
                          row.venue_name ?? row.district_name ?? row.venue_city,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <PlayButton
                      openMatchId={row.id}
                      authenticated={!!user}
                      alreadyApplied={myApplications.has(row.id)}
                      labels={{
                        play: t("game.play"),
                        applied: t("game.applied"),
                        error: t("common.error_generic"),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : !user ? (
          <MEmptyState
            title={t("common.login_required_title")}
            body={t("common.login_required_body")}
            cta={t("common.login")}
            href="/login"
          />
        ) : (
          <MineTab
            appliedRows={appliedRows}
            myApplications={myApplications}
            myOpenMatches={myOpenMatches}
            dateFmt={dateFmt}
            t={t}
          />
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} />
    </div>
  );
}

function FilterChipLabel({
  label,
  active,
  icon,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-3 py-[7px] text-[12px] font-bold leading-none",
        active
          ? "bg-[rgba(28,122,70,0.1)] text-grass-600"
          : "border border-[rgba(20,60,30,0.1)] bg-white text-[#3A5445]",
      ].join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

function MineTab({
  appliedRows,
  myApplications,
  myOpenMatches,
  dateFmt,
  t,
}: {
  appliedRows: OpenMatchFeedRow[];
  myApplications: Map<string, OpenMatchApplicationStatus>;
  myOpenMatches: OpenMatchFeedRow[];
  dateFmt: Intl.DateTimeFormat;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  const statusTone = (s: OpenMatchStatus) =>
    s === "open"
      ? ("registration" as const)
      : s === "filled"
        ? ("win" as const)
        : ("finished" as const);

  if (appliedRows.length === 0 && myOpenMatches.length === 0) {
    return (
      <MEmptyState
        title={t("game.empty_mine_title")}
        body={t("game.empty_mine_body")}
        cta={t("game.invite_cta")}
        href="/open-matches/new"
      />
    );
  }

  return (
    <div className="space-y-5">
      {myOpenMatches.length > 0 ? (
        <div>
          <MEyebrow className="mb-2.5">{t("game.mine_created")}</MEyebrow>
          <ul className="space-y-[9px]">
            {myOpenMatches.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/open-matches/${row.id}` as never}
                  className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-extrabold text-ink-900">
                      {[
                        dateFmt.format(new Date(row.starts_at)),
                        row.venue_name ?? row.district_name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-ink-500">
                      {t("game.applications_count", {
                        count: row.pending_applications_count,
                      })}
                    </p>
                  </div>
                  <MStatusPill tone={statusTone(row.status)} pulse={row.status === "open"}>
                    {t(`game.status_${row.status}` as never)}
                  </MStatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {appliedRows.length > 0 ? (
        <div>
          <MEyebrow className="mb-2.5">{t("game.mine_applied")}</MEyebrow>
          <ul className="space-y-[9px]">
            {appliedRows.map((row) => {
              const appStatus = myApplications.get(row.id);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                >
                  <MAvatar name={row.creator_name} url={row.creator_avatar} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-extrabold text-ink-900">
                      {row.creator_name ?? t("common.player_unknown")}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                      {dateFmt.format(new Date(row.starts_at))}
                    </p>
                  </div>
                  <MStatusPill
                    tone={
                      appStatus === "accepted" ? "win" : appStatus === "rejected" ? "loss" : "soon"
                    }
                  >
                    {t(`game.app_status_${appStatus ?? "pending"}` as never)}
                  </MStatusPill>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
