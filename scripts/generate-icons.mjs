// One-shot generator: rasterises public/icons/icon.svg + maskable.svg into the
// PWA icon set we reference from app/manifest.ts.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inDir = path.join(root, "public/icons");

async function rasterise(svgFile, outFile, size) {
  const svg = await readFile(path.join(inDir, svgFile));
  const buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
  await writeFile(path.join(inDir, outFile), buf);
  console.log("wrote", outFile, size);
}

await rasterise("icon.svg", "icon-192.png", 192);
await rasterise("icon.svg", "icon-512.png", 512);
await rasterise("icon.svg", "apple-touch-icon.png", 180);
await rasterise("maskable.svg", "maskable-512.png", 512);
console.log("done");
