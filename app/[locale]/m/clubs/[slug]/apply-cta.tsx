"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { Check, Clock3, Pencil, Plus } from "lucide-react";
import { applyToJoinClub } from "@/app/[locale]/clubs/actions";

// =============================================================================
// CTA for the club detail screen (ТЗ Mobile §7.05): «Подать заявку» gradient
// button with a plus icon. States mirror the web join CTA. Owners/co-admins
// get an edit link to the club management page instead of a static banner.
// The optional accent color comes from the club's branding.
// =============================================================================

type Props = {
  clubId: string;
  state: "guest" | "none" | "pending" | "approved" | "closed" | "manage";
  accentColor?: string | null;
  labels: {
    apply: string;
    login: string;
    pending: string;
    approved: string;
    closed: string;
    manage: string;
    error: string;
  };
};

const PRIMARY =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85 disabled:opacity-60";
const NEUTRAL =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] border border-[rgba(20,60,30,0.12)] bg-white font-display text-[14px] font-extrabold text-ink-500";

export function ClubApplyCta({ clubId, state, accentColor, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const accentStyle = accentColor ? { background: accentColor } : undefined;

  if (state === "guest") {
    return (
      <button
        type="button"
        className={PRIMARY}
        style={accentStyle}
        onClick={() => router.push("/login" as never)}
      >
        {labels.login}
      </button>
    );
  }

  if (state === "manage") {
    return (
      <Link href={`/me/clubs/owned/${clubId}` as never} className={PRIMARY} style={accentStyle}>
        <Pencil className="h-4 w-4" strokeWidth={2.4} />
        {labels.manage}
      </Link>
    );
  }

  if (state === "closed") {
    return <div className={NEUTRAL}>{labels.closed}</div>;
  }

  if (state === "pending") {
    return (
      <div className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] bg-sun-50 font-display text-[14px] font-extrabold text-sun-600">
        <Clock3 className="h-4 w-4" strokeWidth={2.2} />
        {labels.pending}
      </div>
    );
  }

  if (state === "approved") {
    return (
      <div className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] bg-[rgba(28,122,70,0.1)] font-display text-[14px] font-extrabold text-grass-600">
        <Check className="h-4 w-4" strokeWidth={2.4} />
        {labels.approved}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={PRIMARY}
        style={accentStyle}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            const res = await applyToJoinClub({ club_id: clubId });
            if (res.ok) router.refresh();
            else setError(true);
          })
        }
      >
        <Plus className="h-4 w-4" strokeWidth={2.6} />
        {labels.apply}
      </button>
      {error ? (
        <p className="mt-1.5 text-center text-[11.5px] font-bold text-clay-500">{labels.error}</p>
      ) : null}
    </div>
  );
}
