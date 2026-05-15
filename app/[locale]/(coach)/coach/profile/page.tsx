import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Award } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { PageHeader } from "@/components/layout/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMyCoachProfile } from "./actions";
import { CoachProfileForm } from "./coach-profile-form";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachProfile");
  const tSec = await getTranslations("accountSecurity");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  const result = await loadMyCoachProfile();
  if (!result.ok) {
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/coach/profile`);
    if (result.error === "not_a_coach") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/me/profile`);
  }

  const profile = result.profile;

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-800">
              <Award className="h-5 w-5" />
            </span>
            {t("title")}
          </span>
        }
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="coach-profile"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <CoachProfileForm initial={profile} />

      {email && (
        <ChangePasswordCard
          email={email}
          copy={{
            title: tSec("title"),
            subtitle: tSec("subtitle"),
            email_label: tSec("email_label"),
            current_password: tSec("current_password"),
            new_password: tSec("new_password"),
            confirm_password: tSec("confirm_password"),
            cta_change: tSec("cta_change"),
            cta_send_link: tSec("cta_send_link"),
            link_mode_hint: tSec("link_mode_hint"),
            toggle_to_link: tSec("toggle_to_link"),
            toggle_to_direct: tSec("toggle_to_direct"),
            sending: tSec("sending"),
            saving: tSec("saving"),
            success_changed: tSec("success_changed"),
            success_link_sent: tSec("success_link_sent"),
            error: tSec("error"),
            mismatch: tSec("mismatch"),
            min_hint: tSec("min_hint"),
            wrong_current: tSec("wrong_current"),
          }}
        />
      )}
    </div>
  );
}
