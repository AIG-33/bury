"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Check,
  X,
  Loader2,
  Crown,
  Shield,
  Award,
  UserMinus,
  Settings,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  Link2,
  Send,
} from "lucide-react";
import { ClubLogo } from "@/components/clubs/club-logo";
import { JoinPolicyBadge } from "@/components/clubs/join-policy-badge";
import type { OwnedClubDetail, ApplicationRow, MemberRow } from "../actions";
import {
  decideApplication,
  setMemberRole,
  removeMember,
  regenerateInviteToken,
  revokeInviteToken,
  proposeOwnership,
  cancelOwnershipTransfer,
  setClubLogoUrl,
  deleteClub,
} from "../actions";
import { ClubFormDialog } from "../club-form-dialog";
import type { JoinPolicy } from "@/lib/clubs/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  locale: string;
  club: OwnedClubDetail;
  pending: ApplicationRow[];
  members: MemberRow[];
  districts: Array<{ id: string; name: string; city: string }>;
};

export function OwnerPanel({ locale, club, pending, members, districts }: Props) {
  const t = useTranslations("clubsOwned.detail");
  const tDialog = useTranslations("clubsOwned.dialog");
  const tCommon = useTranslations("clubsCommon");

  const joinPolicyLabels: Record<JoinPolicy, string> = {
    approval: tCommon("join_policy.approval"),
    open: tCommon("join_policy.open"),
    closed: tCommon("join_policy.closed"),
  };

  const dialogLabels = {
    create_title: tDialog("create_title"),
    edit_title: tDialog("edit_title"),
    fields: {
      name: tDialog("fields.name"),
      slug: tDialog("fields.slug"),
      slug_hint: tDialog("fields.slug_hint"),
      description: tDialog("fields.description"),
      description_hint: tDialog("fields.description_hint"),
      city: tDialog("fields.city"),
      district: tDialog("fields.district"),
      district_any: tDialog("fields.district_any"),
      join_policy: tDialog("fields.join_policy"),
      hide_owner: tDialog("fields.hide_owner"),
      hide_owner_hint: tDialog("fields.hide_owner_hint"),
    },
    hints: {
      approval: tDialog("fields.join_policy_hints.approval"),
      open: tDialog("fields.join_policy_hints.open"),
      closed: tDialog("fields.join_policy_hints.closed"),
    },
    save: tDialog("save"),
    saving: tDialog("saving"),
    cancel: tDialog("cancel"),
    errors: {
      name_too_short: tDialog("errors.name_too_short"),
      name_too_long: tDialog("errors.name_too_long"),
      slug_invalid: tDialog("errors.slug_invalid"),
      slug_too_short: tDialog("errors.slug_too_short"),
      slug_too_long: tDialog("errors.slug_too_long"),
      slug_owner_only: tDialog("errors.slug_owner_only"),
      unknown: tDialog("errors.unknown"),
    },
  };

  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-6">
      <SettingsHeader club={club} onEdit={() => setEditOpen(true)} labels={joinPolicyLabels} />
      <ApplicationsSection pending={pending} clubSlug={club.slug} />
      <MembersSection
        locale={locale}
        members={members}
        clubSlug={club.slug}
        ownerId={club.owner_id}
        canManageAdmins={club.is_owner}
      />
      <LogoSection club={club} />
      <InviteSection club={club} />
      <TransferSection club={club} members={members} />
      {club.is_owner && <DangerZone club={club} locale={locale} />}

      <ClubFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={club}
        districts={districts}
        labels={dialogLabels}
        joinPolicyLabels={joinPolicyLabels}
      />
    </div>
  );
}

// ─── HEADER + edit ───────────────────────────────────────────────────────────

function SettingsHeader({
  club,
  onEdit,
  labels,
}: {
  club: OwnedClubDetail;
  onEdit: () => void;
  labels: Record<JoinPolicy, string>;
}) {
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <ClubLogo url={club.logo_url} name={club.name} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-display text-lg font-semibold text-ink-900">{club.name}</h2>
            <JoinPolicyBadge policy={club.join_policy} labels={labels} />
            {club.is_owner ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-2 py-0.5 text-[11px] font-semibold text-ball-800">
                <Crown className="h-3 w-3" /> Владелец
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-grass-200 bg-grass-50 px-2 py-0.5 text-[11px] font-semibold text-grass-800">
                <Shield className="h-3 w-3" /> Co-admin
              </span>
            )}
          </div>
          {(club.city || club.district_name) && (
            <p className="text-xs text-ink-500">
              {[club.city, club.district_name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          <Pencil className="h-4 w-4" />
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

// ─── APPLICATIONS ────────────────────────────────────────────────────────────

function ApplicationsSection({ pending, clubSlug: _clubSlug }: { pending: ApplicationRow[]; clubSlug: string }) {
  const t = useTranslations("clubsOwned.detail.applications");
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
        <span className="text-xs text-ink-500">{t("count", { n: pending.length })}</span>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {pending.map((a) => (
            <ApplicationRowItem key={a.member_id} row={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicationRowItem({ row }: { row: ApplicationRow }) {
  const t = useTranslations("clubsOwned.detail.applications");
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {row.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-ink-100 object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-full bg-ink-100" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink-900">
          {row.display_name ?? "—"}
          {row.is_coach && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-1.5 py-0.5 text-[10px] font-medium text-ball-800">
              <Award className="h-2.5 w-2.5" /> {t("coach_badge")}
            </span>
          )}
        </p>
        <p className="text-xs text-ink-500">
          Elo <span className="font-mono tabular-nums text-ink-800">{row.current_elo}</span>
          {row.city && ` · ${row.city}`}
          {row.district_name && ` · ${row.district_name}`}
        </p>
        {row.message && (
          <p className="mt-1 max-w-prose whitespace-pre-line text-xs text-ink-600">«{row.message}»</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await decideApplication({
                member_id: row.member_id,
                decision: "approved",
                reason: null,
              });
              if (r.ok) router.refresh();
              else setError(r.error);
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-grass-500 px-3 text-xs font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          <Check className="h-3 w-3" />
          {t("approve")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowReject(true)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-xs font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-3 w-3" />
          {t("reject")}
        </button>
      </div>
      {error && <p className="basis-full text-xs text-clay-700">{error}</p>}

      {showReject && (
        <RejectDialog
          onClose={() => setShowReject(false)}
          isPending={isPending}
          reason={reason}
          setReason={setReason}
          onSubmit={() => {
            startTransition(async () => {
              setError(null);
              const r = await decideApplication({
                member_id: row.member_id,
                decision: "rejected",
                reason: reason.trim() || null,
              });
              if (r.ok) {
                setShowReject(false);
                router.refresh();
              } else {
                setError(r.error);
              }
            });
          }}
        />
      )}
    </li>
  );
}

function RejectDialog({
  onClose,
  onSubmit,
  isPending,
  reason,
  setReason,
}: {
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  reason: string;
  setReason: (v: string) => void;
}) {
  const t = useTranslations("clubsOwned.detail.applications.reject_dialog");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8"
      onClick={() => !isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="shadow-pop w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
            {t("reason_label")}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reason_placeholder")}
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-clay-500 px-4 text-sm font-semibold text-white transition hover:bg-clay-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBERS ─────────────────────────────────────────────────────────────────

function MembersSection({
  locale,
  members,
  clubSlug,
  ownerId,
  canManageAdmins,
}: {
  locale: string;
  members: MemberRow[];
  clubSlug: string;
  ownerId: string;
  canManageAdmins: boolean;
}) {
  const t = useTranslations("clubsOwned.detail.members");
  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
        <span className="text-xs text-ink-500">{t("count", { n: members.length })}</span>
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-ink-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {members.map((m) => (
            <MemberRowItem
              key={m.member_id}
              row={m}
              locale={locale}
              clubSlug={clubSlug}
              isOwnerRow={m.user_id === ownerId}
              canManageAdmins={canManageAdmins}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberRowItem({
  row,
  locale,
  clubSlug: _clubSlug,
  isOwnerRow,
  canManageAdmins,
}: {
  row: MemberRow;
  locale: string;
  clubSlug: string;
  isOwnerRow: boolean;
  canManageAdmins: boolean;
}) {
  const t = useTranslations("clubsOwned.detail.members");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {row.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-ink-100 object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-full bg-ink-100" />
      )}
      <Link
        href={`/${locale}/players/${row.user_id}`}
        className="min-w-0 flex-1 hover:text-grass-800"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink-900">
          {row.display_name ?? "—"}
          {isOwnerRow && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-1.5 py-0.5 text-[10px] font-medium text-ball-800">
              <Crown className="h-2.5 w-2.5" /> {t("owner_badge")}
            </span>
          )}
          {!isOwnerRow && row.role === "admin" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-grass-200 bg-grass-50 px-1.5 py-0.5 text-[10px] font-medium text-grass-800">
              <Shield className="h-2.5 w-2.5" /> Co-admin
            </span>
          )}
          {row.is_coach && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ball-200 bg-ball-50 px-1.5 py-0.5 text-[10px] font-medium text-ball-800">
              <Award className="h-2.5 w-2.5" /> {t("coach_badge")}
            </span>
          )}
        </p>
        <p className="text-xs text-ink-500">
          Elo <span className="font-mono tabular-nums text-ink-800">{row.current_elo}</span>
        </p>
      </Link>
      <div className="flex items-center gap-1">
        {!isOwnerRow && canManageAdmins && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await setMemberRole({
                  member_id: row.member_id,
                  role: row.role === "admin" ? "member" : "admin",
                });
                if (r.ok) router.refresh();
                else setError(r.error);
              })
            }
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Shield className="h-3 w-3" />
            {row.role === "admin" ? t("demote") : t("promote")}
          </button>
        )}
        {!isOwnerRow && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(t("kick_confirm"))) return;
              startTransition(async () => {
                setError(null);
                const r = await removeMember(row.member_id, null);
                if (r.ok) router.refresh();
                else setError(r.error);
              });
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserMinus className="h-3 w-3" />
            {t("kick")}
          </button>
        )}
      </div>
      {error && <p className="basis-full text-xs text-clay-700">{error}</p>}
    </li>
  );
}

// ─── LOGO ────────────────────────────────────────────────────────────────────

function LogoSection({ club }: { club: OwnedClubDetail }) {
  const t = useTranslations("clubsOwned.detail.settings.logo");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
      <div className="flex items-center gap-4">
        <ClubLogo url={club.logo_url} name={club.name} size="lg" />
        <div className="space-y-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? t("uploading") : t("upload")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                startTransition(async () => {
                  setError(null);
                  const supabase = createSupabaseBrowserClient();
                  const ext = file.name.split(".").pop() ?? "png";
                  const path = `${club.id}/${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("club-logos")
                    .upload(path, file, { upsert: true, contentType: file.type });
                  if (upErr) {
                    setError(upErr.message);
                    return;
                  }
                  const { data: pub } = supabase.storage.from("club-logos").getPublicUrl(path);
                  const r = await setClubLogoUrl(club.id, pub.publicUrl);
                  if (r.ok) router.refresh();
                  else setError(r.error);
                });
              }}
            />
          </label>
          {club.logo_url && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await setClubLogoUrl(club.id, null);
                  if (r.ok) router.refresh();
                  else setError(r.error);
                })
              }
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {t("remove")}
            </button>
          )}
          <p className="text-xs text-ink-500">{t("hint")}</p>
          {error && <p className="text-xs text-clay-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}

// ─── INVITE ──────────────────────────────────────────────────────────────────

function InviteSection({ club }: { club: OwnedClubDetail }) {
  const t = useTranslations("clubsOwned.detail.invite");
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inviteUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/clubs/join/${token}`
    : null;

  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
      <p className="mb-3 text-xs text-ink-500">{t("subtitle")}</p>

      {!club.invite_token_present && !inviteUrl && (
        <p className="mb-3 text-sm text-ink-500">{t("no_token")}</p>
      )}

      {club.invite_token_present && !inviteUrl && (
        <p className="mb-3 text-sm text-ink-700">
          {club.invite_expires_at
            ? t("expires_at", { date: dateFmt.format(new Date(club.invite_expires_at)) })
            : t("expires_never")}
        </p>
      )}

      {inviteUrl && (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-ink-500">{t("current_link")}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs">
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              <Copy className="h-4 w-4" />
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <p className="text-xs text-clay-700">{t("warning_rotate")}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("expires_in_days_label")}
          </span>
          <input
            type="number"
            min={0}
            max={365}
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="w-24 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
          />
          <span className="mt-1 block text-[10px] text-ink-500">{t("expires_in_days_zero")}</span>
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await regenerateInviteToken({
                club_id: club.id,
                expires_in_days: expiresIn,
              });
              if (r.ok) {
                setToken(r.data.token);
                router.refresh();
              } else {
                setError(r.error);
              }
            })
          }
          className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <RefreshCw className="h-4 w-4" />
          {club.invite_token_present ? t("regenerate") : t("generate")}
        </button>
        {club.invite_token_present && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(t("revoke_confirm"))) return;
              startTransition(async () => {
                setError(null);
                const r = await revokeInviteToken(club.id);
                if (r.ok) {
                  setToken(null);
                  router.refresh();
                } else setError(r.error);
              });
            }}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Link2 className="h-4 w-4" />
            {t("revoke")}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-clay-700">{error}</p>}
    </section>
  );
}

// ─── TRANSFER ────────────────────────────────────────────────────────────────

function TransferSection({ club, members }: { club: OwnedClubDetail; members: MemberRow[] }) {
  const t = useTranslations("clubsOwned.detail.transfer");
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!club.is_owner) return null;

  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
  const eligible = members.filter((m) => m.user_id !== club.owner_id);

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">{t("title")}</h2>
      <p className="mb-3 text-xs text-ink-500">{t("subtitle")}</p>

      {club.pending_owner_id ? (
        <div className="rounded-lg border border-ball-200 bg-ball-50 p-3">
          <p className="text-sm text-ball-900">
            {t("pending_intro", { name: club.pending_owner_name ?? "—" })}
          </p>
          {club.pending_owner_at && (
            <p className="text-xs text-ball-700">
              {t("pending_expires")} ·{" "}
              {dateFmt.format(
                new Date(new Date(club.pending_owner_at).getTime() + 14 * 24 * 60 * 60 * 1000),
              )}
            </p>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await cancelOwnershipTransfer(club.id);
                if (r.ok) router.refresh();
                else setError(r.error);
              })
            }
            className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-clay-50 hover:text-clay-700"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? t("cancelling") : t("cancel")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block uppercase tracking-wider text-ink-500">
              {t("select_label")}
            </span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-72 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("select_placeholder")}</option>
              {eligible.map((m) => (
                <option key={m.member_id} value={m.user_id}>
                  {m.display_name ?? "—"} (Elo {m.current_elo})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selected || isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await proposeOwnership({
                  club_id: club.id,
                  new_owner_id: selected,
                });
                if (r.ok) router.refresh();
                else setError(r.error);
              })
            }
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" />
            {isPending ? t("proposing") : t("propose")}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-clay-700">{error}</p>}
    </section>
  );
}

// ─── DANGER ZONE (delete) ───────────────────────────────────────────────────

function DangerZone({ club, locale }: { club: OwnedClubDetail; locale: string }) {
  const t = useTranslations("clubsOwned.detail.settings.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = confirmName.trim() === club.name;

  return (
    <section className="rounded-xl2 border border-clay-200 bg-clay-50/40 p-4">
      <h2 className="mb-1 font-display text-lg font-semibold text-clay-900">{t("title")}</h2>
      <p className="mb-3 text-xs text-clay-700">{t("warning")}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-clay-300 bg-white px-3 text-sm font-medium text-clay-700 transition hover:bg-clay-100"
      >
        <Trash2 className="h-4 w-4" />
        {t("cta")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="shadow-pop w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-display text-lg font-semibold text-clay-900">{t("title")}</h3>
            <p className="mb-3 text-sm text-ink-700">{t("warning")}</p>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
                {t("confirm_label")}
              </span>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={club.name}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none focus:ring-1 focus:ring-clay-500"
              />
            </label>
            {error && <p className="mt-2 text-xs text-clay-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={!canSubmit || isPending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await deleteClub(club.id);
                    if (r.ok) router.push(`/${locale}/me/clubs/owned`);
                    else setError(r.error);
                  })
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-clay-500 px-4 text-sm font-semibold text-white transition hover:bg-clay-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {canSubmit ? t("submit") : t("submit_disabled")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
