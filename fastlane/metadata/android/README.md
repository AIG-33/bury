# Google Play listing metadata — `supply`

This folder is the [Fastlane `supply`](https://docs.fastlane.tools/actions/supply/)
metadata tree for the **Google Play Console**. Edit the `.txt` files and push
them with `fastlane android upload_metadata` (see `../../Fastfile`). Nothing
uploads automatically — a human runs the lane with a Play service-account key.

## Layout

```
metadata/android/
  ru-RU/
  en-US/
    title.txt                 # <= 30 chars
    short_description.txt      # <= 80 chars
    full_description.txt       # <= 4000 chars
    changelogs/
      default.txt             # release notes (falls back for any versionCode)
```

## Where the store graphics go

`supply` also reads images from these (currently empty) locations. Drop them in
before running the lane with `UPLOAD_IMAGES=true` / `UPLOAD_SCREENSHOTS=true`:

```
metadata/android/<locale>/images/
  icon.png                    # 512 x 512, 32-bit PNG
  featureGraphic.png          # 1024 x 500
  phoneScreenshots/           # 2–8 PNG/JPEG, min 320px, 16:9 or 9:16
  sevenInchScreenshots/       # optional tablet
  tenInchScreenshots/         # optional tablet
```

See `../../screenshots/README.md` for the full asset spec. Do NOT commit binary
store assets to git without confirming with the team.
