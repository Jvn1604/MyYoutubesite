import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { mediaPatchSchema, parseOrThrow } from "../../validation/schemas.js";
import { processImage, UploadError, MEDIA_KINDS, MAX_UPLOAD_BYTES } from "../../services/images.js";
import { putObject, removeObjects, publicUrl, storageKind } from "../../services/storage.js";
import { ConfigError } from "../../config.js";
import { toId, notFoundIfEmpty } from "./helpers.js";

const SELECT = `select id, kind, path, mime, width, height, bytes, variants, alt, created_at as "createdAt" from media`;

const shape = (m) => ({
  ...m,
  url: publicUrl(m.path),
  variantUrls: Object.fromEntries(Object.entries(m.variants ?? {}).map(([k, p]) => [k, publicUrl(p)])),
});

export async function list({ db, query }) {
  const kind = query.get("kind");
  const rows = MEDIA_KINDS.includes(kind)
    ? await db.query(`${SELECT} where kind = $1 order by created_at desc`, [kind])
    : await db.query(`${SELECT} order by created_at desc limit 200`);
  return rows.map(shape);
}

/** Admin-facing: say exactly what's missing instead of a generic 500. */
function assertStorageConfigured() {
  try {
    storageKind();
  } catch (err) {
    if (err instanceof ConfigError) {
      throw new HttpError(503, "Image storage isn't set up yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the site's environment variables (see README → Media storage).");
    }
    throw err;
  }
}

export async function upload({ req, db }) {
  assertStorageConfigured();
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw new HttpError(415, "Expected a file upload");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, "Images must be 4 MB or smaller");

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "other");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  if (!MEDIA_KINDS.includes(kind)) throw new HttpError(400, "Unknown image type");
  if (!(file instanceof Blob)) throw new HttpError(400, "No file received");

  let processed;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()), kind);
  } catch (err) {
    if (err instanceof UploadError) throw new HttpError(422, err.message);
    throw err;
  }

  const mainPath = `${processed.baseName}.webp`;
  const variantPaths = {};
  const written = [];
  try {
    await putObject(mainPath, processed.main.buffer, "image/webp");
    written.push(mainPath);
    for (const v of processed.variants) {
      const path = `${processed.baseName}-${v.name.replace("_", "-")}.${v.contentType === "image/avif" ? "avif" : "webp"}`;
      await putObject(path, v.buffer, v.contentType);
      written.push(path);
      variantPaths[v.name] = path;
    }
    const [row] = await db.query(
      `insert into media (kind, path, mime, width, height, bytes, variants, alt) values ($1, $2, 'image/webp', $3, $4, $5, $6::jsonb, $7) returning id`,
      [kind, mainPath, processed.main.width, processed.main.height, processed.main.buffer.length, JSON.stringify(variantPaths), alt]
    );
    return shape((await db.query(`${SELECT} where id = $1`, [row.id]))[0]);
  } catch (err) {
    await removeObjects(written).catch(() => {}); // don't leave orphaned files behind
    throw err;
  }
}

export async function patch({ req, db, params }) {
  const { alt } = parseOrThrow(mediaPatchSchema, await readJson(req), HttpError);
  const row = notFoundIfEmpty(await db.query(`update media set alt = $2 where id = $1 returning id, kind, path, mime, width, height, bytes, variants, alt, created_at as "createdAt"`, [toId(params.id), alt]), "Image");
  return shape(row);
}

/** Refuses to delete images still used by a game or a site setting. */
export async function remove({ db, params }) {
  const id = toId(params.id);
  const media = notFoundIfEmpty(await db.query(`${SELECT} where id = $1`, [id]), "Image");
  const games = await db.query("select name from games where cover_media_id = $1 or banner_media_id = $1", [id]);
  if (games.length) throw new HttpError(409, `Still used by: ${games.map((g) => g.name).join(", ")}`);
  const url = publicUrl(media.path);
  const settings = await db.query("select key from site_settings where value::text like $1", [`%${url.replace(/[\\%_]/g, (c) => `\\${c}`)}%`]);
  if (settings.length) throw new HttpError(409, `Still used in site settings: ${settings.map((s) => s.key).join(", ")}`);

  await db.query("delete from media where id = $1", [id]);
  await removeObjects([media.path, ...Object.values(media.variants ?? {})]).catch((err) => console.error("[media] storage cleanup failed:", err.message));
  return { ok: true };
}
