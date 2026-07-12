import { setRequestLocale } from "next-intl/server";

// =============================================================================
// Mobile app shell (`/[locale]/m/...`) — the screens the Capacitor WebView
// lands on. Design follows «ТЗ Mobile — PlayTennis»: 402px base, adaptive
// 360–430, own bottom tab bar / CTA bars per screen. The web chrome is hidden
// for these routes by <HideOnMobileApp> in the locale layout.
// =============================================================================

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MobileAppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <div className="min-h-dvh bg-[#F3F7ED] text-ink-900">{children}</div>;
}
