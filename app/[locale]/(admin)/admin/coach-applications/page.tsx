import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import {
  loadAdminCoachApplications,
  type LoadAdminAppsFilter,
} from "./actions";
import { CoachApplicationsClient, type CoachAppsCopy } from "./client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminCoachApplicationsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("adminCoachApplications");

  const filter = (
    sp.filter === "decided" || sp.filter === "all"
      ? sp.filter
      : "pending"
  ) as LoadAdminAppsFilter;

  const result = await loadAdminCoachApplications(filter);
  if (!result.ok) {
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/admin/coach-applications`);
    if (result.error === "not_an_admin") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/login`);
  }

  const copy: CoachAppsCopy = {
    filter_pending: t("filter.pending"),
    filter_decided: t("filter.decided"),
    filter_all: t("filter.all"),
    status: {
      pending: t("status.pending"),
      approved: t("status.approved"),
      rejected: t("status.rejected"),
    },
    actions: {
      approve: t("actions.approve"),
      reject: t("actions.reject"),
      view_files: t("actions.view_files"),
      hide_files: t("actions.hide_files"),
      open_file: t("actions.open_file"),
      open_player: t("actions.open_player"),
    },
    dialog: {
      approve_title: t("dialog.approve_title"),
      reject_title: t("dialog.reject_title"),
      comment_label_optional: t("dialog.comment_label_optional"),
      comment_label_required: t("dialog.comment_label_required"),
      comment_placeholder: t("dialog.comment_placeholder"),
      cancel: t("dialog.cancel"),
      confirm: t("dialog.confirm"),
      confirming: t("dialog.confirming"),
      reject_requires_comment: t("dialog.reject_requires_comment"),
    },
    fields: {
      submitted_at: t("fields.submitted_at"),
      decided_at: t("fields.decided_at"),
      decided_by: t("fields.decided_by"),
      attachments: t("fields.attachments"),
      message: t("fields.message"),
      admin_comment: t("fields.admin_comment"),
      already_coach: t("fields.already_coach"),
    },
    error_generic: t("error_generic"),
    error_not_pending: t("error_not_pending"),
    files_loading: t("files_loading"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">
          {t("title")}
        </h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="admin-coach-applications"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      {result.rows.length === 0 ? (
        <>
          <CoachApplicationsClient
            initialRows={[]}
            initialFilter={filter}
            copy={copy}
          />
          <EmptyState title={t("empty_title")} description={t("empty_body")} />
        </>
      ) : (
        <CoachApplicationsClient
          initialRows={result.rows}
          initialFilter={filter}
          copy={copy}
        />
      )}
    </div>
  );
}
