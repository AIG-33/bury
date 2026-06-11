import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SectionNav } from "@/components/layout/section-nav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Coach area is protected by RLS at the data layer, but we also gate the
// routes here so non-coaches get a clear redirect rather than blank pages.
export default async function CoachLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachNav");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/coach/dashboard`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_coach, is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_coach: boolean; is_admin: boolean } | null };
  if (!profile?.is_coach && !profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-clay-500" />
        <h1 className="mt-3 font-display text-2xl font-bold text-ink-900">
          {t("forbidden_title")}
        </h1>
        <p className="mt-2 text-ink-600">{t("forbidden_body")}</p>
      </div>
    );
  }

  // /coach/leaderboard was merged into /coach/players, so the leaderboard
  // tab is no longer in this nav. Old URLs still work via a redirect on the
  // /coach/leaderboard route.
  //
  // Tournaments moved out of /coach/* entirely — any registered user can
  // organize one from /me/tournaments/organized — so the coach navigation
  // no longer features them. Coaches still see "tournaments active" KPI
  // on the dashboard for the tournaments they personally organize.
  const items = [
    { href: "/coach/dashboard", label: t("dashboard"), icon: "dashboard" },
    { href: "/coach/players", label: t("players"), icon: "users" },
    { href: "/coach/slots", label: t("slots"), icon: "calendar" },
    { href: "/coach/profile", label: t("profile"), icon: "user" },
  ] as const;

  return (
    <>
      <SectionNav items={items} accent="grass" />
      {children}
    </>
  );
}
