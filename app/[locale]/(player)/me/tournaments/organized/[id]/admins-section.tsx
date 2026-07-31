"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import {
  addTournamentAdmin,
  removeTournamentAdmin,
  type TournamentAdminRow,
  type PlayerOption,
} from "../actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import { PlayerNameLink } from "@/components/domain/player-name-link";

export type AdminsCopy = {
  title: string;
  hint: string;
  add_placeholder: string;
  add_button: string;
  adding: string;
  empty: string;
  remove: string;
  remove_confirm: string;
  no_options: string;
};

/**
 * Owner-only card: appoint / dismiss tournament co-organizers. Co-organizers
 * never see this section (the page renders it only for the owner) and the
 * add/remove server actions are owner-gated anyway.
 */
export function AdminsSection({
  tournamentId,
  admins,
  options,
  copy,
}: {
  tournamentId: string;
  admins: TournamentAdminRow[];
  options: PlayerOption[];
  copy: AdminsCopy;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return options.slice(0, 20);
    return options.filter((o) => (o.display_name ?? "").toLowerCase().includes(q)).slice(0, 20);
  }, [search, options]);

  function onAdd(playerId: string) {
    setBusyId(playerId);
    startT(async () => {
      const r = await addTournamentAdmin({ tournament_id: tournamentId, player_id: playerId });
      setBusyId(null);
      if (r.ok) {
        setSearch("");
        router.refresh();
      } else alert(localizeActionError(tErrors, r.error));
    });
  }

  function onRemove(playerId: string, name: string | null) {
    if (!confirm(copy.remove_confirm.replace("{name}", name ?? "—"))) return;
    setBusyId(playerId);
    startT(async () => {
      const r = await removeTournamentAdmin({ tournament_id: tournamentId, player_id: playerId });
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
        <ShieldCheck className="h-5 w-5 text-grass-700" />
        {copy.title}
      </h2>
      <p className="mt-1 text-[11px] text-ink-500">{copy.hint}</p>

      <div className="mt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.add_placeholder}
            className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] pl-9 pr-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">{copy.no_options}</p>
        ) : (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-100">
            {filtered.map((p) => {
              const busy = pending && busyId === p.id;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b border-ink-50 px-3 py-2 last:border-b-0"
                >
                  <span className="text-sm text-ink-800">
                    {p.display_name ?? "—"}{" "}
                    <span className="font-mono text-xs text-ink-500">Elo {p.current_elo}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdd(p.id)}
                    disabled={busy}
                    className="inline-flex h-7 items-center gap-1 rounded-[11px] bg-pt-primary px-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {busy ? copy.adding : copy.add_button}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5">
        {admins.length === 0 ? (
          <p className="text-sm text-ink-500">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {admins.map((a) => {
              const busy = pending && busyId === a.player_id;
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="inline-flex min-w-0 items-center gap-2 truncate text-sm text-ink-900">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-grass-600" />
                    <PlayerNameLink id={a.player_id} name={a.display_name} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(a.player_id, a.display_name)}
                    disabled={busy}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {copy.remove}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
