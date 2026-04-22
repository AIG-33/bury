import { setRequestLocale, getTranslations } from "next-intl/server";
import { SectionNav } from "@/components/layout/section-nav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function CoachLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachNav");

  // /coach/leaderboard was merged into /coach/players, so the leaderboard
  // tab is no longer in this nav. Old URLs still work via a redirect on the
  // /coach/leaderboard route.
  const items = [
    { href: "/coach/dashboard", label: t("dashboard"), icon: "dashboard" },
    { href: "/coach/players", label: t("players"), icon: "users" },
    { href: "/coach/slots", label: t("slots"), icon: "calendar" },
    { href: "/coach/tournaments", label: t("tournaments"), icon: "trophy" },
    { href: "/coach/profile", label: t("profile"), icon: "user" },
  ] as const;

  return (
    <>
      <SectionNav items={items} accent="grass" />
      {children}
    </>
  );
}
