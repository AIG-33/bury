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
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { deleteTournament, type TournamentRow } from "./actions";
import {
  TournamentFormDialog,
  type TournamentDialogCopy,
} from "./tournament-form-dialog";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
  MatchRules,
} from "@/lib/tournaments/schema";

export type TournamentsListCopy = {
  empty_title: string;
  empty_description: string;
  empty_cta: string;
  add: string;
  edit: string;
  delete: string;
  delete_confirm: string;
  deleting: string;
  open: string;
  no_surface: string;
  format_labels: Record<TournamentFormat, string>;
  status_labels: Record<TournamentStatus, string>;
  surface_labels: Record<Surface, string>;
  dialog: TournamentDialogCopy;
};

export function TournamentsClient({
  locale,
  tournaments,
  copy,
}: {
  locale: string;
  tournaments: TournamentRow[];
  copy: TournamentsListCopy;
}) {
  const t = useTranslations("tournamentsCoach");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  const router = useRouter();

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: TournamentRow) {
    setEditing(t);
    setOpen(true);
  }
  function onDelete(id: string) {
    if (!confirm(copy.delete_confirm)) return;
    setDeletingId(id);
    startT(async () => {
      const r = await deleteTournament(id);
      setDeletingId(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  const initialForm = editing
    ? {
        id: editing.id,
        form: {
          name: editing.name,
          description: editing.description,
          format: editing.format,
          surface: editing.surface,
          starts_on: editing.starts_on,
          ends_on: editing.ends_on,
          registration_deadline: editing.registration_deadline
            ? editing.registration_deadline.slice(0, 10)
            : null,
          max_participants: editing.max_participants,
          privacy: editing.privacy,
          draw_method: editing.draw_method ?? "rating",
          prizes_description: editing.prizes_description,
          match_rules: editing.match_rules as MatchRules,
        },
      }
    : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
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
              className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-ink-900">
                    {tour.name}
                  </h3>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
                    <Trophy className="h-3 w-3" />
                    {copy.format_labels[tour.format]}
                  </p>
                </div>
                <StatusPill status={tour.status} label={copy.status_labels[tour.status]} />
              </div>

              <p className="mt-3 inline-flex items-center gap-1 text-xs text-ink-600">
                <CalendarDays className="h-3 w-3" />
                {tour.starts_on}
                {tour.ends_on && tour.ends_on !== tour.starts_on
                  ? ` → ${tour.ends_on}`
                  : ""}
              </p>

              <div className="mt-3 flex items-center gap-2">
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
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(tour)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    <Pencil className="h-3 w-3" /> {copy.edit}
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
                    {pending && deletingId === tour.id
                      ? copy.deleting
                      : copy.delete}
                  </button>
                </div>
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={`/${locale}/coach/tournaments/${tour.id}` as any}
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
        copy={copy.dialog}
        onSaved={(id) => {
          setOpen(false);
          if (!editing) router.push(`/${locale}/coach/tournaments/${id}` as never);
          else router.refresh();
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
