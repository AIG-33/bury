"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Loader2,
  Trophy,
  CalendarDays,
  Clock,
  Coins,
  Copy,
  MapPin,
  Users,
  Inbox,
  BookmarkPlus,
  LayoutTemplate,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import {
  templatePayloadFromForm,
  formFromTemplatePayload,
  type TournamentTemplatePayload,
} from "@/lib/tournaments/template-schema";
import { deleteTournament, type TournamentRow, type VenueOption, type ClubOption } from "./actions";
import type { TemplateRow } from "./template-actions";
import { SaveTemplateDialog, TemplatePickerDialog } from "./template-dialogs";
import {
  TournamentFormDialog,
  type TournamentDialogCopy,
  type TournamentDialogMode,
} from "./tournament-form-dialog";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
  MatchRules,
  TournamentForm,
} from "@/lib/tournaments/schema";

export type OrganizedTournamentsCopy = {
  empty_title: string;
  empty_description: string;
  empty_cta: string;
  add: string;
  edit: string;
  duplicate: string;
  copy_suffix: string;
  delete: string;
  delete_confirm: string;
  deleting: string;
  open: string;
  no_surface: string;
  entry_fee_free: string;
  entry_fee_byn: string;
  pending_badge: string;
  format_labels: Record<TournamentFormat, string>;
  status_labels: Record<TournamentStatus, string>;
  surface_labels: Record<Surface, string>;
  dialog: TournamentDialogCopy;
};

export function OrganizedTournamentsClient({
  locale,
  tournaments,
  venueOptions,
  clubOptions,
  templates,
  copy,
}: {
  locale: string;
  tournaments: TournamentRow[];
  venueOptions: VenueOption[];
  clubOptions: ClubOption[];
  templates: TemplateRow[];
  copy: OrganizedTournamentsCopy;
}) {
  const t = useTranslations("tournamentsOrganized");
  const tTemplates = useTranslations("tournamentsOrganized.templates");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TournamentDialogMode>("create");
  const [editing, setEditing] = useState<TournamentRow | null>(null);
  const [prefill, setPrefill] = useState<TournamentForm | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveTplFor, setSaveTplFor] = useState<{
    payload: TournamentTemplatePayload;
    name: string;
    clubId: string | null;
  } | null>(null);
  const [pending, startT] = useTransition();
  const router = useRouter();

  function tournamentToForm(t: TournamentRow): TournamentForm {
    return {
      name: t.name,
      description: t.description,
      format: t.format,
      surface: t.surface,
      starts_on: t.starts_on,
      start_time: t.start_time ? t.start_time.slice(0, 5) : null,
      ends_on: t.ends_on,
      registration_deadline: t.registration_deadline ? t.registration_deadline.slice(0, 10) : null,
      max_participants: t.max_participants,
      entry_fee_byn: t.entry_fee_byn,
      privacy: t.privacy,
      club_id: t.club_id ?? null,
      draw_method: t.draw_method ?? "rating",
      prizes_description: t.prizes_description,
      match_rules: t.match_rules as MatchRules,
      venue_ids: t.venues.map((v) => v.id),
      third_place_match: t.third_place_match,
    };
  }

  function openCreate() {
    setMode("create");
    setEditing(null);
    setPrefill(null);
    setOpen(true);
  }
  function openEdit(t: TournamentRow) {
    setMode("edit");
    setEditing(t);
    setPrefill(null);
    setOpen(true);
  }
  function openDuplicate(t: TournamentRow) {
    // Clone settings, blank out everything date-related, suffix the name and
    // demote registration_deadline to null — the organiser must pick fresh
    // dates for the new run. Participants & matches stay behind.
    const base = tournamentToForm(t);
    const today = new Date().toISOString().slice(0, 10);
    setMode("duplicate");
    setEditing(null);
    setPrefill({
      ...base,
      name: `${t.name}${copy.copy_suffix}`,
      starts_on: today,
      ends_on: null,
      registration_deadline: null,
    });
    setOpen(true);
  }
  function openSaveTemplate(t: TournamentRow) {
    setSaveTplFor({
      payload: templatePayloadFromForm(tournamentToForm(t)),
      name: t.name,
      clubId: t.club_id ?? null,
    });
  }
  function openFromTemplate(tpl: TemplateRow) {
    if (!tpl.payload) return;
    setPickerOpen(false);
    setMode("template");
    setEditing(null);
    setPrefill(
      formFromTemplatePayload({
        templateName: tpl.name,
        payload: tpl.payload,
        clubId: tpl.club_id,
      }),
    );
    setOpen(true);
  }
  function onDelete(id: string) {
    if (!confirm(copy.delete_confirm)) return;
    setDeletingId(id);
    startT(async () => {
      const r = await deleteTournament(id);
      setDeletingId(null);
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  const initialForm = editing
    ? {
        id: editing.id,
        form: tournamentToForm(editing),
      }
    : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-grass-300 bg-white px-4 text-sm font-medium text-grass-800 shadow-card transition hover:bg-grass-50"
        >
          <LayoutTemplate className="h-4 w-4" /> {tTemplates("from_template")}
        </button>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
        >
          <Plus className="h-4 w-4" /> {copy.add}
        </button>
      </div>

      {tournaments.length === 0 ? (
        <EmptyState
          title={copy.empty_title}
          description={copy.empty_description}
          action={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
            >
              <Plus className="h-4 w-4" /> {copy.empty_cta}
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tournaments.map((tour) => (
            <li
              key={tour.id}
              className="hover:shadow-pop flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-ink-900">{tour.name}</h3>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
                    <Trophy className="h-3 w-3" />
                    {copy.format_labels[tour.format]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill status={tour.status} label={copy.status_labels[tour.status]} />
                  {tour.pending_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-clay-800">
                      <Inbox className="h-3 w-3" />
                      {copy.pending_badge.replace("{n}", String(tour.pending_count))}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {tour.starts_on}
                  {tour.ends_on && tour.ends_on !== tour.starts_on ? ` → ${tour.ends_on}` : ""}
                </span>
                {tour.start_time && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" />
                    {tour.start_time.slice(0, 5)}
                  </span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-grass-50 px-2 py-1 text-xs font-semibold text-grass-800">
                  <Users className="h-3.5 w-3.5" />
                  {t("list.participants_count", {
                    n: tour.participants_count,
                    max: tour.max_participants ?? 0,
                  })}
                </span>
                {tour.surface && (
                  <span className="rounded-md bg-ball-50 px-2 py-1 text-xs font-medium text-ball-800">
                    {copy.surface_labels[tour.surface]}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-1 text-xs font-medium tabular-nums text-ink-700">
                  <Coins className="h-3.5 w-3.5" />
                  {tour.entry_fee_byn == null || tour.entry_fee_byn === 0
                    ? copy.entry_fee_free
                    : copy.entry_fee_byn.replace("{n}", String(tour.entry_fee_byn))}
                </span>
              </div>

              {tour.venues.length > 0 && (
                <ul className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-600">
                  {tour.venues.map((v) => (
                    <li
                      key={v.id}
                      className="inline-flex items-center gap-1 rounded-full bg-grass-50/60 px-2 py-0.5 text-grass-800"
                    >
                      <MapPin className="h-3 w-3" />
                      {v.name}
                      {v.city && <span className="text-ink-500">· {v.city}</span>}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(tour)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    <Pencil className="h-3 w-3" /> {copy.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDuplicate(tour)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    <Copy className="h-3 w-3" /> {copy.duplicate}
                  </button>
                  <button
                    type="button"
                    onClick={() => openSaveTemplate(tour)}
                    title={tTemplates("save_button")}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    <BookmarkPlus className="h-3 w-3" /> {tTemplates("save_button_short")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(tour.id)}
                    disabled={pending && deletingId === tour.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-2 text-xs font-medium text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                  >
                    {pending && deletingId === tour.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    {pending && deletingId === tour.id ? copy.deleting : copy.delete}
                  </button>
                </div>
                <Link
                  href={`/${locale}/me/tournaments/organized/${tour.id}`}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700"
                >
                  {copy.open} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TournamentFormDialog
        open={open}
        onClose={() => setOpen(false)}
        initial={initialForm}
        prefill={prefill}
        mode={mode}
        venueOptions={venueOptions}
        clubOptions={clubOptions}
        copy={copy.dialog}
        onSaved={(id) => {
          setOpen(false);
          if (mode === "edit") router.refresh();
          else router.push(`/${locale}/me/tournaments/organized/${id}` as never);
        }}
      />

      <TemplatePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        templates={templates}
        formatLabels={copy.format_labels}
        onPick={openFromTemplate}
      />

      <SaveTemplateDialog
        open={saveTplFor != null}
        onClose={() => setSaveTplFor(null)}
        payload={saveTplFor?.payload ?? null}
        defaultName={saveTplFor?.name ?? ""}
        defaultClubId={saveTplFor?.clubId ?? null}
        clubOptions={clubOptions}
        onSaved={() => {
          setSaveTplFor(null);
          router.refresh();
        }}
      />
    </>
  );
}

function StatusPill({ status, label }: { status: TournamentStatus; label: string }) {
  const cls =
    status === "draft"
      ? "bg-ink-100 text-ink-700"
      : status === "registration"
        ? "bg-ball-100 text-ball-800"
        : status === "in_progress"
          ? "bg-grass-100 text-grass-800"
          : status === "finished"
            ? "bg-grass-200 text-grass-900"
            : "bg-clay-100 text-clay-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
