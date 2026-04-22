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

  const items = [
    { href: "/coach/dashboard", label: t("dashboard"), icon: "dashboard" },
    { href: "/coach/players", label: t("players"), icon: "users" },
    { href: "/coach/slots", label: t("slots"), icon: "calendar" },
    { href: "/coach/tournaments", label: t("tournaments"), icon: "trophy" },
    { href: "/coach/leaderboard", label: t("leaderboard"), icon: "chart" },
    { href: "/coach/profile", label: t("profile"), icon: "user" },
  ] as const;

  return (
    <>
      <SectionNav items={items} accent="grass" />
      {children}
    </>
  );
}
