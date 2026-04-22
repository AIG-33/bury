"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { HelpTooltip } from "@/components/help/help-tooltip";
import {
  TournamentFormSchema,
  type TournamentForm,
  TOURNAMENT_FORMATS,
  SUPPORTED_FORMATS_MVP,
  SEEDING_METHODS,
  PRIVACY_OPTIONS,
  SURFACES,
  MATCH_RULE_KINDS,
  DEFAULT_MATCH_RULES,
  type TournamentFormat,
  type SeedingMethod,
  type Privacy,
  type Surface,
  type MatchRuleKind,
} from "@/lib/tournaments/schema";
import { createTournament, updateTournament } from "./actions";

export type TournamentDialogCopy = {
  create_title: string;
  edit_title: string;
  fields: {
    name: string;
    description: string;
    format: string;
    surface: string;
    starts_on: string;
    ends_on: string;
    registration_deadline: string;
    max_participants: string;
    privacy: string;
    draw_method: string;
    prizes: string;
    match_rules: string;
    set_target: string;
    target_games: string;
    minutes: string;
    no_ad: string;
    super_tiebreak: string;
    set_tiebreak_at: string;
  };
  hints: {
    format: string;
    privacy: string;
    draw_method: string;
    match_rules: string;
    coming_soon: string;
  };
  format_labels: Record<TournamentFormat, string>;
  surface_labels: Record<Surface, string>;
  draw_method_labels: Record<SeedingMethod, string>;
  privacy_labels: Record<Privacy, string>;
  match_rule_labels: Record<MatchRuleKind, string>;
  save: string;
  saving: string;
  cancel: string;
  error: string;
  none: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: string;
    form: TournamentForm;
  } | null;
  copy: TournamentDialogCopy;
  onSaved: (id: string) => void;
};

export function TournamentFormDialog({ open, onClose, initial, copy, onSaved }: Props) {
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<TournamentForm>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: initial?.form ?? {
      name: "",
      description: null,
      format: "single_elimination",
      surface: null,
      starts_on: new Date().toISOString().slice(0, 10),
      ends_on: null,
      registration_deadline: null,
      max_participants: null,
      privacy: "club",
      draw_method: "rating",
      prizes_description: null,
      match_rules: DEFAULT_MATCH_RULES,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setError(null);
    } else if (initial?.form) {
      form.reset(initial.form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  if (!open) return null;

  const matchRulesKind = form.watch("match_rules.kind") as MatchRuleKind;

  function onSubmit(values: TournamentForm) {
    setError(null);
    startT(async () => {
      const r = initial
        ? await updateTournament(initial.id, values)
        : await createTournament(values);
      if (r.ok) onSaved(r.id);
      else setError(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8">
      <div className="shadow-pop max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {initial ? copy.edit_title : copy.create_title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 transition hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              {copy.fields.name}
            </label>
            <input
              {...form.register("name")}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-clay-700">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              {copy.fields.description}
            </label>
            <textarea
              {...form.register("description")}
              rows={2}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.format}
              </label>
              <Controller
                control={form.control}
                name="format"
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? "single_elimination"}
                    className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    {TOURNAMENT_FORMATS.map((f) => (
                      <option key={f} value={f} disabled={!SUPPORTED_FORMATS_MVP.includes(f)}>
                        {copy.format_labels[f]}
                        {!SUPPORTED_FORMATS_MVP.includes(f) ? ` — ${copy.hints.coming_soon}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.format}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.draw_method}
              </label>
              <Controller
                control={form.control}
                name="draw_method"
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? "rating"}
                    className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    {SEEDING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {copy.draw_method_labels[m]}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.draw_method}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.surface}
              </label>
              <Controller
                control={form.control}
                name="surface"
                render={({ field }) => (
                  <select
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? null : (e.target.value as Surface))
                    }
                    className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    <option value="">{copy.none}</option>
                    {SURFACES.map((s) => (
                      <option key={s} value={s}>
                        {copy.surface_labels[s]}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.privacy}
              </label>
              <Controller
                control={form.control}
                name="privacy"
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? "club"}
                    className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    {PRIVACY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {copy.privacy_labels[p]}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.privacy}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.starts_on}
              </label>
              <input
                type="date"
                {...form.register("starts_on")}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.ends_on}
              </label>
              <input
                type="date"
                {...form.register("ends_on")}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.registration_deadline}
              </label>
              <input
                type="date"
                {...form.register("registration_deadline")}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.max_participants}
              </label>
              <input
                type="number"
                min={2}
                max={128}
                {...form.register("max_participants")}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>
          </div>

          {/* Match rules */}
          <div className="rounded-xl border border-ink-100 bg-grass-50/40 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-grass-800">
              {copy.fields.match_rules}
            </p>
            <p className="mb-3 text-[11px] text-ink-600">{copy.hints.match_rules}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Controller
                  control={form.control}
                  name="match_rules.kind"
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={(e) => {
                        const k = e.target.value as MatchRuleKind;
                        // Reset payload to safe defaults for each kind.
                        if (k === "best_of_3") {
                          form.setValue("match_rules", {
                            kind: "best_of_3",
                            set_target: 6,
                            no_ad: false,
                            super_tiebreak_decider: false,
                            set_tiebreak_at: 6,
                          });
                        } else if (k === "best_of_5") {
                          form.setValue("match_rules", {
                            kind: "best_of_5",
                            set_target: 6,
                            no_ad: false,
                            set_tiebreak_at: 6,
                          });
                        } else if (k === "single_set") {
                          form.setValue("match_rules", {
                            kind: "single_set",
                            set_target: 6,
                            no_ad: false,
                            set_tiebreak_at: 6,
                          });
                        } else if (k === "pro_set") {
                          form.setValue("match_rules", {
                            kind: "pro_set",
                            target_games: 8,
                            no_ad: false,
                          });
                        } else if (k === "first_to_games") {
                          form.setValue("match_rules", {
                            kind: "first_to_games",
                            target_games: 4,
                            no_ad: false,
                          });
                        } else if (k === "timed") {
                          form.setValue("match_rules", {
                            kind: "timed",
                            minutes: 45,
                            no_ad: false,
                          });
                        }
                      }}
                      className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                    >
                      {MATCH_RULE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {copy.match_rule_labels[k]}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>

              {(matchRulesKind === "best_of_3" ||
                matchRulesKind === "best_of_5" ||
                matchRulesKind === "single_set") && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-700">
                    {copy.fields.set_target}
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={10}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...form.register("match_rules.set_target" as any, { valueAsNumber: true })}
                    className="h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  />
                </div>
              )}

              {(matchRulesKind === "pro_set" || matchRulesKind === "first_to_games") && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-700">
                    {copy.fields.target_games}
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={15}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...form.register("match_rules.target_games" as any, { valueAsNumber: true })}
                    className="h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  />
                </div>
              )}

              {matchRulesKind === "timed" && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-700">
                    {copy.fields.minutes}
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...form.register("match_rules.minutes" as any, { valueAsNumber: true })}
                    className="h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  />
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-xs text-ink-700">
                <input
                  type="checkbox"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...form.register("match_rules.no_ad" as any)}
                />
                <span className="inline-flex items-center gap-1">
                  {copy.fields.no_ad}
                  <HelpTooltip term="no_ad" />
                </span>
              </label>

              {matchRulesKind === "best_of_3" && (
                <label className="inline-flex items-center gap-2 text-xs text-ink-700">
                  <input
                    type="checkbox"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...form.register("match_rules.super_tiebreak_decider" as any)}
                  />
                  <span className="inline-flex items-center gap-1">
                    {copy.fields.super_tiebreak}
                    <HelpTooltip term="super_tiebreak" />
                  </span>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              {copy.fields.prizes}
            </label>
            <textarea
              {...form.register("prizes_description")}
              rows={2}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
              {copy.error}: {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? copy.saving : copy.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
