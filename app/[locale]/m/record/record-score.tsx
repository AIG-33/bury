"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { Minus, Plus, Trophy, X } from "lucide-react";
import {
  loadOpponentOptions,
  quickRegisterMatch,
  type OpponentOption,
} from "@/app/[locale]/(player)/me/matches/actions";
import { computeMatchEloDelta } from "@/lib/rating/elo";
import { inferWinnerFromSets, hasAnyGames, type SetScore } from "@/lib/matches/score";
import { MAvatar, MCtaBar, MEyebrow } from "@/components/mobile/m-ui";

// =============================================================================
// Client part of «Записать счёт»: opponent picker (bottom-sheet with search),
// set steppers with big digits (fast input, no keyboard), automatic
// win/loss banner with the ±ELO forecast and the save flow through
// quickRegisterMatch (opponent still confirms before Elo moves).
// =============================================================================

type Labels = {
  title: string;
  close: string;
  you: string;
  vs: string;
  opponent: string;
  opponent_pick: string;
  opponent_search: string;
  opponent_empty: string;
  seg_two: string;
  seg_three: string;
  seg_proset: string;
  sets_eyebrow: string;
  set_label: string;
  win_forecast: string;
  loss_forecast: string;
  save: string;
  saving: string;
  saved_title: string;
  saved_body: string;
  to_matches: string;
  error: string;
  minus: string;
  plus: string;
};

type Props = {
  me: { name: string | null; avatar: string | null; elo: number; ratedMatches: number };
  labels: Labels;
};

type Format = "two" | "three" | "proset";

const SET_COUNT: Record<Format, number> = { two: 2, three: 3, proset: 1 };
// 11 games allows tiebreak sets to 10 (11:9, 11:10) and champion's tiebreaks
// recorded as a set (10:8); the server accepts up to 20 per side anyway.
const MAX_GAMES: Record<Format, number> = { two: 11, three: 11, proset: 11 };

export function RecordScore({ me, labels }: Props) {
  const router = useRouter();
  const [opponent, setOpponent] = useState<OpponentOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [format, setFormat] = useState<Format>("two");
  const [sets, setSets] = useState<Array<{ me: number; opp: number }>>([
    { me: 0, opp: 0 },
    { me: 0, opp: 0 },
    { me: 0, opp: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const visibleSets = sets.slice(0, SET_COUNT[format]);

  const scoreSets: SetScore[] = visibleSets.map((s) => ({ p1_games: s.me, p2_games: s.opp }));
  const winner = hasAnyGames(scoreSets) ? inferWinnerFromSets(scoreSets) : null;

  // Cheap pure math — no memoization needed. Opponent's rated-matches count
  // isn't public; assume an established player — the confirmed match
  // recalculates the exact value anyway.
  const forecast =
    winner && opponent
      ? computeMatchEloDelta({
          p1Elo: me.elo,
          p2Elo: opponent.current_elo,
          p1Matches: me.ratedMatches,
          p2Matches: 30,
          winnerSide: winner,
          kind: "friendly",
        }).p1Delta
      : null;

  const bump = (index: number, side: "me" | "opp", dir: 1 | -1) => {
    setSets((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, [side]: Math.min(MAX_GAMES[format], Math.max(0, s[side] + dir)) } : s,
      ),
    );
  };

  const canSave = !!opponent && !!winner && !pending;

  const submit = () => {
    if (!opponent || !winner) return;
    setError(null);
    startTransition(async () => {
      const res = await quickRegisterMatch({
        opponent_id: opponent.id,
        sets: scoreSets,
      });
      if (res.ok) {
        setSaved(true);
      } else {
        setError(labels.error);
      }
    });
  };

  if (saved) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-[18px] text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ball-100 text-grass-700">
          <Trophy className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 font-display text-[20px] font-extrabold tracking-[-0.5px] text-grass-900">
          {labels.saved_title}
        </h1>
        <p className="mt-2 max-w-[300px] text-[13px] leading-[1.45] text-ink-500">
          {labels.saved_body}
        </p>
        <button
          type="button"
          onClick={() => router.push("/m/matches" as never)}
          className="mt-6 flex h-12 items-center justify-center rounded-[15px] bg-pt-primary px-8 font-display text-[14.5px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
        >
          {labels.to_matches}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---- Modal-like header ---- */}
      <header
        className="sticky top-0 z-40 border-b border-[rgba(20,60,30,0.07)] bg-[rgba(243,247,237,0.92)] backdrop-blur-[12px]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between px-[18px] pb-3 pt-1">
          <h1 className="font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.6px] text-grass-900">
            {labels.title}
          </h1>
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => router.back()}
            className="grid h-10 w-10 place-items-center rounded-[12px] border border-[rgba(20,60,30,0.1)] bg-white text-grass-900 transition-opacity active:opacity-85"
          >
            <X className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-[430px] flex-1 px-[18px] pt-4"
        style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 168px)" }}
      >
        {/* ---- You vs opponent ---- */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5">
          <div className="flex flex-col items-center gap-1.5 rounded-[16px] border border-ball-600/35 bg-ball-100 px-2 py-3.5">
            <MAvatar name={me.name} url={me.avatar} size={46} ring />
            <p className="w-full truncate text-center text-[13px] font-extrabold text-ink-900">
              {labels.you}
            </p>
            <p className="font-mono text-[11px] font-bold tabular-nums text-grass-600">
              ELO {me.elo}
            </p>
          </div>

          <span className="self-center font-display text-[13px] font-extrabold text-[#8AA093]">
            {labels.vs}
          </span>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={[
              "flex flex-col items-center gap-1.5 rounded-[16px] px-2 py-3.5 transition-opacity active:opacity-85",
              opponent
                ? "border border-[rgba(20,60,30,0.06)] bg-white shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                : "border border-dashed border-[rgba(20,60,30,0.25)] bg-white/60",
            ].join(" ")}
          >
            {opponent ? (
              <>
                <MAvatar name={opponent.display_name} size={46} />
                <p className="w-full truncate text-center text-[13px] font-extrabold text-ink-900">
                  {opponent.display_name}
                </p>
                <p className="font-mono text-[11px] font-bold tabular-nums text-grass-600">
                  ELO {opponent.current_elo}
                </p>
              </>
            ) : (
              <>
                <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-ink-50 text-[#8AA093]">
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </span>
                <p className="text-[13px] font-extrabold text-ink-700">{labels.opponent}</p>
                <p className="text-[11px] font-semibold text-[#8AA093]">{labels.opponent_pick}</p>
              </>
            )}
          </button>
        </div>

        {/* ---- Format segment ---- */}
        <div className="mt-4 flex rounded-[12px] bg-[#E3ECD8] p-1">
          {(
            [
              ["two", labels.seg_two],
              ["three", labels.seg_three],
              ["proset", labels.seg_proset],
            ] as Array<[Format, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              className={[
                "flex-1 rounded-[9px] px-2 py-2 text-center font-display text-[12.5px] font-bold leading-none transition-opacity active:opacity-85",
                format === value
                  ? "bg-white text-grass-600 shadow-[0_1px_3px_rgba(20,60,30,0.12)]"
                  : "text-ink-500",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---- Set steppers ---- */}
        <MEyebrow className="mb-2.5 mt-5">{labels.sets_eyebrow}</MEyebrow>
        <div className="space-y-[10px]">
          {visibleSets.map((set, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
            >
              <p className="w-[44px] shrink-0 text-[12px] font-bold text-ink-500">
                {labels.set_label} {i + 1}
              </p>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <Stepper
                  onClick={() => bump(i, "me", -1)}
                  ariaLabel={`${labels.minus} — ${labels.you}`}
                >
                  <Minus className="h-4 w-4" strokeWidth={2.2} />
                </Stepper>
                <span className="w-[34px] text-center font-mono text-[24px] font-bold tabular-nums text-ink-900">
                  {set.me}
                </span>
                <Stepper
                  onClick={() => bump(i, "me", 1)}
                  ariaLabel={`${labels.plus} — ${labels.you}`}
                  accent
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </Stepper>
              </div>
              <span className="px-1 text-[15px] font-bold text-[#A7B5A9]">:</span>
              <div className="flex flex-1 items-center gap-1.5">
                <Stepper
                  onClick={() => bump(i, "opp", -1)}
                  ariaLabel={`${labels.minus} — ${labels.opponent}`}
                >
                  <Minus className="h-4 w-4" strokeWidth={2.2} />
                </Stepper>
                <span className="w-[34px] text-center font-mono text-[24px] font-bold tabular-nums text-ink-900">
                  {set.opp}
                </span>
                <Stepper
                  onClick={() => bump(i, "opp", 1)}
                  ariaLabel={`${labels.plus} — ${labels.opponent}`}
                  accent
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </Stepper>
              </div>
            </div>
          ))}
        </div>

        {/* ---- Auto result + ELO forecast ---- */}
        {winner ? (
          <div
            className={[
              "mt-4 flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 font-display text-[13.5px] font-extrabold",
              winner === "p1" ? "bg-ball-100 text-grass-800" : "bg-clay-100 text-clay-600",
            ].join(" ")}
          >
            <Trophy className="h-[16px] w-[16px]" strokeWidth={2} />
            {winner === "p1" ? labels.win_forecast : labels.loss_forecast}
            {forecast != null ? (
              <span className="font-mono tabular-nums">
                · {forecast >= 0 ? `+${forecast}` : forecast} ELO
              </span>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-[12px] bg-clay-100 px-3 py-2 text-[12px] font-bold text-clay-600">
            {error}
          </p>
        ) : null}
      </div>

      <MCtaBar aboveTabBar>
        <button
          type="button"
          disabled={!canSave}
          onClick={submit}
          className="flex h-[50px] w-full items-center justify-center rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85 disabled:opacity-50"
        >
          {pending ? labels.saving : labels.save}
        </button>
      </MCtaBar>

      {pickerOpen ? (
        <OpponentPicker
          labels={labels}
          onClose={() => setPickerOpen(false)}
          onPick={(o) => {
            setOpponent(o);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function Stepper({
  onClick,
  ariaLabel,
  accent = false,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "grid h-9 w-9 shrink-0 place-items-center rounded-[11px] transition-opacity active:opacity-85",
        accent ? "bg-pt-icon text-grass-600" : "bg-ink-50 text-ink-500",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function OpponentPicker({
  labels,
  onClose,
  onPick,
}: {
  labels: Labels;
  onClose: () => void;
  onPick: (o: OpponentOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<OpponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const rows = await loadOpponentOptions(query);
      if (requestId.current === id) {
        setOptions(rows);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={labels.close}
        className="absolute inset-0 bg-grass-900/45"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[78dvh] w-full max-w-[430px] flex-col rounded-t-[24px] bg-white px-[18px] pt-4"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          animation: "mPickerUp 250ms cubic-bezier(.4,0,.2,1) both",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-100" aria-hidden />
        <h2 className="font-display text-[18px] font-extrabold tracking-[-0.4px] text-grass-900">
          {labels.opponent}
        </h2>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.opponent_search}
          // 16px: anything smaller makes iOS Safari auto-zoom on focus.
          className="mt-3 h-11 w-full rounded-[13px] border border-[rgba(20,60,30,0.1)] bg-[#F6FAF1] px-4 text-[16px] font-medium text-ink-900 outline-none placeholder:text-[#8AA093] focus:border-grass-500"
        />

        <div className="mt-3 flex-1 overflow-y-auto pb-2">
          {loading ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[56px] animate-pulse rounded-[13px] bg-ink-50" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <p className="px-1 py-6 text-center text-[12.5px] font-semibold text-ink-500">
              {labels.opponent_empty}
            </p>
          ) : (
            <ul className="space-y-1">
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onPick(o)}
                    className="flex h-[56px] w-full items-center gap-3 rounded-[13px] px-2 transition-colors active:bg-[#EFF5E7]"
                  >
                    <MAvatar name={o.display_name} size={38} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14px] font-extrabold text-ink-900">
                        {o.display_name}
                      </span>
                      {o.city ? (
                        <span className="block truncate text-[11px] font-semibold text-ink-500">
                          {o.city}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums text-grass-600">
                      {o.current_elo}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style>{`@keyframes mPickerUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}
