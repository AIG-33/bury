"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Search, Trash2, User, Users, X } from "lucide-react";
import {
  loadOpponentOptions,
  quickRegisterMatch,
  type OpponentOption,
} from "./actions";

type SetRow = {
  p1_games: number;
  p2_games: number;
  tiebreak_p1?: number | null;
  tiebreak_p2?: number | null;
};

const NEW_SET = (): SetRow => ({ p1_games: 0, p2_games: 0 });

export function QuickRegisterDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("myMatches.quick");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<OpponentOption[]>([]);
  const [isDoubles, setIsDoubles] = useState(false);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [myPartnerId, setMyPartnerId] = useState<string | null>(null);
  const [opponentPartnerId, setOpponentPartnerId] = useState<string | null>(null);
  const [playedAt, setPlayedAt] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState<SetRow[]>([NEW_SET(), NEW_SET()]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(async () => {
      const list = await loadOpponentOptions(query);
      setOptions(list);
    }, 200);
    return () => clearTimeout(id);
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setQuery("");
      setIsDoubles(false);
      setOpponentId(null);
      setMyPartnerId(null);
      setOpponentPartnerId(null);
      setPlayedAt("");
      setNotes("");
      setSets([NEW_SET(), NEW_SET()]);
    }
  }, [open]);

  if (!open) return null;

  function setSet(i: number, patch: Partial<SetRow>) {
    setSets((s) => {
      const next = [...s];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function handleSubmit() {
    if (!opponentId) {
      setError(t("error_no_opponent"));
      return;
    }
    if (isDoubles && (!myPartnerId || !opponentPartnerId)) {
      setError(t("error_no_partner"));
      return;
    }
    setError(null);
    start(async () => {
      const cleanSets = sets
        .filter((s) => s.p1_games + s.p2_games > 0)
        .map((s) => ({
          p1_games: s.p1_games,
          p2_games: s.p2_games,
          tiebreak_p1: s.tiebreak_p1 ?? null,
          tiebreak_p2: s.tiebreak_p2 ?? null,
        }));
      const res = await quickRegisterMatch({
        opponent_id: opponentId,
        is_doubles: isDoubles,
        my_partner_id: isDoubles ? myPartnerId : null,
        opponent_partner_id: isDoubles ? opponentPartnerId : null,
        sets: cleanSets,
        played_at: playedAt ? new Date(playedAt).toISOString() : null,
        notes: notes || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  // Every picker excludes players already selected in the other slots.
  const takenIds = new Set(
    [opponentId, myPartnerId, opponentPartnerId].filter((x): x is string => x != null),
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl2 bg-white p-5 shadow-ace"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink-900">
            {t("title")}
          </h3>
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-600">{t("subtitle")}</p>

        {error && (
          <p className="mb-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
            {error}
          </p>
        )}

        {/* Format toggle: singles ↔ doubles */}
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-700">
            {t("format")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsDoubles(false)}
              className={
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition " +
                (!isDoubles
                  ? "border-grass-500 bg-grass-50 text-grass-900"
                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
              }
            >
              <User className="h-4 w-4" />
              {t("format_singles")}
            </button>
            <button
              type="button"
              onClick={() => setIsDoubles(true)}
              className={
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition " +
                (isDoubles
                  ? "border-grass-500 bg-grass-50 text-grass-900"
                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
              }
            >
              <Users className="h-4 w-4" />
              {t("format_doubles")}
            </button>
          </div>
          {isDoubles && (
            <p className="mt-1.5 text-xs text-ink-500">{t("doubles_hint")}</p>
          )}
        </fieldset>

        {/* Shared search box feeding all pickers */}
        <fieldset className="mb-4 rounded-xl border border-ink-100 p-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
            {isDoubles ? t("players") : t("opponent")}
          </legend>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("opponent_search_placeholder")}
              className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] pl-9 pr-3 text-sm"
            />
          </div>

          <div className="mt-3 space-y-3">
            <PlayerSlot
              label={t("opponent")}
              options={options}
              selectedId={opponentId}
              takenIds={takenIds}
              emptyLabel={t("opponent_none")}
              onSelect={setOpponentId}
            />
            {isDoubles && (
              <>
                <PlayerSlot
                  label={t("my_partner")}
                  options={options}
                  selectedId={myPartnerId}
                  takenIds={takenIds}
                  emptyLabel={t("opponent_none")}
                  onSelect={setMyPartnerId}
                />
                <PlayerSlot
                  label={t("opponent_partner")}
                  options={options}
                  selectedId={opponentPartnerId}
                  takenIds={takenIds}
                  emptyLabel={t("opponent_none")}
                  onSelect={setOpponentPartnerId}
                />
              </>
            )}
          </div>
        </fieldset>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-ink-700">{t("played_at")}</span>
          <input
            type="datetime-local"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-ink-500">{t("played_at_hint")}</span>
        </label>

        <fieldset className="mb-4 rounded-xl border border-ink-100 p-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
            {t("sets")}
          </legend>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_auto_36px] items-center gap-2 text-xs text-ink-500">
            <span className="text-center">{isDoubles ? t("your_pair") : t("you")}</span>
            <span></span>
            <span className="text-center">
              {isDoubles ? t("their_pair") : t("opponent_short")}
            </span>
            <span className="text-center">{t("tb_you")}</span>
            <span className="text-center">{t("tb_them")}</span>
            <span></span>
          </div>
          <div className="mt-1 space-y-1.5">
            {sets.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_1fr_auto_auto_36px] items-center gap-2"
              >
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={s.p1_games}
                  onChange={(e) =>
                    setSet(i, { p1_games: Number(e.target.value) || 0 })
                  }
                  className="h-9 rounded-md border border-ink-200 px-2 text-center font-mono text-sm"
                />
                <span className="text-ink-400">:</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={s.p2_games}
                  onChange={(e) =>
                    setSet(i, { p2_games: Number(e.target.value) || 0 })
                  }
                  className="h-9 rounded-md border border-ink-200 px-2 text-center font-mono text-sm"
                />
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={s.tiebreak_p1 ?? ""}
                  onChange={(e) =>
                    setSet(i, {
                      tiebreak_p1:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="—"
                  className="h-9 w-16 rounded-md border border-ink-200 px-2 text-center font-mono text-xs"
                />
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={s.tiebreak_p2 ?? ""}
                  onChange={(e) =>
                    setSet(i, {
                      tiebreak_p2:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="—"
                  className="h-9 w-16 rounded-md border border-ink-200 px-2 text-center font-mono text-xs"
                />
                <button
                  onClick={() => setSets((s) => s.filter((_, j) => j !== i))}
                  disabled={sets.length <= 1}
                  className="grid h-9 place-items-center rounded-md text-clay-700 hover:bg-clay-50 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSets((s) => [...s, NEW_SET()])}
            disabled={sets.length >= 5}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> {t("add_set")}
          </button>
        </fieldset>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-ink-700">{t("notes")}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={t("notes_placeholder")}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-grass-50 px-3 py-2 text-xs text-grass-800">
          <span>{isDoubles ? t("two_party_warning_doubles") : t("two_party_warning")}</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              pending || !opponentId || (isDoubles && (!myPartnerId || !opponentPartnerId))
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-[13px] bg-pt-primary px-4 text-sm font-medium text-white shadow-card hover:-translate-y-0.5 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One "pick a player" slot. Shows the current selection as a chip; expanding
 * lists the shared search results minus players taken by the other slots.
 */
function PlayerSlot({
  label,
  options,
  selectedId,
  takenIds,
  emptyLabel,
  onSelect,
}: {
  label: string;
  options: OpponentOption[];
  selectedId: string | null;
  takenIds: Set<string>;
  emptyLabel: string;
  onSelect: (id: string | null) => void;
}) {
  const selected = options.find((o) => o.id === selectedId);
  const available = options.filter(
    (o) => o.id === selectedId || !takenIds.has(o.id),
  );

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-700">{label}</p>
      {selectedId ? (
        <div className="flex items-center justify-between rounded-lg border border-grass-300 bg-grass-50 px-3 py-2 text-sm text-grass-900">
          <span className="truncate font-medium">
            {selected?.display_name ?? "—"}
            {selected && (
              <span className="ml-2 font-mono text-xs text-ink-500">
                {selected.current_elo}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-2 rounded-md p-0.5 text-ink-500 hover:bg-white"
            aria-label="✕"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <ul className="max-h-36 overflow-y-auto rounded-md border border-ink-100">
          {available.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-500">{emptyLabel}</li>
          ) : (
            available.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onSelect(o.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-ink-50"
                >
                  <span>{o.display_name ?? "—"}</span>
                  <span className="font-mono text-xs text-ink-500">
                    {o.current_elo} · {o.city ?? "—"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
