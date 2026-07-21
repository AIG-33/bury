"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  searchLtCandidates,
  previewLtPlayer,
  type SearchResult,
  type PreviewResult,
} from "./import-lt/actions";
import { confirmImportFromLtQuick, type ImportResult } from "./quick-import-actions";
import type { LtPreview } from "@/lib/rating/external/actions-impl";
import type { LtSearchCandidate } from "@/lib/rating/external/liga-tennisa";

type Locale = "ru" | "en";

export type LtQuickImportCopy = {
  search: {
    label: string;
    placeholder: string;
    no_results: string;
  };
  candidate: {
    anonymous: string;
    no_city: string;
  };
  confirm: {
    lt_elo: string;
    start_elo: string;
    cta: string;
    cta_busy: string;
    back: string;
  };
  done: {
    title: string;
    body: string;
    cta: string;
  };
  or: string;
  quiz_hint: string;
  quiz_cta: string;
  skip: string;
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

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Compact onboarding widget: type your name → live LT matches appear below →
 * one tap to confirm "this is me" → rating imported, CTA to the app.
 * Search / preview / confirm all reuse the server actions of the full
 * /onboarding/import-lt page.
 */
export function LtQuickImport({
  locale,
  initialQuery,
  copy,
}: {
  locale: Locale;
  initialQuery: string;
  copy: LtQuickImportCopy;
}) {
  const [query, setQuery] = useState(initialQuery);
  // The signup name is pre-filled, so a search fires right after mount.
  const [isSearching, setIsSearching] = useState(initialQuery.trim().length >= 2);
  // null = nothing searched yet (query too short); [] = searched, no matches.
  const [candidates, setCandidates] = useState<LtSearchCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [preview, setPreview] = useState<LtPreview | null>(null);
  const [isPreviewing, startPreview] = useTransition();

  const [isImporting, startImport] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [done, setDone] = useState<{ elo: number } | null>(null);

  // Monotonic id so a slow earlier search can't clobber a newer one.
  const searchSeq = useRef(0);

  function onQueryChange(value: string) {
    setQuery(value);
    setSearchError(null);
    if (value.trim().length < 2) {
      // Invalidate any in-flight search so its late result is dropped.
      searchSeq.current++;
      setCandidates(null);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  }

  useEffect(() => {
    if (preview || done) return;
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const r = (await searchLtCandidates(q, null)) as SearchResult;
      if (searchSeq.current !== id) return;
      setIsSearching(false);
      if (!r.ok) {
        setSearchError(copy.errors[r.error] ?? copy.errors.unknown);
        setCandidates(null);
        return;
      }
      setSearchError(null);
      setCandidates(r.candidates);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, preview, done, copy.errors]);

  function pickCandidate(c: LtSearchCandidate) {
    setImportError(null);
    startPreview(async () => {
      const r = (await previewLtPlayer(c.id)) as PreviewResult;
      if (!r.ok) {
        setSearchError(copy.errors[r.error] ?? copy.errors.unknown);
        return;
      }
      setSearchError(null);
      setPreview(r.preview);
    });
  }

  function confirmImport() {
    if (!preview) return;
    setImportError(null);
    startImport(async () => {
      const r = (await confirmImportFromLtQuick(preview.external_id, true)) as ImportResult;
      if (!r.ok) {
        const localised = copy.errors[r.error] ?? copy.errors.unknown;
        const detail = "message" in r && r.message ? ` (${r.message})` : "";
        setImportError(`${localised}${detail}`);
        return;
      }
      setDone({ elo: r.new_local_elo });
    });
  }

  if (done) {
    return (
      <section className="rounded-xl2 border border-grass-200 bg-grass-50/60 p-6 text-center shadow-card">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-grass-100 text-grass-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-bold text-grass-900">{copy.done.title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-grass-800">
          {copy.done.body.replace("{elo}", String(done.elo))}
        </p>
        <a
          href={`/${locale}/me/rating`}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-[13px] bg-pt-primary px-6 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5"
        >
          {copy.done.cta} <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {preview ? (
        <ConfirmCard
          preview={preview}
          copy={copy.confirm}
          isImporting={isImporting}
          importError={importError}
          onConfirm={confirmImport}
          onBack={() => {
            setPreview(null);
            setImportError(null);
          }}
        />
      ) : (
        <div className="space-y-2">
          <label
            htmlFor="lt-quick-search"
            className="block text-sm font-semibold text-ink-900"
          >
            {copy.search.label}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="lt-quick-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={copy.search.placeholder}
              autoComplete="off"
              // 16px on phones: iOS Safari auto-zooms the page when focusing
              // an input with a smaller font, breaking the one-screen layout.
              className="h-11 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] pl-9 pr-9 text-[16px] outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30 sm:text-sm"
            />
            {(isSearching || isPreviewing) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-grass-600" />
            )}
          </div>

          {searchError && (
            <p className="inline-flex items-start gap-1.5 text-xs text-clay-700">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              {searchError}
            </p>
          )}

          {candidates && candidates.length === 0 && !isSearching && (
            <p className="text-xs text-ink-500">{copy.search.no_results}</p>
          )}

          {candidates && candidates.length > 0 && (
            // Capped so a full 8-row result set never pushes the quiz/skip
            // actions below the fold on an iPhone — the list scrolls inside.
            <ul className="max-h-44 divide-y divide-ink-100 overflow-y-auto overscroll-contain rounded-xl border border-ink-100 bg-white shadow-card sm:max-h-72">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickCandidate(c)}
                    disabled={isPreviewing}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-grass-50/60 disabled:opacity-50"
                  >
                    <CandidateAvatar
                      name={c.display_name || copy.candidate.anonymous}
                      avatar={c.avatar}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {c.display_name || copy.candidate.anonymous}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                        <MapPin className="h-3 w-3" />
                        {c.city || copy.candidate.no_city}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-grass-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-400">
        <span className="h-px flex-1 bg-ink-100" />
        {copy.or}
        <span className="h-px flex-1 bg-ink-100" />
      </div>

      <div className="space-y-1.5 text-center">
        {/* Hidden while results are open: saves a fold-budget line on
            small phones, and the open list already answers the question. */}
        <p
          className={
            candidates && candidates.length > 0
              ? "hidden text-xs text-ink-500 sm:block"
              : "text-xs text-ink-500"
          }
        >
          {copy.quiz_hint}
        </p>
        <Link
          href={`/${locale}/onboarding/quiz`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-4 text-sm font-semibold text-ink-800 shadow-card transition hover:border-grass-300 hover:bg-grass-50/60"
        >
          <Sparkles className="h-4 w-4 text-grass-600" />
          {copy.quiz_cta}
        </Link>
      </div>

      <p className="text-center">
        <a
          href={`/${locale}/me/rating`}
          className="text-xs text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
        >
          {copy.skip}
        </a>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CandidateAvatar({
  name,
  avatar,
  size = "h-9 w-9",
}: {
  name: string;
  avatar: string | null;
  size?: string;
}) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt={name}
        className={`${size} flex-shrink-0 rounded-full object-cover ring-2 ring-grass-100`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`${size} grid flex-shrink-0 place-items-center rounded-full bg-grass-100 font-display text-xs font-semibold text-grass-800 ring-2 ring-grass-200`}
    >
      {initials}
    </span>
  );
}

function ConfirmCard({
  preview,
  copy,
  isImporting,
  importError,
  onConfirm,
  onBack,
}: {
  preview: LtPreview;
  copy: LtQuickImportCopy["confirm"];
  isImporting: boolean;
  importError: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl2 border border-grass-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <CandidateAvatar
          name={preview.display_name}
          avatar={preview.avatar}
          size="h-12 w-12"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold text-ink-900">
            {preview.display_name}
          </p>
          {preview.city && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
              <MapPin className="h-3 w-3" />
              {preview.city}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-mono text-2xl font-bold tabular-nums text-grass-700">
            {preview.external_elo ?? "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-ink-500">{copy.lt_elo}</p>
        </div>
      </div>

      <p className="rounded-lg bg-grass-50/70 px-3 py-2 text-sm font-medium text-grass-900">
        {copy.start_elo.replace("{elo}", String(preview.proposed_local_elo))}
      </p>

      {importError && (
        <p className="inline-flex items-start gap-1.5 text-xs text-clay-700">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          {importError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isImporting}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[13px] bg-pt-primary px-4 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {copy.cta_busy}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> {copy.cta}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isImporting}
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> {copy.back}
        </button>
      </div>
    </div>
  );
}
