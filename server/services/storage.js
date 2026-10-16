/**
 * Media storage adapter.
 *   supabase → Supabase Storage public bucket (production; SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   local    → ./.data/media served by the /media/* function (development only)
 * The service-role key is only ever used here, server-side.
 */
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { env, runtimeEnv, ConfigError } from "../config.js";

const LOCAL_ROOT = join(process.cwd(), ".data", "media");
const SAFE_PATH = /^[a-z0-9_]+\/\d{4}\/[a-z0-9-]+\.(webp|avif)$/;

export function storageKind() {
  if (env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")) return "supabase";
  if (runtimeEnv() === "dev" || process.env.VITEST) return "local";
  throw new ConfigError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}

const assertPath = (path) => {
  if (!SAFE_PATH.test(path)) throw new Error(`Refusing unsafe media path: ${path}`);
  return path;
};

const supabase = () => {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = env("SUPABASE_MEDIA_BUCKET");
  return { base, bucket, headers: { Authorization: `Bearer ${key}`, apikey: key } };
};

export function publicUrl(path) {
  if (!path) return "";
  if (storageKind() === "supabase") {
    const { base, bucket } = supabase();
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }
  return `/media/${path}`;
}

export async function putObject(path, body, contentType) {
  assertPath(path);
  if (storageKind() === "local") {
    const file = join(LOCAL_ROOT, normalize(path));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  const { base, bucket, headers } = supabase();
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": contentType, "Cache-Control": "31536000", "x-upsert": "true" },
    body,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
}

export async function removeObjects(paths) {
  const safe = paths.filter(Boolean).map(assertPath);
  if (!safe.length) return;
  if (storageKind() === "local") {
    await Promise.all(safe.map((p) => rm(join(LOCAL_ROOT, normalize(p)), { force: true })));
    return;
  }
  const { base, bucket, headers } = supabase();
  const res = await fetch(`${base}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: safe }),
  });
  if (!res.ok) throw new Error(`Storage delete failed (${res.status})`);
}

/** Local dev only: read a stored file for the /media/* function. */
export async function readLocalObject(path) {
  assertPath(path);
  return readFile(join(LOCAL_ROOT, normalize(path)));
}
