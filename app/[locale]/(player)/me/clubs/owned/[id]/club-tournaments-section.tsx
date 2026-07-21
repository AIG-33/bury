"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trophy,
  CalendarDays,
  Users,
  Inbox,
  ArrowRight,
  Loader2,
  LayoutTemplate,
  RotateCcw,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import {
  formFromTemplatePayload,
  type TournamentTemplatePayload,
} from "@/lib/tournaments/template-schema";
import type { TournamentBranding } from "@/lib/validators/tournament-branding";
import type {
  TournamentForm,
  TournamentStatus,
  TournamentFormat,
  Surface,
} from "@/lib/tournaments/schema";
import { DEFAULT_MATCH_RULES } from "@/lib/tournaments/schema";
import type { VenueOption } from "../../../tournaments/organized/actions";
import { setTournamentStatus } from "../../../tournaments/organized/actions";
import type { TemplateRow } from "../../../tournaments/organized/template-actions";
import { TemplatePickerDialog } from "../../../tournaments/organized/template-dialogs";
import {
  TournamentFormDialog,
  type TournamentDialogCopy,
  type TournamentDialogMode,
} from "../../../tournaments/organized/tournament-form-dialog";
import type { ClubTournamentRow, PendingScoreMatch } from "../tournaments-actions";

const SECTION = "rounded-xl2 border border-ink-100 bg-white p-4 shadow-card";
const BTN_PRIMARY =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-700 px-3 text-sm font-semibold text-white transition hover:bg-grass-800 disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-grass-300 bg-white px-3 text-sm font-medium text-grass-800 transition hover:bg-grass-50 disabled:opacity-50";

type Props = {
  locale: string;
  clubId: string;
  clubName: string;
  tournaments: ClubTournamentRow[];
  pendingScores: PendingScoreMatch[];
  templates: TemplateRow[];
  venueOptions: VenueOption[];
  dialogCopy: TournamentDialogCopy;
  formatLabels: Record<TournamentFormat, string>;
  statusLabels: Record<TournamentStatus, string>;
  surfaceLabels: Record<Surface, string>;
};

export function ClubTournamentsSection({
  locale,
  clubId,
  clubName,
  tournaments,
  pendingScores,
  templates,
  venueOptions,
  dialogCopy,
  formatLabels,
  statusLabels,
  surfaceLabels,
}: Props) {
  const t = useTranslations("clubsOwned.detail.tournaments");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<TournamentDialogMode>("create");
  const [prefill, setPrefill] = useState<TournamentForm | null>(null);
  const [brandingPrefill, setBrandingPrefill] = useState<TournamentBranding | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openingRegId, setOpeningRegId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  const lastRepeatable = tournaments.find((x) => x.status !== "cancelled") ?? null;

  function baseForm(): TournamentForm {
    return {
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
      club_id: clubId,
      draw_method: "rating",
      prizes_description: null,
      match_rules: DEFAULT_MATCH_RULES,
      venue_ids: [],
      third_place_match: false,
      hide_organizer: false,
      regulations_text: null,
      regulations_file_url: null,
    };
  }

  function openNew() {
    setDialogMode("create");
    setPrefill(baseForm());
    setBrandingPrefill(null);
    setDialogOpen(true);
  }

  function openFromTemplate(tpl: TemplateRow) {
    if (!tpl.payload) return;
    setPickerOpen(false);
    setDialogMode("template");
    setPrefill(
      formFromTemplatePayload({
        templateName: tpl.name,
        payload: tpl.payload as TournamentTemplatePayload,
        clubId,
      }),
    );
    setBrandingPrefill(tpl.payload.branding);
    setDialogOpen(true);
  }

  function openRepeatLast() {
    if (!lastRepeatable) return;
    const src = lastRepeatable;
    setDialogMode("duplicate");
    setPrefill({
      name: `${src.name}${t("copy_suffix")}`,
      description: src.description,
      format: src.format,
      discipline: src.discipline,
      surface: src.surface,
      starts_on: new Date().toISOString().slice(0, 10),
      start_time: src.start_time ? src.start_time.slice(0, 5) : null,
      ends_on: null,
      registration_deadline: null,
      max_participants: src.max_participants,
      entry_fee_byn: src.entry_fee_byn,
      privacy: src.privacy,
      application_mode: src.application_mode,
      club_id: clubId,
      draw_method: src.draw_method ?? "rating",
      prizes_description: src.prizes_description,
      match_rules: src.match_rules,
      venue_ids: src.venue_ids,
      third_place_match: src.third_place_match,
      hide_organizer: src.hide_organizer,
      regulations_text: src.regulations_text,
      regulations_file_url: src.regulations_file_url,
    });
    setBrandingPrefill(src.branding);
    setDialogOpen(true);
  }

  function onOpenRegistration(id: string) {
    setError(null);
    setOpeningRegId(id);
    startT(async () => {
      const r = await setTournamentStatus(id, "registration");
      setOpeningRegId(null);
      if (r.ok) router.refresh();
      else setError(localizeActionError(tErrors, r.error));
    });
  }

  const clubTemplates = templates.filter((tpl) => tpl.club_id === clubId);

  return (
    <section className={SECTION}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <Trophy className="h-5 w-5 text-grass-700" />
          {t("title")}
          <HelpPanel
            pageId="club-tournaments"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </h2>
      </div>
      <p className="mb-4 text-xs text-ink-500">{t("subtitle")}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={openNew} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" /> {t("new_tournament")}
        </button>
        <button type="button" onClick={() => setPickerOpen(true)} className={BTN_SECONDARY}>
          <LayoutTemplate className="h-4 w-4" /> {t("from_template")}
        </button>
        <button
          type="button"
          onClick={openRepeatLast}
          disabled={!lastRepeatable}
          title={lastRepeatable ? lastRepeatable.name : undefined}
          className={BTN_SECONDARY}
        >
          <RotateCcw className="h-4 w-4" /> {t("repeat_last")}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </div>
      )}

      {/* ── Pending scores queue ── */}
      {pendingScores.length > 0 && (
        <div className="mb-4 rounded-xl border border-ball-200 bg-ball-50/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-800">
            <ClipboardList className="h-4 w-4 text-ball-700" />
            {t("queue_title", { n: pendingScores.length })}
          </p>
          <ul className="space-y-1.5">
            {pendingScores.map((m) => (
              <li
                key={m.match_id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-xs"
              >
                <span className="font-medium text-ink-900">
                  {m.p1_name ?? "—"} <span className="text-ink-400">vs</span> {m.p2_name ?? "—"}
                </span>
                <span className="flex items-center gap-2 text-ink-600">
                  <span className="truncate">{m.tournament_name}</span>
                  {m.round != null && (
                    <span className="tabular-nums">{t("queue_round", { n: m.round })}</span>
                  )}
                  <Link
                    href={
                      m.tournament_is_mine
                        ? `/${locale}/me/tournaments/organized/${m.tournament_id}`
                        : `/${locale}/tournaments/${m.tournament_id}`
                    }
                    className="inline-flex items-center gap-0.5 font-semibold text-grass-800 hover:underline"
                  >
                    {t("queue_enter_score")} <ArrowRight className="h-3 w-3" />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Tournament list ── */}
      {tournaments.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <button type="button" onClick={openNew} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" /> {t("empty_cta")}
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tournaments.map((tour) => (
            <li
              key={tour.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-ink-100 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  <span className="truncate">{tour.name}</span>
                  <StatusPill status={tour.status} label={statusLabels[tour.status]} />
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-600">
                  <span>{formatLabels[tour.format]}</span>
                  {tour.surface && <span>{surfaceLabels[tour.surface]}</span>}
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {tour.starts_on}
                    {tour.start_time ? ` · ${tour.start_time.slice(0, 5)}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users className="h-3 w-3" />
                    {tour.participants_count}
                    {tour.max_participants != null ? `/${tour.max_participants}` : ""}
                  </span>
                  {!tour.is_mine && tour.organizer_name && (
                    <span>{t("organizer", { name: tour.organizer_name })}</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {tour.pending_applications > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-clay-800">
                    <Inbox className="h-3 w-3" />
                    {t("pending_applications", { n: tour.pending_applications })}
                  </span>
                )}
                {tour.pending_matches > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ball-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ball-800">
                    <ClipboardList className="h-3 w-3" />
                    {t("pending_matches", { n: tour.pending_matches })}
                  </span>
                )}
                {tour.is_mine && tour.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => onOpenRegistration(tour.id)}
                    disabled={pending && openingRegId === tour.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-grass-300 px-2 text-xs font-semibold text-grass-800 transition hover:bg-grass-50 disabled:opacity-50"
                  >
                    {pending && openingRegId === tour.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Megaphone className="h-3 w-3" />
                    )}
                    {t("open_registration")}
                  </button>
                )}
                <Link
                  href={
                    tour.is_mine
                      ? `/${locale}/me/tournaments/organized/${tour.id}`
                      : `/${locale}/tournaments/${tour.id}`
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700"
                >
                  {tour.is_mine ? t("open") : t("open_public")} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TournamentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={null}
        prefill={prefill}
        branding={brandingPrefill}
        mode={dialogMode}
        venueOptions={venueOptions}
        clubOptions={[{ id: clubId, name: clubName }]}
        copy={dialogCopy}
        onSaved={(id) => {
          setDialogOpen(false);
          router.push(`/${locale}/me/tournaments/organized/${id}` as never);
        }}
      />

      <TemplatePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        templates={clubTemplates}
        formatLabels={formatLabels}
        onPick={openFromTemplate}
      />
    </section>
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
