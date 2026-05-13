"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyToOpenMatch,
  cancelOpenMatch,
  decideApplication,
  withdrawApplication,
} from "../actions";
import type {
  OpenMatchApplicationRow,
  OpenMatchStatus,
  OpenMatchApplicationStatus,
} from "@/lib/open-matches/schema";

type Copy = {
  your_application: string;
  your_application_status: string;
  status_pending: string;
  status_accepted: string;
  status_rejected: string;
  status_withdrawn: string;
  apply_cta: string;
  apply_login: string;
  apply_dialog_title: string;
  apply_message_label: string;
  apply_message_placeholder: string;
  apply_send: string;
  apply_sending: string;
  withdraw_cta: string;
  decide_accept: string;
  decide_reject: string;
  cancel_cta: string;
  cancel_confirm: string;
  applications_title: string;
  applications_empty: string;
  err_already_applied: string;
  err_cannot_apply_to_own: string;
  err_open_match_closed: string;
  err_open_match_not_found: string;
  err_not_authenticated: string;
  err_unknown: string;
};

type Props = {
  locale: string;
  matchId: string;
  matchStatus: OpenMatchStatus;
  isCreator: boolean;
  myApplication: OpenMatchApplicationRow | null;
  applications: OpenMatchApplicationRow[];
  copy: Copy;
};

const ERR_KEY: Record<string, keyof Copy> = {
  already_applied: "err_already_applied",
  cannot_apply_to_own: "err_cannot_apply_to_own",
  open_match_closed: "err_open_match_closed",
  open_match_not_found: "err_open_match_not_found",
  not_authenticated: "err_not_authenticated",
};

function statusLabel(s: OpenMatchApplicationStatus, copy: Copy): string {
  switch (s) {
    case "pending":
      return copy.status_pending;
    case "accepted":
      return copy.status_accepted;
    case "rejected":
      return copy.status_rejected;
    case "withdrawn":
      return copy.status_withdrawn;
  }
}

// Bundles all the action triggers around an open match into one client surface
// so the page itself stays as a clean server component. Three concerns:
//   1. "I haven't applied yet" — show Apply button + dialog.
//   2. "I have an application" — show status + withdraw button.
//   3. "I am the creator" — show full applications list with accept/reject.
export function ApplyControls({
  locale,
  matchId,
  matchStatus,
  isCreator,
  myApplication,
  applications,
  copy,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [message, setMessage] = useState("");

  function handleErr(code: string) {
    const key = ERR_KEY[code];
    setError(key ? copy[key] : copy.err_unknown);
  }

  const onApply = () => {
    setError(null);
    startTransition(async () => {
      const r = await applyToOpenMatch({ open_match_id: matchId, message });
      if (r.ok) {
        setShowApplyForm(false);
        setMessage("");
        router.refresh();
        return;
      }
      handleErr(r.error);
    });
  };

  const onWithdraw = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await withdrawApplication(id);
      if (r.ok) router.refresh();
      else handleErr(r.error);
    });
  };

  const onDecide = (id: string, decision: "accepted" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const r = await decideApplication(id, decision);
      if (r.ok) router.refresh();
      else handleErr(r.error);
    });
  };

  const onCancel = () => {
    if (!confirm(copy.cancel_confirm)) return;
    setError(null);
    startTransition(async () => {
      const r = await cancelOpenMatch(matchId);
      if (r.ok) router.refresh();
      else handleErr(r.error);
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </div>
      )}

      {/* Creator branch */}
      {isCreator ? (
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {copy.applications_title}
            </h2>
            {(matchStatus === "open" || matchStatus === "filled") && (
              <button
                onClick={onCancel}
                disabled={pending}
                className="text-sm text-clay-700 hover:text-clay-800 disabled:opacity-60"
              >
                {copy.cancel_cta}
              </button>
            )}
          </div>

          {applications.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">{copy.applications_empty}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {applications.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 bg-white p-3"
                >
                  <a
                    href={`/${locale}/players/${a.applicant_id}`}
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800"
                  >
                    {a.applicant_avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={a.applicant_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs">{(a.applicant_name ?? "?").slice(0, 1)}</span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/${locale}/players/${a.applicant_id}`}
                      className="font-medium text-ink-900 hover:text-grass-800"
                    >
                      {a.applicant_name ?? "—"}
                    </a>
                    <p className="text-xs text-ink-500">
                      <span className="font-mono tabular-nums">{a.applicant_elo}</span> · {statusLabel(a.status, copy)}
                    </p>
                    {a.message && (
                      <p className="mt-1 truncate text-[13px] text-ink-600">{a.message}</p>
                    )}
                  </div>
                  {a.status === "pending" && matchStatus === "open" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onDecide(a.id, "accepted")}
                        disabled={pending}
                        className="inline-flex h-9 items-center rounded-md bg-grass-500 px-3 text-xs font-semibold text-white hover:bg-grass-600 disabled:opacity-60"
                      >
                        {copy.decide_accept}
                      </button>
                      <button
                        onClick={() => onDecide(a.id, "rejected")}
                        disabled={pending}
                        className="inline-flex h-9 items-center rounded-md border border-ink-200 px-3 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                      >
                        {copy.decide_reject}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : myApplication ? (
        // Applicant who already applied — show status + withdraw if pending.
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="font-display text-base font-semibold text-ink-900">
            {copy.your_application}
          </h2>
          <p className="mt-2 text-sm text-ink-700">
            {copy.your_application_status.replace(
              "{status}",
              statusLabel(myApplication.status, copy),
            )}
          </p>
          {myApplication.message && (
            <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {myApplication.message}
            </p>
          )}
          {myApplication.status === "pending" && (
            <button
              onClick={() => onWithdraw(myApplication.id)}
              disabled={pending}
              className="mt-3 text-sm text-clay-700 hover:text-clay-800 disabled:opacity-60"
            >
              {copy.withdraw_cta}
            </button>
          )}
        </section>
      ) : matchStatus === "open" ? (
        // Stranger looking at an open match — show Apply CTA / dialog.
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          {showApplyForm ? (
            <>
              <h2 className="font-display text-base font-semibold text-ink-900">
                {copy.apply_dialog_title}
              </h2>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-ink-800">
                  {copy.apply_message_label}
                </span>
                <textarea
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
                  rows={3}
                  maxLength={400}
                  placeholder={copy.apply_message_placeholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onApply}
                  disabled={pending}
                  className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white hover:bg-grass-600 disabled:opacity-60"
                >
                  {pending ? copy.apply_sending : copy.apply_send}
                </button>
                <button
                  onClick={() => setShowApplyForm(false)}
                  disabled={pending}
                  className="inline-flex h-10 items-center rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowApplyForm(true)}
              className="inline-flex h-11 items-center rounded-lg bg-grass-500 px-5 text-sm font-semibold text-white hover:bg-grass-600"
            >
              {copy.apply_cta}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
