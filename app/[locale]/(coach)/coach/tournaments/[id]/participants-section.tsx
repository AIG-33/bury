"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
import {
  addParticipant,
  removeParticipant,
  type ParticipantRow,
  type PlayerOption,
} from "../actions";

export type ParticipantsCopy = {
  title: string;
  add_placeholder: string;
  add_button: string;
  adding: string;
  empty: string;
  remove: string;
  remove_confirm: string;
  seed_label: string;
  no_seed: string;
  withdrawn: string;
  no_options: string;
};

export function ParticipantsSection({
  tournamentId,
  participants,
  options,
  copy,
  locked,
}: {
  tournamentId: string;
  participants: ParticipantRow[];
  options: PlayerOption[];
  copy: ParticipantsCopy;
  locked: boolean;
}) {
  const t = useTranslations("tournamentsCoach.participants");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return options.slice(0, 20);
    return options
      .filter((o) => (o.display_name ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [search, options]);

  function onAdd(playerId: string) {
    startT(async () => {
      const r = await addParticipant({ tournament_id: tournamentId, player_id: playerId });
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  function onRemove(participantId: string) {
    if (!confirm(copy.remove_confirm)) return;
    setRemoving(participantId);
    startT(async () => {
      const r = await removeParticipant(tournamentId, participantId);
      setRemoving(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink-900">
        {copy.title} · {t("count", { n: participants.filter((p) => !p.withdrawn).length })}
      </h2>

      {!locked && (
        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy.add_placeholder}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">{copy.no_options}</p>
          ) : (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-100">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b border-ink-50 px-3 py-2 last:border-b-0"
                >
                  <span className="text-sm text-ink-800">
                    {p.display_name ?? "—"}{" "}
                    <span className="font-mono text-xs text-ink-500">
                      Elo {p.current_elo}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdd(p.id)}
                    disabled={pending}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-grass-500 px-2 text-xs font-semibold text-white transition hover:bg-grass-600 disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {pending ? copy.adding : copy.add_button}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        {participants.length === 0 ? (
          <p className="text-sm text-ink-500">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {participants.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ball-100 text-xs font-semibold text-ball-800">
                    {p.seed ?? i + 1}
                  </span>
                  <span className="truncate text-sm text-ink-900">
                    {p.display_name ?? "—"}
                  </span>
                  {p.withdrawn && (
                    <span className="rounded-md bg-clay-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-clay-800">
                      {copy.withdrawn}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-500">Elo {p.current_elo}</span>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      disabled={pending && removing === p.id}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-60"
                    >
                      {pending && removing === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      {copy.remove}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
