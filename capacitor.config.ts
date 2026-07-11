import type { CapacitorConfig } from "@capacitor/cli";

// PlayTennis.by ships as a hosted-URL Capacitor shell. The web app is a
// Next.js 16 SSR platform (server actions, proxy.ts session refresh, cron,
// API routes) and cannot be statically exported, so the native WebView loads
// the deployed site and we layer native capabilities (splash, status bar,
// hardware back button, external-link handling) on top of it.
//
// Override the target with CAP_SERVER_URL when pointing a device/emulator at a
// LAN dev server, e.g. CAP_SERVER_URL="http://192.168.1.10:3000" npx cap sync.
const serverUrl = process.env.CAP_SERVER_URL ?? "https://www.playtennis.by";

const config: CapacitorConfig = {
  appId: "by.playtennis.app",
  appName: "PlayTennis.by",
  webDir: "mobile/www",
  server: {
    url: serverUrl,
    // Only allow cleartext when explicitly pointing at a local dev server.
    cleartext: serverUrl.startsWith("http://"),
    // Keep first-party and Supabase auth navigations inside the WebView so the
    // session cookie survives. Everything else (maps, Telegram, mail) is opened
    // in the system browser by the native shell listener.
    allowNavigation: ["www.playtennis.by", "playtennis.by", "*.supabase.co"],
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#f6f9f4",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1f8a4c",
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
