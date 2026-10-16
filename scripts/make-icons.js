#!/usr/bin/env node
/**
 * Regenerates the PNG app icons in public/icons from a source image.
 *   node scripts/make-icons.js [source]   (default: public/fallback/avatar.svg)
 * Run again after replacing the logo, then commit public/icons.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const source = process.argv[2] ?? "public/fallback/avatar.svg";
const out = "public/icons";
const BG = "#0a0a0f";

await mkdir(out, { recursive: true });
for (const size of [180, 192, 512]) {
  await sharp(source, { density: 384 }).resize(size, size).flatten({ background: BG }).png().toFile(`${out}/icon-${size}.png`);
}
// Maskable: keep the logo inside the 80% safe zone
const inner = Math.round(512 * 0.72);
const logo = await sharp(source, { density: 384 }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: logo, gravity: "center" }]).png().toFile(`${out}/icon-maskable-512.png`);
console.log(`Icons written to ${out}/`);
