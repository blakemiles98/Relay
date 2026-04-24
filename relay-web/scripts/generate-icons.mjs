// Generates PWA icons for Relay using sharp (already bundled by Next.js).
// Run once: node scripts/generate-icons.mjs

import sharp from "../node_modules/sharp/lib/index.js";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "../public/icons");
mkdirSync(outDir, { recursive: true });

// Relay "R" lettermark on a violet background
function makeSvg(size) {
  const pad = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.52);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#7c3aed"/>
  <text
    x="50%" y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="white"
    letter-spacing="-2"
  >R</text>
</svg>`;
}

for (const size of [192, 512]) {
  const svg = Buffer.from(makeSvg(size));
  await sharp(svg)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}

console.log("Icons generated in public/icons/");
