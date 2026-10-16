/**
 * Request-level auth helpers for admin endpoints.
 *
 * Every admin request: valid session cookie → else 401.
 * Every state-changing request (POST/PUT/PATCH/DELETE) additionally needs:
 *   - X-CSRF-Token header matching the session's token → else 403
 *   - a same-origin Origin header (when the browser sends one) → else 403
 * The cookie itself is HttpOnly + SameSite=Strict (+ Secure off localhost).
 */
import { getSession } from "../services/auth.js";
import { HttpError } from "./http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const isLocalHost = (url) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

/** __Host- prefix (Secure, Path=/, no Domain) in production; plain name on http://localhost. */
export const cookieName = (url) => (isLocalHost(url) ? "dp_session" : "__Host-dp_session");

export function readSessionCookie(req) {
  const name = cookieName(req.url);
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(req, token, expiresAt) {
  const attrs = [`${cookieName(req.url)}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Expires=${expiresAt.toUTCString()}`];
  if (!isLocalHost(req.url)) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(req) {
  const attrs = [`${cookieName(req.url)}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (!isLocalHost(req.url)) attrs.push("Secure");
  return attrs.join("; ");
}

/** Reject cross-origin state changes (defence in depth on top of SameSite=Strict). */
export function assertSameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients / same-origin GET navigations
  if (origin !== new URL(req.url).origin) throw new HttpError(403, "Cross-origin request blocked");
}

/**
 * → { admin, sessionId, csrfToken } or throws HttpError 401/403.
 */
export async function requireAdmin(req, db) {
  const session = await getSession(db, readSessionCookie(req));
  if (!session) throw new HttpError(401, "Not signed in");
  if (!SAFE_METHODS.has(req.method)) {
    assertSameOrigin(req);
    const sent = req.headers.get("x-csrf-token");
    if (!sent || sent !== session.csrfToken) throw new HttpError(403, "Invalid or missing CSRF token");
  }
  return session;
}

/** Client IP as seen by Netlify's edge (never trust user-supplied X-Forwarded-For first). */
export function clientIp(req, context) {
  return context?.ip ?? req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Parse a JSON body with a size cap. Throws 400/413 on bad input. */
export async function readJson(req, maxBytes = 64 * 1024) {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "Expected application/json");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
