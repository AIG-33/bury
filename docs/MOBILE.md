# Mobile apps (iOS + Android) — Capacitor

PlayTennis.by ships to the App Store and Google Play as a **Capacitor hosted-URL
wrapper**. The web app is a Next.js 16 SSR platform (server actions, `proxy.ts`
session refresh, cron, API routes) and cannot be statically exported, so the
native shell loads the deployed production site and layers native capabilities
(splash, status bar, hardware back button, external-link handling) on top.

```mermaid
flowchart LR
  user["User taps app icon"] --> shell["Native shell (iOS/Android)"]
  shell -->|"loads server.url"| web["https://www.playtennis.by (Next.js on Vercel)"]
  web --> supa["Supabase (auth cookie in WebView)"]
  shell -->|"injects bridge JS"| bridge["NativeBridge: splash / status bar / back / external links"]
```

## Layout

| Path                                  | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `capacitor.config.ts`                 | App id, name, `server.url`, plugin config              |
| `mobile/www/index.html`               | Offline fallback page (the bundled `webDir`)           |
| `resources/`                          | Source `icon.png` + `splash*.png` for asset generation |
| `scripts/generate-mobile-assets.mjs`  | Rebuilds `resources/` from `public/icons/icon.svg`     |
| `components/mobile/native-bridge.tsx` | Client glue, active only inside Capacitor              |
| `ios/` , `android/`                   | Generated native projects (committed)                  |

- **App ID:** `by.playtennis.app`
- **App name:** `PlayTennis.by`
- **Target URL:** `https://www.playtennis.by` (override with `CAP_SERVER_URL`)

## Mobile app UI (`/[locale]/m`)

The store app renders its own screen set built to the mobile design spec
(«ТЗ Mobile — PlayTennis», 8 screens): Турниры (+карточка), Клубы
(+карточка), Профиль, Игра (спарринги) and Матчи. These live under
`app/[locale]/m/` with shared primitives in `components/mobile/` (tab bar,
sticky/dark headers, segment controls, status pills, CTA bars, filter
bottom-sheet) and pure helpers in `lib/mobile/format.ts`.

The app root (`/[locale]/m`) follows the «PlayTennis Start» / «PlayTennis
Home» designs:

- **Guest** → splash + вход (`start-screen.tsx`): brand hero (breathing logo,
  slogan, feature chips, live player/club counter) and a bottom sheet with
  Apple / Google on top (`start-oauth.tsx`, same `lib/auth/oauth.ts` flow as
  the web login form), then the primary e-mail sign-in button and a
  «Создать аккаунт» link (deep-links to `/login?mode=signup`).
- **Signed in** → dashboard (`page.tsx`): dark header with the rating band
  (ELO + 30-day delta, place in the primary club, win streak), three quick
  actions, the next upcoming event card (accepted sparring / own open match /
  tournament game) with «Открыть матч» and «Маршрут», two open games nearby
  and tournaments closing registration.

Routing:

- `proxy.ts` detects the shell's user-agent marker (`PlayTennisApp`, appended
  via `capacitor.config.ts`) and redirects the site root (`/`, `/ru`, `/en`)
  to `/{locale}/m`. Deep links to web pages are untouched.
- The web chrome (TopNav / Footer / web tab bar / install prompt) is hidden on
  `/m/...` by `components/layout/hide-on-mobile-app.tsx`; the web UI elsewhere
  is unchanged.
- The mobile UI reuses the existing server actions (tournaments, clubs, open
  matches, rating history), so shipping it is a normal web deploy — no native
  rebuild required.

## Prerequisites

- Node 20+, Xcode (iOS), Android Studio + SDK (Android), Java 17
- `npm install` (Capacitor deps are in `package.json`)

## Everyday workflow

Because we load a remote URL, **there is no web bundle to rebuild for native**.
The native app reflects whatever is deployed to production, so:

1. Ship web changes to Vercel as usual (the `NativeBridge` glue must be deployed
   for splash-hide / status bar / external links to work in the native app).
2. Only re-sync native when Capacitor config, plugins, or assets change:

```bash
npm run cap:sync          # copy config + plugins into ios/ and android/
npm run cap:assets        # regenerate icons/splashes from resources/
```

### Point the app at a local dev server

```bash
CAP_SERVER_URL="http://192.168.1.10:3000" npm run cap:sync
npm run cap:run:ios       # or cap:run:android
```

(Use your machine's LAN IP, not `localhost`, so the device/emulator can reach it.)

## Build & publish

### iOS (App Store)

```bash
npm run cap:ios           # sync + open Xcode
```

In Xcode: set the Team/signing under _Signing & Capabilities_, bump the build
number, then _Product → Archive → Distribute App → App Store Connect_.

### Android (Google Play)

```bash
npm run cap:android       # sync + open Android Studio
```

In Android Studio: _Build → Generate Signed Bundle / APK → Android App Bundle_,
sign with the upload keystore (keep it out of git — see `.gitignore`), and upload
the `.aab` to the Play Console.

## Regenerating icons / splash

Edit `public/icons/icon.svg`, then:

```bash
node scripts/generate-mobile-assets.mjs   # rebuild resources/
npm run cap:assets                        # fan out to all densities
```

## Known follow-ups

- **Push notifications.** Not wired yet. Add `@capacitor/push-notifications`
  plus APNs/FCM credentials when needed.
- **App Store Guideline 4.2 (minimum functionality).** Pure website wrappers can
  be rejected. We already add native splash, status bar, back-button and external
  link handling; add push notifications and native share before submission if a
  reviewer pushes back.

## OAuth setup (Google + Apple sign-in)

"Continue with Google" and "Continue with Apple" appear on the login screen on
**web, iOS and Android**. The flows differ by platform (gated on
`Capacitor.isNativePlatform()`):

- **Web** — `supabase.auth.signInWithOAuth({ provider, redirectTo:
<origin>/api/auth/callback })`. The existing PKCE callback route runs
  `exchangeCodeForSession` and the profile-based redirect.
- **Native (iOS/Android)** — `@capgo/capacitor-social-login` returns a provider
  **id-token**, which we exchange with `supabase.auth.signInWithIdToken(...)` on
  the cookie-backed browser client, then hard-navigate to `/api/auth/post-login`.
  Google's OAuth screen is blocked inside WebViews, so the id-token flow is
  mandatory on device.

Implementation: `lib/auth/oauth.ts` (branching + result mapping),
`lib/capacitor/platform.ts` (native detection),
`components/auth/oauth-buttons.tsx` (branded buttons),
`SocialLogin.initialize(...)` reads the `NEXT_PUBLIC_*` client IDs below.

### Account linking

Accounts that share the **same confirmed email** are auto-linked by Supabase
(default behaviour — an email/password user who later signs in with Google/Apple
on that email ends up as one account). No manual link screen; `enable_manual_linking`
stays `false` in `supabase/config.toml`.

### Placeholders you MUST fill before native builds work

These are intentionally left as placeholders in the repo:

| Where                    | Placeholder                                                                                  | Replace with                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env (Vercel)             | `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`                                                           | Google **Web application** OAuth client ID (also the iOS token audience)                                                                           |
| Env (Vercel)             | `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`                                                           | Google **iOS** OAuth client ID                                                                                                                     |
| Env (Vercel)             | `NEXT_PUBLIC_APPLE_SERVICES_ID`                                                              | Apple **Services ID** (Android Apple sign-in only)                                                                                                 |
| Env (Vercel)             | `NEXT_PUBLIC_APPLE_REDIRECT_URL`                                                             | Server callback for Android Apple, e.g. `https://<ref>.supabase.co/auth/v1/callback`                                                               |
| `ios/App/App/Info.plist` | `CFBundleURLTypes` → `CFBundleURLSchemes` (✅ restored with the real reversed iOS client ID) | Done — needs an iOS **rebuild + re-upload** to take effect in the store binary                                                                     |
| Google Cloud Console     | Android SHA-1 fingerprints                                                                   | Debug (`./gradlew signingReport`), release, and Play App Signing SHA-1s registered on an **Android** OAuth client with package `by.playtennis.app` |

### Google Cloud Console

1. Create OAuth clients in **one** project: a **Web application** client, an
   **iOS** client (bundle id `by.playtennis.app`), and an **Android** client per
   signing certificate (debug + release + Play App Signing) with package
   `by.playtennis.app` and its SHA-1. Credential Manager needs the **Web** client
   ID as the token audience — do **not** put the Android client ID in
   `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. In the **Supabase dashboard → Auth → Providers → Google**: enable it, paste the
   Web client ID + secret, and add the **iOS** client ID to _Authorized Client IDs_
   so `signInWithIdToken` accepts iOS-issued tokens.

#### PlayTennis.by clients (project `playtennis-502214`)

Client IDs are not secret (they ship inside the app). The Web client **secret**
lives only in `.secrets/google-web-client-secret.txt` (gitignored) and the
Supabase dashboard — never commit it.

| Client type             | Client ID                                                                   | Used for                                                                                     |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Web application**     | `1005010581419-d0vrmm3mc85uv563mvj5d065ahg5nero.apps.googleusercontent.com` | Supabase Google provider Client ID + `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` (iOS token audience) |
| **iOS**                 | `1005010581419-oooj9kskal3jr6t173f5ukp7get5nm8l.apps.googleusercontent.com` | `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` + Supabase _Authorized Client IDs_                        |
| **Desktop (installed)** | `1005010581419-8siinqlb2ktac3lpv9qug820qg40o9e1.apps.googleusercontent.com` | Not used by web/iOS/Supabase (kept for CLI/desktop tooling only)                             |

- iOS reversed client ID (Info.plist `CFBundleURLSchemes`):
  `com.googleusercontent.apps.1005010581419-oooj9kskal3jr6t173f5ukp7get5nm8l`
- Web client **Authorized redirect URI** must include the Supabase callback:
  `https://uvjvvkjodomesycdlydr.supabase.co/auth/v1/callback` (already present in
  the downloaded Web client JSON).
- **Android** client + SHA-1 fingerprints are still pending (not among the current
  credential files) — required before native Google sign-in works on Android.

Once `SUPABASE_ACCESS_TOKEN` (sbp\_…) is available, the provider can be applied in
one command instead of the dashboard:

```bash
SUPABASE_ACCESS_TOKEN=sbp_… node scripts/configure-google-supabase-auth.mjs
```

### Apple Developer

1. Enable the **Sign in with Apple** capability for App ID `by.playtennis.app`
   (the entitlement is committed at `ios/App/App/App.entitlements`; add the
   capability to the target in Xcode so the provisioning profile carries it).
2. For **Android** Apple sign-in, create a **Services ID**, a Sign in with Apple
   **Key** (Team ID + Key ID + `.p8`), and set the return URL to your Supabase
   auth callback. Put the Services ID in `NEXT_PUBLIC_APPLE_SERVICES_ID` and the
   callback in `NEXT_PUBLIC_APPLE_REDIRECT_URL`.
3. In the **Supabase dashboard → Auth → Providers → Apple**: enable it, add the
   Services ID + generated client secret, and ensure both the app **bundle id**
   and the **Services ID** are accepted audiences for the id-token flow.

### After changing native config

```bash
npm run cap:sync   # copies capacitor.config.ts + installs the plugin into ios/ & android/
```

Native OAuth cannot be validated locally without Apple/Google developer accounts
and signed builds; web OAuth can be tested against a Supabase project with the
providers enabled.
