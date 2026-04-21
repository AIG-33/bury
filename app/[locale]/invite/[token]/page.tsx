import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashInvitationToken } from "@/lib/invitations/token";
import { Link } from "@/i18n/routing";
import { TennisBall } from "@/components/icons/tennis-ball";
import { HelpPanel } from "@/components/help/help-panel";
import { acceptInvitationAction } from "./actions";

type Props = { params: Promise<{ locale: string; token: string }> };

export default async function InvitePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");

  // Look up invitation by token hash
  const service = createSupabaseServiceClient();
  const hash = hashInvitationToken(token);
  const { data: inv } = (await service
    .from("invitations")
    .select("id, coach_id, status, expires_at, email")
    .eq("token_hash", hash)
    .maybeSingle()) as {
    data: {
      id: string;
      coach_id: string;
      status: string;
      expires_at: string;
      email: string;
    } | null;
  };

  if (!inv) {
    return <InviteError title={t("error.invalid.title")} body={t("error.invalid.body")} />;
  }
  if (inv.status === "accepted") {
    return <InviteError title={t("error.already.title")} body={t("error.already.body")} />;
  }
  if (inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return <InviteError title={t("error.expired.title")} body={t("error.expired.body")} />;
  }

  // coach name for greeting
  const { data: coach } = (await service
    .from("profiles")
    .select("display_name")
    .eq("id", inv.coach_id)
    .single()) as { data: { display_name: string | null } | null };

  const coachName = coach?.display_name ?? "Your coach";

  // If already authenticated, accept and redirect
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const result = await acceptInvitationAction(token);
    if (result.ok) {
      // Send to onboarding quiz
      redirect(`/${locale}/onboarding/quiz`);
    }
    return <InviteError title={t("error.invalid.title")} body={t("error.invalid.body")} />;
  }

  // Not authenticated → show CTA to sign in
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="mx-auto max-w-xl space-y-5 px-6 py-10">
      <div className="rounded-xl2 border border-grass-100 bg-white p-8 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <TennisBall className="h-10 w-10 text-ball-500" />
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">{t("title", { coach: coachName })}</h1>
            <p className="text-sm text-ink-600">{t("for", { email: inv.email })}</p>
          </div>
        </div>

        <p className="mb-5 text-sm text-ink-700">{t("body")}</p>

        <Link
          href={loginHref}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-grass-500 px-6 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
        >
          {t("cta")}
        </Link>
      </div>

      <HelpPanel
        pageId="invite-page"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />
    </div>
  );
}

function InviteError({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-12 text-center">
      <h1 className="font-display text-2xl font-bold text-clay-700">{title}</h1>
      <p className="mt-2 text-ink-600">{body}</p>
    </div>
  );
}
