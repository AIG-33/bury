"use client";

import { useEffect } from "react";

// Native shell glue for the Capacitor build. PlayTennis.by runs as a hosted-URL
// wrapper: the native WebView loads the production site, so this component ships
// with the web bundle and only activates when it detects it is running inside
// Capacitor. On the plain web it is a no-op (the dynamic imports never resolve
// to native plugins because `isNativePlatform()` short-circuits first).
export function NativeBridge() {
  useEffect(() => {
    let cleanup = () => {};

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const [{ SplashScreen }, { StatusBar, Style }, { App }, { Browser }] =
        await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
          import("@capacitor/app"),
          import("@capacitor/browser"),
        ]);

      // Brand-green status bar with light glyphs, matching the web theme color.
      try {
        await StatusBar.setStyle({ style: Style.Light });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#1f8a4c" });
        }
      } catch {
        // Status bar plugin is best-effort; ignore on unsupported surfaces.
      }

      // Reveal the app now that the remote page has mounted. `launchAutoHide`
      // is the fallback if this never runs (e.g. offline fallback page).
      await SplashScreen.hide();

      // Send off-site links (maps, Telegram, mailto, tel) to the system
      // browser so users are never trapped inside the WebView.
      const onClick = (event: MouseEvent) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href) return;

        let url: URL;
        try {
          url = new URL(href, window.location.href);
        } catch {
          return;
        }

        const isWeb = url.protocol === "http:" || url.protocol === "https:";
        const isExternal = isWeb && url.host !== window.location.host;
        if (isExternal) {
          event.preventDefault();
          void Browser.open({ url: url.href });
        }
      };
      document.addEventListener("click", onClick, true);

      // Android hardware back button: walk WebView history, exit at the root.
      const backSub = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      });

      cleanup = () => {
        document.removeEventListener("click", onClick, true);
        void backSub.remove();
      };
    })();

    return () => cleanup();
  }, []);

  return null;
}
