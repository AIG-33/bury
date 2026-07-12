# App Store (iOS) listing metadata — `deliver`

This folder is the [Fastlane `deliver`](https://docs.fastlane.tools/actions/deliver/)
metadata tree for **App Store Connect**. Edit the `.txt` files here and push them
with `fastlane ios upload_metadata` (see `../Fastfile`). Nothing is uploaded
automatically — a human runs the lane.

## Layout

```
metadata/
  copyright.txt            # global, "<year> PlayTennis.by"
  primary_category.txt     # SPORTS
  secondary_category.txt   # LIFESTYLE
  ru/                      # Russian (primary language)
  en-US/                   # English
    name.txt               # <= 30 chars  (store title)
    subtitle.txt           # <= 30 chars
    keywords.txt           # <= 100 chars total, comma-separated, no spaces
    promotional_text.txt   # <= 170 chars, editable without a new review
    description.txt        # <= 4000 chars
    release_notes.txt      # "what's new" for this version
    support_url.txt        # https://www.playtennis.by/<locale>/support
    marketing_url.txt      # https://www.playtennis.by/<locale>
    privacy_url.txt        # https://www.playtennis.by/<locale>/privacy
```

## Notes

- **Primary language is Russian.** App Store Connect requires the app's primary
  language to be set at app creation (Russian) — see `docs/STORE_SUBMISSION.md`.
- **Privacy URL** is also set at the app level under *App Privacy* in App Store
  Connect. The per-locale `privacy_url.txt` here mirrors it; keep both in sync.
- **Categories**: `SPORTS` / `LIFESTYLE`. Adjust in App Store Connect if you
  prefer a different secondary (e.g. `HEALTH_AND_FITNESS`).
- **Screenshots** are NOT included — see `../screenshots/README.md` for required
  sizes and where to drop the images before running the lane with
  `UPLOAD_SCREENSHOTS=true`.
- **Character limits** above are hard App Store limits; keep copy under them.
