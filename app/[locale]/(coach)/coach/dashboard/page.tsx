import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachDashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-dashboard"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(["players", "tournaments", "bookings"] as const).map((k) => (
          <div
            key={k}
            className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
              {t(`kpi.${k}.label`)}
            </p>
            <p className="mt-1 font-mono text-3xl tabular-nums text-ink-900">0</p>
            <p className="mt-1 text-xs text-ink-500">{t(`kpi.${k}.hint`)}</p>
          </div>
        ))}
      </div>

      <EmptyState
        title={t("empty.title")}
        description={t("empty.description")}
        ctaLabel={t("empty.cta")}
        ctaHref="/coach/players"
      />
    </div>
  );
}
