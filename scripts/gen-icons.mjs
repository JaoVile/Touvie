import { readFileSync } from "node:fs";
// Gera os PNGs do PWA a partir de public/brand/touvie-icon.svg (Monograma Celeste).
// One-off: rode com `node scripts/gen-icons.mjs` após mexer no SVG.
import sharp from "sharp";

const svg = readFileSync("public/brand/touvie-icon.svg");
const targets = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 180, out: "public/icons/apple-touch-icon.png" },
];
for (const { size, out } of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log("✓", out, `(${size}×${size})`);
}

// OG image (1200×630) — lockup completo (touvie-logo.svg, fundo navy #0B122F
// embutido) centrado, barras laterais no mesmo navy pra composição seamless.
const NAVY = "#0B122F";
const lockup = readFileSync("public/brand/touvie-logo.svg");
await sharp(lockup, { density: 240 })
  .resize(630, 630)
  .extend({ left: 285, right: 285, background: NAVY })
  .png()
  .toFile("public/brand/touvie-og.png");
console.log("✓ public/brand/touvie-og.png (1200×630)");
