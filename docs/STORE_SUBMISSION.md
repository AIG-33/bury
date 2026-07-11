# Store submission — App Store & Google Play

Everything needed to publish **PlayTennis.by** to the Apple App Store and Google
Play. The app is a Capacitor hosted-URL shell around `https://www.playtennis.by`
(see [`MOBILE.md`](./MOBILE.md)). This doc covers what's already prepared in the
repo and the **manual web-console steps only you can do** (they need Apple/Google
accounts, 2FA and signing keys — none of that lives in git).

- **App name (display):** PlayTennis.by
- **Bundle ID / applicationId:** `by.playtennis.app`
- **Marketing version:** `1.0.0` · **Build / versionCode:** `1`
- **Primary language:** Russian · **Also:** English
- **Price:** Free · **Category:** Sports (secondary: Lifestyle)
- **Privacy policy:** `https://www.playtennis.by/ru/privacy` · `…/en/privacy`
- **Support URL:** `https://www.playtennis.by/ru/support` · `…/en/support`
- **Marketing URL:** `https://www.playtennis.by`

> ⚠️ **Placeholders to replace before / during submission**
>
> - `hello@playtennis.by` — the support / data-deletion email used on the
>   privacy & support pages and in the store contact fields. **Make sure this
>   inbox actually exists and is monitored** (Apple/Google email it). Change it
>   in `messages/{ru,en}/app.json` (`privacyPage.contact_email`,
>   `supportPage.email`) if you use a different address.
> - iOS Google URL scheme `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID` in
>   `ios/App/App/Info.plist` — see [`MOBILE.md` → OAuth setup](./MOBILE.md#oauth-setup-google--apple-sign-in).
> - Fastlane credentials (ENV only — see below). No secrets are committed.

---

## 1. What's already prepared in the repo

| Area                  | File(s)                                                                                   | State                                |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| iOS display name      | `ios/App/App/Info.plist` → `CFBundleDisplayName`                                          | `PlayTennis.by`                      |
| iOS version           | `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` | `1.0.0` / `1`                        |
| iOS export-compliance | `Info.plist` → `ITSAppUsesNonExemptEncryption`                                            | `false`                              |
| iOS usage strings     | `Info.plist` (camera / photos / location-when-in-use)                                     | English, review-safe                 |
| Android id + version  | `android/app/build.gradle`                                                                | `by.playtennis.app`, `1` / `1.0.0`   |
| Android name          | `android/app/src/main/res/values/strings.xml`                                             | `PlayTennis.by`                      |
| Android permissions   | `android/app/src/main/AndroidManifest.xml`                                                | only `INTERNET`                      |
| Capacitor config      | `capacitor.config.ts`                                                                     | `appName "PlayTennis.by"`            |
| App Store listing     | `fastlane/metadata/{ru,en-US}/…`                                                          | ru + en copy written                 |
| Play listing          | `fastlane/metadata/android/{ru-RU,en-US}/…`                                               | ru + en copy written                 |
| Fastlane lanes        | `fastlane/Fastfile`, `fastlane/Appfile`                                                   | `deliver` / `supply` skeletons       |
| Privacy page          | `app/[locale]/(public)/privacy/page.tsx`                                                  | live at `/ru/privacy`, `/en/privacy` |
| Support page          | `app/[locale]/(public)/support/page.tsx`                                                  | live at `/ru/support`, `/en/support` |

### iOS usage-description strings — trim before submission

`Info.plist` currently declares three purpose strings. Because this is a WebView
shell, a prompt only appears if the **site** requests that capability. Keep only
what the site can actually trigger, and **delete the rest** so App Review doesn't
ask why an unused permission is declared:

| Key                                   | Keep if…                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| `NSCameraUsageDescription`            | avatar capture uses the camera (`<input capture>` / getUserMedia) |
| `NSPhotoLibraryUsageDescription`      | avatar upload lets users pick an existing photo                   |
| `NSLocationWhenInUseUsageDescription` | the maps / "near me" features request geolocation                 |

If none of these are triggered by the site, remove all three. Android currently
declares **only `INTERNET`**, which is correct for a pure WebView shell — do not
add runtime permissions unless a feature needs them.

---

## 2. App privacy — Apple "App Privacy" answers

Fill these under **App Store Connect → your app → App Privacy**. Based on actual
usage: Supabase auth, PostHog product analytics, **no third-party ad tracking,
no data sold**. "Linked to you" = tied to the account/identity.

| Data type                         | Collected?                                         | Linked to user? | Used for tracking? | Purpose                            |
| --------------------------------- | -------------------------------------------------- | --------------- | ------------------ | ---------------------------------- |
| Email address                     | Yes                                                | Yes             | No                 | App Functionality, Account         |
| Name                              | Yes                                                | Yes             | No                 | App Functionality                  |
| Photos (avatar / user content)    | Yes (if uploaded)                                  | Yes             | No                 | App Functionality                  |
| Coarse/precise Location           | Yes (only if the maps feature is used & permitted) | Yes             | No                 | App Functionality                  |
| User ID                           | Yes                                                | Yes             | No                 | App Functionality, Analytics       |
| Product interaction / usage data  | Yes                                                | Yes¹            | No                 | Analytics, Product Personalization |
| Crash/diagnostics                 | Only if you enable Sentry                          | Yes/No          | No                 | App Functionality                  |
| Purchases / financial info        | No                                                 | —               | —                  | —                                  |
| Contacts / browsing history / ads | No                                                 | —               | —                  | —                                  |

¹ PostHog events are associated with the signed-in user id → mark "linked".
Nothing is used for **Tracking** (no cross-app/website ad tracking, no data
broker sharing), so answer **No** to the App Tracking Transparency question and
do **not** add `NSUserTrackingUsageDescription`.

- **Privacy policy URL (app level):** `https://www.playtennis.by/ru/privacy`
- If you disable location in the WebView, mark Location as **not collected**.

---

## 3. Data safety — Google Play answers

Fill under **Play Console → App content → Data safety**. Mirror of the Apple map.

**Data collected (not "shared" — processors act on our behalf):**

| Category → type                      | Collected              | Processed ephemerally? | Optional?            | Purpose                               |
| ------------------------------------ | ---------------------- | ---------------------- | -------------------- | ------------------------------------- |
| Personal info → Email address        | Yes                    | No                     | Required for account | Account management, App functionality |
| Personal info → Name                 | Yes                    | No                     | Optional             | App functionality                     |
| Personal info → User IDs             | Yes                    | No                     | Required             | Account management, Analytics         |
| Photos and videos → Photos           | Yes (avatar)           | No                     | Optional             | App functionality                     |
| Location → Approximate/Precise       | Yes (if maps used)     | No                     | Optional             | App functionality                     |
| App activity → Product interaction   | Yes                    | No                     | Optional             | Analytics                             |
| App activity → In-app search history | No                     | —                      | —                    | —                                     |
| App info & performance → Crash logs  | Only if Sentry enabled | —                      | Optional             | App functionality, Analytics          |

**Answers to the yes/no questions:**

- Is data **encrypted in transit**? **Yes** (HTTPS/TLS everywhere).
- Can users **request deletion**? **Yes** — via `hello@playtennis.by` (documented
  on the support & privacy pages).
- Is any data **shared with third parties**? **No** in the Play sense (Supabase,
  Vercel, PostHog, Resend are _processors_, not third-party recipients selling
  data). Do not sell data.
- Do you use data for **advertising or third-party tracking**? **No.**
- **Data types collected** must match the Apple answers above.

---

## 4. Content rating

- **App Store age rating:** expected **4+**. In App Store Connect answer **None**
  to all content descriptors (no violence, sexual content, gambling, drugs, etc.).
  Note: the app has **user-generated content** (profiles, reviews, tournament
  names). Apple requires (Guideline 1.2): a way to **report/flag** content, block
  users, and a moderation/EULA. We already gate coach reviews behind a confirmed
  lesson; ensure a report/contact path exists (the support page + email covers
  the contact requirement).
- **Google Play content rating questionnaire (IARC):** category _Social /
  Reference or Sports_. Answer **No** to violence, sexual, gambling, controlled
  substances. Declare **user interaction** and **user-generated content**
  (players can create tournaments and reviews). Expected result: **Everyone / PEGI 3**.

---

## 5. Sign in with Apple — mandatory

Because the login screen offers **Continue with Google** (a third-party social
login), Apple **App Store Guideline 4.8** requires **Sign in with Apple** to be
offered as an equivalent option on iOS. It already is (see
[`MOBILE.md` → OAuth setup](./MOBILE.md#oauth-setup-google--apple-sign-in);
`components/auth/oauth-buttons.tsx`, entitlement at `ios/App/App/App.entitlements`).

You must:

1. Enable the **Sign in with Apple** capability on the App ID `by.playtennis.app`
   in the Apple Developer portal.
2. Add the **Sign in with Apple** capability to the app target in Xcode so the
   provisioning profile carries the entitlement.
3. Configure the Apple provider in Supabase (see `MOBILE.md`).

---

## 6. Export compliance (encryption)

The app only uses standard HTTPS/TLS — **exempt** encryption. We set
`ITSAppUsesNonExemptEncryption = false` in `ios/App/App/Info.plist`, so App Store
Connect won't ask the export question on every build.

- If you ever add **non-exempt** cryptography (custom/proprietary algorithms,
  not just calling the OS TLS/crypto), change this to `true`, answer the export
  questions, and file the annual self-classification report with the US BIS.
- Android has no equivalent flag; the same "standard TLS only" reasoning applies.

---

## 7. Fastlane — how the listing lanes work

Nothing uploads automatically. You build the binaries by hand (Xcode / Android
Studio, per `MOBILE.md`), then a human runs a lane to push listings. Credentials
come from **environment variables only**.

```bash
# Install once
brew install fastlane   # or: gem install fastlane

# --- iOS (App Store Connect API key auth) ---
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ASC_KEY_CONTENT="$(cat AuthKey_XXXXXXXXXX.p8)"   # or base64 + ASC_KEY_CONTENT_B64=true
export FASTLANE_TEAM_ID=XXXXXXXXXX

fastlane ios metadata_check      # dry-run: validate listing copy
fastlane ios upload_metadata     # push text listing (no binary, no submit)
IPA_PATH=./build/PlayTennis.ipa fastlane ios release   # upload an exported .ipa + metadata

# --- Android (Play service-account JSON, "Release manager") ---
export SUPPLY_JSON_KEY=./fastlane/play-service-account.json   # gitignored!
fastlane android metadata_check
fastlane android upload_metadata
AAB_PATH=./android/app/build/outputs/bundle/release/app-release.aab \
  PLAY_TRACK=internal fastlane android release
```

- Store copy lives in `fastlane/metadata/**` — edit the `.txt` files there.
- Screenshots/graphics are **not** committed — see `fastlane/screenshots/README.md`.
- **Add `fastlane/play-service-account.json` and any `.p8`/keystore to
  `.gitignore`.** Never commit them.

---

## 8. Master manual checklist (web consoles — repo can't do these)

Do these in order. Cross-referenced files are prepared in the repo.

### A. Apple Developer portal (developer.apple.com)

1. [ ] Register an **explicit App ID** `by.playtennis.app` (not wildcard).
2. [ ] Enable the **Sign in with Apple** capability on that App ID.
3. [ ] Create the OAuth artifacts for Apple sign-in (Services ID, Key/`.p8`) — see
       [`MOBILE.md` → Apple Developer](./MOBILE.md#apple-developer).
4. [ ] Create an **App Store Connect API key** (Users and Access → Integrations)
       for Fastlane, or plan to sign in interactively.

### B. Google Cloud + Supabase (OAuth) — do NOT duplicate here

5. [ ] Follow [`MOBILE.md` → OAuth setup](./MOBILE.md#oauth-setup-google--apple-sign-in)
       to create the Google **Web / iOS / Android** OAuth clients and enable the
       Google + Apple providers in Supabase.
6. [ ] Put the **reversed iOS client ID** into `ios/App/App/Info.plist`
       (`com.googleusercontent.apps.…`), then `npm run cap:sync`.
7. [ ] Set the `NEXT_PUBLIC_GOOGLE_*` / `NEXT_PUBLIC_APPLE_*` env vars on Vercel.

### C. App Store Connect (appstoreconnect.apple.com)

8. [ ] **Create the app**: platform iOS, name **PlayTennis** (or "PlayTennis.by"
       if available), primary language **Russian**, bundle ID `by.playtennis.app`,
       SKU e.g. `playtennis-ios`.
9. [ ] Add the **English (U.S.)** localization.
10. [ ] Fill the listing (or run `fastlane ios upload_metadata`): name, subtitle,
        description, keywords, promo text, what's-new, support/marketing URLs.
11. [ ] Upload **screenshots** for the required device sizes
        (`fastlane/screenshots/README.md`).
12. [ ] Complete **App Privacy** (section 2) and set the privacy policy URL.
13. [ ] Set **Pricing** = Free, choose availability (Belarus + wherever you want).
14. [ ] Set **age rating** = 4+ (section 4); confirm the UGC report/contact path.
15. [ ] Answer **export compliance** (already `false` in Info.plist → auto).

### D. Xcode (build & upload iOS)

16. [ ] Open with `npm run cap:ios`. Set **Team** + signing under _Signing &
        Capabilities_; confirm bundle id `by.playtennis.app`.
17. [ ] Add the **Sign in with Apple** capability to the target.
18. [ ] Confirm `MARKETING_VERSION = 1.0.0`, `CURRENT_PROJECT_VERSION = 1`.
19. [ ] _Product → Archive → Distribute App → App Store Connect_. (Or export an
        `.ipa` and `fastlane ios release`.)
20. [ ] Attach the build to the version and **Submit for Review**.

### E. Google Play Console (play.google.com/console)

21. [ ] **Create app**: name "PlayTennis.by", default language **Russian**, type
        App, Free.
22. [ ] Set up **Play App Signing** (let Google manage the app signing key; you
        keep an upload key). Register the app-signing + upload SHA-1s on the
        Android OAuth client (step 5).
23. [ ] Fill the **store listing** (or `fastlane android upload_metadata`): title,
        short + full description (ru + en), then upload **icon 512×512**,
        **feature graphic 1024×500**, phone screenshots.
24. [ ] Complete **Data safety** (section 3) and **content rating** (section 4).
25. [ ] Set the **privacy policy URL**: `https://www.playtennis.by/ru/privacy`.
26. [ ] Build a **signed `.aab`** in Android Studio (`npm run cap:android`), upload
        to a track (Internal testing → Production), roll out.

### F. Both — before you hit submit

27. [ ] Trim unused iOS usage strings (section 1).
28. [ ] Verify `hello@playtennis.by` (or your chosen address) receives mail.
29. [ ] Sanity-check that `https://www.playtennis.by/{ru,en}/privacy` and
        `/support` load in a browser (they ship with this change once deployed).
30. [ ] Because this is a website wrapper, be ready for **Guideline 4.2**
        (minimum functionality) — the native splash/status-bar/back/external-link
        glue is in place; add push/native share if a reviewer pushes back
        (see `MOBILE.md` → Known follow-ups).
