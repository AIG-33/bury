"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, LogOut, XCircle, Crown, Shield, Loader2 } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/clubs/club-logo";
import { JoinPolicyBadge } from "@/components/clubs/join-policy-badge";
import type {
  MyMembershipRow,
  PendingOwnershipOffer,
} from "./actions";
import {
  setPrimaryClub,
  leaveClub,
  cancelMyApplication,
} from "@/app/[locale]/clubs/actions";
import { acceptOwnership } from "./actions";
import type { JoinPolicy, MemberStatus } from "@/lib/clubs/schema";

type Labels = {
  section_approved: string;
  section_pending: string;
  section_rejected: string;
  section_offers: string;
  primary_label: string;
  primary_set: string;
  primary_clear: string;
  primary_help: string;
  owner_badge: string;
  admin_badge: string;
  leave: string;
  leave_confirm: string;
  cancel_application: string;
  // Template string with the literal placeholder "{club}" — the client
  // substitutes it at confirm-time. Functions can't cross the
  // server→client component boundary in Next.js 15.
  cancel_application_confirm_template: string;
  join_policy: Record<JoinPolicy, string>;
  statuses: Record<MemberStatus, string>;
  ownership_offer: {
    // Templates use {previous}, {club}, {date} placeholders.
    intro_template: string;
    expires_template: string;
    accept: string;
    decline: string;
    accepting: string;
    errors: { transfer_not_offered: string; transfer_expired: string; unknown: string };
  };
};

// Per-row pre-formatted strings derived on the server. Keeps the client
// component free of non-serialisable props.
export type OwnershipOfferDerived = {
  expires_label: string;
};

type Props = {
  locale: string;
  memberships: MyMembershipRow[];
  pendingOwnershipOffers: Array<PendingOwnershipOffer & OwnershipOfferDerived>;
  labels: Labels;
};

export function MyClubsClient({
  locale,
  memberships,
  pendingOwnershipOffers,
  labels,
}: Props) {
  const approved = memberships.filter((m) => m.status === "approved");
  const pending = memberships.filter((m) => m.status === "pending");
  const rejected = memberships.filter((m) => m.status === "rejected");

  return (
    <div className="space-y-6">
      {pendingOwnershipOffers.length > 0 && (
        <Section title={labels.section_offers}>
          <div className="grid gap-3">
            {pendingOwnershipOffers.map((offer) => (
              <OwnershipOfferCard
                key={offer.club_id}
                locale={locale}
                offer={offer}
                labels={labels.ownership_offer}
              />
            ))}
          </div>
        </Section>
      )}

      {approved.length > 0 && (
        <Section title={labels.section_approved}>
          <div className="grid gap-3 md:grid-cols-2">
            {approved.map((m) => (
              <MembershipCard key={m.member_id} locale={locale} membership={m} labels={labels} />
            ))}
          </div>
        </Section>
      )}

      {pending.length > 0 && (
        <Section title={labels.section_pending}>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((m) => (
              <MembershipCard key={m.member_id} locale={locale} membership={m} labels={labels} />
            ))}
          </div>
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title={labels.section_rejected}>
          <div className="grid gap-3 md:grid-cols-2">
            {rejected.map((m) => (
              <MembershipCard key={m.member_id} locale={locale} membership={m} labels={labels} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label-eyebrow mb-3">{title}</p>
      {children}
    </section>
  );
}

function MembershipCard({
  locale,
  membership,
  labels,
}: {
  locale: string;
  membership: MyMembershipRow;
  labels: Labels;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isApproved = membership.status === "approved";

  return (
    <Surface variant="card">
      <div className="flex items-start gap-3">
        <ClubLogo url={membership.club_logo_url} name={membership.club_name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/${locale}/clubs/${membership.club_slug}` as any}
              className="font-display text-base font-semibold text-ink-900 hover:text-grass-800"
            >
              {membership.club_name}
            </Link>
            <JoinPolicyBadge
              policy={membership.club_join_policy}
              labels={labels.join_policy}
              iconOnly
            />
            {membership.is_primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ball-100 px-2 py-0.5 text-[11px] font-semibold text-ball-800">
                <Star className="h-3 w-3" />
                {labels.primary_label}
              </span>
            )}
          </div>
          {membership.club_city && (
            <p className="mt-1 text-xs text-ink-500">{membership.club_city}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {membership.is_owner && (
              <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-2 py-0.5 font-medium text-ball-800">
                <Crown className="h-3 w-3" />
                {labels.owner_badge}
              </span>
            )}
            {!membership.is_owner && membership.role === "admin" && isApproved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-grass-200 bg-grass-50 px-2 py-0.5 font-medium text-grass-800">
                <Shield className="h-3 w-3" />
                {labels.admin_badge}
              </span>
            )}
            {!isApproved && (
              <span className="inline-flex items-center rounded-full border border-ink-200 bg-white px-2 py-0.5 font-medium text-ink-600">
                {labels.statuses[membership.status]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isApproved && (
          <Button
            variant={membership.is_primary ? "accent" : "secondary"}
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setPrimaryClub(membership.is_primary ? null : membership.club_id);
                router.refresh();
              })
            }
            title={labels.primary_help}
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            <Star className="h-3 w-3" />
            {membership.is_primary ? labels.primary_clear : labels.primary_set}
          </Button>
        )}

        {isApproved && !membership.is_owner && (
          <Button
            variant="danger"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (!confirm(labels.leave_confirm)) return;
              startTransition(async () => {
                await leaveClub(membership.club_id);
                router.refresh();
              });
            }}
          >
            <LogOut className="h-3 w-3" />
            {labels.leave}
          </Button>
        )}

        {membership.status === "pending" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              const message = labels.cancel_application_confirm_template.replace(
                "{club}",
                membership.club_name,
              );
              if (!confirm(message)) return;
              startTransition(async () => {
                await cancelMyApplication(membership.club_id);
                router.refresh();
              });
            }}
          >
            <XCircle className="h-3 w-3" />
            {labels.cancel_application}
          </Button>
        )}
      </div>
    </Surface>
  );
}

function OwnershipOfferCard({
  locale,
  offer,
  labels,
}: {
  locale: string;
  offer: PendingOwnershipOffer & OwnershipOfferDerived;
  labels: Labels["ownership_offer"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const introText = labels.intro_template
    .replace("{previous}", offer.previous_owner_name ?? "—")
    .replace("{club}", offer.club_name);
  const expiresText = labels.expires_template.replace("{date}", offer.expires_label);

  return (
    <Surface variant="soft" className="border-ball-200/60 bg-ball-50/60">
      <div className="flex items-start gap-3">
        <ClubLogo url={offer.club_logo_url} name={offer.club_name} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-ball-900">{introText}</p>
          <p className="text-xs text-ball-700">{expiresText}</p>
          {error && (
            <p className="text-xs text-clay-700">
              {error === "transfer_not_offered"
                ? labels.errors.transfer_not_offered
                : error === "transfer_expired"
                  ? labels.errors.transfer_expired
                  : labels.errors.unknown}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await acceptOwnership(offer.club_id);
              if (r.ok) {
                router.push(`/${locale}/me/clubs/owned/${offer.club_id}`);
                router.refresh();
              } else {
                setError(r.error);
              }
            })
          }
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? labels.accepting : labels.accept}
        </Button>
      </div>
    </Surface>
  );
}
