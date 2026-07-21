"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, Users, X } from "lucide-react";
import {
  loadOpponentOptions,
  type OpponentOption,
} from "@/app/[locale]/(player)/me/matches/actions";

// =============================================================================
// Partner picker for DOUBLES tournament applications. Shared by the public
// tournament page, the /me/tournaments cards and the mobile CTA: the player
// picks who they enter the tournament with, then the caller submits
// `applyToTournament(id, { partnerId })`.
// =============================================================================

export function TournamentPartnerPicker({
  open,
  onClose,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (partnerId: string) => void;
  /** True while the apply action runs — keeps the confirm button busy. */
  submitting: boolean;
}) {
  const t = useTranslations("tournamentsPlayer.partner_picker");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<OpponentOption[]>([]);
  const [selected, setSelected] = useState<OpponentOption | null>(null);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(null);
      setOptions([]);
      return;
    }
    startSearch(async () => {
      setOptions(await loadOpponentOptions(query));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8">
      <div className="shadow-pop flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Users className="h-4 w-4 text-grass-600" />
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 transition hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-600">{t("hint")}</p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            // 16px on phones — prevents the iOS focus auto-zoom.
            className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-[16px] outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200 sm:text-sm"
          />
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-ink-100">
          {searching && options.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-3 text-xs text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("searching")}
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-ink-500">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {options.map((o) => {
                const isSelected = selected?.id === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(isSelected ? null : o)}
                      aria-pressed={isSelected}
                      className={
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition " +
                        (isSelected ? "bg-grass-50 text-grass-900" : "hover:bg-ink-50")
                      }
                    >
                      <span className="min-w-0 truncate">
                        {o.display_name ?? "—"}
                        {o.city && (
                          <span className="ml-1 text-[11px] text-ink-500">· {o.city}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink-500 tabular-nums">
                        Elo {o.current_elo}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={!selected || submitting}
            onClick={() => selected && onConfirm(selected.id)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? t("submitting") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
