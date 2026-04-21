"use client";

import { useState, useTransition } from "react";
import {
  Check,
  X,
  MessageCircle,
  Loader2,
  Calendar,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { respondToProposal, type ProposalRow } from "../actions";
import { whatsappLink } from "@/lib/contact/whatsapp";

export type ProposalCardCopy = {
  accept: string;
  decline: string;
  cancel: string;
  sending: string;
  accepted: string;
  declined: string;
  cancelled: string;
  scheduled: string;
  proposed_by_you: string;
  proposed_by_them: string;
  written: string;
  response: string;
  whatsapp: string;
  optional_note: string;
  confirm: string;
  locale: string;
  /** Template with `{name}` placeholder; replaced on the client. */
  whatsapp_prefill: string;
};

export function ProposalCard({
  row,
  kind,
  copy,
}: {
  row: ProposalRow;
  kind: "incoming" | "sent" | "history";
  copy: ProposalCardCopy;
}) {
  const [open, setOpen] = useState<"accept" | "decline" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startT] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const wa = whatsappLink(
    row.other.whatsapp,
    copy.whatsapp_prefill.replace("{name}", row.other.display_name ?? ""),
  );

  const initials = (row.other.display_name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function respond(decision: "accept" | "decline" | "cancel") {
    setErrMsg(null);
    startT(async () => {
      const r = await respondToProposal({ match_id: row.id, decision, note: note || null });
      if (!r.ok) setErrMsg(r.error);
      else {
        setOpen(null);
        setNote("");
      }
    });
  }

  const dateLabel = new Date(row.created_at).toLocaleString(copy.locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        {/* Avatar */}
        {row.other.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.other.avatar_url}
            alt={row.other.display_name ?? ""}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-grass-100"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-grass-100 font-display text-sm font-semibold text-grass-800 ring-2 ring-grass-200">
            {initials}
          </div>
        )}

        {/* Header */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="truncate font-display text-base font-semibold text-ink-900">
              {row.other.display_name ?? "—"}
            </p>
            <span className="font-mono text-xs text-grass-700">Elo {row.other.current_elo}</span>
            {row.other.city && <span className="text-xs text-ink-500">· {row.other.city}</span>}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {row.is_initiator ? copy.proposed_by_you : copy.proposed_by_them} · {dateLabel}
          </p>
        </div>

        {/* Status pill */}
        <StatusPill outcome={row.outcome} copy={copy} />
      </div>

      {/* Initiator note */}
      {row.proposal_message && (
        <div className="mt-3 rounded-lg bg-grass-50 px-3 py-2 text-sm text-ink-800 ring-1 ring-grass-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-grass-700">
            {copy.written}
          </p>
          <p className="mt-0.5 leading-relaxed">{row.proposal_message}</p>
        </div>
      )}

      {/* Recipient response */}
      {row.proposal_response_note && (
        <div className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-600">
            {copy.response}
          </p>
          <p className="mt-0.5 leading-relaxed">{row.proposal_response_note}</p>
        </div>
      )}

      {/* Actions */}
      {kind !== "history" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-grass-300 bg-grass-50 px-3 text-xs font-semibold text-grass-800 transition hover:bg-grass-100"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {copy.whatsapp}
            </a>
          )}

          {kind === "incoming" && (
            <>
              <button
                type="button"
                onClick={() => setOpen("accept")}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-grass-500 px-3 text-xs font-semibold text-white transition hover:bg-grass-600"
              >
                <Check className="h-3.5 w-3.5" /> {copy.accept}
              </button>
              <button
                type="button"
                onClick={() => setOpen("decline")}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-clay-300 bg-clay-50 px-3 text-xs font-semibold text-clay-800 transition hover:bg-clay-100"
              >
                <X className="h-3.5 w-3.5" /> {copy.decline}
              </button>
            </>
          )}

          {kind === "sent" && (
            <button
              type="button"
              onClick={() => setOpen("cancel")}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-300 bg-white px-3 text-xs font-semibold text-ink-700 transition hover:bg-ink-50"
            >
              <Ban className="h-3.5 w-3.5" /> {copy.cancel}
            </button>
          )}
        </div>
      )}

      {/* Drawer for note */}
      {open && (
        <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/50 p-3">
          <label className="mb-1.5 block text-xs font-medium text-ink-700">
            {copy.optional_note}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs outline-none transition focus:border-grass-500"
          />
          {errMsg && (
            <p className="mt-1.5 text-[11px] text-clay-700">{errMsg}</p>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                setNote("");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-ink-200 bg-white px-2 text-[11px] font-medium text-ink-600 transition hover:bg-ink-50"
            >
              <X className="h-3 w-3" /> {copy.cancel}
            </button>
            <button
              type="button"
              onClick={() => respond(open)}
              disabled={pending}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-grass-500 px-3 text-[11px] font-semibold text-white transition hover:bg-grass-600 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {pending ? copy.sending : copy.confirm}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StatusPill({
  outcome,
  copy,
}: {
  outcome: ProposalRow["outcome"];
  copy: ProposalCardCopy;
}) {
  if (outcome === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-grass-800 ring-1 ring-grass-200">
        <Calendar className="h-3 w-3" /> {copy.scheduled}
      </span>
    );
  }
  if (outcome === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
        <X className="h-3 w-3" /> {copy.cancelled}
      </span>
    );
  }
  if (outcome === "proposed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ball-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ball-800 ring-1 ring-ball-200">
        <CheckCircle2 className="h-3 w-3" /> ⏳
      </span>
    );
  }
  return null;
}
