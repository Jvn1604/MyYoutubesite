/**
 * Upload validation + optimisation with sharp.
 * Every upload is decoded and re-encoded: this strips EXIF/GPS metadata and
 * anything that isn't pixels (so a disguised script can't survive).
 * SVG is rejected on purpose (it can carry scripts).
 */
import sharp from "sharp";
import { randomBytes } from "node:crypto";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // keeps us under Netlify's 6 MB request limit
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif"]);
const MIN_SIDE = 64;
const MAX_SIDE = 8000;
const MAX_STORED_WIDTH = 2400;
const VARIANT_WIDTHS = [400, 800, 1600];

export const MEDIA_KINDS = ["logo", "avatar", "hero", "game_cover", "game_banner", "background", "other"];

export class UploadError extends Error {}

/** Sniff the real type from the bytes (never trust the filename or Content-Type). */
export async function inspectImage(buffer) {
  if (!buffer?.length) throw new UploadError("The file is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new UploadError(`Images must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_SIDE * MAX_SIDE }).metadata();
  } catch {
    throw new UploadError("That file isn't a supported image (use JPG, PNG, WebP, AVIF or GIF).");
  }
  if (!ACCEPTED_FORMATS.has(meta.format)) throw new UploadError("Only JPG, PNG, WebP, AVIF or GIF images are allowed.");
  const swap = (meta.orientation ?? 1) >= 5; // EXIF rotation swaps width/height
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (width < MIN_SIDE || height < MIN_SIDE) throw new UploadError(`Image is too small (minimum ${MIN_SIDE}×${MIN_SIDE}px).`);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new UploadError(`Image is too large (maximum ${MAX_SIDE}px per side).`);
  return { format: meta.format, width, height };
}

/**
 * → { main: { buffer, width, height }, variants: [{ name, buffer, contentType, width }], baseName }
 * Main image is WebP (max 2400px wide). Variants: WebP at 400/800/1600 and AVIF at 800, never upscaled.
 */
export async function processImage(buffer, kind) {
  const info = await inspectImage(buffer);
  const base = () => sharp(buffer, { animated: false }).rotate(); // apply EXIF orientation, drop metadata
  const stamp = new Date().getUTCFullYear();
  const baseName = `${kind}/${stamp}/${randomBytes(8).toString("hex")}`;

  const mainWidth = Math.min(info.width, MAX_STORED_WIDTH);
  const main = await base().resize({ width: mainWidth, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });

  const variants = [];
  for (const w of VARIANT_WIDTHS.filter((w) => w < info.width)) {
    const out = await base().resize({ width: w }).webp({ quality: 80 }).toBuffer();
    variants.push({ name: `webp_${w}`, buffer: out, contentType: "image/webp", width: w });
  }
  const avifWidth = Math.min(800, info.width);
  variants.push({ name: `avif_${avifWidth}`, buffer: await base().resize({ width: avifWidth }).avif({ quality: 55, effort: 2 }).toBuffer(), contentType: "image/avif", width: avifWidth });

  return { baseName, main: { buffer: main.data, width: main.info.width, height: main.info.height }, variants };
}
