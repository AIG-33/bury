"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Globe2, Loader2, Lock } from "lucide-react";
import { setTournamentPrivacy } from "../actions";
import type { Privacy } from "@/lib/tournaments/schema";

export type PrivacyControlCopy = {
  status_label: string;
  club_label: string;
  public_label: string;
  club_hint: string;
  public_hint: string;
  publish_button: string;
  unpublish_button: string;
  publishing: string;
  hidden_results_title: string;
  hidden_results_body: string;
  visible_results_title: string;
  visible_results_body: string;
  view_public: string;
  error_prefix: string;
};

/**
 * Inline privacy switch shown on the coach tournament detail page.
 * Surfaces the link between `tournaments.privacy` and the public
 * `/matches` feed so the coach doesn't have to dig through the full
 * edit dialog (or the docs) to discover that "club" tournaments are
 * not surfaced publicly. Two states:
 *
 *  - privacy = 'club'    → shows a "publish results" CTA card.
 *  - privacy = 'public'  → shows a confirmation row + a "make club" link.
 */
export function PrivacyControl({
  tournamentId,
  initialPrivacy,
  publicHref,
  copy,
}: {
  tournamentId: string;
  initialPrivacy: Privacy;
  publicHref: string;
  copy: PrivacyControlCopy;
}) {
  const router = useRouter();
  const [privacy, setPrivacy] = useState<Privacy>(initialPrivacy);
  const [pending, startT] = useTransition();

  function flip(next: Privacy) {
    startT(async () => {
      const r = await setTournamentPrivacy(tournamentId, next);
      if (!r.ok) {
        alert(`${copy.error_prefix}: ${r.error}`);
        return;
      }
      setPrivacy(next);
      router.refresh();
    });
  }

  if (privacy === "club") {
    return (
      <section className="rounded-xl2 border border-clay-200 bg-clay-50/60 p-4 shadow-card">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay-100 text-clay-700">
            <EyeOff className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-sm font-semibold text-clay-900">
              {copy.hidden_results_title}
            </p>
            <p className="text-xs text-clay-800">{copy.hidden_results_body}</p>
            <p className="inline-flex items-center gap-1 text-[11px] text-clay-700">
              <Lock className="h-3 w-3" />
              {copy.status_label}
              <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium uppercase tracking-wider">
                {copy.club_label}
              </span>
              <span className="text-clay-600">— {copy.club_hint}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => flip("public")}
            disabled={pending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-grass-700 px-4 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_20px_-10px_rgba(21,94,54,0.5)] transition hover:-translate-y-0.5 hover:bg-grass-800 disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {copy.publishing}
              </>
            ) : (
              <>
                <Globe2 className="h-3.5 w-3.5" />
                {copy.publish_button}
              </>
            )}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl2 border border-grass-200 bg-grass-50/60 p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700">
          <Eye className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold text-grass-900">
            {copy.visible_results_title}
          </p>
          <p className="text-xs text-grass-800">{copy.visible_results_body}</p>
          <p className="inline-flex items-center gap-1 text-[11px] text-grass-700">
            <Globe2 className="h-3 w-3" />
            {copy.status_label}
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium uppercase tracking-wider">
              {copy.public_label}
            </span>
            <span className="text-grass-600">— {copy.public_hint}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={publicHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-grass-300 bg-white/70 px-3 text-[12px] font-semibold text-grass-800 hover:bg-white"
          >
            {copy.view_public}
          </a>
          <button
            type="button"
            onClick={() => flip("club")}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {copy.unpublish_button}
          </button>
        </div>
      </div>
    </section>
  );
}
