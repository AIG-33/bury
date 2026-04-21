import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { InviteForm } from "./invite-form";

type Props = { params: Promise<{ locale: string }> };

type InvitationListRow = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
};

export default async function CoachPlayersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachPlayers");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: invites } = (await supabase
    .from("invitations")
    .select("id, email, status, expires_at, created_at")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)) as { data: InvitationListRow[] | null };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-players"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("invite.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("invite.subtitle")}</p>
        <div className="mt-4">
          <InviteForm
            copy={{
              email: t("invite.email"),
              first_name: t("invite.first_name"),
              last_name: t("invite.last_name"),
              cta: t("invite.cta"),
              sending: t("invite.sending"),
              sent: t("invite.sent"),
              dev_link_label: t("invite.dev_link_label"),
              error: t("invite.error"),
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          {t("recent.title")}
        </h2>

        {!invites || invites.length === 0 ? (
          <EmptyState
            title={t("recent.empty_title")}
            description={t("recent.empty_description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_email")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_status")}</th>
                  <th className="px-3 py-2 text-left font-medium sm:px-4">{t("recent.col_expires")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="break-all px-3 py-2 text-ink-900 sm:px-4">{i.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <StatusBadge status={i.status} labels={{
                        pending: t("status.pending"),
                        accepted: t("status.accepted"),
                        expired: t("status.expired"),
                        revoked: t("status.revoked"),
                      }} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500 sm:px-4">
                      {new Date(i.expires_at).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({
  status,
  labels,
}: {
  status: "pending" | "accepted" | "expired" | "revoked";
  labels: Record<"pending" | "accepted" | "expired" | "revoked", string>;
}) {
  const palette: Record<typeof status, string> = {
    pending: "bg-ball-100 text-ball-900",
    accepted: "bg-grass-100 text-grass-800",
    expired: "bg-ink-100 text-ink-600",
    revoked: "bg-clay-100 text-clay-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status]}`}>
      {labels[status]}
    </span>
  );
}
