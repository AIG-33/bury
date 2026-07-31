import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutGrid,
  MapPin,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { PlayerNameLink } from "@/components/domain/player-name-link";
import { Link } from "@/i18n/routing";
import {
  MAvatar,
  MContent,
  MCtaBar,
  MEmptyState,
  MEyebrow,
  MSegment,
} from "@/components/mobile/m-ui";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import {
  loadPublicTournamentDetail,
  type PublicTournamentDetail,
} from "@/app/[locale]/tournaments/actions";
import { loadTournamentViewerState } from "@/app/[locale]/(player)/me/tournaments/actions";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { SponsorsCarousel } from "@/components/domain/SponsorsCarousel";
import { formatSetsScore, shortNameOf } from "@/lib/mobile/format";
import { getMobilePlayLabels, getMobileTabLabels } from "@/app/[locale]/m/tab-labels";
import { TournamentApplyCta } from "./apply-cta";
import { TournamentShareButton } from "./share-button";

// =============================================================================
// Screen 03 — Карточка турнира («Tournament Page» mockup, июль 2026).
// Themed hero (branding tokens: banner + scrim, logo tile, tagline, sponsors),
// status/format/surface chips, meta tiles, segment Участники / Сетка / Инфо,
// fixed CTA «Участие … / Подать заявку» stacked above the unified tab bar.
// =============================================================================

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function MobileTournamentDetailPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");

  const [detail, viewer] = await Promise.all([
    loadPublicTournamentDetail(id),
    loadTournamentViewerState(id),
  ]);
  if (!detail) notFound();

  const { tournament, participants, matches, groups } = detail;
  const hasGroups = groups.length > 0;
  const tab = sp.tab === "draw" ? "draw" : sp.tab === "info" ? "info" : "players";

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Minsk",
  });
  const startLabel = [
    dateFmt.format(new Date(tournament.starts_on)).replace(/\s*г\.$/u, ""),
    tournament.start_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" · ");
  const venue = tournament.venues[0];
  const venueLabel = venue
    ? [venue.name, venue.city].filter(Boolean).join(" · ")
    : t("tournaments.place_tba");
  const active = participants.filter((p) => !p.withdrawn);
  const freeSlots = tournament.max_participants
    ? Math.max(0, tournament.max_participants - tournament.participants_count)
    : null;

  const theme = buildRoomTheme(tournament.branding);
  const heroTitle = tournament.branding.title_override ?? tournament.name;
  const accent = theme.accentColor;

  const ctaState = !viewer.authenticated
    ? ("guest" as const)
    : viewer.isOwner
      ? ("owner" as const)
      : tournament.status !== "registration"
        ? ("closed" as const)
        : viewer.applicationStatus === "pending"
          ? ("pending" as const)
          : viewer.applicationStatus === "approved"
            ? ("approved" as const)
            : ("none" as const);

  const segHref = (nextTab: string) =>
    `/m/tournaments/${id}${nextTab === "players" ? "" : `?tab=${nextTab}`}`;

  const heroBackground =
    Object.keys(theme.backgroundStyle).length > 0
      ? theme.backgroundStyle
      : { background: "linear-gradient(150deg,#12331F 0%,#1C6B40 55%,#2A9556 100%)" };

  const playersList = active.map((p, i) => (
    <div
      key={p.id}
      className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
    >
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-pt-icon font-mono text-[12px] font-bold tabular-nums text-grass-700">
        {p.seed ?? i + 1}
      </span>
      {p.name ? (
        <Link
          /* No /m/players route — the web profile is responsive. */
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          href={`/players/${p.id}` as any}
          className="flex min-w-0 flex-1 items-center gap-3 transition-opacity active:opacity-85"
        >
          <MAvatar name={p.name} url={p.avatar_url} size={34} />
          <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink-900">{p.name}</p>
        </Link>
      ) : (
        <>
          <MAvatar name={p.name} url={p.avatar_url} size={34} />
          <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink-900">
            {t("common.player_unknown")}
          </p>
        </>
      )}
      {p.city ? (
        <span className="shrink-0 text-[12.5px] font-semibold text-ink-500">{p.city}</span>
      ) : (
        <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-ink-700">
          {p.elo}
        </span>
      )}
    </div>
  ));

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background:
          "linear-gradient(180deg, rgba(42,149,86,0.16) 0%, rgba(42,149,86,0.05) 320px, rgba(42,149,86,0) 520px)",
      }}
    >
      {/* ── Hero: branding tokens (banner + scrim / gradient / logo / tagline) ── */}
      <header
        className="relative overflow-hidden text-white"
        style={{
          ...heroBackground,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          paddingTop: "max(env(safe-area-inset-top), 14px)",
        }}
      >
        {theme.bannerImageStyle ? (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: theme.bannerImageStyle }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,${Math.max(
                  0,
                  theme.scrimOpacity - 0.25,
                )}) 100%)`,
              }}
            />
          </>
        ) : (
          <CourtLinesPattern />
        )}

        <div className="relative mx-auto w-full max-w-[430px] px-[18px] pb-5 pt-2">
          <div className="flex items-center justify-between">
            <Link
              href="/m/tournaments"
              aria-label={t("common.back")}
              className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/20 bg-white/15 text-white backdrop-blur-[8px] transition-opacity active:opacity-85"
            >
              <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </Link>
            <TournamentShareButton
              title={heroTitle}
              label={t("tournament.share")}
              copiedLabel={t("tournament.share_copied")}
            />
          </div>

          <div className="mt-9 flex items-center gap-3">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="h-[56px] w-[56px] shrink-0 rounded-[14px] border-2 bg-white/95 object-contain"
                style={{ borderColor: accent ?? "rgba(255,255,255,0.55)" }}
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="font-display text-[22px] font-extrabold leading-[1.12] tracking-[-0.4px] text-white">
                {heroTitle}
              </h1>
              {tournament.branding.tagline ? (
                <p className="mt-1 text-[12.5px] font-semibold leading-snug text-white/75">
                  {tournament.branding.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <MContent className="flex-1 pt-4" extraBottom={72}>
        {/* Prominent sponsors carousel right under the hero — replaces the old
            tiny logo pills that used to sit inside the hero. */}
        {tournament.branding.sponsors.length > 0 ? (
          <SponsorsCarousel
            sponsors={tournament.branding.sponsors}
            heading={t("tournament.partners_title")}
            accentColor={accent}
            size="mobile"
            className="mb-4"
          />
        ) : null}

        {/* Status / format / surface chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11px] font-extrabold shadow-[0_1px_2px_rgba(20,60,30,0.06)] ${
              tournament.status === "registration"
                ? "border-[rgba(28,122,70,0.25)] text-grass-600"
                : tournament.status === "in_progress"
                  ? "border-ball-200 text-ball-700"
                  : "border-[rgba(20,60,30,0.1)] text-[#7A8C7F]"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                tournament.status === "registration"
                  ? "bg-grass-500"
                  : tournament.status === "in_progress"
                    ? "bg-ball-600"
                    : "bg-[#9FB3A6]"
              }`}
            />
            {t(`tournaments.status_${tournament.status}` as never)}
          </span>
          <span className="rounded-full border border-[rgba(20,60,30,0.1)] bg-white px-3 py-1.5 text-[11px] font-bold text-[#3A5445] shadow-[0_1px_2px_rgba(20,60,30,0.06)]">
            {t(`tournament.format_${tournament.format}` as never)}
          </span>
          {tournament.surface ? (
            <span className="rounded-full border border-[rgba(20,60,30,0.1)] bg-white px-3 py-1.5 text-[11px] font-bold text-[#3A5445] shadow-[0_1px_2px_rgba(20,60,30,0.06)]">
              {t(`common.surface_${tournament.surface}` as never)}
            </span>
          ) : null}
        </div>

        {/* Meta tiles */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetaTile
            eyebrow={t("tournament.meta_start")}
            icon={<CalendarDays className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={startLabel}
          />
          <MetaTile
            eyebrow={t("tournament.meta_participants")}
            icon={<Users className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={t("tournament.players_count", { count: tournament.participants_count })}
          />
          <MetaTile
            eyebrow={t("tournament.meta_cost")}
            icon={<Tag className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={
              tournament.entry_fee_byn
                ? `${tournament.entry_fee_byn} BYN`
                : t("tournaments.fee_free")
            }
            mono={Boolean(tournament.entry_fee_byn)}
          />
          {tournament.organizer_name ? (
            <MetaTile
              eyebrow={t("tournament.info_organizer")}
              icon={<UserRound className="h-[13px] w-[13px]" strokeWidth={2} />}
              value={shortNameOf(tournament.organizer_name) ?? "—"}
            />
          ) : null}
          <MetaTile
            eyebrow={t("tournament.meta_place")}
            icon={<MapPin className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={venueLabel}
          />
        </div>

        <div className="mt-4">
          <MSegment
            items={[
              {
                label: t("tournament.seg_players"),
                href: segHref("players"),
                active: tab === "players",
              },
              { label: t("tournament.seg_draw"), href: segHref("draw"), active: tab === "draw" },
              { label: t("tournament.seg_info"), href: segHref("info"), active: tab === "info" },
            ]}
          />
        </div>

        <div className="mt-4">
          {tab === "players" ? (
            <div className="space-y-[8px]">
              {hasGroups ? (
                <>
                  {/* Group stage: per-group standings (same math as the
                      organizer page), flat list collapses below. */}
                  {groups.map((g) => (
                    <GroupCard key={g.id} group={g} t={t} />
                  ))}
                  <details className="group/mplist">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)] [&::-webkit-details-marker]:hidden">
                      <span className="text-[13.5px] font-bold text-ink-900">
                        {t("tournament.participants_all", { count: active.length })}
                      </span>
                      <ChevronDown
                        className="h-[18px] w-[18px] shrink-0 text-ink-400 transition-transform group-open/mplist:rotate-180"
                        strokeWidth={2}
                      />
                    </summary>
                    <div className="mt-2 space-y-[8px]">{playersList}</div>
                  </details>
                </>
              ) : active.length === 0 ? (
                <MEmptyState
                  icon={<Users className="h-[22px] w-[22px]" strokeWidth={1.8} />}
                  title={t("tournament.no_players_title")}
                  body={t("tournament.no_players_body")}
                />
              ) : (
                playersList
              )}
              {freeSlots && freeSlots > 0 ? (
                <div className="rounded-[14px] border border-dashed border-[rgba(20,60,30,0.18)] px-3 py-3 text-center text-[12.5px] font-bold text-[#8AA093]">
                  {t("tournament.free_slots", { count: freeSlots })}
                </div>
              ) : null}
            </div>
          ) : tab === "draw" ? (
            <DrawList matches={matches} t={t} locale={locale} />
          ) : (
            <InfoTab tournament={tournament} t={t} />
          )}
        </div>
      </MContent>

      <MCtaBar
        aboveTabBar
        left={
          <div>
            <MEyebrow>{t("tournament.cta_fee_label")}</MEyebrow>
            <p className="font-mono text-[19px] font-bold tabular-nums leading-tight text-ink-900">
              {tournament.entry_fee_byn
                ? `${tournament.entry_fee_byn}\u00A0BYN`
                : t("tournaments.fee_free")}
            </p>
          </div>
        }
      >
        <TournamentApplyCta
          tournamentId={id}
          state={ctaState}
          discipline={tournament.discipline}
          accentColor={accent}
          labels={{
            apply: t("tournament.cta_apply"),
            login: t("tournament.cta_login"),
            pending: t("tournament.cta_pending"),
            approved: t("tournament.cta_approved"),
            closed: t("tournament.cta_closed"),
            owner: t("tournament.cta_owner"),
            withdraw: t("tournament.cta_withdraw"),
            withdraw_confirm: t("tournament.cta_withdraw_confirm"),
            cancel: t("common.cancel"),
            error: t("common.error_generic"),
          }}
        />
      </MCtaBar>

      <MTabBar
        labels={getMobileTabLabels(t)}
        playLabels={getMobilePlayLabels(t)}
        authed={viewer.authenticated}
      />
    </div>
  );
}

/** Faint tennis-court lines over the default hero gradient (mockup art). */
function CourtLinesPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      viewBox="0 0 402 240"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.5"
    >
      <rect x="40" y="-40" width="322" height="260" />
      <line x1="40" y1="90" x2="362" y2="90" />
      <line x1="201" y1="-40" x2="201" y2="220" />
      <line x1="112" y1="-40" x2="112" y2="220" />
      <line x1="290" y1="-40" x2="290" y2="220" />
      <line x1="112" y1="160" x2="290" y2="160" />
    </svg>
  );
}

function MetaTile({
  eyebrow,
  icon,
  value,
  mono = false,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093]">
        <span className="text-grass-600">{icon}</span>
        {eyebrow}
      </p>
      <p
        className={[
          "mt-1.5 truncate text-[14px] font-extrabold leading-tight text-ink-900",
          mono ? "font-mono tabular-nums" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Compact group card for the players tab: roster ordered by standings with
 * P/W/L/sets columns. Games are dropped — too wide for 390px screens.
 */
function GroupCard({
  group,
  t,
}: {
  group: PublicTournamentDetail["groups"][number];
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <p className="text-[11.5px] font-extrabold uppercase tracking-wide text-grass-700">
        {t("tournament.group_label", { name: group.name })}
      </p>
      {group.rows.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-ink-500">{t("tournament.group_empty")}</p>
      ) : (
        /* Player column gets all leftover width and wraps to a second line
           instead of truncating; numeric columns stay narrow (nowrap). */
        <table className="mt-1.5 w-full text-[12px] tabular-nums">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-[#8AA093]">
              <th className="py-0.5 pr-1.5 text-left">{t("tournament.group_col_pos")}</th>
              <th className="w-full py-0.5 pr-1.5 text-left">{t("tournament.group_col_player")}</th>
              <th className="px-1 py-0.5 text-center">{t("tournament.group_col_played")}</th>
              <th className="px-1 py-0.5 text-center">{t("tournament.group_col_wins")}</th>
              <th className="px-1 py-0.5 text-center">{t("tournament.group_col_losses")}</th>
              <th className="py-0.5 pl-1 text-center">{t("tournament.group_col_sets")}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => (
              <tr key={r.player_id} className="border-t border-[rgba(20,60,30,0.06)]">
                <td className="whitespace-nowrap py-1.5 pr-1.5 font-mono font-bold text-ink-500">
                  {r.position}
                </td>
                <td className="w-full py-1.5 pr-1.5 text-[13px] font-bold leading-snug text-ink-900">
                  <PlayerNameLink
                    id={r.player_id}
                    name={r.name}
                    className="transition-opacity active:opacity-85"
                  />
                </td>
                <td className="whitespace-nowrap px-1 py-1.5 text-center text-ink-600">
                  {r.matches_played}
                </td>
                <td className="whitespace-nowrap px-1 py-1.5 text-center font-bold text-grass-700">
                  {r.wins}
                </td>
                <td className="whitespace-nowrap px-1 py-1.5 text-center text-ink-600">
                  {r.losses}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-1 text-center font-mono text-ink-700">
                  {r.sets_won}–{r.sets_lost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DrawList({
  matches,
  t,
  locale,
}: {
  matches: PublicTournamentDetail["matches"];
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
  locale: string;
}) {
  void locale;
  if (!matches || matches.length === 0) {
    return (
      <MEmptyState
        icon={<LayoutGrid className="h-[22px] w-[22px]" strokeWidth={1.8} />}
        title={t("tournament.no_draw_title")}
        body={t("tournament.no_draw_body")}
      />
    );
  }

  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    const round = m.round ?? 0;
    const arr = byRound.get(round) ?? [];
    arr.push(m);
    byRound.set(round, arr);
  }

  return (
    <div className="space-y-4">
      {Array.from(byRound.entries()).map(([round, list]) => (
        <div key={round}>
          <MEyebrow className="mb-2">{t("tournament.round_label", { round: round || 1 })}</MEyebrow>
          <div className="space-y-[8px]">
            {list.map((m) => {
              const score = formatSetsScore(m.sets, true);
              return (
                <div
                  key={m.id}
                  className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <DrawPlayerName
                      id={m.p1_id}
                      name={m.p1_name}
                      isWinner={m.winner_id != null && m.winner_id === m.p1_id}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <DrawPlayerName
                      id={m.p2_id}
                      name={m.p2_name}
                      isWinner={m.winner_id != null && m.winner_id === m.p2_id}
                    />
                    <span className="shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-ink-700">
                      {score || t("matches.no_score")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One side of a draw match — links to the public profile when the slot is
 *  filled (pairs link to the captain). TBD/bye slots stay plain text. */
function DrawPlayerName({
  id,
  name,
  isWinner,
}: {
  id: string | null;
  name: string | null;
  isWinner: boolean;
}) {
  const cls = `min-w-0 truncate text-[13.5px] font-bold ${
    isWinner ? "text-grass-600" : "text-ink-900"
  }`;
  if (!id || !name) return <p className={cls}>{name ?? "—"}</p>;
  return (
    <Link
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      href={`/players/${id}` as any}
      className={`${cls} transition-opacity active:opacity-85`}
    >
      {name}
    </Link>
  );
}

function InfoTab({
  tournament,
  t,
}: {
  tournament: PublicTournamentDetail["tournament"];
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  return (
    <div className="space-y-3">
      {tournament.description ? (
        <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
          <p className="whitespace-pre-line text-[13.5px] leading-[1.4] text-ink-900">
            {tournament.description}
          </p>
        </div>
      ) : null}
      {tournament.regulations_text || tournament.regulations_file_url ? (
        <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
            {t("tournament.regulations_title")}
          </p>
          {tournament.regulations_text ? (
            <p className="mt-2 whitespace-pre-line text-[13.5px] leading-[1.4] text-ink-900">
              {tournament.regulations_text}
            </p>
          ) : null}
          {tournament.regulations_file_url ? (
            <a
              href={tournament.regulations_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-grass-200 bg-grass-50 px-3 text-[13px] font-bold text-grass-800 active:opacity-85"
            >
              <FileText className="h-4 w-4" strokeWidth={2} />
              {t("tournament.regulations_download")}
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
        <dl className="space-y-2.5">
          {tournament.organizer_name ? (
            <InfoRow label={t("tournament.info_organizer")} value={tournament.organizer_name} />
          ) : null}
          <InfoRow
            label={t("tournament.info_format")}
            value={t(`tournament.format_${tournament.format}` as never)}
          />
          {tournament.surface ? (
            <InfoRow
              label={t("tournaments.filter_surface")}
              value={t(`common.surface_${tournament.surface}` as never)}
            />
          ) : null}
          {tournament.registration_deadline ? (
            <InfoRow
              label={t("tournament.info_deadline")}
              value={tournament.registration_deadline}
            />
          ) : null}
          {tournament.venues.length > 0 ? (
            <InfoRow
              label={t("tournament.meta_place")}
              value={tournament.venues
                .map((v) => (v.city ? `${v.name} · ${v.city}` : v.name))
                .join("; ")}
            />
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[11.5px] font-semibold text-ink-500">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-bold text-ink-900">{value}</dd>
    </div>
  );
}
