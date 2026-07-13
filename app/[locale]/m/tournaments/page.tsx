import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Trophy } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import {
  MContent,
  MEmptyState,
  MIconBadge,
  MRow,
  MSegment,
  MStatusPill,
  MStickyHeader,
  type MPillTone,
} from "@/components/mobile/m-ui";
import { MFilterTool, MSearchTool } from "@/components/mobile/m-header-tools";
import {
  loadPublicTournaments,
  loadVenueCities,
  type PublicTournamentRow,
} from "@/app/[locale]/tournaments/actions";
import {
  loadMyTournaments,
  type MyTournamentRow,
} from "@/app/[locale]/(player)/me/tournaments/actions";
import { SURFACES } from "@/lib/tournaments/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMobileMenuLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen 02 — Список турниров (ТЗ Mobile §7.02).
// Sticky light header + segment (Все / Регистрация / Идут / Мои), rows with a
// 46px cup badge colored by status, status pill + participants counter,
// entry fee (Space Grotesk) + chevron. Filters live in a bottom-sheet.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    q?: string;
    city?: string;
    format?: string;
    surface?: string;
    fee?: string;
  }>;
};

const STATUS_TONE: Record<string, MPillTone> = {
  registration: "registration",
  in_progress: "live",
  upcoming: "soon",
  finished: "finished",
};

export default async function MobileTournamentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");

  // Auth state only feeds the burger menu (profile/logout vs login CTA).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tab =
    sp.tab === "reg" ? "reg" : sp.tab === "live" ? "live" : sp.tab === "mine" ? "mine" : "all";
  const status = tab === "reg" ? "registration" : tab === "live" ? "in_progress" : "all";

  const surface = (SURFACES as readonly string[]).includes(sp.surface ?? "")
    ? (sp.surface as (typeof SURFACES)[number])
    : null;
  const fee = sp.fee === "free" || sp.fee === "paid" ? sp.fee : null;

  const [rows, cities, mine] = await Promise.all([
    tab === "mine"
      ? Promise.resolve([] as PublicTournamentRow[])
      : loadPublicTournaments({
          status,
          surface,
          fee,
          city: sp.city ?? null,
        }),
    loadVenueCities(),
    tab === "mine" ? loadMyTournaments() : Promise.resolve(null),
  ]);

  const q = sp.q?.trim().toLowerCase() ?? "";
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;

  // "Все": upcoming statuses first (registration → in_progress), finished last.
  const order: Record<string, number> = {
    registration: 0,
    in_progress: 1,
    upcoming: 2,
    finished: 3,
  };
  const sorted = [...filtered].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  // "Мои": active tournaments first (live → registration), withdrawn and
  // finished sink to the bottom; newest start date first within each group.
  const mineRows =
    mine && mine.ok
      ? mine.tournaments
          .filter((r) => !q || r.name.toLowerCase().includes(q))
          .sort((a, b) => {
            const rank = (r: MyTournamentRow) => (r.withdrawn ? 10 : 0) + (order[r.status] ?? 9);
            const byRank = rank(a) - rank(b);
            if (byRank !== 0) return byRank;
            return b.starts_on.localeCompare(a.starts_on);
          })
      : [];

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });

  const buildTabHref = (nextTab: string) => {
    const next = new URLSearchParams();
    if (nextTab !== "all") next.set("tab", nextTab);
    for (const key of ["q", "city", "format", "surface", "fee"] as const) {
      if (sp[key]) next.set(key, sp[key] as string);
    }
    const qs = next.toString();
    return `/m/tournaments${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <MStickyHeader
        title={t("tournaments.title")}
        actions={
          <>
            <MSearchTool
              placeholder={t("tournaments.search_placeholder")}
              ariaLabel={t("common.search")}
            />
            <MFilterTool
              title={t("common.filters")}
              applyLabel={t("common.apply")}
              resetLabel={t("common.reset")}
              anyLabel={t("common.any")}
              ariaLabel={t("common.filters")}
              groups={[
                {
                  param: "city",
                  label: t("tournaments.filter_city"),
                  options: cities.map((c) => ({ value: c, label: c })),
                },
                {
                  param: "surface",
                  label: t("tournaments.filter_surface"),
                  options: SURFACES.map((s) => ({
                    value: s,
                    label: t(`common.surface_${s}`),
                  })),
                },
                {
                  param: "fee",
                  label: t("tournaments.filter_fee"),
                  options: [
                    { value: "free", label: t("tournaments.fee_free") },
                    { value: "paid", label: t("tournaments.fee_paid") },
                  ],
                },
              ]}
            />
          </>
        }
      >
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("tournaments.seg_all"), href: buildTabHref("all"), active: tab === "all" },
              { label: t("tournaments.seg_reg"), href: buildTabHref("reg"), active: tab === "reg" },
              {
                label: t("tournaments.seg_live"),
                href: buildTabHref("live"),
                active: tab === "live",
              },
              {
                label: t("tournaments.seg_mine"),
                href: buildTabHref("mine"),
                active: tab === "mine",
              },
            ]}
          />
        </div>
      </MStickyHeader>

      <MContent className="flex-1 pt-4">
        {tab === "mine" ? (
          mine && !mine.ok ? (
            <MEmptyState
              title={t("common.login_required_title")}
              body={t("common.login_required_body")}
              cta={t("common.login")}
              href="/login"
            />
          ) : mineRows.length === 0 ? (
            q ? (
              <MEmptyState
                title={t("tournaments.empty_title")}
                body={t("tournaments.empty_body")}
                cta={t("tournaments.seg_all")}
                href="/m/tournaments"
              />
            ) : (
              <MEmptyState
                title={t("tournaments.empty_mine_title")}
                body={t("tournaments.empty_mine_body")}
                cta={t("tournaments.empty_mine_cta")}
                href="/m/tournaments?tab=reg"
              />
            )
          ) : (
            <ul className="space-y-[10px]">
              {mineRows.map((row) => (
                <li key={row.id}>
                  <MyTournamentRowItem row={row} t={t} dateFmt={dateFmt} />
                </li>
              ))}
            </ul>
          )
        ) : sorted.length === 0 ? (
          <MEmptyState
            title={t("tournaments.empty_title")}
            body={t("tournaments.empty_body")}
            cta={t("tournaments.seg_all")}
            href="/m/tournaments"
          />
        ) : (
          <ul className="space-y-[10px]">
            {sorted.map((row) => (
              <li key={row.id}>
                <TournamentRow row={row} t={t} dateFmt={dateFmt} />
              </li>
            ))}
          </ul>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} menuLabels={getMobileMenuLabels(t)} authed={!!user} />
    </div>
  );
}

function TournamentRow({
  row,
  t,
  dateFmt,
}: {
  row: PublicTournamentRow;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
  dateFmt: Intl.DateTimeFormat;
}) {
  const finished = row.status === "finished";
  const tone = STATUS_TONE[row.status] ?? "soon";
  const venue = row.venues[0];
  const place = venue
    ? venue.city
      ? `${venue.name} · ${venue.city}`
      : venue.name
    : t("tournaments.place_tba");
  const time = row.start_time ? row.start_time.slice(0, 5) : null;
  const meta = [dateFmt.format(new Date(row.starts_on)), time, place].filter(Boolean).join(" · ");

  const badgeClass = finished
    ? "bg-ink-50 text-[#7A8C7F]"
    : row.status === "in_progress"
      ? "bg-ball-100 text-ball-700"
      : "";

  return (
    <MRow href={`/m/tournaments/${row.id}`} className={finished ? "opacity-[0.72]" : ""}>
      <MIconBadge size={46} radius={14} className={badgeClass}>
        <Trophy className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </MIconBadge>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-extrabold leading-tight text-ink-900">
          {row.name}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">{meta}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <MStatusPill
            tone={tone}
            pulse={row.status === "registration" || row.status === "in_progress"}
          >
            {t(`tournaments.status_${row.status}` as never)}
          </MStatusPill>
          {row.max_participants ? (
            <span className="font-mono text-[11px] font-bold tabular-nums text-ink-500">
              {row.participants_count}/{row.max_participants}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-center">
        {row.entry_fee_byn ? (
          <span className="font-mono text-[14px] font-bold tabular-nums text-ink-900">
            {row.entry_fee_byn}&nbsp;BYN
          </span>
        ) : (
          <span className="text-[11.5px] font-bold text-grass-600">
            {t("tournaments.fee_free")}
          </span>
        )}
        <ChevronRight className="h-[15px] w-[15px] text-[#8AA093]" strokeWidth={2} />
      </div>
    </MRow>
  );
}

function MyTournamentRowItem({
  row,
  t,
  dateFmt,
}: {
  row: MyTournamentRow;
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
  dateFmt: Intl.DateTimeFormat;
}) {
  const inactive = row.withdrawn || row.status === "finished" || row.status === "cancelled";

  // Pill: application state first (pending / rejected / withdrawn), otherwise
  // the tournament status — same tones as the public list.
  const pill = row.withdrawn
    ? { tone: "finished" as MPillTone, label: t("tournaments.mine_withdrawn"), pulse: false }
    : row.application_status === "pending"
      ? { tone: "soon" as MPillTone, label: t("tournaments.mine_pending"), pulse: false }
      : row.application_status === "rejected"
        ? { tone: "loss" as MPillTone, label: t("tournaments.mine_rejected"), pulse: false }
        : {
            tone: STATUS_TONE[row.status] ?? ("soon" as MPillTone),
            label: t(`tournaments.status_${row.status}` as never),
            pulse: row.status === "registration" || row.status === "in_progress",
          };

  const nextMatch =
    !row.withdrawn && row.next_match?.opponent_name
      ? t("tournaments.mine_next_match", { opponent: row.next_match.opponent_name })
      : null;
  const meta = [dateFmt.format(new Date(row.starts_on)), nextMatch ?? row.organizer_name]
    .filter(Boolean)
    .join(" · ");

  const badgeClass = inactive
    ? "bg-ink-50 text-[#7A8C7F]"
    : row.status === "in_progress"
      ? "bg-ball-100 text-ball-700"
      : "";

  return (
    <MRow href={`/m/tournaments/${row.id}`} className={inactive ? "opacity-[0.72]" : ""}>
      <MIconBadge size={46} radius={14} className={badgeClass}>
        <Trophy className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </MIconBadge>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-extrabold leading-tight text-ink-900">
          {row.name}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">{meta}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <MStatusPill tone={pill.tone} pulse={pill.pulse}>
            {pill.label}
          </MStatusPill>
          {row.max_participants ? (
            <span className="font-mono text-[11px] font-bold tabular-nums text-ink-500">
              {row.participants_count}/{row.max_participants}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <ChevronRight className="h-[15px] w-[15px] text-[#8AA093]" strokeWidth={2} />
      </div>
    </MRow>
  );
}
