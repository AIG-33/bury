import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Award, CheckCircle2, Clock, XCircle } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyCoachApplications } from "./actions";
import { COACH_APPLICATION_LIMITS } from "@/lib/coach-applications/schema";
import { BecomeCoachForm, type BecomeCoachCopy } from "./form";

type Props = { params: Promise<{ locale: string }> };

export default async function BecomeCoachPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("becomeCoach");

  const result = await loadMyCoachApplications();
  if (!result.ok) redirect(`/${locale}/login?next=/me/become-coach`);

  const { is_already_coach, applications } = result;
  const head = applications[0] ?? null;
  const history = applications.slice(1);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const copy: BecomeCoachCopy = {
    message_label: t("form.message_label"),
    message_placeholder: t("form.message_placeholder"),
    message_hint: t("form.message_hint", {
      min: COACH_APPLICATION_LIMITS.message_min,
      max: COACH_APPLICATION_LIMITS.message_max,
    }),
    files_label: t("form.files_label"),
    files_hint: t("form.files_hint", {
      max_files: COACH_APPLICATION_LIMITS.attachments_max,
      max_mb: Math.round(COACH_APPLICATION_LIMITS.file_max_bytes / 1024 / 1024),
    }),
    files_add: t("form.files_add"),
    files_remove: t("form.files_remove"),
    submit: t("form.submit"),
    submitting: t("form.submitting"),
    submitted: t("form.submitted"),
    error: t("form.error"),
    error_message_too_short: t("form.error_message_too_short"),
    error_too_many_files: t("form.error_too_many_files", {
      max_files: COACH_APPLICATION_LIMITS.attachments_max,
    }),
    error_file_too_large: t("form.error_file_too_large", {
      max_mb: Math.round(COACH_APPLICATION_LIMITS.file_max_bytes / 1024 / 1024),
    }),
    error_bad_mime: t("form.error_bad_mime"),
    error_pending_exists: t("form.error_pending_exists"),
    error_already_coach: t("form.error_already_coach"),
    accept_attribute: COACH_APPLICATION_LIMITS.allowed_mime_types.join(","),
    max_file_bytes: COACH_APPLICATION_LIMITS.file_max_bytes,
    max_files: COACH_APPLICATION_LIMITS.attachments_max,
    allowed_mimes: [...COACH_APPLICATION_LIMITS.allowed_mime_types],
  };

  // ============================================================
  // States
  // ============================================================
  // 1. Already a coach → green confirmation, link to /coach
  // 2. Pending application → status card, no form
  // 3. No application yet OR last is rejected → show form (+ rejection note)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-grass-700">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-3xl font-bold text-ink-900">
          {t("title")}
        </h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="me-become-coach"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {is_already_coach ? (
        <div className="rounded-xl2 border border-grass-200 bg-grass-50 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700">
              <Award className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-grass-900">
                {t("already_coach.title")}
              </h2>
              <p className="mt-1 text-sm text-grass-800">
                {t("already_coach.body")}
              </p>
              <Link
                href="/coach/dashboard"
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-grass-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-grass-700"
              >
                {t("already_coach.cta")}
              </Link>
            </div>
          </div>
        </div>
      ) : head?.status === "pending" ? (
        <PendingCard
          submittedAt={dateFmt.format(new Date(head.created_at))}
          messagePreview={head.message}
          attachmentsCount={head.attachments.length}
          copy={{
            title: t("pending.title"),
            body: t("pending.body"),
            submitted_at: t("pending.submitted_at"),
            attachments_count: (n: number) =>
              t("pending.attachments_count", { n }),
            message_label: t("pending.message_label"),
          }}
        />
      ) : (
        <>
          {head?.status === "rejected" && head.admin_comment && (
            <RejectionNote
              decidedAt={
                head.decided_at
                  ? dateFmt.format(new Date(head.decided_at))
                  : null
              }
              comment={head.admin_comment}
              copy={{
                title: t("rejected.title"),
                body: t("rejected.body"),
                comment_label: t("rejected.comment_label"),
                decided_at: t("rejected.decided_at"),
              }}
            />
          )}

          <BecomeCoachForm copy={copy} />
        </>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("history.title")}
          </h2>
          <ul className="space-y-3">
            {history.map((app) => (
              <li
                key={app.id}
                className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
              >
                <div className="flex items-center gap-2 text-xs">
                  <StatusBadge
                    status={app.status}
                    label={t(`status.${app.status}`)}
                  />
                  <span className="text-ink-500">
                    {dateFmt.format(new Date(app.created_at))}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-ink-700">
                  {app.message}
                </p>
                {app.admin_comment && (
                  <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    <span className="font-medium text-ink-700">
                      {t("history.admin_comment")}:
                    </span>{" "}
                    {app.admin_comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!head && !is_already_coach && history.length === 0 && (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
        />
      )}
    </div>
  );
}

function PendingCard({
  submittedAt,
  messagePreview,
  attachmentsCount,
  copy,
}: {
  submittedAt: string;
  messagePreview: string;
  attachmentsCount: number;
  copy: {
    title: string;
    body: string;
    submitted_at: string;
    attachments_count: (n: number) => string;
    message_label: string;
  };
}) {
  return (
    <div className="rounded-xl2 border border-ball-200 bg-ball-50 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ball-100 text-clay-700">
          <Clock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-ink-700">{copy.body}</p>
          <p className="mt-3 text-xs text-ink-500">
            {copy.submitted_at}: {submittedAt} ·{" "}
            {copy.attachments_count(attachmentsCount)}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-ink-700 hover:text-ink-900">
              {copy.message_label}
            </summary>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-white px-3 py-2 text-sm text-ink-700">
              {messagePreview}
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

function RejectionNote({
  decidedAt,
  comment,
  copy,
}: {
  decidedAt: string | null;
  comment: string;
  copy: {
    title: string;
    body: string;
    comment_label: string;
    decided_at: string;
  };
}) {
  return (
    <div className="rounded-xl2 border border-clay-200 bg-clay-50 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay-100 text-clay-700">
          <XCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-clay-900">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-clay-800">{copy.body}</p>
          {decidedAt && (
            <p className="mt-2 text-xs text-clay-700">
              {copy.decided_at}: {decidedAt}
            </p>
          )}
          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-ink-700">
            <span className="font-medium text-ink-900">
              {copy.comment_label}:
            </span>{" "}
            {comment}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: "pending" | "approved" | "rejected";
  label: string;
}) {
  const cls =
    status === "approved"
      ? "bg-grass-100 text-grass-800"
      : status === "rejected"
        ? "bg-clay-100 text-clay-700"
        : "bg-ball-100 text-clay-700";
  const Icon =
    status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
        cls
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
