// One-shot generator for Capacitor native assets. Produces the source images
// consumed by `@capacitor/assets` (npm run cap:assets), which then fans them out
// into every iOS/Android icon and splash density.
//
//   resources/icon.png        1024x1024  app icon (full bleed)
//   resources/splash.png      2732x2732  light splash
//   resources/splash-dark.png 2732x2732  dark splash
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconSvg = path.join(root, "public/icons/icon.svg");
const outDir = path.join(root, "resources");

const LIGHT_BG = "#f6f9f4";
const DARK_BG = "#0f1b14";

async function makeIcon() {
  const buf = await sharp(await readFile(iconSvg), { density: 512 })
    .resize(1024, 1024, { fit: "contain" })
    .png()
    .toBuffer();
  await writeFile(path.join(outDir, "icon.png"), buf);
  console.log("wrote resources/icon.png");
}

async function makeSplash(file, background) {
  const logoSize = 640;
  const logo = await sharp(await readFile(iconSvg), { density: 512 })
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
  const canvas = sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background,
    },
  });
  const buf = await canvas
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
  await writeFile(path.join(outDir, file), buf);
  console.log("wrote resources/" + file);
}

await mkdir(outDir, { recursive: true });
await makeIcon();
await makeSplash("splash.png", LIGHT_BG);
await makeSplash("splash-dark.png", DARK_BG);
console.log("done");
