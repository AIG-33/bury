import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import {
  MBackButton,
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
import { formatSetsScore } from "@/lib/mobile/format";
import { getMobilePlayLabels, getMobileTabLabels } from "@/app/[locale]/m/tab-labels";
import { TournamentApplyCta } from "./apply-cta";

// =============================================================================
// Screen 03 — Карточка турнира (ТЗ Mobile §7.03).
// Light header with back + eyebrow-status + H1 + format/surface tags,
// 2×2 meta grid, segment Участники / Сетка / Инфо, fixed CTA bar
// («Взнос … BYN» + «Записаться») stacked above the unified tab bar.
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

  const { tournament, participants, matches } = detail;
  const tab = sp.tab === "draw" ? "draw" : sp.tab === "info" ? "info" : "players";

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });
  const startLabel = [
    dateFmt.format(new Date(tournament.starts_on)),
    tournament.start_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(", ");
  const venue = tournament.venues[0];
  const active = participants.filter((p) => !p.withdrawn);
  const freeSlots = tournament.max_participants
    ? Math.max(0, tournament.max_participants - tournament.participants_count)
    : null;

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="border-b border-[rgba(20,60,30,0.07)] bg-[rgba(243,247,237,0.92)]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div className="mx-auto w-full max-w-[430px] px-[18px] pb-4">
          <div className="flex items-center justify-between pt-1">
            <MBackButton href="/m/tournaments" label={t("common.back")} />
          </div>
          <p
            className={`mt-3 text-[10px] font-bold uppercase tracking-[1.2px] ${
              tournament.status === "registration"
                ? "text-grass-600"
                : tournament.status === "in_progress"
                  ? "text-ball-700"
                  : "text-[#8AA093]"
            }`}
          >
            {t(`tournaments.status_${tournament.status}` as never)}
          </p>
          <h1 className="mt-1 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.5px] text-grass-900">
            {tournament.name}
          </h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[rgba(20,60,30,0.1)] bg-white px-3 py-1 text-[11px] font-bold text-[#3A5445]">
              {t(`tournament.format_${tournament.format}` as never)}
            </span>
            {tournament.surface ? (
              <span className="rounded-full border border-[rgba(20,60,30,0.1)] bg-white px-3 py-1 text-[11px] font-bold text-[#3A5445]">
                {t(`common.surface_${tournament.surface}` as never)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <MContent className="flex-1 pt-4" extraBottom={72}>
        <div className="grid grid-cols-2 gap-2">
          <MetaTile
            eyebrow={t("tournament.meta_start")}
            icon={<CalendarDays className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={startLabel}
          />
          <MetaTile
            eyebrow={t("tournament.meta_place")}
            icon={<MapPin className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={venue ? venue.name : t("tournaments.place_tba")}
          />
          <MetaTile
            eyebrow={t("tournament.meta_slots")}
            icon={<Users className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={
              tournament.max_participants
                ? `${tournament.participants_count}/${tournament.max_participants}`
                : String(tournament.participants_count)
            }
            mono
          />
          <MetaTile
            eyebrow={t("tournament.meta_fee")}
            icon={<Wallet className="h-[13px] w-[13px]" strokeWidth={2} />}
            value={
              tournament.entry_fee_byn
                ? `${tournament.entry_fee_byn} BYN`
                : t("tournaments.fee_free")
            }
            mono
            accent
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
              {active.length === 0 ? (
                <MEmptyState
                  title={t("tournament.no_players_title")}
                  body={t("tournament.no_players_body")}
                />
              ) : (
                active.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                  >
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-pt-icon font-mono text-[12px] font-bold tabular-nums text-grass-700">
                      {p.seed ?? i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink-900">
                      {p.name ?? t("common.player_unknown")}
                    </p>
                    <span className="font-mono text-[14px] font-bold tabular-nums text-ink-700">
                      {p.elo}
                    </span>
                  </div>
                ))
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
          tournament.entry_fee_byn ? (
            <div>
              <MEyebrow>{t("tournament.meta_fee")}</MEyebrow>
              <p className="font-mono text-[19px] font-bold tabular-nums leading-tight text-ink-900">
                {tournament.entry_fee_byn}&nbsp;BYN
              </p>
            </div>
          ) : undefined
        }
      >
        <TournamentApplyCta
          tournamentId={id}
          state={ctaState}
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

function MetaTile({
  eyebrow,
  icon,
  value,
  mono = false,
  accent = false,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093]">{eyebrow}</p>
      <p
        className={[
          "mt-1.5 flex items-center gap-1.5 text-[14px] font-extrabold leading-tight",
          accent ? "text-grass-600" : "text-ink-900",
          mono ? "font-mono tabular-nums" : "",
        ].join(" ")}
      >
        <span className={accent ? "text-grass-600" : "text-grass-600"}>{icon}</span>
        <span className="min-w-0 truncate">{value}</span>
      </p>
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
      <MEmptyState title={t("tournament.no_draw_title")} body={t("tournament.no_draw_body")} />
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
                    <p
                      className={`min-w-0 truncate text-[13.5px] font-bold ${
                        m.winner_id && m.winner_id === m.p1_id ? "text-grass-600" : "text-ink-900"
                      }`}
                    >
                      {m.p1_name ?? "—"}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p
                      className={`min-w-0 truncate text-[13.5px] font-bold ${
                        m.winner_id && m.winner_id === m.p2_id ? "text-grass-600" : "text-ink-900"
                      }`}
                    >
                      {m.p2_name ?? "—"}
                    </p>
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
      <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
        <dl className="space-y-2.5">
          <InfoRow
            label={t("tournament.info_organizer")}
            value={tournament.organizer_name ?? "—"}
          />
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
