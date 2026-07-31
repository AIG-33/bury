"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trophy, Shuffle, UserRoundPen } from "lucide-react";
import {
  generateBracket,
  setMatchScore,
  editPlayoffSlot,
  type MatchRow,
  type ParticipantRow,
} from "../actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import { PlayerNameLink } from "@/components/domain/player-name-link";
import {
  type SeedingMethod,
  SEEDING_METHODS,
  MatchOutcomeInputs,
  type MatchOutcomeInput,
  type MatchRules,
} from "@/lib/tournaments/schema";

export type BracketCopy = {
  title: string;
  playoff_title: string;
  playoff_pending: string;
  third_place_label: string;
  generate: string;
  generating: string;
  regenerate_warning: string;
  no_matches: string;
  not_supported: string;
  draw_method: string;
  draw_method_labels: Record<SeedingMethod, string>;
  round: string;
  bye: string;
  tbd: string;
  edit_score: string;
  save: string;
  saving: string;
  cancel: string;
  outcome_label: string;
  outcome_labels: Record<MatchOutcomeInput, string>;
  add_set: string;
  remove_set: string;
  set: string;
  quick_scores?: string;
  special_result?: string;
  error: string;
  insufficient_players: string;
  edit_players?: string;
  edit_players_hint?: string;
  slot_empty?: string;
};

/** Option for the manual slot editor: an approved tournament participant. */
export type SlotPlayerOption = { id: string; label: string };

export function BracketSection({
  tournamentId,
  matches,
  copy,
  participantsCount,
  initialMethod,
  format,
  matchRules,
  participants,
}: {
  tournamentId: string;
  matches: MatchRow[];
  copy: BracketCopy;
  participantsCount: number;
  initialMethod: SeedingMethod;
  format: string;
  matchRules: MatchRules;
  /** Enables the manual "replace player in a playoff pair" editor. */
  participants?: ParticipantRow[];
}) {
  const t = useTranslations("tournamentsOrganized.bracket");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [method, setMethod] = useState<SeedingMethod>(initialMethod);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isHybrid = format === "group_playoff";
  // For hybrid tournaments BracketSection only displays the PLAYOFF part —
  // the group stage is owned by <GroupsSection>. For other formats we display
  // everything (legacy behaviour: stage is null).
  const visibleMatches = useMemo(
    () =>
      isHybrid ? matches.filter((m) => m.stage === "playoff" || m.stage === "third_place") : matches,
    [matches, isHybrid],
  );

  const playoffMatches = useMemo(
    () => visibleMatches.filter((m) => m.stage !== "third_place"),
    [visibleMatches],
  );
  const thirdPlace = useMemo(
    () => visibleMatches.find((m) => m.stage === "third_place") ?? null,
    [visibleMatches],
  );

  const grouped = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of playoffMatches) {
      const r = m.round ?? 0;
      const arr = map.get(r) ?? [];
      arr.push(m);
      map.set(r, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [playoffMatches]);

  // Manual slot editing applies to elimination trees only (playoff of a
  // hybrid and pure single-elimination) — round-robin has no bracket slots.
  // Options: approved, non-withdrawn participants (a doubles pair renders as
  // one "Иванов / Петров" line keyed by the pair captain).
  const effectiveSlotOptions = useMemo<SlotPlayerOption[] | undefined>(() => {
    if (!participants || (!isHybrid && format !== "single_elimination")) return undefined;
    return participants
      .filter((p) => p.status === "approved" && !p.withdrawn)
      .map((p) => ({
        id: p.player_id,
        label: (p.display_name ?? p.player_id) + (p.partner_name ? ` / ${p.partner_name}` : ""),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [participants, isHybrid, format]);

  function onGenerate() {
    if (matches.length > 0 && !confirm(copy.regenerate_warning)) return;
    startT(async () => {
      const r = await generateBracket(tournamentId, { method });
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  if (format !== "single_elimination" && format !== "round_robin" && format !== "group_playoff") {
    return (
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
        <p className="mt-2 rounded-lg bg-ball-50 px-3 py-2 text-sm text-ball-900">
          {copy.not_supported}
        </p>
      </section>
    );
  }

  const totalRounds = grouped.length;
  // For hybrids the "Generate" button is replaced by group-stage + close-groups
  // UI in <GroupsSection>. BracketSection only renders the resulting bracket.
  const showGenerate = !isHybrid;

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {isHybrid ? copy.playoff_title : copy.title}
        </h2>
        {showGenerate && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-ink-700">
              {copy.draw_method}
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as SeedingMethod)}
                className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs"
              >
                {SEEDING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {copy.draw_method_labels[m]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onGenerate}
              disabled={pending || participantsCount < 2}
              className="inline-flex h-8 items-center gap-1 rounded-[11px] bg-pt-primary px-3 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
              {pending ? copy.generating : copy.generate}
            </button>
          </div>
        )}
      </div>

      {showGenerate && participantsCount < 2 && (
        <p className="mt-2 rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-800">
          {copy.insufficient_players}
        </p>
      )}

      {playoffMatches.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          {isHybrid ? copy.playoff_pending : copy.no_matches}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {grouped.map(([round, rms]) => (
            <div key={round} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-grass-700">
                {t("round_label", { n: round, total: totalRounds })}
              </p>
              {rms.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  copy={copy}
                  matchRules={matchRules}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onSaved={() => router.refresh()}
                  pending={pending}
                  startT={startT}
                  slotOptions={effectiveSlotOptions}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {isHybrid && thirdPlace && (
        <div className="mt-6 border-t border-ink-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-clay-700">
            {copy.third_place_label}
          </p>
          <div className="mt-2 max-w-sm">
            <MatchCard
              match={thirdPlace}
              copy={copy}
              matchRules={matchRules}
              editingId={editingId}
              setEditingId={setEditingId}
              onSaved={() => router.refresh()}
              pending={pending}
              startT={startT}
              slotOptions={effectiveSlotOptions}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export function MatchCard({
  match,
  copy,
  matchRules,
  editingId,
  setEditingId,
  onSaved,
  pending,
  startT,
  slotOptions,
}: {
  match: MatchRow;
  copy: BracketCopy;
  matchRules: MatchRules;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onSaved: () => void;
  pending: boolean;
  startT: (cb: () => void) => void;
  /** When present, unplayed matches expose the manual player-slot editor. */
  slotOptions?: SlotPlayerOption[];
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const isEditing = editingId === match.id;
  const [editingSlots, setEditingSlots] = useState(false);
  // A match is slot-editable while it has no recorded result: pending, or an
  // auto-bye (walkover with an empty side) that never had sets entered.
  const slotEditable =
    !!slotOptions &&
    (match.outcome === "pending" ||
      ((match.outcome === "walkover_p1" || match.outcome === "walkover_p2") &&
        (match.p1_id == null || match.p2_id == null) &&
        (!match.sets || match.sets.length === 0)));
  const winner = match.winner_side;
  const p1Cls =
    winner === "p1"
      ? "font-semibold text-grass-900"
      : winner === "p2"
        ? "text-ink-500"
        : "text-ink-800";
  const p2Cls =
    winner === "p2"
      ? "font-semibold text-grass-900"
      : winner === "p1"
        ? "text-ink-500"
        : "text-ink-800";
  const score1Cls =
    "font-mono tabular-nums " +
    (winner === "p1"
      ? "font-bold text-grass-900"
      : winner === "p2"
        ? "text-ink-500"
        : "text-ink-700");
  const score2Cls =
    "font-mono tabular-nums " +
    (winner === "p2"
      ? "font-bold text-grass-900"
      : winner === "p1"
        ? "text-ink-500"
        : "text-ink-700");

  return (
    <div className="rounded-lg border border-ink-100 bg-grass-50/30 p-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={`flex-1 truncate ${p1Cls}`}>
          <PlayerNameLink id={match.p1_id} name={match.p1_name} fallback={copy.tbd} />
        </span>
        <span className={`text-sm ${score1Cls}`}>{scoreSummary(match.sets, "p1")}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
        <span className={`flex-1 truncate ${p2Cls}`}>
          <PlayerNameLink
            id={match.p2_id}
            name={match.p2_name}
            fallback={match.outcome === "walkover_p1" ? copy.bye : copy.tbd}
          />
        </span>
        <span className={`text-sm ${score2Cls}`}>{scoreSummary(match.sets, "p2")}</span>
      </div>

      {winner && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-grass-700">
          <Trophy className="h-3 w-3" />
          {winner === "p1" ? match.p1_name : match.p2_name}
        </p>
      )}

      {(match.p1_id || match.p2_id || slotEditable) && (
        <div className="mt-2">
          {!isEditing && (
            <div className="flex flex-wrap items-center gap-2">
              {match.p1_id && match.p2_id && (
                <button
                  type="button"
                  onClick={() => setEditingId(match.id)}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-md border border-grass-300 bg-white px-3 text-xs font-medium text-grass-700 hover:bg-grass-50 disabled:opacity-60"
                >
                  {copy.edit_score}
                </button>
              )}
              {slotEditable && (
                <button
                  type="button"
                  onClick={() => setEditingSlots((v) => !v)}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60"
                >
                  <UserRoundPen className="h-3 w-3" />
                  {copy.edit_players ?? "Участники"}
                </button>
              )}
            </div>
          )}
          {!isEditing && editingSlots && slotEditable && slotOptions && (
            <SlotEditor
              match={match}
              options={slotOptions}
              copy={copy}
              pending={pending}
              startT={startT}
              onSaved={onSaved}
            />
          )}
          {isEditing && match.p1_id && match.p2_id && (
            <ScoreEditor
              match={match}
              copy={copy}
              matchRules={matchRules}
              onCancel={() => setEditingId(null)}
              onSubmit={(values) => {
                startT(async () => {
                  const r = await setMatchScore(values);
                  if (r.ok) {
                    setEditingId(null);
                    onSaved();
                  } else {
                    alert(localizeActionError(tErrors, r.error));
                  }
                });
              }}
              pending={pending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function scoreSummary(sets: MatchRow["sets"], side: "p1" | "p2"): string {
  if (!sets || sets.length === 0) return "—";
  return sets.map((s) => (side === "p1" ? s.p1 : s.p2)).join(" ");
}

/**
 * Manual bracket fix-up: two selects (one per side) listing every approved
 * participant. Picking a player calls the server action immediately; the
 * empty option clears the slot (TBD). Only unplayed matches get here.
 */
function SlotEditor({
  match,
  options,
  copy,
  pending,
  startT,
  onSaved,
}: {
  match: MatchRow;
  options: SlotPlayerOption[];
  copy: BracketCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onSaved: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");

  function apply(side: "p1" | "p2", playerId: string) {
    startT(async () => {
      const r = await editPlayoffSlot({
        match_id: match.id,
        side,
        player_id: playerId === "" ? null : playerId,
      });
      if (r.ok) onSaved();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  const row = (side: "p1" | "p2") => {
    const current = side === "p1" ? match.p1_id : match.p2_id;
    return (
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => apply(side, e.target.value)}
        className="h-8 w-full rounded-md border border-ink-200 bg-white px-1.5 text-xs text-ink-800"
        aria-label={copy.edit_players ?? "Участники"}
      >
        <option value="">{copy.slot_empty ?? `— ${copy.tbd} —`}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-ink-200 bg-white p-2">
      {copy.edit_players_hint && <p className="text-[10px] text-ink-500">{copy.edit_players_hint}</p>}
      {row("p1")}
      {row("p2")}
    </div>
  );
}

// Quick-tap presets — most common tennis set scores. Tapping one fills both
// sides of the current set in a single click; designed to make mobile data
// entry feel like a chat reaction picker, not a spreadsheet.
const QUICK_SCORES: Array<{ p1: number; p2: number }> = [
  { p1: 6, p2: 0 },
  { p1: 6, p2: 1 },
  { p1: 6, p2: 2 },
  { p1: 6, p2: 3 },
  { p1: 6, p2: 4 },
  { p1: 7, p2: 5 },
  { p1: 7, p2: 6 },
];

function ScoreEditor({
  match,
  copy,
  matchRules,
  onCancel,
  onSubmit,
  pending,
}: {
  match: MatchRow;
  copy: BracketCopy;
  matchRules: MatchRules;
  onCancel: () => void;
  onSubmit: (v: {
    match_id: string;
    outcome: MatchOutcomeInput;
    sets: Array<{ p1: number; p2: number }>;
  }) => void;
  pending: boolean;
}) {
  const initialSets =
    match.sets && match.sets.length > 0
      ? match.sets.map((s) => ({ p1: s.p1, p2: s.p2 }))
      : suggestInitialSets(matchRules);

  const [outcome, setOutcome] = useState<MatchOutcomeInput>(
    MatchOutcomeInputs.includes(match.outcome as MatchOutcomeInput)
      ? (match.outcome as MatchOutcomeInput)
      : "completed",
  );
  const [sets, setSets] = useState(initialSets);
  // Currently focused set — we auto-advance to it when applying a preset.
  const [activeIdx, setActiveIdx] = useState(0);

  function updateSet(i: number, side: "p1" | "p2", val: number) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [side]: val } : s)));
    setActiveIdx(i);
  }

  function addSet() {
    setSets((prev) => {
      if (prev.length >= 5) return prev;
      const next = [...prev, { p1: 0, p2: 0 }];
      setActiveIdx(next.length - 1);
      return next;
    });
  }
  function removeSet(i: number) {
    setSets((prev) => prev.filter((_, idx) => idx !== i));
    setActiveIdx((idx) => Math.max(0, Math.min(idx, sets.length - 2)));
  }

  function applyPreset(preset: { p1: number; p2: number }, mirror: boolean) {
    setSets((prev) => {
      const i = activeIdx >= prev.length ? prev.length - 1 : activeIdx;
      return prev.map((s, idx) =>
        idx === i
          ? mirror
            ? { p1: preset.p2, p2: preset.p1 }
            : { p1: preset.p1, p2: preset.p2 }
          : s,
      );
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-grass-200 bg-white p-3 shadow-sm">
      {/* Outcome — only show the dropdown when result is non-standard. */}
      {outcome !== "completed" && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-ink-600">
            {copy.outcome_label}
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as MatchOutcomeInput)}
            className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm"
          >
            {MatchOutcomeInputs.map((o) => (
              <option key={o} value={o}>
                {copy.outcome_labels[o]}
              </option>
            ))}
          </select>
        </div>
      )}

      {outcome === "completed" && (
        <>
          {/* Per-set picker — large tap-friendly digit chips */}
          <div className="space-y-2.5">
            {sets.map((s, i) => {
              const winner = setWinner(s);
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-2 transition ${
                    activeIdx === i
                      ? "border-grass-400 bg-grass-50/60"
                      : "border-ink-100 bg-white"
                  }`}
                  onPointerDown={() => setActiveIdx(i)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      {copy.set} {i + 1}
                    </span>
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(i)}
                        className="text-[10px] text-clay-600 underline"
                      >
                        {copy.remove_set}
                      </button>
                    )}
                  </div>
                  <DigitRow
                    value={s.p1}
                    onChange={(v) => updateSet(i, "p1", v)}
                    winner={winner === "p1"}
                    maxGames={maxSelectableGames(matchRules)}
                  />
                  <div className="mt-1.5">
                    <DigitRow
                      value={s.p2}
                      onChange={(v) => updateSet(i, "p2", v)}
                      winner={winner === "p2"}
                      maxGames={maxSelectableGames(matchRules)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick-fill presets — tap to apply 6-0…7-6 to active set in 1 click */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {copy.quick_scores ?? "Быстрый счёт"}
            </p>
            <div className="flex flex-wrap gap-1">
              {QUICK_SCORES.map((p) => (
                <button
                  key={`${p.p1}-${p.p2}`}
                  type="button"
                  onClick={() => applyPreset(p, false)}
                  className="inline-flex h-8 items-center rounded-md border border-ink-200 bg-white px-2 font-mono text-xs tabular-nums text-ink-700 hover:border-grass-400 hover:bg-grass-50"
                >
                  {p.p1}–{p.p2}
                </button>
              ))}
              {QUICK_SCORES.map((p) => (
                <button
                  key={`m-${p.p1}-${p.p2}`}
                  type="button"
                  onClick={() => applyPreset(p, true)}
                  className="inline-flex h-8 items-center rounded-md border border-ink-200 bg-white px-2 font-mono text-xs tabular-nums text-ink-700 hover:border-clay-400 hover:bg-clay-50"
                >
                  {p.p2}–{p.p1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sets.length < 5 && (
              <button
                type="button"
                onClick={addSet}
                className="inline-flex h-8 items-center rounded-md border border-grass-300 bg-white px-2 text-xs font-medium text-grass-700 hover:bg-grass-50"
              >
                + {copy.add_set}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOutcome("walkover_p1")}
              className="ml-auto text-[10px] text-ink-500 underline hover:text-ink-800"
            >
              {copy.special_result ?? "Спец. исход"}
            </button>
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-ink-200 px-3 text-sm text-ink-700 hover:bg-ink-50"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSubmit({
              match_id: match.id,
              outcome,
              sets: outcome === "completed" ? sets : [],
            })
          }
          className="inline-flex h-9 items-center gap-1 rounded-[11px] bg-pt-primary px-4 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? copy.saving : copy.save}
        </button>
      </div>
    </div>
  );
}

function setWinner(s: { p1: number; p2: number }): "p1" | "p2" | null {
  if (s.p1 === 0 && s.p2 === 0) return null;
  if (s.p1 > s.p2) return "p1";
  if (s.p2 > s.p1) return "p2";
  return null;
}

/**
 * Highest games count that can appear in one set under the given rules —
 * defines the digit-picker range. E.g. set to 6 (TB at 6) → 7; set to 10
 * (tiebreak set) → 11; pro-set to 8 → 9.
 */
function maxSelectableGames(rules: MatchRules): number {
  switch (rules.kind) {
    case "best_of_3":
    case "best_of_5":
    case "single_set":
      return Math.max(rules.set_target, rules.set_tiebreak_at) + 1;
    case "pro_set":
      return rules.target_games + 1;
    case "first_to_games":
      return rules.target_games;
    case "timed":
      return 12;
  }
}

function DigitRow({
  value,
  onChange,
  winner,
  maxGames,
}: {
  value: number;
  onChange: (v: number) => void;
  winner: boolean;
  maxGames: number;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: maxGames + 1 }, (_, d) => d).map((d) => {
        const selected = d === value;
        return (
          <button
            key={d}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(d)}
            className={`h-9 w-9 rounded-md border text-sm font-semibold tabular-nums transition ${
              selected
                ? winner
                  ? "border-grass-600 bg-grass-600 text-white shadow-sm"
                  : "border-grass-500 bg-grass-100 text-grass-900"
                : "border-ink-200 bg-white text-ink-700 hover:border-grass-300 hover:bg-grass-50"
            }`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

function suggestInitialSets(rules: MatchRules): Array<{ p1: number; p2: number }> {
  switch (rules.kind) {
    case "best_of_3":
      return [
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
      ];
    case "best_of_5":
      return [
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
      ];
    default:
      return [{ p1: 0, p2: 0 }];
  }
}
