import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashInvitationToken } from "@/lib/invitations/token";
import { Link } from "@/i18n/routing";
import { TennisBall } from "@/components/icons/tennis-ball";
import { HelpPanel } from "@/components/help/help-panel";
import { acceptInvitationAction } from "./actions";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

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
      // Send to onboarding chooser (quiz vs. Liga Tennisa import).
      redirect(`/${locale}/onboarding`);
    }
    return <InviteError title={t("error.invalid.title")} body={t("error.invalid.body")} />;
  }

  // Not authenticated → show CTA to sign in
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-xl">
        <Surface variant="card" className="space-y-5">
          <div className="flex items-start gap-3">
            <TennisBall className="mt-1 h-10 w-10 shrink-0 text-ball-500" />
            <PageHeader
              title={t("title", { coach: coachName })}
              subtitle={t("for", { email: inv.email })}
              help={
                <HelpPanel
                  pageId="invite-page"
                  variant="inline"
                  why={t("help.why")}
                  what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
                  result={[t("help.result.1"), t("help.result.2")]}
                />
              }
            />
          </div>

          <p className="text-sm text-ink-700">{t("body")}</p>

          <Button variant="primary" asChild>
            <Link href={loginHref}>{t("cta")}</Link>
          </Button>
        </Surface>
      </div>
    </div>
  );
}

function InviteError({ title, body }: { title: string; body: string }) {
  return (
    <div className="page-shell text-center">
      <PageHeader title={<span className="text-clay-700">{title}</span>} subtitle={body} />
    </div>
  );
}
