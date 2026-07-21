"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X, MapPin, FileText, Paperclip, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { HelpTooltip } from "@/components/help/help-tooltip";
import {
  TournamentFormSchema,
  type TournamentForm,
  TOURNAMENT_FORMATS,
  TOURNAMENT_DISCIPLINES,
  SUPPORTED_FORMATS_MVP,
  SEEDING_METHODS,
  PRIVACY_OPTIONS,
  APPLICATION_MODES,
  SURFACES,
  MATCH_RULE_KINDS,
  DEFAULT_MATCH_RULES,
  type TournamentFormat,
  type TournamentDiscipline,
  type SeedingMethod,
  type Privacy,
  type ApplicationMode,
  type Surface,
  type MatchRuleKind,
} from "@/lib/tournaments/schema";
import { createTournament, updateTournament, type VenueOption, type ClubOption } from "./actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import type { TournamentBranding } from "@/lib/validators/tournament-branding";

export type TournamentDialogCopy = {
  create_title: string;
  edit_title: string;
  duplicate_title: string;
  template_title: string;
  third_place_match_label: string;
  third_place_match_hint: string;
  hide_organizer_label: string;
  hide_organizer_hint: string;
  regulations: {
    section: string;
    text_hint: string;
    file_label: string;
    file_hint: string;
    upload: string;
    uploading: string;
    remove: string;
    view: string;
    file_error: string;
  };
  fields: {
    name: string;
    description: string;
    format: string;
    discipline: string;
    surface: string;
    starts_on: string;
    start_time: string;
    ends_on: string;
    registration_deadline: string;
    max_participants: string;
    entry_fee: string;
    entry_fee_currency: string;
    venues: string;
    club: string;
    privacy: string;
    application_mode: string;
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
    discipline: string;
    privacy: string;
    application_mode: string;
    draw_method: string;
    match_rules: string;
    coming_soon: string;
    start_time: string;
    entry_fee: string;
    venues: string;
    venues_empty_catalogue: string;
    club: string;
  };
  format_labels: Record<TournamentFormat, string>;
  discipline_labels: Record<TournamentDiscipline, string>;
  surface_labels: Record<Surface, string>;
  draw_method_labels: Record<SeedingMethod, string>;
  privacy_labels: Record<Privacy, string>;
  application_mode_labels: Record<ApplicationMode, string>;
  match_rule_labels: Record<MatchRuleKind, string>;
  save: string;
  saving: string;
  cancel: string;
  error: string;
  none: string;
};

export type TournamentDialogMode = "create" | "edit" | "duplicate" | "template";

// Regulations document constraints — mirrored by the `tournament-files`
// storage bucket (mime types + 10 MB limit enforced server-side).
const REGULATIONS_MAX_BYTES = 10 * 1024 * 1024;
const REGULATIONS_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: string;
    form: TournamentForm;
  } | null;
  /**
   * Pre-filled values for the "Duplicate" flow. When set, the dialog opens
   * with these values but submits as a fresh create (no `id`). The caller
   * is responsible for clearing dates / suffixing the name beforehand.
   */
  prefill?: TournamentForm | null;
  /**
   * Branding (logo, banner, colors, sponsors) to apply to the NEW tournament.
   * Set by the duplicate / create-from-template flows; ignored in edit mode
   * (branding of an existing tournament is managed by its own editor).
   */
  branding?: TournamentBranding | null;
  mode?: TournamentDialogMode;
  venueOptions: VenueOption[];
  clubOptions: ClubOption[];
  copy: TournamentDialogCopy;
  onSaved: (id: string) => void;
};

export function TournamentFormDialog({
  open,
  onClose,
  initial,
  prefill,
  branding,
  mode = initial ? "edit" : "create",
  venueOptions,
  clubOptions,
  copy,
  onSaved,
}: Props) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useForm<TournamentForm>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: initial?.form ??
      prefill ?? {
        name: "",
        description: null,
        format: "single_elimination",
        discipline: "singles",
        surface: null,
        starts_on: new Date().toISOString().slice(0, 10),
        start_time: null,
        ends_on: null,
        registration_deadline: null,
        max_participants: null,
        entry_fee_byn: null,
        privacy: "club",
        application_mode: "manual",
        club_id: null,
        draw_method: "rating",
        prizes_description: null,
        match_rules: DEFAULT_MATCH_RULES,
        venue_ids: [],
        third_place_match: false,
        hide_organizer: false,
        regulations_text: null,
        regulations_file_url: null,
      },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setError(null);
    } else if (initial?.form) {
      form.reset(initial.form);
    } else if (prefill) {
      form.reset(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, mode]);

  if (!open) return null;

  const matchRulesKind = form.watch("match_rules.kind") as MatchRuleKind;

  async function uploadRegulationsFile(file: File): Promise<string | null> {
    setFileError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = REGULATIONS_MIME_BY_EXT[ext];
    if (!contentType || file.size > REGULATIONS_MAX_BYTES) {
      setFileError(copy.regulations.file_error);
      return null;
    }
    setFileUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFileError(copy.error);
        return null;
      }
      // Per-USER folder (not per-tournament): in create mode the tournament
      // row doesn't exist yet, so storage RLS checks ownership by uid folder.
      const path = `${user.id}/regulations-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("tournament-files")
        .upload(path, file, { upsert: true, contentType });
      if (upErr) {
        setFileError(upErr.message);
        return null;
      }
      const { data: pub } = supabase.storage.from("tournament-files").getPublicUrl(path);
      return pub.publicUrl;
    } finally {
      setFileUploading(false);
    }
  }

  function onSubmit(values: TournamentForm) {
    setError(null);
    startT(async () => {
      const r =
        mode === "edit" && initial
          ? await updateTournament(initial.id, values)
          : await createTournament(values, branding ?? undefined);
      if (r.ok) onSaved(r.id);
      else setError(localizeActionError(tErrors, r.error));
    });
  }

  const title =
    mode === "edit"
      ? copy.edit_title
      : mode === "duplicate"
        ? copy.duplicate_title
        : mode === "template"
          ? copy.template_title
          : copy.create_title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8">
      <div className="shadow-pop max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>
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
              className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
              className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                {copy.fields.discipline}
              </label>
              <Controller
                control={form.control}
                name="discipline"
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? "singles"}
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    {TOURNAMENT_DISCIPLINES.map((d) => (
                      <option key={d} value={d}>
                        {copy.discipline_labels[d]}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.discipline}</p>
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
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                {copy.fields.application_mode}
              </label>
              <Controller
                control={form.control}
                name="application_mode"
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? "manual"}
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  >
                    {APPLICATION_MODES.map((m) => (
                      <option key={m} value={m}>
                        {copy.application_mode_labels[m]}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.application_mode}</p>
            </div>

            {clubOptions.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-700">
                  {copy.fields.club}
                </label>
                <Controller
                  control={form.control}
                  name="club_id"
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : e.target.value)
                      }
                      className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                    >
                      <option value="">{copy.none}</option>
                      {clubOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <p className="mt-1 text-[11px] text-ink-500">{copy.hints.club}</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.starts_on}
              </label>
              <input
                type="date"
                {...form.register("starts_on")}
                className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.start_time}
              </label>
              <Controller
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <input
                    type="time"
                    step={300}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                    className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm tabular-nums outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                  />
                )}
              />
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.start_time}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.ends_on}
              </label>
              <input
                type="date"
                {...form.register("ends_on")}
                className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.registration_deadline}
              </label>
              <input
                type="date"
                {...form.register("registration_deadline")}
                className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {copy.fields.entry_fee}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={10}
                  {...form.register("entry_fee_byn")}
                  className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm tabular-nums outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
                />
                <span className="text-xs text-ink-500">{copy.fields.entry_fee_currency}</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-500">{copy.hints.entry_fee}</p>
            </div>
          </div>

          {/* Venues — multi-select chips, sourced from the public venues catalogue. */}
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-grass-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-grass-800">
                {copy.fields.venues}
              </p>
            </div>
            <p className="mb-3 text-[11px] text-ink-600">{copy.hints.venues}</p>
            <Controller
              control={form.control}
              name="venue_ids"
              render={({ field }) => {
                const selected = new Set<string>(field.value ?? []);
                if (venueOptions.length === 0) {
                  return (
                    <p className="text-xs text-ink-500">{copy.hints.venues_empty_catalogue}</p>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-2">
                    {venueOptions.map((v) => {
                      const isOn = selected.has(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(selected);
                            if (isOn) next.delete(v.id);
                            else next.add(v.id);
                            field.onChange(Array.from(next));
                          }}
                          aria-pressed={isOn}
                          className={
                            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition " +
                            (isOn
                              ? "border-grass-500 bg-grass-50 text-grass-800"
                              : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50")
                          }
                        >
                          <span>{v.name}</span>
                          {v.city && <span className="text-[10px] text-ink-500">· {v.city}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            />
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
                      className="h-10 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    {...form.register("match_rules.set_target" as any, {
                      valueAsNumber: true,
                      // Keep the tiebreak threshold in sync for long sets:
                      // a set to 10 plays its tiebreak at 10-all, not 6-all.
                      onChange: (e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) {
                          form.setValue(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            "match_rules.set_tiebreak_at" as any,
                            Math.max(6, Math.min(Math.round(v), 10)),
                          );
                        }
                      },
                    })}
                    className="h-9 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    className="h-9 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
                    className="h-9 w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
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
              className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
          </div>

          {/* Regulations — free-form text + attached PDF/DOC/DOCX document */}
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-grass-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-grass-800">
                {copy.regulations.section}
              </p>
            </div>
            <textarea
              {...form.register("regulations_text")}
              rows={4}
              className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
            <p className="mt-1 text-[11px] text-ink-500">{copy.regulations.text_hint}</p>

            <p className="mb-1 mt-3 block text-xs font-semibold text-ink-700">
              {copy.regulations.file_label}
            </p>
            <Controller
              control={form.control}
              name="regulations_file_url"
              render={({ field }) => (
                <div className="flex flex-wrap items-center gap-2">
                  {field.value && (
                    <>
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-grass-200 bg-grass-50 px-3 text-sm font-medium text-grass-800 transition hover:bg-grass-100"
                      >
                        <FileText className="h-4 w-4" />
                        {copy.regulations.view}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(null);
                          setFileError(null);
                        }}
                        className="inline-flex h-9 items-center gap-1 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        {copy.regulations.remove}
                      </button>
                    </>
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50">
                    {fileUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                    {fileUploading ? copy.regulations.uploading : copy.regulations.upload}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      disabled={fileUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const url = await uploadRegulationsFile(file);
                        if (url) field.onChange(url);
                      }}
                    />
                  </label>
                </div>
              )}
            />
            <p className="mt-1 text-[11px] text-ink-500">{copy.regulations.file_hint}</p>
            {fileError && <p className="mt-1 text-xs text-clay-700">{fileError}</p>}
            {form.formState.errors.regulations_file_url && (
              <p className="mt-1 text-xs text-clay-700">
                {form.formState.errors.regulations_file_url.message}
              </p>
            )}
          </div>

          {form.watch("format") === "group_playoff" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-100 bg-grass-50/30 p-3">
              <input
                type="checkbox"
                {...form.register("third_place_match")}
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-grass-600 focus:ring-grass-200"
              />
              <span className="text-xs">
                <span className="font-semibold text-ink-800">{copy.third_place_match_label}</span>
                <span className="mt-0.5 block text-ink-600">{copy.third_place_match_hint}</span>
              </span>
            </label>
          )}

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-100 p-3">
            <input
              type="checkbox"
              {...form.register("hide_organizer")}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-grass-600 focus:ring-grass-200"
            />
            <span className="text-xs">
              <span className="font-semibold text-ink-800">{copy.hide_organizer_label}</span>
              <span className="mt-0.5 block text-ink-600">{copy.hide_organizer_hint}</span>
            </span>
          </label>

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
              disabled={pending || fileUploading}
              className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-pt-primary px-4 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
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
