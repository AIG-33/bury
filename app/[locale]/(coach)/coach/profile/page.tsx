import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Award } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { loadMyCoachProfile } from "./actions";
import { CoachProfileForm } from "./coach-profile-form";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachProfile");

  const result = await loadMyCoachProfile();
  if (!result.ok) {
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/coach/profile`);
    if (result.error === "not_a_coach") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/me/profile`);
  }

  const profile = result.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-grass-100 text-grass-800">
          <Award className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            {t("title")}
          </h1>
          <p className="text-sm text-ink-600">{t("subtitle")}</p>
        </div>
      </header>

      <HelpPanel
        pageId="coach-profile"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <CoachProfileForm initial={profile} />
    </div>
  );
}
