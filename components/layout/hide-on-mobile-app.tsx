"use client";

import { usePathname } from "@/i18n/routing";

/**
 * Hides the web chrome (TopNav / Footer / web tab bar / install prompt) on the
 * mobile-app routes (`/[locale]/m/...`), which ship their own header + tab bar
 * per the mobile ТЗ. The locale layout wraps everything, so this is the least
 * invasive way to keep both UIs on one route tree.
 */
export function HideOnMobileApp({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobileApp = pathname === "/m" || pathname.startsWith("/m/");
  if (isMobileApp) return null;
  return <>{children}</>;
}
