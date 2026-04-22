"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Trophy,
} from "lucide-react";
import { whatsappLink } from "@/lib/contact/whatsapp";
import {
  cancelScheduledMatch,
  confirmFriendlyResult,
  disputeFriendlyResult,
  reportFriendlyResult,
  type MatchListItem,
} from "./actions";

type Variant =
  | "awaiting_my_confirmation"
  | "awaiting_their_confirmation"
  | "scheduled"
  | "recent";

type SetRow = NonNullable<MatchListItem["sets"]>[number];

export function MatchCard({
  m,
  variant,
  locale,
  whatsappPrefill,
}: {
  m: MatchListItem;
  variant: Variant;
  locale: string;
  whatsappPrefill: string;
}) {
  const t = useTranslations("myMatches.card");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportSets, setReportSets] = useState<SetRow[]>([
    { p1_games: 0, p2_games: 0 },
    { p1_games: 0, p2_games: 0 },
  ]);

  const opponentName = m.opponent.display_name ?? "—";
  const dateTime = new Date(m.played_at ?? m.created_at).toLocaleString(locale);
  const waMessage = whatsappPrefill.replace("{name}", opponentName);
  const waLink = whatsappLink(m.opponent.whatsapp, waMessage);

  function handleConfirm() {
    setError(null);
    start(async () => {
      const res = await confirmFriendlyResult(m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  function handleDispute() {
    if (!confirm(t("confirm_dispute"))) return;
    setError(null);
    start(async () => {
      const res = await disputeFriendlyResult(m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  function handleCancel() {
    if (!confirm(t("confirm_cancel"))) return;
    setError(null);
    start(async () => {
      const res = await cancelScheduledMatch(m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  function handleReport() {
    setError(null);
    start(async () => {
      const cleanSets = reportSets
        .filter((s) => s.p1_games + s.p2_games > 0)
        .map((s) => ({
          p1_games: s.p1_games,
          p2_games: s.p2_games,
          tiebreak_p1: s.tiebreak_p1 ?? null,
          tiebreak_p2: s.tiebreak_p2 ?? null,
        }));
      if (cleanSets.length === 0) {
        setError(t("error_empty_sets"));
        return;
      }
      const res = await reportFriendlyResult({ match_id: m.id, sets: cleanSets });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setShowReport(false);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-base font-semibold text-ink-900">
              {opponentName}
            </p>
            <span className="font-mono text-xs text-ink-500">
              {m.opponent.current_elo}
            </span>
            {variant === "recent" && m.outcome === "completed" && (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
                  (m.i_am_winner
                    ? "bg-grass-100 text-grass-800"
                    : "bg-clay-50 text-clay-700")
                }
              >
                <Trophy className="h-3 w-3" />
                {m.i_am_winner ? t("won") : t("lost")}
              </span>
            )}
            {variant === "recent" && m.outcome === "cancelled" && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
                {t("cancelled")}
              </span>
            )}
            {m.tournament_id && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ball-50 px-2 py-0.5 text-[11px] font-medium text-ball-800 ring-1 ring-ball-200">
                <Trophy className="h-3 w-3" />
                {m.tournament_name ?? t("tournament_generic")}
              </span>
            )}
          </div>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
            <Clock className="h-3 w-3" />
            {dateTime}
          </p>

          {m.sets && (
            <ScoreLine sets={m.sets} isP1={m.is_p1} winner={m.i_am_winner} />
          )}

          {variant === "awaiting_my_confirmation" && (
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-ball-50 px-2 py-1 text-xs text-ink-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ball-700" />
              {t("awaiting_my_confirmation_hint")}
            </p>
          )}
          {variant === "awaiting_their_confirmation" && (
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-xs text-ink-700">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("awaiting_their_confirmation_hint")}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-grass-200 bg-grass-50 px-2 text-xs font-medium text-grass-800 hover:bg-grass-100"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {t("whatsapp")}
            </a>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-clay-200 bg-clay-50 px-2 py-1 text-xs text-clay-800">
          {error}
        </p>
      )}

      {variant === "awaiting_my_confirmation" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white hover:bg-grass-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("confirm_and_apply")}
          </button>
          <button
            onClick={handleDispute}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-clay-300 bg-white px-3 text-sm font-medium text-clay-800 hover:bg-clay-50 disabled:opacity-50"
          >
            {t("dispute")}
          </button>
        </div>
      )}

      {variant === "awaiting_their_confirmation" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleDispute}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
          >
            {t("rewrite_result")}
          </button>
        </div>
      )}

      {variant === "scheduled" && !showReport && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowReport(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white hover:bg-grass-600"
          >
            <Trophy className="h-3.5 w-3.5" />
            {t("report_result")}
          </button>
          <button
            onClick={handleCancel}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-clay-200 bg-white px-3 text-sm font-medium text-clay-700 hover:bg-clay-50 disabled:opacity-50"
          >
            {t("cancel_match")}
          </button>
        </div>
      )}

      {variant === "scheduled" && showReport && (
        <ReportInline
          sets={reportSets}
          setSets={setReportSets}
          pending={pending}
          onCancel={() => setShowReport(false)}
          onSubmit={handleReport}
        />
      )}
    </li>
  );
}

function ScoreLine({
  sets,
  isP1,
  winner,
}: {
  sets: NonNullable<MatchListItem["sets"]>;
  isP1: boolean;
  winner: boolean | null;
}) {
  return (
    <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 font-mono text-sm text-ink-800">
      {sets.map((s, i) => {
        const my = isP1 ? s.p1_games : s.p2_games;
        const their = isP1 ? s.p2_games : s.p1_games;
        const myTb = isP1 ? s.tiebreak_p1 : s.tiebreak_p2;
        const theirTb = isP1 ? s.tiebreak_p2 : s.tiebreak_p1;
        const wonSet = my > their;
        const cls = wonSet
          ? winner === false
            ? "text-ink-800"
            : "text-grass-700 font-semibold"
          : "text-ink-500";
        return (
          <span key={i} className={cls}>
            {my}–{their}
            {myTb != null && theirTb != null ? `(${myTb}–${theirTb})` : ""}
          </span>
        );
      })}
    </p>
  );
}

function ReportInline({
  sets,
  setSets,
  pending,
  onCancel,
  onSubmit,
}: {
  sets: SetRow[];
  setSets: (s: SetRow[]) => void;
  pending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("myMatches.card");

  function setSet(i: number, patch: Partial<SetRow>) {
    setSets(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="mt-3 rounded-lg border border-grass-200 bg-grass-50/50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-grass-800">
        {t("report_result")}
      </p>
      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
          >
            <input
              type="number"
              min={0}
              max={20}
              value={s.p1_games}
              onChange={(e) =>
                setSet(i, { p1_games: Number(e.target.value) || 0 })
              }
              className="h-9 rounded-md border border-ink-200 px-2 text-center font-mono text-sm"
            />
            <span className="text-ink-400">:</span>
            <input
              type="number"
              min={0}
              max={20}
              value={s.p2_games}
              onChange={(e) =>
                setSet(i, { p2_games: Number(e.target.value) || 0 })
              }
              className="h-9 rounded-md border border-ink-200 px-2 text-center font-mono text-sm"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600">{t("two_party_warning_inline")}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={pending}
          className="h-9 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {t("cancel_inline")}
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white hover:bg-grass-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("submit_report")}
        </button>
      </div>
    </div>
  );
}
