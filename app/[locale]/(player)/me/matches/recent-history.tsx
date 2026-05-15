"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter } from "lucide-react";
import { MatchCard } from "./match-card";
import type { MatchListItem } from "./actions";

type DateWindow = "all" | "7d" | "30d" | "90d" | "year";
type EventFilter = "all" | "friendly" | "tournament";

const PAGE_SIZE = 10;

// Recent matches list with client-side filters. The server already returns up
// to 120 most recent matches (friendly + tournament). Filtering in-memory is
// snappier than a round-trip and keeps URL state out of the player's way —
// these filters are not meant to be bookmarked.
export function RecentHistory({
  items,
  locale,
  whatsappPrefill,
}: {
  items: MatchListItem[];
  locale: string;
  whatsappPrefill: string;
}) {
  const t = useTranslations("myMatches.history_filters");

  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [tournamentId, setTournamentId] = useState<string>("");
  const [limit, setLimit] = useState<number>(PAGE_SIZE);

  // Build the list of tournaments the player participated in for the picker.
  const tournamentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of items) {
      if (m.tournament_id) {
        seen.set(m.tournament_id, m.tournament_name ?? m.tournament_id);
      }
    }
    return Array.from(seen.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], locale),
    );
  }, [items, locale]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const windowMs: Record<DateWindow, number | null> = {
      all: null,
      "7d": 7 * 24 * 3600 * 1000,
      "30d": 30 * 24 * 3600 * 1000,
      "90d": 90 * 24 * 3600 * 1000,
      year: 365 * 24 * 3600 * 1000,
    };
    const w = windowMs[dateWindow];

    return items.filter((m) => {
      if (w != null) {
        const when = new Date(m.played_at ?? m.created_at).getTime();
        if (now - when > w) return false;
      }
      if (eventFilter === "friendly" && m.tournament_id != null) return false;
      if (eventFilter === "tournament" && m.tournament_id == null) return false;
      if (tournamentId && m.tournament_id !== tournamentId) return false;
      return true;
    });
  }, [items, dateWindow, eventFilter, tournamentId]);

  // Reset paging when filters change.
  const visible = filtered.slice(0, limit);

  function resetFilters() {
    setDateWindow("all");
    setEventFilter("all");
    setTournamentId("");
    setLimit(PAGE_SIZE);
  }

  const hasFilter =
    dateWindow !== "all" || eventFilter !== "all" || tournamentId !== "";

  return (
    <div className="space-y-3">
      {/* Filter bar — three compact selects on desktop, stack on mobile */}
      <div className="rounded-xl2 border border-ink-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
            <Filter className="h-3.5 w-3.5" />
            {t("title")}
          </span>

          <label className="flex items-center gap-1.5 text-xs text-ink-700">
            <span className="text-ink-500">{t("date_label")}</span>
            <select
              value={dateWindow}
              onChange={(e) => {
                setDateWindow(e.target.value as DateWindow);
                setLimit(PAGE_SIZE);
              }}
              className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs"
            >
              <option value="all">{t("date.all")}</option>
              <option value="7d">{t("date.7d")}</option>
              <option value="30d">{t("date.30d")}</option>
              <option value="90d">{t("date.90d")}</option>
              <option value="year">{t("date.year")}</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-ink-700">
            <span className="text-ink-500">{t("event_label")}</span>
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value as EventFilter);
                if (e.target.value !== "tournament") setTournamentId("");
                setLimit(PAGE_SIZE);
              }}
              className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs"
            >
              <option value="all">{t("event.all")}</option>
              <option value="friendly">{t("event.friendly")}</option>
              <option value="tournament">{t("event.tournament")}</option>
            </select>
          </label>

          {eventFilter !== "friendly" && tournamentOptions.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <span className="text-ink-500">{t("tournament_label")}</span>
              <select
                value={tournamentId}
                onChange={(e) => {
                  setTournamentId(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
                className="h-8 max-w-[200px] rounded-md border border-ink-200 bg-white px-2 text-xs"
              >
                <option value="">{t("tournament_any")}</option>
                {tournamentOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <span className="ml-auto text-xs tabular-nums text-ink-500">
            {t("results", { n: filtered.length })}
          </span>

          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-8 items-center rounded-md border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              {t("reset")}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 bg-white p-4 text-center text-sm text-ink-500">
          {t("empty")}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {visible.map((m) => (
              <MatchCard
                key={m.id}
                m={m}
                variant="recent"
                locale={locale}
                whatsappPrefill={whatsappPrefill}
              />
            ))}
          </ul>
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="inline-flex h-9 items-center rounded-md border border-grass-300 bg-white px-3 text-sm font-medium text-grass-700 hover:bg-grass-50"
            >
              {t("show_more", {
                n: Math.min(PAGE_SIZE, filtered.length - limit),
              })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
