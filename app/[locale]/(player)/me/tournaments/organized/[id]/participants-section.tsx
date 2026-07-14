"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Loader2,
  Search,
  Check,
  X as XIcon,
  RotateCcw,
  Inbox,
  CheckCircle2,
  Ban,
} from "lucide-react";
import {
  addParticipant,
  removeParticipant,
  setParticipantStatus,
  type ParticipantRow,
  type PlayerOption,
} from "../actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";

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
  pending_section: string;
  approved_section: string;
  rejected_section: string;
  pending_empty: string;
  rejected_empty: string;
  approve: string;
  reject: string;
  reject_confirm: string;
  approving: string;
  rejecting: string;
  reapprove: string;
  add_directly_hint: string;
  mode_hint_auto: string;
  mode_hint_manual: string;
};

export function ParticipantsSection({
  tournamentId,
  participants,
  options,
  copy,
  locked,
  applicationMode,
}: {
  tournamentId: string;
  participants: ParticipantRow[];
  options: PlayerOption[];
  copy: ParticipantsCopy;
  locked: boolean;
  applicationMode: "auto" | "manual";
}) {
  const t = useTranslations("tournamentsOrganized.participants");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return options.slice(0, 20);
    return options
      .filter((o) => (o.display_name ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [search, options]);

  const grouped = useMemo(() => {
    const pendingArr: ParticipantRow[] = [];
    const approvedArr: ParticipantRow[] = [];
    const rejectedArr: ParticipantRow[] = [];
    for (const p of participants) {
      if (p.status === "pending") pendingArr.push(p);
      else if (p.status === "approved") approvedArr.push(p);
      else rejectedArr.push(p);
    }
    return { pending: pendingArr, approved: approvedArr, rejected: rejectedArr };
  }, [participants]);

  function onAdd(playerId: string) {
    setBusyId(playerId);
    startT(async () => {
      const r = await addParticipant({ tournament_id: tournamentId, player_id: playerId });
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  function onDecide(participantId: string, status: "approved" | "rejected") {
    if (status === "rejected" && !confirm(copy.reject_confirm)) return;
    setBusyId(participantId);
    startT(async () => {
      const r = await setParticipantStatus(tournamentId, participantId, status);
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  function onRemove(participantId: string) {
    if (!confirm(copy.remove_confirm)) return;
    setBusyId(participantId);
    startT(async () => {
      const r = await removeParticipant(tournamentId, participantId);
      setBusyId(null);
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {copy.title} · {t("count", { n: grouped.approved.filter((p) => !p.withdrawn).length })}
        </h2>
        {grouped.pending.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-clay-800">
            <Inbox className="h-3 w-3" />
            {t("pending_count", { n: grouped.pending.length })}
          </span>
        )}
      </div>

      {/* Pending applications inbox — top of section so it can't be missed. */}
      {!locked && (
        <div className="mt-4 rounded-xl border border-clay-200 bg-clay-50/40 p-3">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-clay-800">
            <Inbox className="h-3.5 w-3.5" />
            {copy.pending_section}
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            {applicationMode === "auto" ? copy.mode_hint_auto : copy.mode_hint_manual}
          </p>
          {grouped.pending.length === 0 ? (
            <p className="mt-2 text-xs text-clay-700/80">{copy.pending_empty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-clay-100/80">
              {grouped.pending.map((p) => {
                const busy = pending && busyId === p.id;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs text-clay-700 ring-1 ring-clay-200">
                        <Inbox className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {p.display_name ?? "—"}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          Elo {p.current_elo} · {new Date(p.registered_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDecide(p.id, "approved")}
                        disabled={busy}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-600 px-2.5 text-xs font-semibold text-white transition hover:bg-grass-700 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {busy ? copy.approving : copy.approve}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecide(p.id, "rejected")}
                        disabled={busy}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-300 bg-white px-2.5 text-xs font-semibold text-clay-700 transition hover:bg-clay-50 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XIcon className="h-3 w-3" />
                        )}
                        {busy ? copy.rejecting : copy.reject}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Owner can also add players directly without the application step. */}
      {!locked && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-ink-500">{copy.add_directly_hint}</p>
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
              {filtered.map((p) => {
                const busy = pending && busyId === p.id;
                return (
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
                      disabled={busy}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-grass-500 px-2 text-xs font-semibold text-white transition hover:bg-grass-600 disabled:opacity-60"
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
      )}

      {/* Approved roster */}
      <div className="mt-6">
        <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-grass-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {copy.approved_section}
        </p>
        {grouped.approved.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">{copy.empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {grouped.approved.map((p, i) => {
              const busy = pending && busyId === p.id;
              return (
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
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rejected applications — collapsed-style list with a re-approve button. */}
      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-700">
          <span className="inline-flex items-center gap-1">
            <Ban className="h-3 w-3" />
            {copy.rejected_section}
            {grouped.rejected.length > 0 && (
              <span className="text-ink-400">({grouped.rejected.length})</span>
            )}
          </span>
        </summary>
        {grouped.rejected.length === 0 ? (
          <p className="mt-2 text-xs text-ink-400">{copy.rejected_empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100/80">
            {grouped.rejected.map((p) => {
              const busy = pending && busyId === p.id;
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-700">{p.display_name ?? "—"}</p>
                    <p className="text-[11px] text-ink-400">Elo {p.current_elo}</p>
                  </div>
                  {!locked && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDecide(p.id, "approved")}
                        disabled={busy}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-grass-300 bg-white px-2 text-xs font-medium text-grass-800 transition hover:bg-grass-50 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        {copy.reapprove}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(p.id)}
                        disabled={busy}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3" />
                        {copy.remove}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </section>
  );
}
