"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import { Loader2, Shuffle, Users, Trophy, ArrowRightLeft, FlagTriangleRight } from "lucide-react";
import {
  generateGroups,
  reassignToGroup,
  closeGroupsAndStartPlayoff,
  type GroupRow,
  type ParticipantRow,
  type MatchRow,
  type GroupStandingsBlock,
} from "../actions";
import { MatchCard, type BracketCopy } from "./bracket-section";
import {
  SEEDING_METHODS,
  PLAYOFF_SIZES,
  type SeedingMethod,
  type MatchRules,
  type PlayoffSize,
} from "@/lib/tournaments/schema";

export type GroupsCopy = {
  title: string;
  setup_help: string;
  groups_count_label: string;
  method_label: string;
  method_labels: Record<SeedingMethod, string>;
  generate: string;
  generating: string;
  regenerate_warning: string;
  not_enough_players: string;
  empty: string;
  // Template string with the literal "{name}" placeholder. Functions
  // can't cross the server→client component boundary in Next.js 15.
  group_label: string;
  move_to: string;
  cannot_move_after_start: string;
  member_count: string;
  roster: string;
  matches: string;
  no_matches: string;
  standings: string;
  col_pos: string;
  col_player: string;
  col_played: string;
  col_wins: string;
  col_losses: string;
  col_sets: string;
  col_games: string;
  close_groups_title: string;
  close_groups_help: string;
  advance_per_group_label: string;
  playoff_size_label: string;
  close_groups_cta: string;
  closing: string;
  qualifiers_summary: string;
  playoff_too_small: string;
  groups_pending: string;
  error: string;
};

export function GroupsSection({
  tournamentId,
  format,
  groupsCount,
  advancePerGroup,
  playoffSize,
  thirdPlaceMatch,
  participants,
  groups,
  matches,
  standings,
  copy,
  bracketCopy,
  matchRules,
}: {
  tournamentId: string;
  format: string;
  groupsCount: number | null;
  advancePerGroup: number | null;
  playoffSize: number | null;
  thirdPlaceMatch: boolean;
  participants: ParticipantRow[];
  groups: GroupRow[];
  matches: MatchRow[];
  standings: GroupStandingsBlock[];
  copy: GroupsCopy;
  bracketCopy: BracketCopy;
  matchRules: MatchRules;
}) {
  const router = useRouter();
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [pending, startT] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const approvedActive = useMemo(
    () => participants.filter((p) => p.status === "approved" && !p.withdrawn),
    [participants],
  );

  const groupMatches = useMemo(() => matches.filter((m) => m.stage === "group"), [matches]);
  const allGroupMatchesDone = useMemo(
    () => groupMatches.length > 0 && groupMatches.every((m) => m.outcome !== "pending"),
    [groupMatches],
  );
  const anyGroupResults = useMemo(
    () => groupMatches.some((m) => m.outcome !== "pending"),
    [groupMatches],
  );

  if (format !== "group_playoff") return null;

  // ── Setup state: no groups yet ────────────────────────────────────────────
  if (groups.length === 0) {
    return (
      <SetupGroupsCard
        tournamentId={tournamentId}
        approvedCount={approvedActive.length}
        copy={copy}
        pending={pending}
        startT={startT}
        onSaved={() => router.refresh()}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
            <p className="mt-0.5 text-xs text-ink-600">{copy.setup_help}</p>
          </div>
          {!anyGroupResults && (
            <button
              type="button"
              onClick={() => {
                if (!confirm(copy.regenerate_warning)) return;
                // The simplest path to re-generate: open the setup card by
                // sending the user back through the same flow. We just reset
                // groups by calling generateGroups again with the saved count.
                if (!groupsCount) return;
                startT(async () => {
                  const r = await generateGroups({
                    tournament_id: tournamentId,
                    groups_count: groupsCount,
                    method: "rating",
                  });
                  if (r.ok) router.refresh();
                  else alert(localizeActionError(tErrors, r.error));
                });
              }}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
              {copy.generate}
            </button>
          )}
        </div>

        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const members = approvedActive.filter((p) => p.group_id === g.id);
            const gMatches = groupMatches.filter((m) => m.group_id === g.id);
            const block = standings.find((s) => s.group.id === g.id);
            return (
              <li key={g.id} className="rounded-lg border border-ink-100 bg-grass-50/30 p-4">
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ink-900">
                    {copy.group_label.replace("{name}", g.name)}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold text-grass-800">
                    <Users className="h-3 w-3" />
                    {copy.member_count.replace("{n}", String(members.length))}
                  </span>
                </header>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {copy.roster}
                </p>
                <ul className="mt-1 space-y-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-ink-800">
                        {m.display_name ?? m.player_id}
                        {m.partner_name ? ` / ${m.partner_name}` : ""}
                      </span>
                      {!anyGroupResults && groups.length > 1 ? (
                        <MoveSelector
                          participantId={m.id}
                          currentGroupId={g.id}
                          groups={groups}
                          copy={copy}
                          pending={pending}
                          startT={startT}
                          onMoved={() => router.refresh()}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>

                {block && block.rows.length > 0 && (
                  <>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      {copy.standings}
                    </p>
                    <div className="mt-1 overflow-x-auto">
                      <table className="w-full text-xs tabular-nums">
                        <thead className="text-ink-500">
                          <tr>
                            <th className="text-left">{copy.col_pos}</th>
                            <th className="text-left">{copy.col_player}</th>
                            <th>{copy.col_played}</th>
                            <th>{copy.col_wins}</th>
                            <th>{copy.col_losses}</th>
                            <th>{copy.col_sets}</th>
                            <th>{copy.col_games}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((r) => (
                            <tr key={r.player_id} className="border-t border-ink-100">
                              <td className="py-1 text-ink-600">{r.position}</td>
                              <td className="truncate py-1 text-ink-800">
                                {r.display_name ?? r.player_id}
                              </td>
                              <td className="py-1 text-center text-ink-700">{r.matches_played}</td>
                              <td className="py-1 text-center font-semibold text-grass-700">
                                {r.wins}
                              </td>
                              <td className="py-1 text-center text-ink-700">{r.losses}</td>
                              <td className="py-1 text-center text-ink-700">
                                {r.sets_won}-{r.sets_lost}
                              </td>
                              <td className="py-1 text-center text-ink-700">
                                {r.games_won}-{r.games_lost}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {copy.matches}
                </p>
                {gMatches.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-500">{copy.no_matches}</p>
                ) : (
                  <div className="mt-1 space-y-1.5">
                    {gMatches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        copy={bracketCopy}
                        matchRules={matchRules}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        onSaved={() => router.refresh()}
                        pending={pending}
                        startT={startT}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* "Close groups → start playoff" — only when groups are done and the
          playoff bracket hasn't been seeded yet. */}
      {playoffSize == null && (
        <CloseGroupsCard
          tournamentId={tournamentId}
          groupsCount={groups.length}
          allDone={allGroupMatchesDone}
          thirdPlaceMatch={thirdPlaceMatch}
          copy={copy}
          pending={pending}
          startT={startT}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Already closed: simple summary line. */}
      {playoffSize != null && (
        <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">
          {copy.qualifiers_summary
            .replace("{groups}", String(groups.length))
            .replace("{n}", String(advancePerGroup ?? 0))
            .replace("{size}", String(playoffSize))}
        </p>
      )}
    </section>
  );
}

function SetupGroupsCard({
  tournamentId,
  approvedCount,
  copy,
  pending,
  startT,
  onSaved,
}: {
  tournamentId: string;
  approvedCount: number;
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onSaved: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const maxGroups = Math.max(2, Math.floor(approvedCount / 2));
  const defaultCount = approvedCount >= 8 ? 4 : approvedCount >= 6 ? 3 : 2;
  const [groupsCount, setGroupsCount] = useState<number>(Math.min(defaultCount, maxGroups));
  const [method, setMethod] = useState<SeedingMethod>("rating");

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
      <p className="mt-1 text-xs text-ink-600">{copy.setup_help}</p>

      {approvedCount < 4 ? (
        <p className="mt-3 rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-800">
          {copy.not_enough_players}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600">
              {copy.groups_count_label}
            </span>
            <input
              type="number"
              min={2}
              max={maxGroups}
              value={groupsCount}
              onChange={(e) =>
                setGroupsCount(Math.max(2, Math.min(maxGroups, Number(e.target.value) || 2)))
              }
              className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600">
              {copy.method_label}
            </span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as SeedingMethod)}
              className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm"
            >
              {SEEDING_METHODS.map((m) => (
                <option key={m} value={m}>
                  {copy.method_labels[m]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startT(async () => {
                const r = await generateGroups({
                  tournament_id: tournamentId,
                  groups_count: groupsCount,
                  method,
                });
                if (r.ok) onSaved();
                else alert(localizeActionError(tErrors, r.error));
              });
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-grass-500 px-3 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
            {pending ? copy.generating : copy.generate}
          </button>
        </div>
      )}
    </section>
  );
}

function MoveSelector({
  participantId,
  currentGroupId,
  groups,
  copy,
  pending,
  startT,
  onMoved,
}: {
  participantId: string;
  currentGroupId: string;
  groups: GroupRow[];
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onMoved: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  return (
    <select
      value={currentGroupId}
      disabled={pending}
      onChange={(e) => {
        const newId = e.target.value;
        if (newId === currentGroupId) return;
        startT(async () => {
          const r = await reassignToGroup({
            participant_id: participantId,
            group_id: newId,
          });
          if (r.ok) onMoved();
          else alert(localizeActionError(tErrors, r.error));
        });
      }}
      className="h-7 rounded-md border border-ink-200 bg-white px-1 text-[11px] text-ink-700"
      title={copy.move_to}
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          <ArrowRightLeft className="h-2 w-2" /> {g.name}
        </option>
      ))}
    </select>
  );
}

function CloseGroupsCard({
  tournamentId,
  groupsCount,
  allDone,
  thirdPlaceMatch,
  copy,
  pending,
  startT,
  onSaved,
}: {
  tournamentId: string;
  groupsCount: number;
  allDone: boolean;
  thirdPlaceMatch: boolean;
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onSaved: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [advanceN, setAdvanceN] = useState<number>(2);
  const qualifiers = groupsCount * advanceN;
  const suggested = PLAYOFF_SIZES.find((s) => s >= qualifiers) ?? 32;
  const [playoffSize, setPlayoffSize] = useState<PlayoffSize>(suggested as PlayoffSize);

  // Keep size auto-bumped when N changes.
  if (playoffSize < qualifiers) {
    const next = PLAYOFF_SIZES.find((s) => s >= qualifiers);
    if (next && next !== playoffSize) setPlayoffSize(next as PlayoffSize);
  }

  return (
    <section className="rounded-xl2 border border-clay-200 bg-clay-50/40 p-5 shadow-card">
      <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
        <FlagTriangleRight className="h-4 w-4 text-clay-700" />
        {copy.close_groups_title}
      </h2>
      <p className="mt-1 text-xs text-ink-700">{copy.close_groups_help}</p>

      {!allDone ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-ink-700">{copy.groups_pending}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                {copy.advance_per_group_label}
              </span>
              <select
                value={advanceN}
                onChange={(e) => setAdvanceN(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm tabular-nums"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    top-{n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                {copy.playoff_size_label}
              </span>
              <select
                value={playoffSize}
                onChange={(e) => setPlayoffSize(Number(e.target.value) as PlayoffSize)}
                className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm tabular-nums"
              >
                {PLAYOFF_SIZES.filter((s) => s >= qualifiers).map((s) => (
                  <option key={s} value={s}>
                    {labelForPlayoffSize(s)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || playoffSize < qualifiers}
              onClick={() => {
                startT(async () => {
                  const r = await closeGroupsAndStartPlayoff({
                    tournament_id: tournamentId,
                    advance_per_group: advanceN,
                    playoff_size: playoffSize,
                  });
                  if (r.ok) onSaved();
                  else alert(localizeActionError(tErrors, r.error));
                });
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-clay-600 px-3 text-sm font-semibold text-white transition hover:bg-clay-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              {pending ? copy.closing : copy.close_groups_cta}
            </button>
          </div>

          {playoffSize < qualifiers && (
            <p className="mt-2 text-[11px] text-clay-700">{copy.playoff_too_small}</p>
          )}

          <p className="mt-3 text-[11px] text-ink-600">
            {copy.qualifiers_summary
              .replace("{groups}", String(groupsCount))
              .replace("{n}", String(advanceN))
              .replace("{size}", String(playoffSize))}
            {thirdPlaceMatch ? " · 3rd-place match: on" : ""}
          </p>
        </>
      )}
    </section>
  );
}

function labelForPlayoffSize(size: number): string {
  switch (size) {
    case 2:
      return "Final";
    case 4:
      return "1/2 (semis)";
    case 8:
      return "1/4";
    case 16:
      return "1/8";
    case 32:
      return "1/16";
    default:
      return String(size);
  }
}
