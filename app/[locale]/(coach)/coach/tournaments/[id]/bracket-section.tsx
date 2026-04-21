"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trophy, Shuffle } from "lucide-react";
import { generateBracket, setMatchScore, type MatchRow } from "../actions";
import {
  type SeedingMethod,
  SEEDING_METHODS,
  MatchOutcomeInputs,
  type MatchOutcomeInput,
  type MatchRules,
} from "@/lib/tournaments/schema";

export type BracketCopy = {
  title: string;
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
  error: string;
  insufficient_players: string;
};

export function BracketSection({
  tournamentId,
  matches,
  copy,
  participantsCount,
  initialMethod,
  format,
  matchRules,
}: {
  tournamentId: string;
  matches: MatchRow[];
  copy: BracketCopy;
  participantsCount: number;
  initialMethod: SeedingMethod;
  format: string;
  matchRules: MatchRules;
}) {
  const t = useTranslations("tournamentsCoach.bracket");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [method, setMethod] = useState<SeedingMethod>(initialMethod);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of matches) {
      const r = m.round ?? 0;
      const arr = map.get(r) ?? [];
      arr.push(m);
      map.set(r, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [matches]);

  function onGenerate() {
    if (matches.length > 0 && !confirm(copy.regenerate_warning)) return;
    startT(async () => {
      const r = await generateBracket(tournamentId, { method });
      if (r.ok) router.refresh();
      else alert(`${copy.error}: ${r.error}`);
    });
  }

  if (format !== "single_elimination" && format !== "round_robin") {
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

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
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
            className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-500 px-3 text-xs font-semibold text-white transition hover:bg-grass-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Shuffle className="h-3 w-3" />
            )}
            {pending ? copy.generating : copy.generate}
          </button>
        </div>
      </div>

      {participantsCount < 2 && (
        <p className="mt-2 rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-800">
          {copy.insufficient_players}
        </p>
      )}

      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">{copy.no_matches}</p>
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
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match,
  copy,
  matchRules,
  editingId,
  setEditingId,
  onSaved,
  pending,
  startT,
}: {
  match: MatchRow;
  copy: BracketCopy;
  matchRules: MatchRules;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onSaved: () => void;
  pending: boolean;
  startT: (cb: () => void) => void;
}) {
  const isEditing = editingId === match.id;
  const isFinal = match.outcome === "completed" || match.outcome.startsWith("walkover_") ||
    match.outcome.startsWith("retired_") || match.outcome.startsWith("dsq_");

  const p1Cls = match.winner_side === "p1" ? "font-semibold text-grass-800" : "text-ink-800";
  const p2Cls = match.winner_side === "p2" ? "font-semibold text-grass-800" : "text-ink-800";

  return (
    <div className="rounded-lg border border-ink-100 bg-grass-50/30 p-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className={p1Cls}>{match.p1_name ?? copy.tbd}</span>
        <span className="font-mono text-xs text-ink-500">
          {scoreSummary(match.sets, "p1")}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-sm">
        <span className={p2Cls}>{match.p2_name ?? (match.outcome === "walkover_p1" ? copy.bye : copy.tbd)}</span>
        <span className="font-mono text-xs text-ink-500">
          {scoreSummary(match.sets, "p2")}
        </span>
      </div>

      {match.winner_side && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-grass-700">
          <Trophy className="h-3 w-3" />
          {match.winner_side === "p1" ? match.p1_name : match.p2_name}
        </p>
      )}

      {match.p1_id && match.p2_id && (
        <div className="mt-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setEditingId(match.id)}
              disabled={pending}
              className="text-[11px] font-medium text-grass-700 underline hover:text-grass-900"
            >
              {isFinal ? copy.edit_score : copy.edit_score}
            </button>
          ) : (
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
                    alert(`${copy.error}: ${r.error}`);
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

function scoreSummary(
  sets: MatchRow["sets"],
  side: "p1" | "p2",
): string {
  if (!sets || sets.length === 0) return "—";
  return sets.map((s) => (side === "p1" ? s.p1 : s.p2)).join(" ");
}

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
  const initialSets = match.sets && match.sets.length > 0
    ? match.sets.map((s) => ({ p1: s.p1, p2: s.p2 }))
    : suggestInitialSets(matchRules);

  const [outcome, setOutcome] = useState<MatchOutcomeInput>(
    (MatchOutcomeInputs.includes(match.outcome as MatchOutcomeInput)
      ? (match.outcome as MatchOutcomeInput)
      : "completed"),
  );
  const [sets, setSets] = useState(initialSets);

  function updateSet(i: number, side: "p1" | "p2", val: number) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [side]: val } : s)));
  }

  function addSet() {
    setSets((prev) => (prev.length >= 5 ? prev : [...prev, { p1: 0, p2: 0 }]));
  }
  function removeSet(i: number) {
    setSets((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2 rounded-md border border-grass-200 bg-white p-2">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase text-ink-600">
          {copy.outcome_label}
        </label>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as MatchOutcomeInput)}
          className="h-8 w-full rounded-md border border-ink-200 bg-white px-2 text-xs"
        >
          {MatchOutcomeInputs.map((o) => (
            <option key={o} value={o}>
              {copy.outcome_labels[o]}
            </option>
          ))}
        </select>
      </div>

      {outcome === "completed" && (
        <div className="space-y-1">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-10 text-[10px] text-ink-500">
                {copy.set} {i + 1}
              </span>
              <input
                type="number"
                min={0}
                max={20}
                value={s.p1}
                onChange={(e) => updateSet(i, "p1", Number(e.target.value))}
                className="h-7 w-12 rounded-md border border-ink-200 bg-white px-2 text-center text-xs"
              />
              <span className="text-xs text-ink-400">:</span>
              <input
                type="number"
                min={0}
                max={20}
                value={s.p2}
                onChange={(e) => updateSet(i, "p2", Number(e.target.value))}
                className="h-7 w-12 rounded-md border border-ink-200 bg-white px-2 text-center text-xs"
              />
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
          ))}
          {sets.length < 5 && (
            <button
              type="button"
              onClick={addSet}
              className="text-[10px] font-medium text-grass-700 underline hover:text-grass-900"
            >
              + {copy.add_set}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-md border border-ink-200 px-2 text-xs text-ink-700 hover:bg-ink-50"
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
          className="inline-flex h-7 items-center gap-1 rounded-md bg-grass-500 px-2 text-xs font-semibold text-white hover:bg-grass-600 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {pending ? copy.saving : copy.save}
        </button>
      </div>
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
