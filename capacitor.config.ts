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
  // Grass-green WebView background: even if the splash hides before the remote
  // page paints, the user sees brand green instead of a black flash.
  backgroundColor: "#1C7A46",
  // UA marker so the site can detect the store app even if the Capacitor
  // bridge global is unavailable (see lib/is-native-app.ts). Needs a native
  // rebuild to ship; the bridge check works with existing binaries.
  appendUserAgent: "PlayTennisApp",
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
      // Keep the native splash up until the web app mounts and hides it from
      // JS (native-bridge.tsx). The animated web overlay (launch-splash.tsx)
      // is already in the server HTML underneath, so the hand-off is seamless
      // and there is never a black frame between splash and content.
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#1C7A46",
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
    // Native Google / Apple sign-in (@capgo/capacitor-social-login). Real client
    // IDs are passed at runtime via SocialLogin.initialize() in lib/auth/oauth.ts
    // (fed by NEXT_PUBLIC_GOOGLE_* / NEXT_PUBLIC_APPLE_* env). Facebook + Twitter
    // are disabled so their SDKs (and the Facebook AD_ID permission) are excluded.
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
