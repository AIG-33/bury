"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Trophy,
  CalendarDays,
  Loader2,
  CheckCircle2,
  LogOut,
  UserPlus,
  Swords,
  Plus,
  Inbox,
  Clock,
  Ban,
  ArrowRight,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import {
  applyToTournament,
  withdrawFromTournament,
  type ApplicationStatus,
  type OpenTournamentRow,
  type MyTournamentRow,
} from "./actions";
import type { TournamentRow as OrganizedTournamentRow } from "./organized/actions";
import type { TournamentFormat, TournamentStatus, Surface } from "@/lib/tournaments/schema";

export type PlayerTournamentsCopy = {
  tab_open: string;
  tab_mine: string;
  tab_organized: string;
  create_cta: string;
  open_empty_title: string;
  open_empty_description: string;
  mine_empty_title: string;
  mine_empty_description: string;
  organized_empty_title: string;
  organized_empty_description: string;
  apply: string;
  applying: string;
  application_pending: string;
  application_approved: string;
  application_rejected: string;
  cancel_application: string;
  withdraw: string;
  withdrawing: string;
  withdraw_confirm: string;
  cancel_application_confirm: string;
  next_match: string;
  no_next_match: string;
  vs: string;
  by_organizer: string;
  pending_badge: string;
  open_organizer: string;
  format_labels: Record<TournamentFormat, string>;
  status_labels: Record<TournamentStatus, string>;
  surface_labels: Record<Surface, string>;
  error: string;
};

type Tab = "open" | "mine" | "organized";

export function PlayerTournamentsClient({
  locale,
  open,
  mine,
  organized,
  copy,
}: {
  locale: string;
  open: OpenTournamentRow[];
  mine: MyTournamentRow[];
  organized: OrganizedTournamentRow[];
  copy: PlayerTournamentsCopy;
}) {
  const initialTab: Tab =
    organized.length > 0 ? "organized" : mine.length > 0 ? "mine" : "open";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-ink-200 bg-white p-1 shadow-card">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
            {copy.tab_mine}{" "}
            {mine.length > 0 && (
              <span className="ml-1 rounded-full bg-grass-100 px-1.5 text-[10px] text-grass-800">
                {mine.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "open"} onClick={() => setTab("open")}>
            {copy.tab_open}{" "}
            {open.length > 0 && (
              <span className="ml-1 rounded-full bg-ball-100 px-1.5 text-[10px] text-ball-800">
                {open.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "organized"} onClick={() => setTab("organized")}>
            {copy.tab_organized}{" "}
            {organized.length > 0 && (
              <span className="ml-1 rounded-full bg-clay-100 px-1.5 text-[10px] text-clay-800">
                {organized.length}
              </span>
            )}
          </TabButton>
        </div>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/me/tournaments/organized` as any}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-700 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-grass-800"
        >
          <Plus className="h-4 w-4" /> {copy.create_cta}
        </Link>
      </div>

      {tab === "mine" ? (
        mine.length === 0 ? (
          <EmptyState
            title={copy.mine_empty_title}
            description={copy.mine_empty_description}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mine.map((t) => (
              <MyTournamentCard key={t.id} tournament={t} copy={copy} />
            ))}
          </ul>
        )
      ) : tab === "open" ? (
        open.length === 0 ? (
          <EmptyState
            title={copy.open_empty_title}
            description={copy.open_empty_description}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.map((t) => (
              <OpenTournamentCard key={t.id} tournament={t} copy={copy} />
            ))}
          </ul>
        )
      ) : organized.length === 0 ? (
        <EmptyState
          title={copy.organized_empty_title}
          description={copy.organized_empty_description}
          ctaLabel={copy.create_cta}
          ctaHref={`/${locale}/me/tournaments/organized`}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {organized.map((t) => (
            <OrganizedTournamentCard key={t.id} tournament={t} copy={copy} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm font-medium transition " +
        (active ? "bg-grass-500 text-white shadow-card" : "text-ink-600 hover:bg-ink-50")
      }
    >
      {children}
    </button>
  );
}

function ApplicationBadge({
  status,
  copy,
}: {
  status: ApplicationStatus;
  copy: PlayerTournamentsCopy;
}) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-clay-800">
        <Clock className="h-3 w-3" />
        {copy.application_pending}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-grass-800">
        <CheckCircle2 className="h-3 w-3" />
        {copy.application_approved}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700">
        <Ban className="h-3 w-3" />
        {copy.application_rejected}
      </span>
    );
  }
  return null;
}

function OpenTournamentCard({
  tournament,
  copy,
}: {
  tournament: OpenTournamentRow;
  copy: PlayerTournamentsCopy;
}) {
  const t = useTranslations("tournamentsPlayer");
  const router = useRouter();
  const [pending, startT] = useTransition();

  function onApply() {
    startT(async () => {
      const r = await applyToTournament(tournament.id);
      if (r.ok) router.refresh();
      else alert(`${copy.error}: ${r.error}`);
    });
  }

  function onCancel() {
    if (!confirm(copy.cancel_application_confirm)) return;
    startT(async () => {
      const r = await withdrawFromTournament(tournament.id);
      if (r.ok) router.refresh();
      else alert(`${copy.error}: ${r.error}`);
    });
  }

  return (
    <li className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink-900">{tournament.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
            <Trophy className="h-3 w-3" /> {copy.format_labels[tournament.format]}
          </p>
        </div>
        {tournament.application_status !== "none" && (
          <ApplicationBadge status={tournament.application_status} copy={copy} />
        )}
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-600">
        <CalendarDays className="h-3 w-3" />
        {tournament.starts_on}
        {tournament.ends_on && tournament.ends_on !== tournament.starts_on
          ? ` → ${tournament.ends_on}`
          : ""}
      </p>

      {tournament.organizer_name && (
        <p className="mt-1 text-xs text-ink-500">
          {copy.by_organizer} {tournament.organizer_name}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1 rounded-md bg-ball-50 px-2 py-1 text-ball-800">
          {t("seats", {
            n: tournament.participants_count,
            max: tournament.max_participants ?? 0,
          })}
        </span>
        {tournament.surface && (
          <span className="rounded-md bg-grass-50 px-2 py-1 text-grass-800">
            {copy.surface_labels[tournament.surface]}
          </span>
        )}
      </div>

      {tournament.description && (
        <p className="mt-2 line-clamp-2 text-xs text-ink-600">{tournament.description}</p>
      )}

      <div className="mt-4 flex justify-end">
        {tournament.application_status === "approved" ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-3 text-xs font-semibold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            {pending ? copy.withdrawing : copy.withdraw}
          </button>
        ) : tournament.application_status === "pending" ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-3 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            {pending ? copy.withdrawing : copy.cancel_application}
          </button>
        ) : tournament.application_status === "rejected" ? null : (
          <button
            type="button"
            onClick={onApply}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-500 px-3 text-xs font-semibold text-white hover:bg-grass-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <UserPlus className="h-3 w-3" />
            )}
            {pending ? copy.applying : copy.apply}
          </button>
        )}
      </div>
    </li>
  );
}

function MyTournamentCard({
  tournament,
  copy,
}: {
  tournament: MyTournamentRow;
  copy: PlayerTournamentsCopy;
}) {
  const router = useRouter();
  const [pending, startT] = useTransition();

  function onWithdraw() {
    if (!confirm(copy.withdraw_confirm)) return;
    startT(async () => {
      const r = await withdrawFromTournament(tournament.id);
      if (r.ok) router.refresh();
      else alert(`${copy.error}: ${r.error}`);
    });
  }

  return (
    <li className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink-900">{tournament.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
            <Trophy className="h-3 w-3" /> {copy.format_labels[tournament.format]}
          </p>
        </div>
        <span
          className={
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
            (tournament.status === "in_progress"
              ? "bg-grass-100 text-grass-800"
              : tournament.status === "finished"
                ? "bg-grass-200 text-grass-900"
                : "bg-ball-100 text-ball-800")
          }
        >
          {copy.status_labels[tournament.status]}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ApplicationBadge status={tournament.application_status} copy={copy} />
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-600">
        <CalendarDays className="h-3 w-3" />
        {tournament.starts_on}
        {tournament.ends_on && tournament.ends_on !== tournament.starts_on
          ? ` → ${tournament.ends_on}`
          : ""}
      </p>

      {tournament.application_status === "approved" && (
        <div className="mt-3 rounded-lg bg-grass-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-grass-700">
            {copy.next_match}
          </p>
          {tournament.next_match ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-900">
              <Swords className="h-3.5 w-3.5 text-grass-700" />
              <span className="font-medium">
                {copy.vs} {tournament.next_match.opponent_name ?? "—"}
              </span>
              {tournament.next_match.scheduled_at && (
                <span className="text-xs text-ink-500">
                  · {new Date(tournament.next_match.scheduled_at).toLocaleString()}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">{copy.no_next_match}</p>
          )}
        </div>
      )}

      {tournament.application_status !== "rejected" && tournament.status !== "finished" && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onWithdraw}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-clay-200 px-3 text-xs font-semibold text-clay-700 hover:bg-clay-50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            {pending
              ? copy.withdrawing
              : tournament.application_status === "pending"
                ? copy.cancel_application
                : copy.withdraw}
          </button>
        </div>
      )}
    </li>
  );
}

function OrganizedTournamentCard({
  tournament,
  copy,
  locale,
}: {
  tournament: OrganizedTournamentRow;
  copy: PlayerTournamentsCopy;
  locale: string;
}) {
  return (
    <li className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-5 shadow-card transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink-900">{tournament.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-600">
            <Trophy className="h-3 w-3" /> {copy.format_labels[tournament.format]}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
              (tournament.status === "in_progress"
                ? "bg-grass-100 text-grass-800"
                : tournament.status === "finished"
                  ? "bg-grass-200 text-grass-900"
                  : tournament.status === "draft"
                    ? "bg-ink-100 text-ink-700"
                    : "bg-ball-100 text-ball-800")
            }
          >
            {copy.status_labels[tournament.status]}
          </span>
          {tournament.pending_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-clay-800">
              <Inbox className="h-3 w-3" />
              {copy.pending_badge.replace("{n}", String(tournament.pending_count))}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-600">
        <CalendarDays className="h-3 w-3" />
        {tournament.starts_on}
        {tournament.ends_on && tournament.ends_on !== tournament.starts_on
          ? ` → ${tournament.ends_on}`
          : ""}
      </p>

      <div className="mt-4 flex justify-end">
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/me/tournaments/organized/${tournament.id}` as any}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700"
        >
          {copy.open_organizer} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}
