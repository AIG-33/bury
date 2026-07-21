"use client";

import { useState, useTransition } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  X,
  MapPin,
  Trophy,
  Star,
  Calendar,
  ShieldAlert,
} from "lucide-react";
import {
  searchLtCandidates,
  previewLtPlayer,
  confirmImportFromLt,
  type SearchResult,
  type PreviewResult,
  type ImportResult,
} from "./actions";
import type { LtPreview } from "@/lib/rating/external/actions-impl";
import type { LtSearchCandidate } from "@/lib/rating/external/liga-tennisa";

type Locale = "ru" | "en";

export type ImportLtCopy = {
  search: {
    label: string;
    placeholder: string;
    city_label: string;
    city_placeholder: string;
    cta: string;
    cta_busy: string;
    min_chars: string;
    empty_title: string;
    empty_body: string;
    no_results_title: string;
    no_results_body: string;
  };
  candidate: {
    select: string;
    score_hint: string;
    anonymous: string;
    no_city: string;
  };
  preview: {
    title: string;
    tier: string;
    singles_elo: string;
    doubles_elo: string;
    calibrating: string;
    ranking: string;
    wins: string;
    seed_hint: string;
    seed_clamped_hint: string;
    seed_fallback_hint: string;
    copy_label: string;
    copy_hint: string;
    confirm: string;
    confirm_busy: string;
    cancel: string;
    view_on_lt: string;
    disclaimer: string;
  };
  done: {
    title: string;
    body: string;
    cta: string;
  };
  errors: Record<
    | "invalid_query"
    | "invalid_payload"
    | "not_authenticated"
    | "upstream_unreachable"
    | "upstream_error"
    | "player_not_found"
    | "already_claimed_by_other_user"
    | "already_imported"
    | "db_error"
    | "unknown",
    string
  >;
};

export function ImportLtClient({
  locale,
  initialQuery,
  initialCity,
  copy,
}: {
  locale: Locale;
  initialQuery: string;
  initialCity: string | null;
  copy: ImportLtCopy;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity ?? "");
  const [isSearching, startSearch] = useTransition();
  const [searchState, setSearchState] = useState<
    | { kind: "idle" }
    | { kind: "results"; candidates: LtSearchCandidate[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [preview, setPreview] = useState<LtPreview | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [copyEmpty, setCopyEmpty] = useState(true);
  const [isImporting, startImport] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ elo: number } | null>(null);

  function runSearch() {
    setPreview(null);
    setPreviewError(null);
    setImportError(null);
    if (query.trim().length < 2) {
      setSearchState({ kind: "error", message: copy.search.min_chars });
      return;
    }
    startSearch(async () => {
      const r = (await searchLtCandidates(query, city || null)) as SearchResult;
      if (!r.ok) {
        setSearchState({ kind: "error", message: copy.errors[r.error] ?? copy.errors.unknown });
        return;
      }
      setSearchState({ kind: "results", candidates: r.candidates });
    });
  }

  function pickCandidate(c: LtSearchCandidate) {
    setPreviewError(null);
    setImportError(null);
    setImported(null);
    startPreview(async () => {
      const r = (await previewLtPlayer(c.id)) as PreviewResult;
      if (!r.ok) {
        setPreviewError(copy.errors[r.error] ?? copy.errors.unknown);
        setPreview(null);
        return;
      }
      setPreview(r.preview);
    });
  }

  function confirmImport() {
    if (!preview) return;
    setImportError(null);
    startImport(async () => {
      const r = (await confirmImportFromLt(preview.external_id, copyEmpty)) as ImportResult;
      if (!r.ok) {
        // Surface the upstream/Postgres detail when present — these messages
        // are not PII and they're the only signal a coach/player can give us
        // when they hit a "save failed" path. Localised text comes first.
        const localised = copy.errors[r.error] ?? copy.errors.unknown;
        const detail = "message" in r && r.message ? ` (${r.message})` : "";
        setImportError(`${localised}${detail}`);
        return;
      }
      setImported({ elo: r.new_local_elo });
    });
  }

  if (imported) {
    return <ImportSuccess locale={locale} elo={imported.elo} copy={copy.done} />;
  }

  if (preview) {
    return (
      <PreviewCard
        preview={preview}
        copy={copy.preview}
        copyEmpty={copyEmpty}
        onToggleCopy={setCopyEmpty}
        onConfirm={confirmImport}
        onCancel={() => {
          setPreview(null);
          setPreviewError(null);
        }}
        isImporting={isImporting}
        importError={importError}
      />
    );
  }

  return (
    <section className="space-y-6">
      {/* Search form */}
      <div className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <Field label={copy.search.label}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder={copy.search.placeholder}
                // 16px on phones — prevents the iOS focus auto-zoom.
                className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-[16px] outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30 sm:text-sm"
              />
            </div>
          </Field>
          <Field label={copy.search.city_label}>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={copy.search.city_placeholder}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-[16px] outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30 sm:text-sm"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={runSearch}
              disabled={isSearching}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50 sm:w-auto"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.search.cta_busy}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {copy.search.cta}
                </>
              )}
            </button>
          </div>
        </div>
        {previewError && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-clay-700">
            <AlertCircle className="h-3 w-3" />
            {previewError}
          </p>
        )}
      </div>

      {/* Results */}
      {searchState.kind === "idle" && !isPreviewing && (
        <EmptyHero title={copy.search.empty_title} body={copy.search.empty_body} />
      )}

      {searchState.kind === "error" && (
        <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{searchState.message}</span>
        </div>
      )}

      {searchState.kind === "results" && (
        <>
          {searchState.candidates.length === 0 ? (
            <EmptyHero
              title={copy.search.no_results_title}
              body={copy.search.no_results_body}
              muted
            />
          ) : (
            <ul className="space-y-3">
              {searchState.candidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  copy={copy.candidate}
                  isBusy={isPreviewing}
                  onSelect={() => pickCandidate(c)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}

function EmptyHero({ title, body, muted }: { title: string; body: string; muted?: boolean }) {
  return (
    <div
      className={
        "flex flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-ink-200 px-6 py-12 text-center " +
        (muted ? "bg-ink-50/30" : "bg-grass-50/30")
      }
    >
      <Trophy className="h-10 w-10 text-grass-600" />
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      <p className="max-w-md text-sm text-ink-600">{body}</p>
    </div>
  );
}

function CandidateCard({
  candidate,
  copy,
  isBusy,
  onSelect,
}: {
  candidate: LtSearchCandidate;
  copy: ImportLtCopy["candidate"];
  isBusy: boolean;
  onSelect: () => void;
}) {
  const initials = (candidate.display_name || copy.anonymous)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const scorePct = Math.round(candidate.score * 100);

  return (
    <li className="hover:shadow-pop rounded-xl2 border border-ink-100 bg-white shadow-card transition">
      <button
        type="button"
        onClick={onSelect}
        disabled={isBusy}
        className="flex w-full items-center gap-4 p-4 text-left disabled:opacity-50"
      >
        <div className="flex-shrink-0">
          {candidate.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.avatar}
              alt={candidate.display_name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-grass-100"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-grass-100 font-display text-sm font-semibold text-grass-800 ring-2 ring-grass-200">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold text-ink-900">
            {candidate.display_name || copy.anonymous}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {candidate.city || copy.no_city}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-0.5 text-[10px] font-semibold text-grass-800 ring-1 ring-grass-200"
              title={copy.score_hint}
            >
              <Star className="h-2.5 w-2.5" /> {scorePct}%
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-grass-700">
          {copy.select}
          <ArrowRight className="h-3 w-3" />
        </div>
      </button>
    </li>
  );
}

function PreviewCard({
  preview,
  copy,
  copyEmpty,
  onToggleCopy,
  onConfirm,
  onCancel,
  isImporting,
  importError,
}: {
  preview: LtPreview;
  copy: ImportLtCopy["preview"];
  copyEmpty: boolean;
  onToggleCopy: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
  importError: string | null;
}) {
  const initials = (preview.display_name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const seedHint = preview.proposed_local_elo_fallback
    ? copy.seed_fallback_hint
    : preview.proposed_local_elo_clamped
      ? copy.seed_clamped_hint
      : copy.seed_hint;

  return (
    <section className="space-y-4 rounded-xl2 border border-grass-200 bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-grass-100 bg-grass-50/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-grass-700" />
          <h2 className="section-title text-[18px] md:text-[20px]">{copy.title}</h2>
        </div>
        <a
          href={preview.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-grass-700 hover:underline"
        >
          {copy.view_on_lt} <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      <div className="px-5 pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-shrink-0">
            {preview.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.avatar}
                alt={preview.display_name}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-grass-100"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-grass-100 font-display text-xl font-semibold text-grass-800 ring-2 ring-grass-200">
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-2xl font-bold text-ink-900">{preview.display_name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
              {preview.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {preview.city}
                </span>
              )}
              {preview.in_tennis_from && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {preview.in_tennis_from.slice(0, 4)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-grass-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-grass-800 ring-1 ring-grass-200">
              {preview.display_tier}
            </span>
            <p className="font-mono text-3xl font-bold tabular-nums text-grass-700">
              {preview.external_elo ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-ink-500">{copy.singles_elo}</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={copy.singles_elo} value={preview.external_elo ?? "—"} />
          <Stat label={copy.doubles_elo} value={preview.external_elo_doubles ?? "—"} />
          <Stat label={copy.ranking} value={preview.ranking_position ?? "—"} />
          <Stat label={copy.wins} value={preview.singles_wins ?? "—"} />
        </dl>

        {(preview.is_calibrating_singles || preview.is_calibrating_doubles) && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-ball-50 px-3 py-2 text-xs text-ball-800">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{copy.calibrating}</span>
          </div>
        )}
      </div>

      <div className="mx-5 rounded-lg border border-grass-200 bg-grass-50/60 p-4">
        <p className="text-sm font-semibold text-grass-900">
          {seedHint.replace("{elo}", String(preview.proposed_local_elo))}
        </p>
      </div>

      <div className="mx-5 rounded-lg border border-ink-100 bg-ink-50/40 p-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={copyEmpty}
            onChange={(e) => onToggleCopy(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-grass-600 focus:ring-grass-500"
          />
          <span className="text-sm">
            <span className="font-medium text-ink-900">{copy.copy_label}</span>
            <span className="ml-1 text-ink-600">{copy.copy_hint}</span>
          </span>
        </label>
      </div>

      <p className="mx-5 text-[11px] text-ink-500">{copy.disclaimer}</p>

      {importError && (
        <p className="mx-5 inline-flex items-center gap-1.5 text-xs text-clay-700">
          <AlertCircle className="h-3 w-3" />
          {importError}
        </p>
      )}

      <footer className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isImporting}
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> {copy.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isImporting}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-semibold text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {copy.confirm_busy}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> {copy.confirm}
            </>
          )}
        </button>
      </footer>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-ink-100 bg-white px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="font-mono text-base font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}

function ImportSuccess({
  locale,
  elo,
  copy,
}: {
  locale: Locale;
  elo: number;
  copy: ImportLtCopy["done"];
}) {
  return (
    <section className="rounded-xl2 border border-grass-200 bg-grass-50/60 p-8 text-center shadow-card">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-grass-100 text-grass-700">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="font-display text-2xl font-bold text-grass-900">{copy.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-grass-800">
        {copy.body.replace("{elo}", String(elo))}
      </p>
      <a
        href={`/${locale}/me/rating`}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-grass-500 px-6 text-sm font-semibold text-white shadow-card transition hover:bg-grass-600"
      >
        {copy.cta} <ArrowRight className="h-4 w-4" />
      </a>
    </section>
  );
}
