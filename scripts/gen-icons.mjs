// Gera os PNGs do PWA a partir de public/icons/icon.svg.
// One-off: rode com `node scripts/gen-icons.mjs` após mexer no SVG.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon.svg");
const targets = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 180, out: "public/icons/apple-touch-icon.png" },
];
for (const { size, out } of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log("✓", out, `(${size}×${size})`);
}
