"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import { Loader2, Shuffle, Users, Trophy, AlertTriangle, FlagTriangleRight } from "lucide-react";
import {
  generateGroups,
  generateGroupsManual,
  reassignToGroup,
  closeGroupsAndStartPlayoff,
  type GroupRow,
  type ParticipantRow,
  type MatchRow,
  type GroupStandingsBlock,
} from "../actions";
import { MatchCard, type BracketCopy } from "./bracket-section";
import { PlayerNameLink } from "@/components/domain/player-name-link";
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
  manual_title: string;
  manual_help: string;
  // Template with "{done}" / "{total}" placeholders.
  manual_progress: string;
  manual_confirm: string;
  manual_too_small: string;
  generate: string;
  generating: string;
  regenerate: string;
  regenerate_warning: string;
  regenerate_cancel: string;
  not_enough_players: string;
  empty: string;
  unassigned_title: string;
  unassigned_hint: string;
  assign_placeholder: string;
  too_small_warning: string;
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
  const [pending, startT] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);

  const approvedActive = useMemo(
    () => participants.filter((p) => p.status === "approved" && !p.withdrawn),
    [participants],
  );
  // Approved after the groups were generated → not in any group yet. They must
  // be placeable by hand, otherwise they'd be invisible in this section.
  const unassigned = useMemo(
    () => approvedActive.filter((p) => p.group_id == null),
    [approvedActive],
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
        approved={approvedActive}
        copy={copy}
        pending={pending}
        startT={startT}
        onSaved={() => router.refresh()}
      />
    );
  }

  return (
    <section className="space-y-6">
      {/* Re-generation re-opens the full setup form (count + method) so the
          organizer isn't locked into the original settings. */}
      {showRegenerate && !anyGroupResults && (
        <SetupGroupsCard
          tournamentId={tournamentId}
          approved={approvedActive}
          copy={copy}
          pending={pending}
          startT={startT}
          confirmText={copy.regenerate_warning}
          onCancel={() => setShowRegenerate(false)}
          onSaved={() => {
            setShowRegenerate(false);
            router.refresh();
          }}
        />
      )}

      <div className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
            <p className="mt-0.5 text-xs text-ink-600">{copy.setup_help}</p>
          </div>
          {!anyGroupResults && !showRegenerate && (
            <button
              type="button"
              onClick={() => setShowRegenerate(true)}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
            >
              <Shuffle className="h-3 w-3" />
              {copy.regenerate}
            </button>
          )}
        </div>

        {/* Once a group match has a score, moving players is locked — say so
            instead of silently hiding the controls. */}
        {anyGroupResults && (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            {copy.cannot_move_after_start}
          </p>
        )}

        {unassigned.length > 0 && (
          <div className="mt-4 rounded-lg border border-clay-200 bg-clay-50/40 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-clay-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {copy.unassigned_title.replace("{n}", String(unassigned.length))}
            </p>
            <p className="mt-1 text-[11px] text-ink-600">{copy.unassigned_hint}</p>
            <ul className="mt-2 space-y-1.5">
              {unassigned.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink-800">
                    <PlayerNameLink id={m.player_id} name={m.display_name} fallback={m.player_id} />
                    {m.partner_name ? (
                      <>
                        {" / "}
                        <PlayerNameLink id={m.partner_id} name={m.partner_name} />
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                  {!anyGroupResults ? (
                    <MoveSelector
                      participantId={m.id}
                      currentGroupId={null}
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
          </div>
        )}

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
                  <span
                    className={
                      members.length < 2
                        ? "inline-flex items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold text-clay-800"
                        : "inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold text-grass-800"
                    }
                  >
                    <Users className="h-3 w-3" />
                    {copy.member_count.replace("{n}", String(members.length))}
                  </span>
                </header>

                {members.length < 2 && (
                  <p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-2.5 py-1.5 text-[11px] text-clay-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {copy.too_small_warning}
                  </p>
                )}

                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {copy.roster}
                </p>
                <ul className="mt-1 space-y-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-ink-800">
                        <PlayerNameLink
                          id={m.player_id}
                          name={m.display_name}
                          fallback={m.player_id}
                        />
                        {m.partner_name ? (
                          <>
                            {" / "}
                            <PlayerNameLink id={m.partner_id} name={m.partner_name} />
                          </>
                        ) : (
                          ""
                        )}
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
                                <PlayerNameLink
                                  id={r.player_id}
                                  name={r.display_name}
                                  fallback={r.player_id}
                                />
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
  approved,
  copy,
  pending,
  startT,
  onSaved,
  confirmText,
  onCancel,
}: {
  tournamentId: string;
  approved: ParticipantRow[];
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onSaved: () => void;
  confirmText?: string;
  onCancel?: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const approvedCount = approved.length;
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
          <div className="flex items-end gap-2">
            {/* Manual mode confirms from the roster panel below instead. */}
            {method !== "manual" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirmText && !confirm(confirmText)) return;
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
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[11px] bg-pt-primary px-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                {pending ? copy.generating : copy.generate}
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                disabled={pending}
                onClick={onCancel}
                className="inline-flex h-9 items-center justify-center rounded-[11px] border border-ink-200 px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
              >
                {copy.regenerate_cancel}
              </button>
            )}
          </div>
        </div>
      )}

      {approvedCount >= 4 && method === "manual" && (
        <ManualAssignPanel
          tournamentId={tournamentId}
          approved={approved}
          groupsCount={groupsCount}
          copy={copy}
          pending={pending}
          startT={startT}
          onSaved={onSaved}
          confirmText={confirmText}
        />
      )}
    </section>
  );
}

// 0 → A … 15 → P; the SA caps groups_count at 16 so single letters suffice.
function clientGroupName(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Manual mode: no groups exist yet — the organiser assigns every approved
 * participant (a pair counts as one entry) to a group letter and confirms
 * once. Only then does the server create the groups and schedule matches.
 */
function ManualAssignPanel({
  tournamentId,
  approved,
  groupsCount,
  copy,
  pending,
  startT,
  onSaved,
  confirmText,
}: {
  tournamentId: string;
  approved: ParticipantRow[];
  groupsCount: number;
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onSaved: () => void;
  confirmText?: string;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  // participant_id → 0-based group index; absent key = not assigned yet.
  const [picks, setPicks] = useState<Record<string, number>>({});

  // Shrinking the groups count invalidates picks pointing at removed groups.
  const effective = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of approved) {
      const idx = picks[p.id];
      if (idx !== undefined && idx < groupsCount) out[p.id] = idx;
    }
    return out;
  }, [picks, approved, groupsCount]);

  const assignedCount = Object.keys(effective).length;
  const allAssigned = assignedCount === approved.length;
  const sizeByGroup = useMemo(() => {
    const counts = new Array<number>(groupsCount).fill(0);
    for (const idx of Object.values(effective)) counts[idx] += 1;
    return counts;
  }, [effective, groupsCount]);
  const hasTooSmallGroup = allAssigned && sizeByGroup.some((n) => n < 2);

  return (
    <div className="mt-4 rounded-lg border border-ink-100 bg-grass-50/30 p-4">
      <p className="text-sm font-semibold text-ink-900">{copy.manual_title}</p>
      <p className="mt-1 text-xs text-ink-600">{copy.manual_help}</p>

      <ul className="mt-3 divide-y divide-ink-100">
        {approved.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="truncate text-ink-800">
              <PlayerNameLink id={m.player_id} name={m.display_name} fallback={m.player_id} />
              {m.partner_name ? (
                <>
                  {" / "}
                  <PlayerNameLink id={m.partner_id} name={m.partner_name} />
                </>
              ) : (
                ""
              )}
            </span>
            <select
              value={effective[m.id] ?? ""}
              disabled={pending}
              onChange={(e) => {
                const value = e.target.value;
                setPicks((prev) => {
                  const next = { ...prev };
                  if (value === "") delete next[m.id];
                  else next[m.id] = Number(value);
                  return next;
                });
              }}
              className="h-7 rounded-md border border-ink-200 bg-white px-1 text-[11px] text-ink-700"
              aria-label={copy.assign_placeholder}
            >
              <option value="">{copy.assign_placeholder}</option>
              {Array.from({ length: groupsCount }, (_, i) => (
                <option key={i} value={i}>
                  {copy.group_label.replace("{name}", clientGroupName(i))}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-ink-600">
          {copy.manual_progress
            .replace("{done}", String(assignedCount))
            .replace("{total}", String(approved.length))}
        </span>
        <button
          type="button"
          disabled={pending || !allAssigned || hasTooSmallGroup}
          onClick={() => {
            if (confirmText && !confirm(confirmText)) return;
            startT(async () => {
              const r = await generateGroupsManual({
                tournament_id: tournamentId,
                groups_count: groupsCount,
                assignments: Object.entries(effective).map(([participant_id, group_index]) => ({
                  participant_id,
                  group_index,
                })),
              });
              if (r.ok) onSaved();
              else alert(localizeActionError(tErrors, r.error));
            });
          }}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[11px] bg-pt-primary px-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {pending ? copy.generating : copy.manual_confirm}
        </button>
      </div>

      {hasTooSmallGroup && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-2.5 py-1.5 text-[11px] text-clay-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {copy.manual_too_small}
        </p>
      )}
    </div>
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
  currentGroupId: string | null;
  groups: GroupRow[];
  copy: GroupsCopy;
  pending: boolean;
  startT: (cb: () => void) => void;
  onMoved: () => void;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  return (
    <select
      value={currentGroupId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const newId = e.target.value;
        if (!newId || newId === currentGroupId) return;
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
      aria-label={copy.move_to}
    >
      {currentGroupId == null && (
        <option value="" disabled>
          {copy.assign_placeholder}
        </option>
      )}
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {copy.group_label.replace("{name}", g.name)}
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
