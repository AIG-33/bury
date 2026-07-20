import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildTournamentEventJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { CalendarDays, LayoutGrid, MapPin, Tag, UserRound, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { SponsorsCarousel } from "@/components/domain/SponsorsCarousel";
import { RatingDisplay } from "@/components/rating/rating-display";
import { MatchScorecard, type ScorecardSet } from "@/components/match/match-scorecard";
import { Surface } from "@/components/ui/surface";
import { initialsOf, shortNameOf } from "@/lib/mobile/format";
import { loadPublicTournamentDetail, type PublicTournamentRow } from "../actions";
import { loadTournamentViewerState } from "@/app/[locale]/(player)/me/tournaments/actions";
import { TournamentApplyButton, type ApplyButtonCopy } from "./apply-button";
import { TournamentShareActions } from "./share-actions";

// =============================================================================
// Public tournament room («Tournament Page» mockup, июль 2026): full-bleed
// themed hero (branding tokens: banner + scrim, logo tile, tagline, partners),
// meta tiles, participants with seed + avatar + city, matches by round, and a
// sticky registration card in the sidebar (share / add-to-calendar included).
// =============================================================================

type Props = { params: Promise<{ locale: string; id: string }> };

const tournamentIdSchema = z.string().uuid();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const detail = await loadPublicTournamentDetail(id);
  if (!detail) return { title: "Tournament", robots: { index: false } };
  const description =
    detail.tournament.description ??
    `${detail.tournament.format} · ${detail.tournament.participants_count} participants`;
  return buildPageMetadata({
    locale,
    path: `/tournaments/${id}`,
    title: detail.tournament.name,
    description,
    ogType: "article",
  });
}

export default async function PublicTournamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  if (!tournamentIdSchema.safeParse(id).success) notFound();

  const [detail, viewer] = await Promise.all([
    loadPublicTournamentDetail(id),
    loadTournamentViewerState(id),
  ]);
  if (!detail) {
    // RLS hides non-public tournaments from anonymous visitors, so a shared
    // registration link used to dead-end in a 404. Send guests through login
    // and bounce them back here (post-login honours the locale-less `next`).
    if (!viewer.authenticated) {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/tournaments/${id}`)}`);
    }
    notFound();
  }

  const { tournament, participants, matches } = detail;

  const applyCopy: ApplyButtonCopy = {
    title: t("detail.apply.title"),
    cta: t("detail.apply.cta"),
    applying: t("detail.apply.applying"),
    login_cta: t("detail.apply.login_cta"),
    login_hint: t("detail.apply.login_hint"),
    closed: t("detail.apply.closed"),
    owner: t("detail.apply.owner"),
    pending: t("detail.apply.pending"),
    approved: t("detail.apply.approved"),
    rejected: t("detail.apply.rejected"),
  };
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

  const city = tournament.venues[0]?.city ?? null;
  const jsonLd = buildTournamentEventJsonLd({
    id,
    locale,
    name: tournament.name,
    description: tournament.description,
    startsOn: tournament.starts_on,
    startTime: tournament.start_time,
    city,
    status: tournament.status,
  });

  const theme = buildRoomTheme(tournament.branding);
  const accent = theme.accentColor;
  const heroTitle = tournament.branding.title_override ?? tournament.name;
  const sponsors = tournament.branding.sponsors;
  const activeParticipants = participants.filter((p) => !p.withdrawn);
  const freeSlots = tournament.max_participants
    ? Math.max(0, tournament.max_participants - tournament.participants_count)
    : null;
  const feeLabel =
    tournament.entry_fee_byn == null || tournament.entry_fee_byn === 0
      ? t("entry_fee_free")
      : t("entry_fee_byn", { n: tournament.entry_fee_byn });
  const venueLabel =
    tournament.venues.length > 0
      ? tournament.venues.map((v) => [v.name, v.city].filter(Boolean).join(" · ")).join("; ")
      : null;

  const heroBackground =
    Object.keys(theme.backgroundStyle).length > 0
      ? theme.backgroundStyle
      : { background: "linear-gradient(150deg,#12331F 0%,#1C6B40 55%,#2A9556 100%)" };
  const overBanner = theme.bannerImageStyle != null;
  const heroTextColor =
    overBanner || Object.keys(theme.backgroundStyle).length === 0 ? "#ffffff" : theme.textColor;
  const heroMuted = heroTextColor === "#ffffff" ? "rgba(255,255,255,0.78)" : theme.mutedTextColor;

  const helpPanel = (
    <HelpPanel
      pageId="public-tournament-detail"
      variant="inline"
      why={t("detail.help.why")}
      what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
      result={[t("detail.help.result.1")]}
    />
  );

  return (
    <div
      style={
        theme.themed && Object.keys(theme.backgroundStyle).length > 0
          ? theme.backgroundStyle
          : { background: "linear-gradient(180deg,#E9F2E3 0%,#CDE3C9 55%,#BCD9BA 100%)" }
      }
    >
      <JsonLdScript data={jsonLd} />

      {/* ── Hero: branding tokens (banner + scrim / gradient / logo / tagline) ── */}
      <div
        className={`relative overflow-hidden ${theme.fontClass}`}
        style={{ ...heroBackground, color: heroTextColor }}
      >
        {accent && <div aria-hidden style={{ height: 4, backgroundColor: accent }} />}

        {overBanner ? (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: theme.bannerImageStyle! }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,${Math.max(
                  0,
                  theme.scrimOpacity - 0.2,
                )}) 60%, rgba(0,0,0,${Math.max(0, theme.scrimOpacity - 0.35)}) 100%)`,
              }}
            />
          </>
        ) : (
          <CourtLinesPattern />
        )}

        <div className="page-shell relative space-y-6 pb-8 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-full bg-black/25 px-4 py-1.5 backdrop-blur-[6px] [&_a:hover]:text-white [&_a]:text-white/80 [&_span]:text-white [&_svg]:text-white/50">
              <Breadcrumbs
                locale={locale}
                items={[
                  { name: tCrumb("home"), path: "" },
                  { name: tNav("tournaments"), path: "/tournaments" },
                  { name: tournament.name, path: `/tournaments/${id}` },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              {sponsors.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-black/25 py-1 pl-3 pr-1 text-[10px] font-bold uppercase tracking-[1.2px] text-white/80 backdrop-blur-[6px]">
                  {t("detail.partner_badge")}
                  <span className="inline-flex items-center rounded-full bg-white/90 px-1.5 py-0.5">
                    {sponsors[0].logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsors[0].logo_url}
                        alt={sponsors[0].name}
                        title={sponsors[0].name}
                        className="h-5 w-auto max-w-[72px] object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-bold normal-case tracking-normal text-ink-900">
                        {sponsors[0].name}
                      </span>
                    )}
                  </span>
                </span>
              )}
              {helpPanel}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 pt-6">
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-2xl border-2 bg-white/95 object-contain sm:h-24 sm:w-24"
                style={{ borderColor: accent ?? "rgba(255,255,255,0.55)" }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-[6px]">
                  {t(`format.${tournament.format}`)}
                </span>
                {tournament.discipline === "doubles" && (
                  <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-[6px]">
                    {t("detail.discipline_doubles")}
                  </span>
                )}
                {tournament.surface && (
                  <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-[6px]">
                    {t(`surfaces.${tournament.surface}`)}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-white"
                  style={{ backgroundColor: accent ?? "#28A35A" }}
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/90" />
                  {t(`status.${tournament.status}`)}
                </span>
              </div>
              <h1
                className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
                style={{ color: heroTextColor }}
              >
                {heroTitle}
              </h1>
              {tournament.branding.tagline && (
                <p className="mt-1.5 text-sm font-medium sm:text-base" style={{ color: heroMuted }}>
                  {tournament.branding.tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell py-8">
        {/* Prominent sponsors carousel right under the hero (mockup: dedicated
            section with large clickable logo tiles, scroll-snap when 3+). */}
        {sponsors.length > 0 && (
          <SponsorsCarousel
            sponsors={sponsors}
            heading={t("detail.partners_title")}
            accentColor={accent}
            size="web"
            className="mb-6"
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-6">
            {/* Meta tiles */}
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaTile
                eyebrow={t("detail.starts")}
                icon={<CalendarDays className="h-4 w-4" strokeWidth={2} />}
                value={startLabel}
              />
              <MetaTile
                eyebrow={t("detail.participants")}
                icon={<Users className="h-4 w-4" strokeWidth={2} />}
                value={t("detail.players_count", { count: tournament.participants_count })}
              />
              <MetaTile
                eyebrow={t("detail.entry_fee")}
                icon={<Tag className="h-4 w-4" strokeWidth={2} />}
                value={feeLabel}
                mono={Boolean(tournament.entry_fee_byn)}
              />
              <MetaTile
                eyebrow={t("detail.organizer")}
                icon={<UserRound className="h-4 w-4" strokeWidth={2} />}
                value={shortNameOf(tournament.organizer_name) ?? "—"}
              />
              {venueLabel && (
                <MetaTile
                  eyebrow={t("detail.venues")}
                  icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                  value={venueLabel}
                />
              )}
            </div>

            {/* Participants */}
            <Surface variant="card" as="section">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title text-[18px] md:text-[20px]">
                  {t("detail.participants_title")}
                </h2>
                <span className="rounded-full bg-grass-50 px-3 py-1 text-xs font-bold tabular-nums text-grass-700">
                  {t("detail.registered_count", { count: activeParticipants.length })}
                </span>
              </div>
              {activeParticipants.length === 0 ? (
                <p className="text-sm text-ink-500">{t("detail.participants_empty")}</p>
              ) : (
                <ol className="grid gap-2">
                  {activeParticipants.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-ink-100/70 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-grass-50 font-mono text-xs font-bold tabular-nums text-grass-700">
                        {p.seed ?? i + 1}
                      </span>
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grass-100 text-xs font-extrabold text-grass-700">
                          {initialsOf(p.name)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900">
                        {p.name ?? "?"}
                      </span>
                      <RatingDisplay
                        internalElo={p.elo}
                        external={
                          p.external_rating
                            ? {
                                source: "liga_tennisa",
                                elo: p.external_rating.external_elo,
                                displayTier: p.external_rating.display_tier,
                                externalUrl: p.external_rating.external_url,
                                isCalibrating: p.external_rating.is_calibrating_singles,
                              }
                            : null
                        }
                        variant="inline"
                        size="sm"
                      />
                      {p.city && (
                        <span className="hidden shrink-0 text-xs font-semibold text-ink-500 sm:inline">
                          {p.city}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Surface>

            {/* Matches — same scorecard look as /matches; grouped by round so a
              long bracket reads top → down by stage. */}
            <Surface variant="card" as="section">
              <h2 className="section-title mb-3 text-[18px] md:text-[20px]">
                {t("detail.matches_title")}
              </h2>
              {matches.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-grass-200 bg-grass-50/40 px-6 py-10 text-center">
                  <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-grass-100 text-grass-600">
                    <LayoutGrid className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <p className="font-display text-[15px] font-extrabold text-ink-900">
                    {t("detail.draw_empty_title")}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
                    {t("detail.draw_empty_body")}
                  </p>
                </div>
              ) : (
                <TournamentMatchesByRound
                  matches={matches}
                  locale={locale}
                  labels={{
                    round_short: t("detail.round_short"),
                    scheduled: t("detail.scheduled"),
                    winner: t("detail.winner"),
                    countLabel: (n: number) => t("detail.matches_count", { n }),
                    tba: t("detail.tba"),
                  }}
                />
              )}
            </Surface>
          </div>

          {/* ── Sidebar: sticky registration card + organizer ── */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Surface variant="card" as="section">
              <p
                className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                  tournament.status === "registration" ? "text-grass-600" : "text-ink-500"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    tournament.status === "registration" ? "bg-grass-500" : "bg-ink-300"
                  }`}
                />
                {tournament.status === "registration"
                  ? t("detail.reg_open")
                  : t(`status.${tournament.status}`)}
              </p>
              <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">
                {feeLabel}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {t("detail.participation")}
                {freeSlots != null && freeSlots > 0
                  ? ` · ${t("detail.slots_left", { count: freeSlots })}`
                  : ""}
              </p>
              <div className="mt-4">
                <TournamentApplyButton
                  locale={locale}
                  tournamentId={id}
                  status={tournament.status}
                  discipline={tournament.discipline}
                  viewer={viewer}
                  copy={applyCopy}
                />
              </div>
              <div className="mt-4 border-t border-ink-100 pt-4">
                <TournamentShareActions
                  title={tournament.name}
                  calendarUrl={buildGoogleCalendarUrl(tournament, locale)}
                  labels={{
                    share: t("detail.share"),
                    copied: t("detail.share_copied"),
                    calendar: t("detail.add_to_calendar"),
                  }}
                />
              </div>
            </Surface>

            <Surface variant="card" as="section">
              <p className="label-eyebrow">{t("detail.organizer")}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grass-100 text-sm font-extrabold text-grass-700">
                  {initialsOf(tournament.organizer_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">
                    {tournament.organizer_name ?? "—"}
                  </p>
                  <p className="text-xs text-ink-500">{t("detail.organizer_role")}</p>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Faint tennis-court lines over the default hero gradient (mockup art). */
function CourtLinesPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2"
    >
      <rect x="140" y="-60" width="920" height="360" />
      <line x1="140" y1="120" x2="1060" y2="120" />
      <line x1="600" y1="-60" x2="600" y2="300" />
      <line x1="340" y1="-60" x2="340" y2="300" />
      <line x1="860" y1="-60" x2="860" y2="300" />
      <line x1="340" y1="220" x2="860" y2="220" />
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
    <div className="rounded-2xl border border-ink-100/70 bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[1.2px] text-ink-400">
        <span className="text-grass-600">{icon}</span>
        {eyebrow}
      </p>
      <p
        className={`mt-1.5 truncate text-[15px] font-extrabold leading-tight text-ink-900 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Prefilled Google Calendar event link (no API key; works logged-out). */
function buildGoogleCalendarUrl(tournament: PublicTournamentRow, locale: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  let dates: string;
  if (tournament.start_time) {
    // Wall-clock times + ctz=Europe/Minsk → Google interprets them in Minsk time.
    const start = new Date(`${tournament.starts_on}T${tournament.start_time}`);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    dates = `${fmt(start)}/${fmt(end)}`;
  } else {
    const start = new Date(`${tournament.starts_on}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);
    const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    dates = `${fmt(start)}/${fmt(end)}`;
  }
  const venue = tournament.venues[0];
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: tournament.name,
    dates,
    ctz: "Europe/Minsk",
    details: `${SITE_URL}/${locale}/tournaments/${tournament.id}`,
  });
  if (venue) params.set("location", [venue.name, venue.city].filter(Boolean).join(", "));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// =============================================================================
// Tournament-page rendering of matches.
//
// Same compact scorecard as /matches (shared component), wrapped in a
// per-round <details> shutter so the bracket reads stage-by-stage.
// =============================================================================
function TournamentMatchesByRound({
  matches,
  locale,
  labels,
}: {
  matches: NonNullable<Awaited<ReturnType<typeof loadPublicTournamentDetail>>>["matches"];
  locale: string;
  labels: {
    round_short: string;
    scheduled: string;
    winner: string;
    /** Renders e.g. "9 матчей" with proper plural form. */
    countLabel: (n: number) => string;
    tba: string;
  };
}) {
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Minsk",
  });

  // Preserve the upstream order (round asc, bracket_slot asc).
  const order: Array<number | "_no_round"> = [];
  const groups = new Map<number | "_no_round", { matches: typeof matches }>();
  for (const m of matches) {
    const k: number | "_no_round" = m.round ?? "_no_round";
    if (!groups.has(k)) {
      order.push(k);
      groups.set(k, { matches: [] });
    }
    groups.get(k)!.matches.push(m);
  }

  // All rounds collapsed by default — user picks the round they care
  // about. Keeps the initial bracket index compact.
  return (
    <div className="space-y-2">
      {order.map((roundKey) => {
        const g = groups.get(roundKey)!;
        const headerLabel =
          roundKey === "_no_round" ? labels.tba : `${labels.round_short}${roundKey}`;

        return (
          <details
            key={String(roundKey)}
            open={false}
            className="group/g rounded-2xl border border-ball-100 bg-white shadow-[0_4px_18px_-14px_rgba(15,27,20,0.1)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2 transition hover:bg-ink-50/60 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ball-100 font-mono text-[10px] font-bold text-ball-800">
                  {roundKey === "_no_round" ? "—" : roundKey}
                </span>
                <span className="truncate font-display text-[14px] font-bold text-ball-900">
                  {headerLabel}
                </span>
                <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-600">
                  {labels.countLabel(g.matches.length)}
                </span>
              </div>
            </summary>

            <ul className="grid gap-2 px-3 pb-3 md:grid-cols-2">
              {g.matches.map((m) => {
                const dateIso = m.played_at ?? m.scheduled_at;
                const sets: ScorecardSet[][] = (m.sets ?? []).reduce(
                  (acc: ScorecardSet[][], s) => {
                    acc[0].push({
                      my: s.p1,
                      their: s.p2,
                      tb: s.tb_p1 ?? null,
                    });
                    acc[1].push({
                      my: s.p2,
                      their: s.p1,
                      tb: s.tb_p2 ?? null,
                    });
                    return acc;
                  },
                  [[], []],
                );

                return (
                  <MatchScorecard
                    key={m.id}
                    accent="tournament"
                    winnerLabel={labels.winner}
                    noScoreLabel={m.outcome === "scheduled" ? labels.scheduled : "—"}
                    meta={
                      <>
                        {dateIso ? (
                          <span className="inline-flex items-center gap-1 text-ink-500">
                            <CalendarDays className="h-3 w-3" />
                            <span className="normal-case tracking-normal text-ink-700">
                              {dateFmt.format(new Date(dateIso))}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-ink-600">
                            {labels.tba}
                          </span>
                        )}
                      </>
                    }
                    p1={{
                      id: m.p1_id,
                      name: m.p1_name,
                      avatarUrl: m.p1_avatar,
                      isCoach: m.p1_is_coach,
                      isWinner: m.winner_id != null && m.winner_id === m.p1_id,
                      sets: sets[0],
                    }}
                    p2={{
                      id: m.p2_id,
                      name: m.p2_name,
                      avatarUrl: m.p2_avatar,
                      isCoach: m.p2_is_coach,
                      isWinner: m.winner_id != null && m.winner_id === m.p2_id,
                      sets: sets[1],
                    }}
                  />
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
