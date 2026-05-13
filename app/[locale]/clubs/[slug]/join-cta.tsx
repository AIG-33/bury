"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
import type { ClubViewerState } from "@/app/[locale]/clubs/actions";
import { applyToJoinClub } from "@/app/[locale]/clubs/actions";
import type { JoinPolicy } from "@/lib/clubs/schema";

type Props = {
  locale: string;
  clubId: string;
  clubName: string;
  joinPolicy: JoinPolicy;
  viewer: ClubViewerState;
};

/**
 * Single CTA shown in the club header. The button label and behaviour vary
 * with the viewer's relationship to the club:
 *   - not signed in    → "Sign in to join"
 *   - already member   → muted "You're in"
 *   - pending          → muted "Application sent"
 *   - rejected         → "Apply again"
 *   - owner            → muted "This is your club"
 *   - eligible & open  → instant join
 *   - eligible & appr. → opens a dialog with optional message
 *   - eligible & closed→ muted "Invite-only"
 */
export function JoinCta({ locale, clubId, clubName, joinPolicy, viewer }: Props) {
  const t = useTranslations("clubPublic.join_cta");
  const tDlg = useTranslations("clubPublic.apply_dialog");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!viewer.authenticated) {
    return (
      <a
        href={`/${locale}/login`}
        className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
      >
        {t("login")}
      </a>
    );
  }
  if (viewer.is_owner) {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-ink-100 bg-ink-50 px-4 text-sm font-medium text-ink-700">
        {t("owner")}
      </span>
    );
  }
  if (viewer.status === "approved") {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-grass-200 bg-grass-50 px-4 text-sm font-medium text-grass-800">
        {t("approved")}
      </span>
    );
  }
  if (viewer.status === "pending") {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-ball-200 bg-ball-50 px-4 text-sm font-medium text-ball-800">
        {t("pending")}
      </span>
    );
  }
  if (joinPolicy === "closed") {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-ink-100 bg-ink-50 px-4 text-sm font-medium text-ink-500">
        {t("closed")}
      </span>
    );
  }

  const isOpen = joinPolicy === "open";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            startTransition(async () => {
              const r = await applyToJoinClub({
                club_id: clubId,
                message: null,
                make_primary: false,
              });
              if (r.ok) {
                router.refresh();
              } else {
                setError(r.error);
                setOpen(true);
              }
            });
          } else {
            setOpen(true);
          }
        }}
        disabled={isPending}
        className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isOpen ? t("open") : t("approval")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="shadow-pop max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-900">
                {tDlg("title", { club: clubName })}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
                  {tDlg("message_label")}
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={tDlg("message_placeholder")}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
                />
              </label>
              {error && (
                <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
                  {error === "club_closed"
                    ? tDlg("errors.club_closed")
                    : error === "already_member"
                      ? tDlg("errors.already_member")
                      : tDlg("errors.unknown")}
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setOpen(false);
                }}
                className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {tDlg("cancel")}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const r = await applyToJoinClub({
                      club_id: clubId,
                      message: message.trim() || null,
                      make_primary: false,
                    });
                    if (r.ok) {
                      setOpen(false);
                      router.refresh();
                    } else {
                      setError(r.error);
                    }
                  });
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? tDlg("submitting") : tDlg("submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
