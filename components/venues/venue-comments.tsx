"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { AlertCircle, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import {
  addVenueComment,
  deleteVenueComment,
  type VenueCommentRow,
} from "@/app/[locale]/venues/[id]/comment-actions";
import { VENUE_COMMENT_MAX, VENUE_COMMENT_MIN } from "@/lib/venues/schema";

type Props = {
  venueId: string;
  comments: VenueCommentRow[];
  currentUserId: string | null;
  isAdmin: boolean;
};

export function VenueComments({ venueId, comments, currentUserId, isAdmin }: Props) {
  const t = useTranslations("venuesCatalog.comments");
  const locale = useLocale();
  const router = useRouter();

  const [body, setBody] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const trimmed = body.trim();
  const canSubmit = trimmed.length >= VENUE_COMMENT_MIN && trimmed.length <= VENUE_COMMENT_MAX;

  function submit() {
    if (!canSubmit || pending) return;
    setErrMsg(null);
    startT(async () => {
      const r = await addVenueComment({ venue_id: venueId, body: trimmed });
      if (r.ok) {
        setBody("");
        router.refresh();
      } else {
        setErrMsg(r.error);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm(t("delete_confirm"))) return;
    setDeletingId(id);
    startT(async () => {
      const r = await deleteVenueComment(id);
      setDeletingId(null);
      if (r.ok) router.refresh();
      else setErrMsg(r.error);
    });
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card sm:p-6">
      <h2 className="section-title text-[18px] md:text-[20px]">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>

      {errMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("error")}: {errMsg}
          </span>
        </div>
      )}

      {currentUserId ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={VENUE_COMMENT_MAX}
            placeholder={t("placeholder")}
            className="w-full rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] tabular-nums text-ink-400">
              {trimmed.length}/{VENUE_COMMENT_MAX}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || pending}
              className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-pt-primary px-4 text-sm font-medium text-white shadow-card transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {pending && deletingId == null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              {t("submit")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-ink-200 bg-ink-50/40 px-4 py-3">
          <p className="text-sm text-ink-600">{t("guest_hint")}</p>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-[13px] bg-pt-primary px-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            {t("guest_cta")}
          </Link>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="mt-5 text-sm text-ink-500">{t("empty")}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {comments.map((c) => {
            const canDelete = isAdmin || c.author_id === currentUserId;
            return (
              <li key={c.id} className="rounded-lg border border-ink-100 bg-ink-50/30 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    {c.author_name ? (
                      <Link
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        href={`/players/${c.author_id}` as any}
                        className="font-display text-sm font-semibold text-ink-900 transition-colors hover:text-grass-800"
                      >
                        {c.author_name}
                      </Link>
                    ) : (
                      <span className="font-display text-sm font-semibold text-ink-900">
                        {t("anonymous")}
                      </span>
                    )}
                    <span className="text-[11px] text-ink-400">
                      {dateFmt.format(new Date(c.created_at))}
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-ink-400 transition hover:bg-clay-50 hover:text-clay-700"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      {t("delete")}
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
