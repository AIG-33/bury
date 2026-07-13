"use client";

import { usePathname } from "@/i18n/routing";
import { useIsNativeApp } from "@/lib/is-native-app";
import { MTabBar, type MTab } from "./m-tab-bar";
import type { MPlaySheetLabels } from "./m-play-sheet";

type Props = {
  labels: Record<MTab, string>;
  playLabels: MPlaySheetLabels;
  authed: boolean;
};

/**
 * Injects the mobile-app tab bar (MTabBar + central «Играть» FAB) on REGULAR
 * web pages when they're opened inside the Capacitor store shell, so the whole
 * app shows one unified bottom bar. Renders nothing:
 * - outside the native app (web keeps its own BottomTabBar), and
 * - on /m routes (those screens render MTabBar themselves).
 *
 * The spacer replaces the footer's `.pb-mobile-nav` reservation — the footer
 * is hidden inside the native shell, so without it the fixed bar would cover
 * the end of the page content.
 */
export function NativeTabBar({ labels, playLabels, authed }: Props) {
  const isNative = useIsNativeApp();
  const pathname = usePathname();
  const isMobileAppRoute = pathname === "/m" || pathname.startsWith("/m/");

  if (!isNative || isMobileAppRoute) return null;

  return (
    <>
      <div aria-hidden style={{ height: "calc(max(env(safe-area-inset-bottom), 12px) + 72px)" }} />
      <MTabBar labels={labels} playLabels={playLabels} authed={authed} />
    </>
  );
}
