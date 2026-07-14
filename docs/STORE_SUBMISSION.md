# Store submission — App Store & Google Play

Everything needed to publish **PlayTennis.by** to the Apple App Store and Google
Play. The app is a Capacitor hosted-URL shell around `https://www.playtennis.by`
(see [`MOBILE.md`](./MOBILE.md)). This doc covers what's already prepared in the
repo and the **manual web-console steps only you can do** (they need Apple/Google
accounts, 2FA and signing keys — none of that lives in git).

- **App name (display):** PlayTennis.by
- **Bundle ID / applicationId:** `by.playtennis.app`
- **Marketing version:** `1.1.0` · **Build / versionCode:** `6` (see §10 Release log)
- **Primary language:** Russian · **Also:** English
- **Price:** Free · **Category:** Sports (secondary: Lifestyle)
- **Privacy policy:** `https://www.playtennis.by/ru/privacy` · `…/en/privacy`
- **Support URL:** `https://www.playtennis.by/ru/support` · `…/en/support`
- **Account deletion URL:** `https://www.playtennis.by/ru/account-deletion` ·
  `…/en/account-deletion`
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

| Area                  | File(s)                                                                                   | State                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| iOS display name      | `ios/App/App/Info.plist` → `CFBundleDisplayName`                                          | `PlayTennis.by`                                        |
| iOS version           | `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` | `1.0.0` / `1`                                          |
| iOS export-compliance | `Info.plist` → `ITSAppUsesNonExemptEncryption`                                            | `false`                                                |
| iOS usage strings     | `Info.plist` (camera / photos / location-when-in-use)                                     | English, review-safe                                   |
| Android id + version  | `android/app/build.gradle`                                                                | `by.playtennis.app`, `1` / `1.0.0`                     |
| Android name          | `android/app/src/main/res/values/strings.xml`                                             | `PlayTennis.by`                                        |
| Android permissions   | `android/app/src/main/AndroidManifest.xml`                                                | only `INTERNET`                                        |
| Capacitor config      | `capacitor.config.ts`                                                                     | `appName "PlayTennis.by"`                              |
| App Store listing     | `fastlane/metadata/{ru,en-US}/…`                                                          | ru + en copy written                                   |
| Play listing          | `fastlane/metadata/android/{ru-RU,en-US}/…`                                               | ru + en copy written                                   |
| Fastlane lanes        | `fastlane/Fastfile`, `fastlane/Appfile`                                                   | `deliver` / `supply` skeletons                         |
| Privacy page          | `app/[locale]/(public)/privacy/page.tsx`                                                  | live at `/ru/privacy`, `/en/privacy`                   |
| Support page          | `app/[locale]/(public)/support/page.tsx`                                                  | live at `/ru/support`, `/en/support`                   |
| Account deletion page | `app/[locale]/(public)/account-deletion/page.tsx`                                         | live at `/ru/account-deletion`, `/en/account-deletion` |

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
  on the account deletion, support & privacy pages).
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
# SUPPLY_JSON_KEY defaults to ./fastlane/play-service-account.json (gitignored) —
# already in place, no export needed.
fastlane android metadata_check
```

### Android — exact commands once the app exists in Play Console

The app **must first be created by hand** in the Play Console UI (name
"PlayTennis.by", default language Russian, App, Free) — the Play API cannot
create apps. After that, run from the repo root:

```bash
# 1. Upload the signed release bundle to the internal track as a draft release
AAB_PATH=./build/PlayTennis-1.0.0-vc1.aab PLAY_TRACK=internal PLAY_RELEASE_STATUS=draft fastlane android release

# 2. Push the full store listing: text (ru-RU + en-US), icon, feature graphic, screenshots
UPLOAD_IMAGES=true UPLOAD_SCREENSHOTS=true fastlane android upload_metadata
```

Until the app exists, both commands fail with
`Google Api Error: … Package not found: by.playtennis.app` (or "caller does not
have permission") — that is expected and confirms the service-account auth
itself works.

- Store copy lives in `fastlane/metadata/**` — edit the `.txt` files there.
- App Review contact info lives in `fastlane/metadata/review_information/`
  (first/last name, email, phone, reviewer notes) — deliver uploads it with the
  metadata.
- Screenshots/graphics are **not** committed — see `fastlane/screenshots/README.md`.
- **Add `fastlane/play-service-account.json` and any `.p8`/keystore to
  `.gitignore`.** Never commit them.

### Android release signing (upload key)

The upload keystore lives at `android/keystore/playtennis-upload.jks` with its
credentials in `android/keystore.properties` (both **gitignored** — back them up
somewhere safe, e.g. a password manager). `android/app/build.gradle` picks up
`keystore.properties` automatically, so a signed release bundle is just:

```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

If you lose the keystore before the first Play upload, generate a new one; after
the first upload you must request an upload-key reset in the Play Console.

### iOS App Privacy JSON

`fastlane/app_privacy_details.json` mirrors section 2 of this doc. It can be
pushed with `fastlane run upload_app_privacy_details_to_app_store` — note that
action needs interactive Apple ID login (no API-key support), otherwise answer
the questionnaire in App Store Connect by hand.

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
29. [ ] Sanity-check that `https://www.playtennis.by/{ru,en}/privacy`,
        `/support` and `/account-deletion` load in a browser (they ship with
        this change once deployed).
30. [ ] Because this is a website wrapper, be ready for **Guideline 4.2**
        (minimum functionality) — the native splash/status-bar/back/external-link
        glue is in place; add push/native share if a reviewer pushes back
        (see `MOBILE.md` → Known follow-ups).

---

## 9. Review rejections & replies

Log of App Review rejections and the replies we sent, so the same answers can
be reused (Google Play asks near-identical questions in its policy forms).

### 2026-07-13 — iOS 1.0.0 (1) rejected: Guideline 2.1 + 2.1(b) (Information Needed)

- **Submission ID:** `63dcfdc1-c267-458e-80f8-c8025792d532` · reviewed on iPad
  Air 11-inch (M3).
- **Status:** rejected as _2.1.0 Performance: App Completeness_ — **not** a
  policy violation; the reviewer asked questions and review resumes once we
  reply **in App Store Connect** (no new binary needed).
- **What they asked:**
  - **2.1 (referencing Guideline 1.3, kids/data):** third-party analytics?
    third-party advertising? data shared with third parties? any other
    user/device data collected and why?
  - **2.1(b) (business model):** who uses the paid content? where is it
    purchased? what previously-purchased content is accessible? what is
    unlocked without In-App Purchase?

#### Facts the reply is based on (verified in the repo at reply time)

- **Analytics:** PostHog only (`posthog-js`, wired via
  `components/analytics/posthog-provider.tsx` + `lib/analytics/posthog-client.ts`).
  EU cloud host (`eu.posthog.com`), `autocapture` **off**, session recording
  **off**, pageviews sent manually on route change plus one custom UI event
  (`players.guest_propose_clicked`). **`posthog.identify()` is never called**
  → events carry a random client id and are _not_ tied to the account.
  Active only when `NEXT_PUBLIC_POSTHOG_KEY` is set (Vercel env).
- **Crash reporting:** none. `SENTRY_DSN` exists in `.env.example` as a
  placeholder, but no Sentry SDK is installed and no init code exists.
- **Advertising:** none. No ad SDKs, no ad networks, no tracking for ads.
- **Payments:** none in-app. No payment SDK (no Stripe/bePaid/etc.), no IAP.
  Coach slots have an informational `price_byn`; tournaments an informational
  `entry_fee_byn`. Booking inserts `paid_status: "unpaid"`; the coach flips
  paid/unpaid/comped **manually** — bookkeeping only. All actual payment is
  offline, in person, for real-world services (lessons on a court, amateur
  tournament entry) — Guideline 3.1.5(a) territory, IAP not required.
- **Data collected:** account email + name (email magic-link or Google/Apple
  sign-in via Supabase Auth), optional avatar photo, city/district, skill
  level, gameplay data (matches, ratings, tournaments, reviews), optional
  geolocation (foreground only, for the courts map), optional Telegram link,
  optional WhatsApp number (coaches). Stored in Supabase (managed Postgres);
  processors: Supabase, Vercel, PostHog (EU), Resend, Telegram (opt-in),
  Google/Apple (sign-in only). Nothing sold or shared for third-party
  purposes.
- **Kids angle (the Guideline 1.3 reference):** the app is a platform for
  **adult amateur players**, is **not** in the Kids Category, and the privacy
  policy states it is not intended for children under 13. The 1.3 reference
  is almost certainly triggered by the 4+ age rating, hence the explicit
  "not directed at children" paragraph in the reply.

#### Reply sent to Apple (paste into App Store Connect → App Review messages)

> Hello,
>
> Thank you for reviewing PlayTennis.by. Please find our answers below.
>
> First, some context relevant to Guideline 1.3: PlayTennis.by is a community
> platform for adult amateur tennis players in Belarus — finding hitting
> partners, viewing coaches' schedules, and organizing amateur tournaments
> with a club rating. The app is not directed at children, is not in the Kids
> Category, and our Privacy Policy (https://www.playtennis.by/en/privacy)
> states the platform is not intended for children under 13. We do not
> knowingly collect data from children.
>
> **Guideline 2.1 — questions:**
>
> 1. **Third-party analytics:** Yes, we use one product-analytics tool,
>    PostHog (PostHog Cloud EU, hosted in the European Union). It is
>    configured conservatively: autocapture is disabled, session recording is
>    disabled, and no device advertising identifiers are read. The only data
>    collected are screen/page views and a small number of predefined UI
>    events (for example, a signed-out visitor tapping "Propose a match").
>    Events are pseudonymous — they carry a random client-generated
>    identifier and are not linked to the user's name or email (we never call
>    the analytics "identify" function). The sole purpose is understanding
>    aggregate product usage to improve the app.
> 2. **Third-party advertising:** No. The app contains no advertising of any
>    kind — no ad SDKs, no ad networks, no ad tracking. (Not applicable: ad
>    network policies for kids apps.)
> 3. **Data sharing with third parties:** We do not sell user data and do not
>    share it with any third party for their own purposes. Data is handled
>    only by service providers acting as processors on our instructions:
>    Supabase (authentication and our primary database, where user data is
>    stored), Vercel (hosting of the web application the app displays),
>    PostHog (the pseudonymous analytics described above, stored in the EU),
>    Resend (delivery of transactional emails such as booking confirmations),
>    Telegram (only if a user voluntarily links our optional Telegram bot for
>    notifications), and Google/Apple (only when the user chooses "Sign in
>    with Google/Apple"). All processing is solely to operate the service.
> 4. **Other data collected:** Only what users provide to use the service:
>    account data (email address and name, via email sign-in or Sign in with
>    Google/Apple), optional profile data (avatar photo, city/district,
>    self-assessed skill level), gameplay data the user creates (match
>    results, rating, tournament participation, coach reviews), and — only
>    with the user's explicit permission — foreground geolocation used to
>    show nearby courts and coaches on a map. We collect no device data
>    beyond standard web-server logs. All of this is used exclusively for app
>    functionality; none of it is used for advertising or marketing, and none
>    of it is sold or shared as described above.
>
> **Guideline 2.1(b) — business model:**
>
> The app is completely free. It contains no paid digital content, no
> subscriptions, no in-app purchases, and no payment processing of any kind
> (no payment SDK is integrated).
>
> 1. **Who are the users that will use the paid content and services?** There
>    is no paid content or paid digital service in the app. Every app feature
>    (profiles, partner search, ratings, tournaments, coach schedules) is
>    free for all users. The only prices displayed are informational prices
>    for real-world, in-person services: a coach's lesson price or an amateur
>    tournament entry fee (in Belarusian rubles), used by adult amateur
>    players who book a lesson or enter a tournament.
> 2. **Where can users purchase the content and services accessible in the
>    app?** Nothing can be purchased inside the app. Booking a lesson or
>    registering for a tournament only reserves a spot. Any payment for these
>    physical, in-person services happens entirely outside the app — in
>    person at the tennis venue (typically cash or a direct transfer to the
>    coach or organizer). The coach can later mark a booking "paid" or
>    "unpaid" in their schedule, which is a manual bookkeeping status, not a
>    transaction.
> 3. **What types of previously purchased content and services can a user
>    access in the app?** None. There is no purchasable digital content or
>    service, so there is nothing previously purchased to access or restore.
> 4. **What paid content, subscriptions, or features are unlocked within the
>    app without using In-App Purchase?** None. No feature is locked behind a
>    payment. The only paid items connected to the app are real-world
>    person-to-person services consumed outside the app (tennis lessons,
>    amateur tournament participation), which per Guideline 3.1.5(a) may be
>    paid by methods other than In-App Purchase — and in our case the app
>    does not process those payments at all.
>
> Please let us know if any further detail would help. Thank you!

#### App Store Connect follow-ups (do together with the reply)

- [ ] **Age rating:** confirm the rating questionnaire result and that the
      app is **not** enrolled in the Kids Category / "Made for Kids". The app
      targets adults; if the questionnaire allows, a 13+ style rating is a
      safe fit with the privacy policy's "not for children under 13" — at
      minimum keep 4+ with Kids Category **off**.
- [ ] **App Privacy — remove Crash Data.** `fastlane/app_privacy_details.json`
      and section 2 above declare crash/diagnostics data, but no crash
      reporter (Sentry) is integrated. Declaring data we don't collect
      invites exactly these questions — remove `CRASH_DATA` from the App
      Privacy answers (and from the JSON) until Sentry actually ships.
- [ ] **App Privacy — analytics "linked to you".** Section 2 marks product
      interaction and User ID as _linked_ to identity, but the code never
      calls `posthog.identify()` — analytics is pseudonymous. Either align
      the labels (Product interaction → **not linked**, drop the Analytics
      purpose from User ID) to match the reply above, or start calling
      `identify()` deliberately; don't leave the two contradicting.
- [ ] **Privacy policy URL** set at the app level
      (`https://www.playtennis.by/ru/privacy`) — the reply links the `/en/`
      version; both must load.
- [ ] Reply is sent as a **message in App Store Connect** on the rejected
      1.0.0 (1) submission — no new build is required unless the reviewer
      asks for one.

### 2026-07-14 — iOS 1.0.0 (1): automated "crashed on launch" message

After the 2.1 reply, App Review sent an automated message that 1.0.0 (1)
**crashed on launch**. That binary was months old; instead of debugging it we
replaced it with build 1.1.0 (5) — see the §10 release-log entry, which
includes the crash check and the submission swap (old build detached, version
renamed to 1.1.0, build 5 attached, resubmitted with a reviewer note).

### 2026-07-14 — iOS 1.1.0 (5) rejected: Guideline 1.3 (Kids Category) + 2.1(a) (Sign in with Apple error)

- **Submission ID:** `198e10f7-8248-4790-a757-2a44ae684e78` · reviewed on iPad
  Air 11-inch (M3), iPadOS 26.5.2.
- **Issue 1 — Guideline 1.3:** "you selected the Kids Category for the app, but
  the app does not appear designed for kids aged 11 and under… resubmit the app
  without the Kids category designation." The age-rating questionnaire had
  `kidsAgeBand = NINE_TO_ELEVEN` set (a leftover from an age-rating edit), which
  enrolls the app in the Kids Category. **Fixed via the ASC API** (PATCH
  `ageRatingDeclarations` with `kidsAgeBand: null`); the rating stays **4+**
  with the Kids Category off, matching §4 and the "not directed at children"
  position from the 2026-07-13 reply.
- **Issue 2 — Guideline 2.1(a):** "the app displayed an error message when we
  attempted to Sign in with Apple." Root cause found in `lib/auth/oauth.ts`:
  `SocialLogin.initialize()` passed the Supabase callback
  (`…supabase.co/auth/v1/callback`) as `apple.redirectUrl` on **all** platforms.
  On iOS a non-empty `redirectUrl` switches `@capgo/capacitor-social-login`
  into the Android web flow — after the user authorizes, the plugin POSTs the
  authorization code to that URL and expects a `success=true` redirect back.
  Supabase answers that POST with `bad_oauth_callback` (no `success` param), so
  the plugin rejected with "Success path component not provided." and the app
  showed the sign-in error — always, on every iOS device, right after a
  successful Apple authorization. Per the plugin docs iOS must get an **empty**
  `redirectUrl`; then the identityToken is returned directly and exchanged via
  `supabase.auth.signInWithIdToken` (audience `by.playtennis.app` is registered
  as an additional client ID on the Supabase Apple provider). Fix is
  web-layer (deployed with the merge to `main`), so it applies to any installed
  binary; build 6 was still uploaded to give the reviewer a fresh build to test.
  Verified on iPad Air 11-inch and iPhone 17 Pro simulators: tapping "Apple" now
  reaches the native `ASAuthorizationController` (simulator without an Apple ID
  session fails with AuthenticationServices error 1000 — the expected simulator
  limitation, proving the broken redirect path is gone; full end-to-end sign-in
  needs a device with an Apple ID).

---

## 10. Release log

### 2026-07-15 — 1.1.0 (iOS build 6 / Android versionCode 6)

Response to the 2026-07-14 rejection of 1.1.0 (5) — see §9. Two changes:
Kids Category removed in App Store Connect (via the ASC API,
`kidsAgeBand: null` on the age-rating declaration; rating stays 4+), and the
iOS Sign in with Apple bug fixed (`lib/auth/oauth.ts`: empty `apple.redirectUrl`
on iOS so the plugin returns the id-token directly instead of POSTing the
auth code to the Supabase callback — see §9 for the full root cause).

**iOS:** archived `build/App-1.1.0-6.xcarchive` (`xcodebuild`, team
`VH4L4R7PKW`, ASC API key `TRS8NZAGX5`), exported with
`build/ExportOptions.plist`, uploaded via `xcrun altool` (delivery
`646f11ec-c03b-4227-9bef-7be14e9de06c`). Build 6 attached to version 1.1.0,
reviewer note updated (Kids Category removed + Apple sign-in root cause and
fix), review submission resubmitted (the `198e10f7-…` submission was reused /
recreated as needed — final state in §9).

**Android:** `./gradlew bundleRelease` → `build/PlayTennis-1.1.0-vc6.aab`
(versionCode 6 verified with bundletool), uploaded to the **internal** track
via `fastlane android release` (changelogs `6.txt`, ru-RU + en-US), then
promoted to **production** (`supply` with `track_promote_to: production`).

**Verification before upload:** Release simulator build + prod web bundle on
iPad Air 11-inch (M4) and iPhone 17 Pro (iOS 26.4): Apple sign-in now invokes
the native `ASAuthorizationController` (simulator-only error 1000 without an
Apple ID session; the previous "Success path component not provided." plugin
error is gone). `npm run typecheck`, `npm run lint`, `prettier --check` clean.

### 2026-07-14 — 1.1.0 (iOS build 5 / Android versionCode 5)

Replaces the rejected 1.0.0 (1) submission on the App Store and rolls Android
to production. Marketing version stays `1.1.0` (builds 2–4 were earlier 1.1.0
uploads; build 4 went up a day earlier but was never attached to the version).

**Included since 1.0.0 (1):** new animated launch splash (shows immediately,
minimum 3 s hold — fixes the black screen / perceived launch hang), redesigned
tournament and club pages with tournament-grade branding, unified navigation
(tab bar on every screen, role-aware "Ещё" hub), sponsor branding with website
URLs.

**Crash check (before upload):** Release-configuration build installed and
launched on the iPhone 17 Pro simulator — no crash, splash then start screen
rendered (process stayed alive; verified via `launchctl list` + screenshots).

**iOS:** archived `build/App-1.1.0-5.xcarchive` with `xcodebuild` (team
`VH4L4R7PKW`, ASC API-key auth), exported with `build/ExportOptions.plist`,
uploaded via `xcrun altool`. In App Store Connect the rejected version was
reworked **via the ASC API (Spaceship)**: version string `1.0.0` → `1.1.0`,
build 1.0.0 (1) detached and build 5 attached, reviewer note added (crash fixed
by the new build; 2.1/2.1(b) answers are in the 2026-07-13 reply). The old
review submission (`63dcfdc1-…`, UNRESOLVED_ISSUES) would not accept a
resubmit while holding the rejected item ("Version is not ready to be
submitted yet"), so it was **canceled** and a fresh submission
(`198e10f7-8248-4790-a757-2a44ae684e78`) was created with the reworked version
and submitted → state `WAITING_FOR_REVIEW`. The 2.1 reply thread stays
available in the Resolution Center history.

**Android:** `./gradlew bundleRelease` → `build/PlayTennis-1.1.0-vc5.aab`
(versionCode 5 verified with bundletool), uploaded to the **internal** track
via `fastlane android release` (changelogs `5.txt`, ru-RU + en-US), then
promoted to the **production** track (`supply` with `track_promote_to:
production`, 100 % rollout).
