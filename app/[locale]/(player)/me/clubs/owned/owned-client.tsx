"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Crown, Shield, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/clubs/club-logo";
import { JoinPolicyBadge } from "@/components/clubs/join-policy-badge";
import { ClubFormDialog } from "./club-form-dialog";
import type { OwnedClubRow } from "./actions";
import type { JoinPolicy } from "@/lib/clubs/schema";

type Props = {
  locale: string;
  clubs: OwnedClubRow[];
  autoOpenCreate: boolean;
  labels: {
    create_cta: string;
    empty_cta: string;
    card: {
      members: string;
      pending: string;
      open: string;
      edit: string;
      owner_badge: string;
      admin_badge: string;
      transfer_pending: string;
    };
    dialog: React.ComponentProps<typeof ClubFormDialog>["labels"];
    join_policy_labels: Record<JoinPolicy, string>;
  };
};

export function OwnedClubsClient({
  locale,
  clubs,
  autoOpenCreate,
  labels,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (autoOpenCreate) setCreateOpen(true);
  }, [autoOpenCreate]);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {clubs.length === 0 ? labels.empty_cta : labels.create_cta}
        </Button>
      </div>

      {clubs.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {clubs.map((c) => (
            <ClubAdminCard key={c.id} locale={locale} club={c} labels={labels} />
          ))}
        </div>
      )}

      <ClubFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={null}
        locale={locale}
        labels={labels.dialog}
        joinPolicyLabels={labels.join_policy_labels}
      />
    </>
  );
}

function ClubAdminCard({
  locale,
  club,
  labels,
}: {
  locale: string;
  club: OwnedClubRow;
  labels: Props["labels"];
}) {
  return (
    <Link
      href={`/${locale}/me/clubs/owned/${club.id}`}
      className="group block surface-card lift-on-hover"
    >
      <div className="flex items-start gap-3">
        <ClubLogo url={club.logo_url} name={club.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-base font-semibold text-ink-900 group-hover:text-grass-800">
              {club.name}
            </h3>
            <JoinPolicyBadge
              policy={club.join_policy}
              labels={labels.join_policy_labels}
              iconOnly
            />
            {club.is_owner ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-2 py-0.5 text-[11px] font-semibold text-ball-800">
                <Crown className="h-3 w-3" />
                {labels.card.owner_badge}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-grass-200 bg-grass-50 px-2 py-0.5 text-[11px] font-semibold text-grass-800">
                <Shield className="h-3 w-3" />
                {labels.card.admin_badge}
              </span>
            )}
          </div>
          {club.city && <p className="mt-1 text-xs text-ink-500">{club.city}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-50 pt-3 text-xs text-ink-600">
        <span>
          {labels.card.members}:{" "}
          <span className="font-mono tabular-nums font-semibold text-ink-900">
            {club.members_total}
          </span>
        </span>
        <span>
          {labels.card.pending}:{" "}
          <span className="font-mono tabular-nums font-semibold text-ball-700">
            {club.pending_count}
          </span>
        </span>
        {club.pending_owner_id && (
          <span className="inline-flex items-center gap-1 text-clay-700">
            <AlertCircle className="h-3 w-3" />
            {labels.card.transfer_pending}
          </span>
        )}
        <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg bg-grass-700 px-2.5 font-semibold text-white transition group-hover:bg-grass-800">
          <Pencil className="h-3 w-3" />
          {labels.card.edit}
        </span>
      </div>
    </Link>
  );
}
