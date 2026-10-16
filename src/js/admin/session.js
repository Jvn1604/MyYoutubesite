/**
 * Admin session on the client: fetches the CSRF token once, attaches it to
 * every state-changing request, and sends the user to the login page on 401.
 * The session cookie itself is HttpOnly, so JS never sees it.
 */
import { api } from "../core/api.js";

let csrfToken = null;
let admin = null;

const LOGIN = "/admin/login";

export function goToLogin() {
  const next = location.pathname + location.search + location.hash;
  location.replace(`${LOGIN}?next=${encodeURIComponent(next)}`);
}

/** Resolve the current admin or redirect to login. */
export async function requireSession() {
  const res = await api("/api/admin/session");
  if (res.status === 401) { goToLogin(); return new Promise(() => {}); } // halt page boot
  if (!res.ok) throw new Error(res.error ?? "Couldn't verify your session");
  csrfToken = res.data.csrfToken;
  admin = res.data.admin;
  return admin;
}

export const currentAdmin = () => admin;
export const setCsrfToken = (token) => { csrfToken = token; };

/** api() for admin endpoints: CSRF header on writes, login redirect on 401. */
export async function adminApi(path, { method = "GET", ...opts } = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  const res = await api(path, { ...opts, method, headers });
  if (res.status === 401) goToLogin();
  return res;
}

export async function signOut() {
  await adminApi("/api/admin/logout", { method: "POST" });
  location.replace(LOGIN);
}

/** Only allow same-site relative paths under /admin as post-login destinations. */
export function safeNext(next) {
  return typeof next === "string" && /^\/admin(\/|$|\?|#)/.test(next) && !next.startsWith("//") ? next : "/admin/";
}
