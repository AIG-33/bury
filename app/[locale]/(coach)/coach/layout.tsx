import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Trophy,
  BarChart3,
  UserCircle,
} from "lucide-react";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function CoachLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachNav");

  const items = [
    { href: "/coach/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/coach/players", label: t("players"), icon: Users },
    { href: "/coach/venues", label: t("venues"), icon: Building2 },
    { href: "/coach/slots", label: t("slots"), icon: CalendarDays },
    { href: "/coach/tournaments", label: t("tournaments"), icon: Trophy },
    { href: "/coach/leaderboard", label: t("leaderboard"), icon: BarChart3 },
    { href: "/coach/profile", label: t("profile"), icon: UserCircle },
  ] as const;

  return (
    <>
      <nav className="border-b border-ink-100 bg-grass-50/40">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={it.href as any}
                className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink-600 transition hover:border-grass-400 hover:text-grass-700"
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
