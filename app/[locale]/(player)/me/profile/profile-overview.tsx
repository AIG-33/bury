import { Link } from "@/i18n/routing";
import { ArrowRight, Award, Flame, Medal, ShieldCheck, Trophy } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import type { EloPoint, RatingMatchRow } from "@/lib/rating/history";

// =============================================================================
// Profile overview (redesign spec §4.6): two columns under the dark header —
// "Recent matches" (W/L badge + score) and "Achievements" + an ELO sparkline
// on a dark plate. Server component: everything is rendered from data that the
// page already loads, the sparkline is a plain inline SVG.
// =============================================================================

export type ProfileOverviewCopy = {
  recent: {
    title: string;
    all: string;
    empty_title: string;
    empty_body: string;
    empty_cta: string;
    won: string;
    lost: string;
    cancelled: string;
  };
  achievements: {
    title: string;
    first_match: string;
    ten_matches: string;
    five_wins: string;
    established: string;
    locked_hint: string;
  };
  chart: {
    title: string;
    empty: string;
  };
};

const RECENT_LIMIT = 5;

export function ProfileOverview({
  locale,
  matches,
  history,
  stats,
  eloStatus,
  copy,
}: {
  locale: string;
  matches: RatingMatchRow[];
  history: EloPoint[];
  stats: { matches_total: number; wins: number };
  eloStatus: "provisional" | "established";
  copy: ProfileOverviewCopy;
}) {
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const recent = matches.slice(0, RECENT_LIMIT);

  const achievements = [
    {
      key: "first_match",
      label: copy.achievements.first_match,
      unlocked: stats.matches_total >= 1,
      icon: Flame,
    },
    {
      key: "five_wins",
      label: copy.achievements.five_wins,
      unlocked: stats.wins >= 5,
      icon: Trophy,
    },
    {
      key: "ten_matches",
      label: copy.achievements.ten_matches,
      unlocked: stats.matches_total >= 10,
      icon: Medal,
    },
    {
      key: "established",
      label: copy.achievements.established,
      unlocked: eloStatus === "established",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Recent matches */}
      <section className="surface-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="section-title text-[18px] md:text-[20px]">{copy.recent.title}</h2>
          <Link
            href="/me/matches"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-grass-700 hover:text-grass-900"
          >
            {copy.recent.all}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title={copy.recent.empty_title}
            description={copy.recent.empty_body}
            ctaLabel={copy.recent.empty_cta}
            ctaHref={`/${locale}/players`}
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((m) => (
              <MatchRow key={m.id} m={m} copy={copy.recent} dateFmt={dateFmt} />
            ))}
          </ul>
        )}
      </section>

      {/* Achievements + ELO sparkline on a dark plate */}
      <div className="space-y-6">
        <section className="surface-card">
          <h2 className="section-title mb-3 flex items-center gap-2 text-[18px] md:text-[20px]">
            <Award className="h-5 w-5 text-ball-600" />
            {copy.achievements.title}
          </h2>
          <ul className="grid grid-cols-2 gap-2.5">
            {achievements.map((a) => (
              <li
                key={a.key}
                title={a.unlocked ? undefined : copy.achievements.locked_hint}
                className={`flex items-center gap-2.5 rounded-xl border p-3 ${
                  a.unlocked
                    ? "border-grass-200 bg-grass-50/70"
                    : "border-ink-100 bg-ink-50/50 opacity-60"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    a.unlocked ? "bg-pt-lime text-[#123320]" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  <a.icon className="h-[18px] w-[18px]" />
                </span>
                <span
                  className={`text-[13px] font-semibold leading-snug ${
                    a.unlocked ? "text-grass-900" : "text-ink-500"
                  }`}
                >
                  {a.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="hero-dark p-5">
          <div className="relative">
            <h2 className="font-display text-[16px] font-bold text-white">{copy.chart.title}</h2>
            <EloSparkline history={history} emptyLabel={copy.chart.empty} />
          </div>
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// Compact match row: opponent, date, W/L badge, score, Elo delta.
// =============================================================================

function MatchRow({
  m,
  copy,
  dateFmt,
}: {
  m: RatingMatchRow;
  copy: ProfileOverviewCopy["recent"];
  dateFmt: Intl.DateTimeFormat;
}) {
  const won = m.i_am_winner === true;
  const cancelled = m.outcome === "cancelled";

  const score = (m.sets ?? [])
    .map((s) => {
      const my = m.is_p1 ? s.p1_games : s.p2_games;
      const their = m.is_p1 ? s.p2_games : s.p1_games;
      return `${my}–${their}`;
    })
    .join(" ");

  return (
    <li className="surface-row flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-[12px] font-bold ${
          cancelled
            ? "bg-ink-100 text-ink-500"
            : won
              ? "bg-pt-lime text-[#123320]"
              : "bg-clay-50 text-clay-700 ring-1 ring-clay-200"
        }`}
        aria-label={cancelled ? copy.cancelled : won ? copy.won : copy.lost}
      >
        {cancelled ? "·" : won ? "W" : "L"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[14px] font-semibold text-ink-900">
          {m.opponent.display_name ?? "—"}
        </p>
        <p className="text-[11px] text-ink-500">{dateFmt.format(new Date(m.played_at))}</p>
      </div>

      {score && (
        <span className="font-mono text-[13px] font-semibold tabular-nums text-ink-800">
          {score}
        </span>
      )}

      {m.delta != null && (
        <span
          className={`font-mono text-[12px] font-bold tabular-nums ${
            m.delta > 0 ? "text-grass-700" : m.delta < 0 ? "text-clay-700" : "text-ink-500"
          }`}
        >
          {m.delta > 0 ? `+${m.delta}` : m.delta}
        </span>
      )}
    </li>
  );
}

// =============================================================================
// ELO sparkline — dependency-free inline SVG polyline, oldest → newest.
// =============================================================================

function EloSparkline({ history, emptyLabel }: { history: EloPoint[]; emptyLabel: string }) {
  if (history.length < 2) {
    return <p className="mt-3 text-[13px] text-white/60">{emptyLabel}</p>;
  }

  const W = 320;
  const H = 84;
  const PAD = 6;
  const values = history.map((p) => p.new_elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${PAD},${H - PAD} ${polyline} ${W - PAD},${H - PAD}`;
  const last = pts[pts.length - 1];

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`ELO ${min}–${max}`}
      >
        <polygon points={area} fill="rgba(195,232,79,0.14)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#C3E84F"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="#C3E84F" />
      </svg>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-white/70">
        <span>{min}</span>
        <span className="text-[15px] font-bold text-white">{values[values.length - 1]}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
