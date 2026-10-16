/**
 * Admin auth controller: POST login, POST logout, GET session, POST password.
 * Pure Request → Response functions that take a db, so tests can call them directly.
 */
import { json, error, HttpError } from "../middleware/http.js";
import { requireAdmin, readSessionCookie, sessionCookie, clearSessionCookie, assertSameOrigin, clientIp, readJson } from "../middleware/auth.js";
import { login, logout, changePassword } from "../services/auth.js";
import { loginSchema, changePasswordSchema, parseOrThrow } from "../validation/schemas.js";

const NO_STORE = { "Cache-Control": "no-store" };

export async function handleLogin(req, db, context) {
  assertSameOrigin(req);
  const body = parseOrThrow(loginSchema, await readJson(req, 4096), HttpError);
  const result = await login(db, { ...body, ip: clientIp(req, context), userAgent: req.headers.get("user-agent") ?? "" });
  if (result.status === 429) {
    return json({ error: "Too many failed attempts. Try again later." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(result.retryAfter) } });
  }
  if (!result.ok) return error(401, "Incorrect email or password");
  return json({ admin: { email: result.admin.email }, csrfToken: result.csrfToken }, {
    headers: { ...NO_STORE, "Set-Cookie": sessionCookie(req, result.token, result.expiresAt) },
  });
}

export async function handleLogout(req, db) {
  await requireAdmin(req, db); // CSRF-protected: a third-party page can't log you out
  await logout(db, readSessionCookie(req));
  return json({ ok: true }, { headers: { ...NO_STORE, "Set-Cookie": clearSessionCookie(req) } });
}

export async function handleSession(req, db) {
  const session = await requireAdmin(req, db);
  return json({ admin: { email: session.admin.email }, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() }, { headers: NO_STORE });
}

export async function handleChangePassword(req, db) {
  const session = await requireAdmin(req, db);
  const body = parseOrThrow(changePasswordSchema, await readJson(req, 4096), HttpError);
  const result = await changePassword(db, { adminId: session.admin.id, sessionId: session.sessionId, ...body });
  if (!result.ok) return error(400, result.error);
  return json({ ok: true }, { headers: NO_STORE });
}

const ROUTES = {
  "POST /api/admin/login": handleLogin,
  "POST /api/admin/logout": handleLogout,
  "GET /api/admin/session": handleSession,
  "POST /api/admin/password": handleChangePassword,
};

export function routeAuth(req, db, context) {
  const handler = ROUTES[`${req.method} ${new URL(req.url).pathname}`];
  if (!handler) throw new HttpError(405, "Method not allowed");
  return handler(req, db, context);
}
