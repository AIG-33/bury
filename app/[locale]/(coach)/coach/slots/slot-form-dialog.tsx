"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  RefreshCcw,
  Calendar,
  CalendarRange,
  Plus,
} from "lucide-react";
import {
  SlotFormSchema,
  SLOT_TYPES,
  type SlotForm,
  type SlotType,
  type IsoWeekday,
} from "@/lib/slots/schema";
import { addDays, formatISODate, isoWeekday, parseISODate } from "@/lib/slots/expand";
import { createSlots, type CourtOption } from "./actions";
import { HelpTooltip } from "@/components/help/help-tooltip";

const ISO_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export type SlotDialogCopy = {
  title: string;
  intro: string;
  fields: {
    court: string;
    kind: string;
    date: string;
    start_date: string;
    weeks: string;
    weekdays: string;
    start_time: string;
    duration: string;
    slot_type: string;
    max_participants: string;
    price_pln: string;
    notes: string;
    range_from: string;
    range_to: string;
    selected_dates: string;
  };
  hints: {
    weekly: string;
    duration: string;
    price: string;
    max_participants: string;
    dates: string;
  };
  kinds: { single: string; weekly: string; dates: string };
  slot_type_options: Record<SlotType, string>;
  weekday_short: Record<IsoWeekday, string>;
  add_range: string;
  add_date: string;
  clear_all: string;
  selected_count: string;
  no_dates_yet: string;
  weekday_filter_label: string;
  weekday_filter_all: string;
  save: string;
  saving: string;
  cancel: string;
  error: string;
  no_courts: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  courts: CourtOption[];
  copy: SlotDialogCopy;
  onSaved: () => void;
};

export function SlotFormDialog({ open, onClose, courts, copy, onSaved }: Props) {
  const t = useTranslations("slotsCoach.dialog");
  const [pending, startT] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    conflicts: Array<{ local_date: string; local_start_time: string }>;
  } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<SlotForm>({
    resolver: zodResolver(SlotFormSchema),
    defaultValues: {
      court_id: courts[0]?.id ?? "",
      start_time: "18:00",
      duration_minutes: 60,
      slot_type: "individual",
      max_participants: 1,
      price_pln: null,
      notes: null,
      recurrence: { kind: "single", date: today },
    },
  });

  // `recurrence.kind` is never registered directly (only its sibling fields
  // are, via register/Controller), so `form.watch("recurrence.kind")` does
  // not always re-render when we replace the whole `recurrence` object via
  // setValue. We mirror the active kind in local state — the button group
  // becomes the source of truth for which sub-form is visible, and setValue
  // keeps the actual form payload in sync.
  const [recurrenceKind, setRecurrenceKind] = useState<"single" | "weekly" | "dates">("single");

  useEffect(() => {
    if (!open) return;
    setErrMsg(null);
    setResult(null);
    setRecurrenceKind("single");
    form.setValue("recurrence", { kind: "single", date: today });
    // We intentionally only react to `open` flipping — re-syncing on every
    // form/today change would clobber user input mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = form.handleSubmit((values) => {
    setErrMsg(null);
    setResult(null);
    startT(async () => {
      const r = await createSlots(values);
      if (!r.ok) {
        setErrMsg(r.error);
        return;
      }
      onSaved();
      // Auto-close on full success. If there were conflicts (some dates
      // already had a slot), keep the dialog open so the coach actually
      // sees which dates were skipped — losing that info silently is
      // worse than the extra click.
      if (r.conflicts.length === 0) {
        onClose();
        return;
      }
      setResult({ created: r.created, conflicts: r.conflicts });
    });
  });

  function switchKind(kind: "single" | "weekly" | "dates") {
    setRecurrenceKind(kind);
    if (kind === "single") {
      form.setValue("recurrence", { kind: "single", date: today });
    } else if (kind === "weekly") {
      form.setValue("recurrence", {
        kind: "weekly",
        start_date: today,
        weeks: 4,
        weekdays: [1, 3],
      });
    } else {
      form.setValue("recurrence", {
        kind: "dates",
        dates: [today],
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div className="shadow-pop relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-grass-700" />
            <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-5">
          <p className="text-sm text-ink-600">{copy.intro}</p>

          {courts.length === 0 ? (
            <div className="rounded-md bg-ball-100 px-3 py-2 text-sm text-ink-700">
              {copy.no_courts}
            </div>
          ) : (
            <Field label={copy.fields.court}>
              <select
                {...form.register("court_id")}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.venue_name} — {c.name ? `${c.name} (#${c.number})` : `#${c.number}`}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Kind toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-700">
              {copy.fields.kind}
            </label>
            <div className="flex gap-2">
              {(["single", "weekly", "dates"] as const).map((k) => {
                const isOn = recurrenceKind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchKind(k)}
                    className={
                      "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition " +
                      (isOn
                        ? "bg-grass-500 text-white shadow-card"
                        : "bg-ink-100 text-ink-700 hover:bg-ink-200")
                    }
                  >
                    {k === "single" ? (
                      <Calendar className="h-4 w-4" />
                    ) : k === "weekly" ? (
                      <RefreshCcw className="h-4 w-4" />
                    ) : (
                      <CalendarRange className="h-4 w-4" />
                    )}
                    {copy.kinds[k]}
                  </button>
                );
              })}
            </div>
            {recurrenceKind === "weekly" && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-500">
                <span>RRULE</span>
                <HelpTooltip term="rrule" />
              </p>
            )}
          </div>

          {/* Recurrence-specific fields */}
          {recurrenceKind === "single" ? (
            <Field label={copy.fields.date}>
              <input type="date" {...form.register("recurrence.date")} className={inputCls} />
            </Field>
          ) : recurrenceKind === "weekly" ? (
            <div className="space-y-3 rounded-xl bg-grass-50/50 p-4 ring-1 ring-grass-100">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={copy.fields.start_date}>
                  <input
                    type="date"
                    {...form.register("recurrence.start_date")}
                    className={inputCls}
                  />
                </Field>
                <Field label={copy.fields.weeks}>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    {...form.register("recurrence.weeks")}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label={copy.fields.weekdays} hint={copy.hints.weekly}>
                <Controller
                  control={form.control}
                  name="recurrence.weekdays"
                  render={({ field }) => {
                    const set = new Set<IsoWeekday>((field.value as IsoWeekday[]) ?? []);
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {ISO_DAYS.map((d) => {
                          const on = set.has(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                const next = new Set(set);
                                if (on) next.delete(d);
                                else next.add(d);
                                field.onChange(Array.from(next).sort());
                              }}
                              className={
                                "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition " +
                                (on
                                  ? "bg-grass-500 text-white shadow-sm"
                                  : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50")
                              }
                            >
                              {copy.weekday_short[d]}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              </Field>
            </div>
          ) : (
            <Controller
              control={form.control}
              name="recurrence.dates"
              render={({ field }) => (
                <DatesPicker
                  value={(field.value as string[] | undefined) ?? []}
                  onChange={(next) => field.onChange(next)}
                  copy={copy}
                  today={today}
                />
              )}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={copy.fields.start_time}>
              <input type="time" {...form.register("start_time")} className={inputCls} />
            </Field>
            <Field label={copy.fields.duration} hint={copy.hints.duration}>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                {...form.register("duration_minutes")}
                className={inputCls}
              />
            </Field>
            <Field label={copy.fields.slot_type}>
              <select {...form.register("slot_type")} className={inputCls}>
                {SLOT_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {copy.slot_type_options[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={copy.fields.max_participants} hint={copy.hints.max_participants}>
              <input
                type="number"
                min={1}
                max={20}
                {...form.register("max_participants")}
                className={inputCls}
              />
            </Field>
            <Field label={copy.fields.price_pln} hint={copy.hints.price}>
              <input
                type="number"
                min={0}
                placeholder="—"
                {...form.register("price_pln")}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label={copy.fields.notes}>
            <textarea
              {...form.register("notes")}
              rows={2}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
            />
          </Field>

          {errMsg && (
            <div className="flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>
                {copy.error}: {errMsg}
              </span>
            </div>
          )}
          {result && (
            <div className="space-y-1 rounded-md bg-grass-50 px-3 py-2 text-sm text-grass-900">
              <p className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {t("result_created", { n: result.created })}
              </p>
              {result.conflicts.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-clay-700">
                    {t("result_conflicts", { n: result.conflicts.length })}
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-xs text-clay-700">
                    {result.conflicts.map((c, i) => (
                      <li key={i}>
                        {c.local_date} · {c.local_start_time}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <footer className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t border-ink-100 bg-white/95 px-6 pb-1 pt-4 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={pending || courts.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.saving}
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" /> {copy.save}
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

// =============================================================================
// DatesPicker
//
// UX:
//   1. "Add range":  from + to date inputs and an Add button. Adds every date
//      in [from, to] to the selection, optionally filtered by the chosen
//      weekday chips. If no chip is active, all weekdays count.
//   2. "Add single date": one date input + plus button to drop a one-off.
//   3. "Selected dates": chip list with × to remove each, plus Clear all.
//
// All emitted values are unique YYYY-MM-DD strings sorted ascending.
// =============================================================================

function DatesPicker({
  value,
  onChange,
  copy,
  today,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  copy: SlotDialogCopy;
  today: string;
}) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [single, setSingle] = useState(today);
  const [weekdayFilter, setWeekdayFilter] = useState<Set<IsoWeekday>>(
    () => new Set<IsoWeekday>(),
  );

  function addRange() {
    if (!from || !to) return;
    const start = parseISODate(from);
    const end = parseISODate(to);
    if (end.getTime() < start.getTime()) return;
    const allowed = weekdayFilter.size === 0 ? null : weekdayFilter;
    const additions: string[] = [];
    // Cap iterations to avoid runaway loops; schema clamps the final list to 90
    // anyway, so 366 is a comfortable upper bound for any realistic batch.
    for (let i = 0; i < 366; i++) {
      const d = addDays(start, i);
      if (d.getTime() > end.getTime()) break;
      if (allowed && !allowed.has(isoWeekday(d))) continue;
      additions.push(formatISODate(d));
    }
    onChange(mergeDates(value, additions));
  }

  function addSingle() {
    if (!single) return;
    onChange(mergeDates(value, [single]));
  }

  function removeOne(d: string) {
    onChange(value.filter((x) => x !== d));
  }

  function clearAll() {
    onChange([]);
  }

  function toggleWeekday(d: IsoWeekday) {
    const next = new Set(weekdayFilter);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setWeekdayFilter(next);
  }

  return (
    <div className="space-y-3 rounded-xl bg-grass-50/50 p-4 ring-1 ring-grass-100">
      {/* Add range */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label={copy.fields.range_from}>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={copy.fields.range_to}>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from}
            className={inputCls}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={addRange}
            className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 sm:w-auto"
          >
            <CalendarRange className="h-4 w-4" /> {copy.add_range}
          </button>
        </div>
      </div>

      {/* Weekday filter chips for the range */}
      <div>
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">
          {copy.weekday_filter_label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ISO_DAYS.map((d) => {
            const on = weekdayFilter.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                className={
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition " +
                  (on
                    ? "bg-grass-500 text-white shadow-sm"
                    : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50")
                }
              >
                {copy.weekday_short[d]}
              </button>
            );
          })}
          {weekdayFilter.size === 0 && (
            <span className="ml-1 self-center text-[11px] text-ink-500">
              {copy.weekday_filter_all}
            </span>
          )}
        </div>
      </div>

      {/* Add a single date */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={copy.fields.date}>
          <input
            type="date"
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={addSingle}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            <Plus className="h-4 w-4" /> {copy.add_date}
          </button>
        </div>
      </div>

      {/* Selected dates */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-ink-700">
            {copy.fields.selected_dates}{" "}
            <span className="ml-1 font-normal text-ink-500">
              ({copy.selected_count.replace("{n}", String(value.length))})
            </span>
          </p>
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-medium text-clay-700 hover:text-clay-800"
            >
              {copy.clear_all}
            </button>
          )}
        </div>
        {value.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-3 py-2 text-[11px] text-ink-500">
            {copy.no_dates_yet}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {value.map((d) => (
              <li
                key={d}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-ink-800 ring-1 ring-ink-200"
              >
                <span className="tabular-nums">{d}</span>
                <button
                  type="button"
                  onClick={() => removeOne(d)}
                  className="rounded p-0.5 text-ink-400 hover:bg-ink-50 hover:text-clay-700"
                  aria-label={copy.clear_all}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {copy.hints.dates && (
          <p className="text-[11px] text-ink-500">{copy.hints.dates}</p>
        )}
      </div>
    </div>
  );
}

function mergeDates(current: string[], additions: string[]): string[] {
  const set = new Set(current);
  for (const d of additions) set.add(d);
  return Array.from(set).sort();
}
