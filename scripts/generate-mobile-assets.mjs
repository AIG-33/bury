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

async function makeIcon() {
  const buf = await sharp(await readFile(iconSvg), { density: 512 })
    .resize(1024, 1024, { fit: "contain" })
    .png()
    .toBuffer();
  await writeFile(path.join(outDir, "icon.png"), buf);
  console.log("wrote resources/icon.png");
}

// The splash is a static replica of the animated web launch overlay
// (components/mobile/launch-splash.tsx): same grass gradient, court lines,
// logo, slogan and ball (frozen at the animation's start position), so the
// native → web hand-off is seamless — the ball just starts moving.
//
// Geometry: the overlay is designed for a 402x874 viewport. Both iOS
// (scaleAspectFill) and Android (CENTER_CROP) crop the 2732x2732 square to a
// centered portrait band of ~1256px (2732 * 402/874), which maps the design
// 1:1 at scale 2732/874 ≈ 3.125. All coordinates below are the overlay's CSS
// values multiplied by 3.125 and offset to the band at x 738..1994.
//
// The slogan is baked in Russian (the app's default locale) — a static image
// cannot be localized per user; the web overlay on top is fully localized.
async function makeSplash(file) {
  const S = 2732;
  const bandLeft = 738;
  const bandWidth = 1256;
  const cx = S / 2;

  // Court box: inset-x 8% / top 38% / bottom 10% of the 402x874 design.
  const courtLeft = bandLeft + 100;
  const courtRight = bandLeft + bandWidth - 100;
  const courtTop = 1038;
  const courtBottom = 2458;
  const courtWidth = courtRight - courtLeft;
  const courtHeight = courtBottom - courtTop;
  const singlesLeft = courtLeft + courtWidth * 0.13;
  const singlesRight = courtRight - courtWidth * 0.13;
  const netY = courtTop + courtHeight / 2;
  const serviceTop = courtTop + courtHeight * 0.26;
  const serviceBottom = courtBottom - courtHeight * 0.26;

  // Ball frozen at the CSS animation's resting pose (paused until hydration):
  // base = net-line center, translateY(+21vh), translateX(-5.95vh) — i.e. on
  // the near side by the baseline, slightly left, about to be "served".
  const ballCx = cx - 0.0595 * S;
  const ballCy = 0.64 * S + 0.21 * S;
  const ballR = 56;

  const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E9E5B"/>
      <stop offset="0.55" stop-color="#1C7A46"/>
      <stop offset="1" stop-color="#14522F"/>
    </linearGradient>
    <radialGradient id="ballFill" cx="0.32" cy="0.3" r="0.85">
      <stop offset="0" stop-color="#F4FF8A"/>
      <stop offset="0.55" stop-color="#D7F205"/>
      <stop offset="1" stop-color="#A8C21B"/>
    </radialGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#grass)"/>
  <g stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="6" fill="none">
    <rect x="${courtLeft}" y="${courtTop}" width="${courtWidth}" height="${courtHeight}" rx="9"/>
    <line x1="${singlesLeft}" y1="${courtTop}" x2="${singlesLeft}" y2="${courtBottom}"/>
    <line x1="${singlesRight}" y1="${courtTop}" x2="${singlesRight}" y2="${courtBottom}"/>
    <line x1="${singlesLeft}" y1="${serviceTop}" x2="${singlesRight}" y2="${serviceTop}"/>
    <line x1="${singlesLeft}" y1="${serviceBottom}" x2="${singlesRight}" y2="${serviceBottom}"/>
    <line x1="${cx}" y1="${serviceTop}" x2="${cx}" y2="${serviceBottom}"/>
  </g>
  <line x1="${courtLeft - courtWidth * 0.04}" y1="${netY}" x2="${courtRight + courtWidth * 0.04}" y2="${netY}" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="9"/>
  <ellipse cx="${ballCx}" cy="${ballCy + ballR + 26}" rx="${ballR * 0.9}" ry="20" fill="#000000" fill-opacity="0.28" filter="url(#soft)"/>
  <circle cx="${ballCx}" cy="${ballCy}" r="${ballR}" fill="url(#ballFill)"/>
  <text x="${cx}" y="570" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="88" letter-spacing="-1.5">
    <tspan fill="#FFFFFF">PlayTennis</tspan><tspan fill="#C3E84F">.by</tspan>
  </text>
  <text x="${cx}" y="656" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="47" fill="#FFFFFF" fill-opacity="0.85">Играйте в теннис — это полезно</text>
</svg>`;

  // Logo tile above the title, matching the overlay's 80px icon (=> 250px).
  const logoSize = 250;
  const logo = await sharp(await readFile(iconSvg), { density: 512 })
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  const buf = await sharp(Buffer.from(scene))
    .composite([{ input: logo, left: Math.round(cx - logoSize / 2), top: 200 }])
    .png()
    .toBuffer();
  await writeFile(path.join(outDir, file), buf);
  console.log("wrote resources/" + file);
}

await mkdir(outDir, { recursive: true });
await makeIcon();
// Light and dark are identical: the splash scene is theme-independent, just
// like the web overlay that continues it.
await makeSplash("splash.png");
await makeSplash("splash-dark.png");
console.log("done");
