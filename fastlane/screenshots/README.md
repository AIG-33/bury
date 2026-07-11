# Store screenshots & graphics

Binary store assets are **not committed to git**. This folder documents the
required sizes and where to drop the files before running the Fastlane lanes.
Generate them from real screens of https://www.playtennis.by running inside the
native shell (iOS Simulator / Android emulator), then export at the sizes below.

Localize per language where the on-screen text differs (ru vs en). Keep the
frame count and order consistent between locales.

---

## iOS — App Store (`deliver`, path `fastlane/screenshots/ios/<locale>/`)

Apple requires at least one set for the largest iPhone; older sizes are optional
but recommended. Drop `.png`/`.jpg` files named so they sort in display order
(e.g. `01_home.png`, `02_tournaments.png`).

| Display class | Device example | Portrait px | Required |
| --- | --- | --- | --- |
| 6.9" / 6.7" iPhone | iPhone 16 Pro Max / 15 Pro Max | 1290 × 2796 | **Yes** |
| 6.5" iPhone | iPhone 11 Pro Max / XS Max | 1242 × 2688 | Recommended |
| 5.5" iPhone | iPhone 8 Plus | 1242 × 2208 | Optional |
| 12.9" iPad Pro | iPad Pro 12.9" | 2048 × 2732 | Only if iPad support is enabled |

- 3–10 screenshots per size. Up to 10.
- If you do NOT ship an iPad build, do not add iPad screenshots (and keep the
  target iPhone-only) — see `docs/STORE_SUBMISSION.md`.
- App icon for the store is taken from the built binary (1024 × 1024, no alpha),
  not from this folder.

Folders: `ios/ru/`, `ios/en-US/`.

---

## Android — Google Play (`supply`, images live under `../metadata/android/<locale>/images/`)

| Asset | Size | Required |
| --- | --- | --- |
| App icon | 512 × 512, 32-bit PNG (with alpha) | **Yes** |
| Feature graphic | 1024 × 500, PNG/JPEG (no alpha) | **Yes** |
| Phone screenshots | min 320px side, 16:9 or 9:16, 2–8 images | **Yes** |
| 7" tablet screenshots | up to 8 | Optional |
| 10" tablet screenshots | up to 8 | Optional |

Play reads Android graphics from the `supply` metadata tree, not from this
folder. Target layout:

```
fastlane/metadata/android/<locale>/images/
  icon.png
  featureGraphic.png
  phoneScreenshots/       01.png, 02.png, ...
  sevenInchScreenshots/
  tenInchScreenshots/
```

Use `fastlane/screenshots/android/ru/` and `.../android/en-US/` to stage raw,
unframed captures before you resize/frame them into the `images/` folders above.

---

## Uploading

Screenshots and images are skipped by default. Enable them explicitly:

```bash
UPLOAD_SCREENSHOTS=true fastlane ios upload_metadata
UPLOAD_IMAGES=true UPLOAD_SCREENSHOTS=true fastlane android upload_metadata
```
