"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trophy,
} from "lucide-react";
import {
  refreshExternalRating,
  type RefreshResult,
} from "@/app/[locale]/(player)/me/profile/external-rating-actions";
import { ExternalRatingBadge } from "./external-rating-badge";
import type { ConnectedSnapshot, ExternalRatingCardCopy } from "./external-rating-card";

// =============================================================================
// ExternalRatingStrip — slim, single-row variant of `ExternalRatingCard`,
// designed for the dense `/me/rating` page.
//
// Why this exists separately from the full card on `/me/profile`:
//   * The rating page already shows the player's primary Elo, season race,
//     chart and recent matches — adding the full multi-row card on top of
//     that would dominate the layout.
//   * Here we only need the LT badge + a one-click "Refresh" action and a
//     subtle empty-state CTA pointing at the existing /onboarding/import-lt
//     flow. Disconnect lives on /me/profile.
//
// The component reuses the `externalRating.*` translations and the same
// `ConnectedSnapshot` / `ExternalRatingCardCopy` shapes as the full card,
// so there's a single source of truth for copy and types.
// =============================================================================
export function ExternalRatingStrip({
  locale,
  initial,
  copy,
}: {
  locale: "ru" | "en";
  initial: ConnectedSnapshot | null;
  copy: ExternalRatingCardCopy;
}) {
  const [snapshot, setSnapshot] = useState<ConnectedSnapshot | null>(initial);
  const [isRefreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refreshedFlash, setRefreshedFlash] = useState(false);

  function doRefresh() {
    setError(null);
    setRefreshedFlash(false);
    startRefresh(async () => {
      const r: RefreshResult = await refreshExternalRating();
      if (!r.ok) {
        setError(copy.errors[r.error] ?? copy.errors.unknown);
        return;
      }
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              external_elo: r.external_elo ?? prev.external_elo,
              display_tier: r.display_tier,
              last_refreshed_at: r.last_refreshed_at,
              last_refresh_error: null,
            }
          : prev,
      );
      setRefreshedFlash(true);
      setTimeout(() => setRefreshedFlash(false), 3000);
    });
  }

  if (!snapshot) {
    return (
      <section className="surface-card-flat flex flex-col gap-3 border-dashed border-grass-200 bg-grass-50/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700"
          >
            <Trophy className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-grass-900">
              {copy.not_connected_title}
            </p>
            <p className="mt-0.5 text-xs text-grass-800">{copy.not_connected_body}</p>
          </div>
        </div>
        <a
          href={`/${locale}/onboarding/import-lt`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg bg-grass-700 px-3 font-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white shadow-card transition hover:bg-grass-800 sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          {copy.not_connected_cta}
        </a>
      </section>
    );
  }

  const refreshedAt = new Date(snapshot.last_refreshed_at);
  const ageMin = Math.round((Date.now() - refreshedAt.getTime()) / 60000);
  const refreshedHint =
    ageMin < 1 ? copy.refreshed_now : copy.refreshed_ago.replace("{min}", String(ageMin));

  return (
    <section
      aria-label={copy.title}
      className="surface-card-flat flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ExternalRatingBadge
          source={snapshot.source}
          externalUrl={snapshot.external_url}
          displayTier={snapshot.display_tier}
          externalElo={snapshot.external_elo}
          externalEloDoubles={snapshot.external_elo_doubles}
          isCalibratingSingles={snapshot.is_calibrating_singles}
          sourceLabel={copy.source_label}
          showDoubles
        />

        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          {refreshedFlash ? (
            <span className="inline-flex items-center gap-1 text-grass-700">
              <CheckCircle2 className="h-3 w-3" />
              {copy.refreshed_now}
            </span>
          ) : (
            <>
              <span className="text-ink-400">{copy.last_refreshed_label}: </span>
              <span className="font-mono tabular-nums text-ink-700">{refreshedHint}</span>
            </>
          )}
        </span>

        {snapshot.last_refresh_error && (
          <span className="inline-flex items-center gap-1 text-[11px] text-clay-700">
            <AlertCircle className="h-3 w-3" />
            {copy.last_refresh_error_label}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={snapshot.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
        >
          {copy.open_on_lt}
          <ExternalLink className="h-3 w-3" />
        </a>

        <button
          type="button"
          onClick={doRefresh}
          disabled={isRefreshing}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-700 px-3 font-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white shadow-card transition hover:bg-grass-800 disabled:opacity-60"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isRefreshing ? copy.refreshing : copy.refresh}
        </button>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1.5 text-xs text-clay-700">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </section>
  );
}
