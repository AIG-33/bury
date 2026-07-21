import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import { BottomTabBar, type BottomTabItem } from "@/components/layout/bottom-tab-bar";
import { InstallAppPrompt } from "@/components/layout/install-app-card";
import { HideOnMobileApp } from "@/components/layout/hide-on-mobile-app";
import { HideInNativeApp } from "@/components/layout/hide-in-native-app";
import { NativeTabBar } from "@/components/mobile/native-tab-bar";
import { LaunchSplash } from "@/components/mobile/launch-splash";
import { getMobilePlayLabels, getMobileTabLabels } from "@/app/[locale]/m/tab-labels";
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
  const tFooter = await getTranslations("footer");
  const tMobile = await getTranslations("mobile");

  // The store app is a WebView shell; its long footer is dead weight there
  // (every footer destination lives in the burger menu). New shells are
  // detected server-side via the `PlayTennisApp` UA token (no flash); older
  // binaries without the token fall back to the client-side Capacitor-bridge
  // check in <HideInNativeApp> below.
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isNativeShellUA = userAgent.includes("PlayTennisApp");

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

  // Labels for the "get the app" prompt (floating toast for mobile-web
  // visitors linking to the store listings). Captured server-side so the
  // client component doesn't need to call useTranslations() for layout chrome.
  const installPromptLabels = {
    prompt_headline: tFooter("install.prompt_headline"),
    prompt_body: tFooter("install.prompt_body"),
    prompt_dismiss: tFooter("install.prompt_dismiss"),
    badges: {
      apple_top: tFooter("install.badge_apple_top"),
      google_top: tFooter("install.badge_google_top"),
      aria_apple: tFooter("install.aria_apple"),
      aria_google: tFooter("install.aria_google"),
    },
  };

  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone="Europe/Minsk">
      {/* Full-screen animated splash for the store app while the WebView
          boots. Server-rendered only for the native UA so it is part of the
          very first paint (covers the old "black screen" gap), then fades out
          client-side after ~3s once the page is interactive. */}
      {isNativeShellUA && <LaunchSplash slogan={tMobile("splash.slogan")} />}
      <Suspense fallback={null}>
        <PostHogProvider>
          <div className="flex min-h-screen flex-col">
            <HideOnMobileApp>
              <TopNav />
            </HideOnMobileApp>
            <main className="flex-1">{children}</main>
            {!isNativeShellUA && (
              <HideOnMobileApp>
                <HideInNativeApp>
                  <Footer authed={!!user} />
                </HideInNativeApp>
              </HideOnMobileApp>
            )}
            {/* Web bottom tab bar — browsers only. Inside the store shell it's
                  replaced by the unified app bar (NativeTabBar below); same
                  UA-token + bridge detection combo as the footer. */}
            {!isNativeShellUA && (
              <HideOnMobileApp>
                <HideInNativeApp>
                  <BottomTabBar items={bottomTabs} />
                </HideInNativeApp>
              </HideOnMobileApp>
            )}
            <NativeTabBar
              labels={getMobileTabLabels(tMobile)}
              playLabels={getMobilePlayLabels(tMobile)}
              authed={!!user}
            />
          </div>
          <HideOnMobileApp>
            <InstallAppPrompt labels={installPromptLabels} />
          </HideOnMobileApp>
        </PostHogProvider>
      </Suspense>
    </NextIntlClientProvider>
  );
}
