import { readFileSync } from "node:fs";
// Gera os PNGs do PWA e a OG image a partir da marca em public/brand/
// (montagem manual do usuário, 2026-06-11). One-off: rode com
// `node scripts/gen-icons.mjs` após mexer nos SVGs.
import sharp from "sharp";

// O navy de fundo DA ARTE (fundo do touvie-logo.svg / touvie-mark-bg.svg).
const NAVY = "#1A2346";

// touvie-icon.svg é a mark transparente num viewBox quadrado (favicon da aba).
// Os PNGs do PWA precisam de fundo cheio; o emblema entra a 80% do quadrado
// pra sobreviver à máscara redonda do Android (safe zone maskable).
const icon = readFileSync("public/brand/touvie-icon.svg");
const targets = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 180, out: "public/icons/apple-touch-icon.png" },
];
for (const { size, out } of targets) {
  const inner = Math.round(size * 0.8);
  const emblem = await sharp(icon, { density: 300 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: emblem }])
    .png()
    .toFile(out);
  console.log("✓", out, `(${size}×${size})`);
}

// OG image (1200×630) — lockup completo (touvie-logo.svg, fundo navy embutido)
// centrado; barras laterais no mesmo navy pra composição seamless.
const lockup = readFileSync("public/brand/touvie-logo.svg");
await sharp(lockup, { density: 240 })
  .resize(1200, 630, { fit: "contain", background: NAVY })
  .flatten({ background: NAVY })
  .png()
  .toFile("public/brand/touvie-og.png");
console.log("✓ public/brand/touvie-og.png (1200×630)");
