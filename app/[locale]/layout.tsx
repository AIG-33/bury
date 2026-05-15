import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import {
  BottomTabBar,
  type BottomTabItem,
} from "@/components/layout/bottom-tab-bar";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations("nav");

  // Single auth probe for layout-level chrome (footer cta state, mobile tabs).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pendingProposals = 0;
  if (user) {
    const { count } = (await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("p2_id", user.id)
      .eq("outcome", "proposed")
      .is("tournament_id", null)) as { count: number | null };
    pendingProposals = count ?? 0;
  }

  // 5 tabs covering "play tennis in two clicks": home → 4 pillars → profile.
  // Authenticated users get the badge for unread match proposals on Profile.
  const bottomTabs: BottomTabItem[] = [
    { href: "/", label: t("tab_home"), icon: "home" },
    { href: "/open-matches", label: t("sparrings"), icon: "sparrings" },
    { href: "/tournaments", label: t("tournaments"), icon: "tournaments" },
    { href: "/coaches", label: t("coaches"), icon: "coaches" },
    {
      href: user ? "/me/profile" : "/login",
      label: user ? t("profile") : t("login"),
      icon: "profile",
      badge: pendingProposals,
    },
  ];

  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone="Europe/Minsk">
      <Suspense fallback={null}>
        <PostHogProvider>
          <div className="flex min-h-screen flex-col">
            <TopNav />
            <main className="flex-1">{children}</main>
            <Footer authed={!!user} />
            <BottomTabBar items={bottomTabs} />
          </div>
        </PostHogProvider>
      </Suspense>
    </NextIntlClientProvider>
  );
}
