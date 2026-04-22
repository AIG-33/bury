"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Users,
  MapPin,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Filter,
  Star,
  X,
  CalendarClock,
  Save,
  Eraser,
  ArrowDown,
} from "lucide-react";
import {
  searchOpponents,
  proposeMatch,
  updateMyAvailability,
  type DistrictOption,
} from "./actions";
import {
  EMPTY_AVAILABILITY,
  WEEKDAYS,
  TIME_SLOTS,
  type Availability,
} from "@/lib/profile/schema";
import type {
  ScoredCandidate,
  Weekday,
  DayPart,
} from "@/lib/matching/find-player";
import { whatsappLink } from "@/lib/contact/whatsapp";

type Locale = "pl" | "en" | "ru";

export type FindCopy = {
  filters_title: string;
  district: string;
  district_placeholder: string;
  elo_radius: string;
  availability: string;
  availability_hint: string;
  hand: string;
  hand_options: { both: string; R: string; L: string };
  query: string;
  query_placeholder: string;
  search: string;
  searching: string;
  reset: string;
  empty_title: string;
  empty_description: string;
  weekday: Record<Weekday, string>;
  weekday_short: Record<Weekday, string>;
  daypart: Record<DayPart, string>;
  card: {
    elo: string;
    score: string;
    overlap: string;
    overlap_none: string;
    propose: string;
    proposing: string;
    sent: string;
    duplicate: string;
    self: string;
    error: string;
    whatsapp: string;
    whatsapp_unavailable: string;
    optional_message: string;
    cancel: string;
    confirm: string;
  };
  /** Template with `{name}` placeholder; replaced on the client. */
  whatsapp_prefill: string;
  my_availability: {
    title: string;
    hint: string;
    empty_hint: string;
    save: string;
    saving: string;
    saved: string;
    error: string;
    reset: string;
    use_in_filter: string;
    profile_link: string;
  };
};

export function FindClient({
  locale,
  districts,
  copy,
  myAvailability,
}: {
  locale: Locale;
  districts: DistrictOption[];
  copy: FindCopy;
  myAvailability: Availability;
}) {
  const t = useTranslations("find");
  const [districtIds, setDistrictIds] = useState<string[]>([]);
  const [eloRadius, setEloRadius] = useState(150);
  const [hand, setHand] = useState<"both" | "R" | "L">("both");
  const [query, setQuery] = useState("");
  const [desiredSlots, setDesiredSlots] = useState<Set<string>>(new Set());
  const [savedAvailability, setSavedAvailability] =
    useState<Availability>(myAvailability);

  const [isSearching, startSearch] = useTransition();
  const [results, setResults] = useState<ScoredCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const slotKey = (w: Weekday, d: DayPart) => `${w}/${d}`;
  const toggleSlot = (w: Weekday, d: DayPart) => {
    setDesiredSlots((prev) => {
      const next = new Set(prev);
      const k = slotKey(w, d);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  function adoptMyScheduleAsFilter() {
    const next = new Set<string>();
    for (const w of WEEKDAYS) {
      for (const d of savedAvailability[w] ?? []) {
        next.add(slotKey(w, d));
      }
    }
    setDesiredSlots(next);
  }

  function runSearch() {
    setSearchError(null);
    startSearch(async () => {
      const desired = Array.from(desiredSlots).map((k) => {
        const [weekday, daypart] = k.split("/") as [Weekday, DayPart];
        return { weekday, daypart };
      });
      const r = await searchOpponents({
        districtIds,
        eloRadius,
        desiredSlots: desired,
        hand,
        query,
      });
      if (!r.ok) {
        setSearchError(r.error);
        setResults([]);
        return;
      }
      setResults(r.results);
    });
  }

  function reset() {
    setDistrictIds([]);
    setEloRadius(150);
    setHand("both");
    setQuery("");
    setDesiredSlots(new Set());
    setResults(null);
  }

  return (
    <div className="space-y-6">
      <MyAvailabilityCard
        locale={locale}
        copy={copy}
        initial={savedAvailability}
        onSaved={(next) => setSavedAvailability(next)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* ─── Filters ─── */}
      <aside className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card lg:sticky lg:top-20 lg:self-start">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-grass-700" />
          <h2 className="font-display text-base font-semibold text-ink-900">
            {copy.filters_title}
          </h2>
        </div>

        {/* Query */}
        <FieldBlock label={copy.query}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.query_placeholder}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
            />
          </div>
        </FieldBlock>

        {/* Districts */}
        <FieldBlock label={copy.district}>
          <DistrictPicker
            options={districts}
            selected={districtIds}
            onChange={setDistrictIds}
            placeholder={copy.district_placeholder}
          />
        </FieldBlock>

        {/* Elo radius */}
        <FieldBlock label={`${copy.elo_radius}: ±${eloRadius}`} hint={t("filters.elo_radius_hint", { n: eloRadius })}>
          <input
            type="range"
            min={25}
            max={500}
            step={25}
            value={eloRadius}
            onChange={(e) => setEloRadius(Number(e.target.value))}
            className="w-full accent-grass-600"
          />
        </FieldBlock>

        {/* Hand */}
        <FieldBlock label={copy.hand}>
          <div className="flex gap-1 rounded-lg border border-ink-200 p-1">
            {(["both", "R", "L"] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHand(h)}
                className={
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition " +
                  (hand === h
                    ? "bg-grass-500 text-white shadow-sm"
                    : "text-ink-600 hover:bg-ink-50")
                }
              >
                {copy.hand_options[h]}
              </button>
            ))}
          </div>
        </FieldBlock>

        {/* Availability grid */}
        <FieldBlock label={copy.availability} hint={copy.availability_hint}>
          <button
            type="button"
            onClick={adoptMyScheduleAsFilter}
            className="mb-2 inline-flex h-7 items-center gap-1 rounded-md border border-grass-300 bg-grass-50 px-2 text-[11px] font-medium text-grass-800 transition hover:bg-grass-100"
          >
            <ArrowDown className="h-3 w-3" />
            {copy.my_availability.use_in_filter}
          </button>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="p-1"></th>
                  {WEEKDAYS.map((w) => (
                    <th key={w} className="p-1 text-center font-medium text-ink-500">
                      {copy.weekday_short[w]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((d) => (
                  <tr key={d}>
                    <td className="pr-1 text-right text-ink-500">{copy.daypart[d]}</td>
                    {WEEKDAYS.map((w) => {
                      const k = slotKey(w, d);
                      const on = desiredSlots.has(k);
                      return (
                        <td key={w} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => toggleSlot(w, d)}
                            className={
                              "h-7 w-full rounded transition " +
                              (on
                                ? "bg-grass-500 text-white"
                                : "bg-ink-50 text-transparent hover:bg-grass-100")
                            }
                            aria-label={`${copy.weekday[w]} · ${copy.daypart[d]}`}
                          >
                            ·
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FieldBlock>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={runSearch}
            disabled={isSearching}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {copy.searching}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> {copy.search}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-ink-200 px-4 text-xs font-medium text-ink-600 transition hover:bg-ink-50"
          >
            {copy.reset}
          </button>
        </div>
      </aside>

      {/* ─── Results ─── */}
      <section className="space-y-3">
        {results === null && !isSearching && (
          <EmptyHero title={copy.empty_title} description={copy.empty_description} />
        )}

        {searchError && (
          <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{searchError}</span>
          </div>
        )}

        {results !== null && (
          <>
            <p className="text-sm text-ink-500">{t("results.count", { n: results.length })}</p>
            {results.length === 0 ? (
              <EmptyHero
                title={copy.empty_title}
                description={copy.empty_description}
                muted
              />
            ) : (
              <ul className="space-y-3">
                {results.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    locale={locale}
                    copy={copy}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  locale,
  copy,
}: {
  candidate: ScoredCandidate;
  locale: Locale;
  copy: FindCopy;
}) {
  const t = useTranslations("find");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, startSend] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errCode, setErrCode] = useState<string | null>(null);

  const wa = whatsappLink(
    candidate.whatsapp,
    copy.whatsapp_prefill.replace("{name}", candidate.display_name ?? ""),
  );

  function send() {
    setStatus("idle");
    setErrCode(null);
    startSend(async () => {
      const r = await proposeMatch({
        opponent_id: candidate.id,
        message: message.trim() || null,
      });
      if (r.ok) {
        setStatus("sent");
        setOpen(false);
      } else {
        setStatus("error");
        setErrCode(r.error);
      }
    });
  }

  const initials = (candidate.display_name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white shadow-card transition hover:shadow-pop">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {candidate.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.avatar_url}
              alt={candidate.display_name ?? ""}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-grass-100"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-grass-100 font-display text-base font-semibold text-grass-800 ring-2 ring-grass-200">
              {initials}
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="truncate font-display text-base font-semibold text-ink-900">
              {candidate.display_name ?? "—"}
            </p>
            <span className="font-mono text-xs text-ink-500">
              · {t("card.matches", { n: candidate.rated_matches_count })}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
            {(candidate.city || candidate.district_name) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[candidate.city, candidate.district_name].filter(Boolean).join(" · ")}
              </span>
            )}
            <ScoreBadge label={copy.card.score} value={candidate.score} />
          </div>
          {candidate.overlap_count > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-[11px] text-ink-500">{copy.card.overlap}:</span>
              {candidate.overlap_slots.slice(0, 6).map((s, i) => (
                <span
                  key={i}
                  className="rounded-md bg-grass-50 px-1.5 py-0.5 text-[11px] font-medium text-grass-800 ring-1 ring-grass-200"
                >
                  {copy.weekday_short[s.weekday]} · {copy.daypart[s.daypart]}
                </span>
              ))}
              {candidate.overlap_slots.length > 6 && (
                <span className="text-[11px] text-ink-500">
                  +{candidate.overlap_slots.length - 6}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-ink-400">{copy.card.overlap_none}</p>
          )}
        </div>

        {/* Elo + actions */}
        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">
              {copy.card.elo}
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-grass-700">
              {candidate.current_elo}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-grass-300 bg-grass-50 px-3 text-xs font-semibold text-grass-800 transition hover:bg-grass-100"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {copy.card.whatsapp}
              </a>
            )}
            {status === "sent" ? (
              <span className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-grass-100 px-3 text-xs font-semibold text-grass-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> {copy.card.sent}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700"
              >
                <Send className="h-3.5 w-3.5" /> {copy.card.propose}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Propose drawer */}
      {open && status !== "sent" && (
        <div className="border-t border-ink-100 bg-ink-50/40 p-4">
          <label className="mb-2 block text-xs font-medium text-ink-700">
            {copy.card.optional_message}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder=""
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
          />
          {status === "error" && errCode && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-clay-700">
              <AlertCircle className="h-3 w-3" />
              {errCode === "duplicate_proposal"
                ? copy.card.duplicate
                : errCode === "self_propose"
                  ? copy.card.self
                  : copy.card.error}
            </p>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-3 text-xs font-medium text-ink-600 transition hover:bg-white"
            >
              <X className="h-3 w-3" /> {copy.card.cancel}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={isSending}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-500 px-4 text-xs font-semibold text-white transition hover:bg-grass-600 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {isSending ? copy.card.proposing : copy.card.confirm}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

function DistrictPicker({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: DistrictOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const visibleOptions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q.length === 0
      ? options.slice(0, 25)
      : options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 25);
  }, [options, filter]);

  const selectedNames = useMemo(
    () =>
      options
        .filter((o) => selected.includes(o.id))
        .map((o) => o.name.split("·").pop()?.trim() ?? o.name),
    [options, selected],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-ink-200 bg-white px-3 text-left text-sm outline-none transition focus:border-grass-500"
      >
        <span className="truncate text-ink-700">
          {selected.length === 0
            ? placeholder
            : `${selectedNames.slice(0, 2).join(", ")}${
                selected.length > 2 ? ` +${selected.length - 2}` : ""
              }`}
        </span>
        <Users className="h-4 w-4 flex-shrink-0 text-ink-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-ink-200 bg-white shadow-pop">
          <div className="border-b border-ink-100 p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-ink-200 px-2 text-xs outline-none focus:border-grass-500"
              placeholder="…"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {visibleOptions.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-ink-400">—</li>
            )}
            {visibleOptions.map((o) => {
              const on = selected.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        on ? selected.filter((id) => id !== o.id) : [...selected, o.id],
                      )
                    }
                    className={
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition " +
                      (on ? "bg-grass-50 text-grass-900" : "hover:bg-ink-50")
                    }
                  >
                    <span
                      className={
                        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border " +
                        (on
                          ? "border-grass-500 bg-grass-500 text-white"
                          : "border-ink-300")
                      }
                    >
                      {on && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{o.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 75
      ? "bg-grass-100 text-grass-800 ring-grass-200"
      : value >= 50
        ? "bg-ball-100 text-ball-800 ring-ball-200"
        : "bg-ink-100 text-ink-700 ring-ink-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tone}`}
    >
      <Star className="h-2.5 w-2.5" /> {label} {value}
    </span>
  );
}

function MyAvailabilityCard({
  locale,
  copy,
  initial,
  onSaved,
}: {
  locale: Locale;
  copy: FindCopy;
  initial: Availability;
  onSaved: (next: Availability) => void;
}) {
  const [draft, setDraft] = useState<Availability>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState<Availability>(initial);
  const [isSaving, startSaving] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const dirty = useMemo(() => {
    for (const w of WEEKDAYS) {
      const a = new Set(draft[w] ?? []);
      const b = new Set(savedSnapshot[w] ?? []);
      if (a.size !== b.size) return true;
      for (const v of a) if (!b.has(v)) return true;
    }
    return false;
  }, [draft, savedSnapshot]);

  const totalSelected = useMemo(
    () => WEEKDAYS.reduce((sum, w) => sum + (draft[w]?.length ?? 0), 0),
    [draft],
  );

  function toggle(w: Weekday, d: DayPart) {
    setStatus("idle");
    setDraft((prev) => {
      const cur = new Set(prev[w] ?? []);
      if (cur.has(d)) cur.delete(d);
      else cur.add(d);
      return { ...prev, [w]: Array.from(cur) };
    });
  }

  function clearAll() {
    setStatus("idle");
    setDraft({ ...EMPTY_AVAILABILITY });
  }

  function save() {
    setStatus("idle");
    startSaving(async () => {
      const r = await updateMyAvailability(draft);
      if (r.ok) {
        setSavedSnapshot(r.availability);
        onSaved(r.availability);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-5 w-5 text-grass-700" />
          <div>
            <h2 className="font-display text-base font-semibold text-ink-900">
              {copy.my_availability.title}
            </h2>
            <p className="mt-0.5 max-w-xl text-xs text-ink-500">
              {totalSelected === 0
                ? copy.my_availability.empty_hint
                : copy.my_availability.hint}
            </p>
          </div>
        </div>
        <Link
          href={`/${locale}/me/profile`}
          className="text-[11px] font-medium text-grass-700 underline-offset-2 hover:underline"
        >
          {copy.my_availability.profile_link}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="p-1"></th>
              {WEEKDAYS.map((w) => (
                <th
                  key={w}
                  className="p-1 text-center font-medium text-ink-500"
                >
                  {copy.weekday_short[w]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((d) => (
              <tr key={d}>
                <td className="pr-2 text-right text-ink-500">
                  {copy.daypart[d]}
                </td>
                {WEEKDAYS.map((w) => {
                  const on = (draft[w] ?? []).includes(d);
                  return (
                    <td key={w} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => toggle(w, d)}
                        className={
                          "h-8 w-full rounded transition " +
                          (on
                            ? "bg-grass-500 text-white"
                            : "bg-ink-50 text-transparent hover:bg-grass-100")
                        }
                        aria-label={`${copy.weekday[w]} · ${copy.daypart[d]}`}
                      >
                        ·
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={clearAll}
          disabled={isSaving || totalSelected === 0}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-3 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
        >
          <Eraser className="h-3 w-3" />
          {copy.my_availability.reset}
        </button>
        <div className="flex items-center gap-3">
          {status === "saved" && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-grass-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {copy.my_availability.saved}
            </span>
          )}
          {status === "error" && (
            <span className="inline-flex items-center gap-1 text-xs text-clay-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {copy.my_availability.error}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={isSaving || !dirty}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-500 px-4 text-xs font-semibold text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isSaving ? copy.my_availability.saving : copy.my_availability.save}
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyHero({
  title,
  description,
  muted = false,
}: {
  title: string;
  description: string;
  muted?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-ink-200 px-6 py-16 text-center " +
        (muted ? "bg-ink-50/30" : "bg-grass-50/30")
      }
    >
      <Users className="h-10 w-10 text-grass-600" />
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="max-w-md text-sm text-ink-600">{description}</p>
    </div>
  );
}
