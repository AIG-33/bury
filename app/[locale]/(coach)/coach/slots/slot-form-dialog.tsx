"use client";

import { useState, useTransition, useEffect } from "react";
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
} from "lucide-react";
import {
  SlotFormSchema,
  SLOT_TYPES,
  type SlotForm,
  type SlotType,
  type IsoWeekday,
} from "@/lib/slots/schema";
import { createSlots, type CourtOption } from "./actions";

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
  };
  hints: {
    weekly: string;
    duration: string;
    price: string;
    max_participants: string;
  };
  kinds: { single: string; weekly: string };
  slot_type_options: Record<SlotType, string>;
  weekday_short: Record<IsoWeekday, string>;
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

  const recurrenceKind = form.watch("recurrence.kind") as "single" | "weekly";

  useEffect(() => {
    if (!open) return;
    setErrMsg(null);
    setResult(null);
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
      setResult({ created: r.created, conflicts: r.conflicts });
      onSaved();
    });
  });

  function switchKind(kind: "single" | "weekly") {
    if (kind === "single") {
      form.setValue("recurrence", { kind: "single", date: today });
    } else {
      form.setValue("recurrence", {
        kind: "weekly",
        start_date: today,
        weeks: 4,
        weekdays: [1, 3],
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-pop">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-grass-700" />
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {copy.title}
            </h2>
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
              {(["single", "weekly"] as const).map((k) => {
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
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {copy.kinds[k]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence-specific fields */}
          {recurrenceKind === "single" ? (
            <Field label={copy.fields.date}>
              <input
                type="date"
                {...form.register("recurrence.date")}
                className={inputCls}
              />
            </Field>
          ) : (
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
                    const set = new Set<IsoWeekday>(
                      (field.value as IsoWeekday[]) ?? [],
                    );
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
            <Field
              label={copy.fields.max_participants}
              hint={copy.hints.max_participants}
            >
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
