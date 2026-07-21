"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Trophy,
  Plus,
} from "lucide-react";
import {
  refreshExternalRating,
  disconnectExternalRating,
  type RefreshResult,
  type DisconnectResult,
} from "@/app/[locale]/(player)/me/profile/external-rating-actions";
import { ExternalRatingBadge } from "./external-rating-badge";

export type ExternalRatingCardCopy = {
  title: string;
  subtitle: string;
  source_label: string;
  not_connected_title: string;
  not_connected_body: string;
  not_connected_cta: string;
  refresh: string;
  refreshing: string;
  refreshed_now: string;
  refreshed_ago: string;
  disconnect: string;
  disconnecting: string;
  confirm_disconnect: string;
  imported_at_label: string;
  last_refreshed_label: string;
  last_refresh_error_label: string;
  open_on_lt: string;
  errors: {
    not_authenticated: string;
    no_external_rating: string;
    rate_limited: string;
    upstream_unreachable: string;
    upstream_error: string;
    player_not_found: string;
    db_error: string;
    unknown: string;
  };
};

export type ConnectedSnapshot = {
  source: "liga_tennisa";
  external_id: string;
  external_url: string;
  display_tier: string;
  external_elo: number;
  external_elo_doubles: number | null;
  is_calibrating_singles: boolean;
  is_calibrating_doubles: boolean;
  imported_at: string;
  last_refreshed_at: string;
  last_refresh_error: string | null;
};

export function ExternalRatingCard({
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
  const [isDisconnecting, startDisconnect] = useTransition();
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

  function doDisconnect() {
    if (!confirm(copy.confirm_disconnect)) return;
    setError(null);
    startDisconnect(async () => {
      const r: DisconnectResult = await disconnectExternalRating();
      if (!r.ok) {
        setError(copy.errors[r.error] ?? copy.errors.unknown);
        return;
      }
      setSnapshot(null);
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 h-5 w-5 text-grass-700" />
          <div>
            <h2 className="font-display text-base font-semibold text-ink-900">{copy.title}</h2>
            <p className="mt-0.5 max-w-xl text-xs text-ink-500">{copy.subtitle}</p>
          </div>
        </div>
        {snapshot && (
          <a
            href={snapshot.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-grass-700 hover:underline"
          >
            {copy.open_on_lt} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </header>

      {!snapshot ? (
        <NotConnected locale={locale} copy={copy} />
      ) : (
        <Connected
          snapshot={snapshot}
          copy={copy}
          isRefreshing={isRefreshing}
          isDisconnecting={isDisconnecting}
          error={error}
          refreshedFlash={refreshedFlash}
          onRefresh={doRefresh}
          onDisconnect={doDisconnect}
        />
      )}
    </section>
  );
}

function NotConnected({ locale, copy }: { locale: "ru" | "en"; copy: ExternalRatingCardCopy }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-grass-200 bg-grass-50/30 p-4">
      <p className="font-display text-sm font-semibold text-grass-900">
        {copy.not_connected_title}
      </p>
      <p className="mt-1 text-xs text-grass-800">{copy.not_connected_body}</p>
      <a
        href={`/${locale}/onboarding/import-lt`}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[13px] bg-pt-primary px-3 text-xs font-semibold text-white shadow-card transition hover:-translate-y-0.5"
      >
        <Plus className="h-3.5 w-3.5" /> {copy.not_connected_cta}
      </a>
    </div>
  );
}

function Connected({
  snapshot,
  copy,
  isRefreshing,
  isDisconnecting,
  error,
  refreshedFlash,
  onRefresh,
  onDisconnect,
}: {
  snapshot: ConnectedSnapshot;
  copy: ExternalRatingCardCopy;
  isRefreshing: boolean;
  isDisconnecting: boolean;
  error: string | null;
  refreshedFlash: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const refreshedAt = new Date(snapshot.last_refreshed_at);
  const ageMin = Math.round((Date.now() - refreshedAt.getTime()) / 60000);
  const refreshedHint =
    ageMin < 1 ? copy.refreshed_now : copy.refreshed_ago.replace("{min}", String(ageMin));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing || isDisconnecting}
            className="inline-flex h-9 items-center gap-1 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {isRefreshing ? copy.refreshing : copy.refresh}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={isRefreshing || isDisconnecting}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-clay-200 bg-clay-50 px-3 text-xs font-medium text-clay-800 transition hover:bg-clay-100 disabled:opacity-50"
          >
            {isDisconnecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            {isDisconnecting ? copy.disconnecting : copy.disconnect}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-[11px] text-ink-600 sm:grid-cols-3">
        <div>
          <dt className="text-ink-500">{copy.imported_at_label}</dt>
          <dd className="font-mono tabular-nums text-ink-800">
            {new Date(snapshot.imported_at).toLocaleDateString()}
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">{copy.last_refreshed_label}</dt>
          <dd
            className={
              refreshedFlash ? "font-medium text-grass-700" : "font-mono tabular-nums text-ink-800"
            }
          >
            {refreshedFlash ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {copy.refreshed_now}
              </span>
            ) : (
              refreshedHint
            )}
          </dd>
        </div>
        {snapshot.last_refresh_error && (
          <div>
            <dt className="text-ink-500">{copy.last_refresh_error_label}</dt>
            <dd className="text-clay-700">{snapshot.last_refresh_error}</dd>
          </div>
        )}
      </dl>

      {error && (
        <p className="inline-flex items-center gap-1.5 text-xs text-clay-700">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
