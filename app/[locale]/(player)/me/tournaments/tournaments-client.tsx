"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import {
  registerForTournament,
  withdrawFromTournament,
  type OpenTournamentRow,
  type MyTournamentRow,
} from "./actions";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
} from "@/lib/tournaments/schema";

export type PlayerTournamentsCopy = {
  tab_open: string;
  tab_mine: string;
  open_empty_title: string;
  open_empty_description: string;
  mine_empty_title: string;
  mine_empty_description: string;
  register: string;
  registering: string;
  registered: string;
  withdraw: string;
  withdrawing: string;
  withdraw_confirm: string;
  next_match: string;
  no_next_match: string;
  vs: string;
  by_coach: string;
  format_labels: Record<TournamentFormat, string>;
  status_labels: Record<TournamentStatus, string>;
  surface_labels: Record<Surface, string>;
  error: string;
};

type Tab = "open" | "mine";

export function PlayerTournamentsClient({
  open,
  mine,
  copy,
}: {
  open: OpenTournamentRow[];
  mine: MyTournamentRow[];
  copy: PlayerTournamentsCopy;
}) {
  const [tab, setTab] = useState<Tab>(mine.length > 0 ? "mine" : "open");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-ink-200 bg-white p-1 shadow-card">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          {copy.tab_mine} {mine.length > 0 && (
            <span className="ml-1 rounded-full bg-grass-100 px-1.5 text-[10px] text-grass-800">
              {mine.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          {copy.tab_open} {open.length > 0 && (
            <span className="ml-1 rounded-full bg-ball-100 px-1.5 text-[10px] text-ball-800">
              {open.length}
            </span>
          )}
        </TabButton>
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
      ) : open.length === 0 ? (
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
        (active
          ? "bg-grass-500 text-white shadow-card"
          : "text-ink-600 hover:bg-ink-50")
      }
    >
      {children}
    </button>
  );
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

  function onRegister() {
    startT(async () => {
      const r = await registerForTournament(tournament.id);
      if (r.ok) router.refresh();
      else alert(`${copy.error}: ${r.error}`);
    });
  }

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
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-600">
        <CalendarDays className="h-3 w-3" />
        {tournament.starts_on}
        {tournament.ends_on && tournament.ends_on !== tournament.starts_on
          ? ` → ${tournament.ends_on}`
          : ""}
      </p>

      {tournament.coach_name && (
        <p className="mt-1 text-xs text-ink-500">
          {copy.by_coach} {tournament.coach_name}
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
        {tournament.is_registered ? (
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
            {pending ? copy.withdrawing : copy.withdraw}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-grass-500 px-3 text-xs font-semibold text-white hover:bg-grass-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <UserPlus className="h-3 w-3" />
            )}
            {pending ? copy.registering : copy.register}
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

      <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-600">
        <CalendarDays className="h-3 w-3" />
        {tournament.starts_on}
        {tournament.ends_on && tournament.ends_on !== tournament.starts_on
          ? ` → ${tournament.ends_on}`
          : ""}
      </p>

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

      {tournament.is_registered && tournament.status !== "finished" && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {tournament.status === "in_progress" ? null : (
            <span className="inline-flex items-center gap-1 text-xs text-grass-700">
              <CheckCircle2 className="h-3 w-3" /> {copy.registered}
            </span>
          )}
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
            {pending ? copy.withdrawing : copy.withdraw}
          </button>
        </div>
      )}
    </li>
  );
}
