/**
 * Single-admin authentication: login with rate limiting, DB-backed sessions,
 * CSRF tokens, logout, password change. Raw session tokens are never stored
 * (only their SHA-256), and raw IPs are never stored (only an HMAC).
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword, dummyVerify, passwordProblem } from "./passwords.js";
import { requireEnv } from "../config.js";

export const SESSION_TTL_DAYS = 7;
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;      // per IP per window
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;   // how often last_seen_at is refreshed

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
export const hashIp = (ip) => createHmac("sha256", requireEnv("SESSION_SECRET")).update(String(ip ?? "unknown")).digest("hex");
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

export async function createAdmin(db, { email, password, reset = false }) {
  const address = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const hash = await hashPassword(password);
  const existing = await db.query("select id from admins where email = $1", [address]);
  if (existing.length && !reset) throw new Error(`Admin ${address} already exists (use --reset to change the password).`);
  if (existing.length) {
    await db.query("update admins set password_hash = $2 where id = $1", [existing[0].id, hash]);
    await db.query("delete from sessions where admin_id = $1", [existing[0].id]); // sign out everywhere
    return { id: existing[0].id, email: address, reset: true };
  }
  const [row] = await db.query("insert into admins (email, password_hash) values ($1, $2) returning id", [address, hash]);
  return { id: row.id, email: address, reset: false };
}

async function recentFailures(db, ipHash) {
  const [row] = await db.query(
    `select count(*)::int as n, min(attempted_at) as oldest from login_attempts
     where ip_hash = $1 and not succeeded and attempted_at > now() - make_interval(mins => $2)`,
    [ipHash, LOGIN_WINDOW_MINUTES]
  );
  return row;
}

/**
 * → { ok: true, token, csrfToken, admin, expiresAt }
 * → { ok: false, status: 401 } (bad credentials) | { ok: false, status: 429, retryAfter }
 */
export async function login(db, { email, password, ip, userAgent = "" }) {
  const ipHash = hashIp(ip);
  const failures = await recentFailures(db, ipHash);
  if (failures.n >= LOGIN_MAX_FAILURES) {
    const retryAfter = Math.max(1, Math.ceil((new Date(failures.oldest).getTime() + LOGIN_WINDOW_MINUTES * 60e3 - Date.now()) / 1000));
    return { ok: false, status: 429, retryAfter };
  }

  const [admin] = await db.query("select id, email, password_hash from admins where email = $1", [normalizeEmail(email)]);
  const valid = admin ? await verifyPassword(password, admin.password_hash) : await dummyVerify(password);
  await db.query("insert into login_attempts (ip_hash, succeeded) values ($1, $2)", [ipHash, valid]);
  if (!valid) return { ok: false, status: 401 };

  const token = newToken();
  const csrfToken = newToken();
  const [session] = await db.query(
    `insert into sessions (admin_id, token_hash, csrf_token, user_agent, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(days => $5)) returning expires_at`,
    [admin.id, sha256(token), csrfToken, String(userAgent).slice(0, 300), SESSION_TTL_DAYS]
  );
  await db.query("update admins set last_login_at = now() where id = $1", [admin.id]);
  // Housekeeping: forget old attempts and expired sessions
  await db.query("delete from login_attempts where attempted_at < now() - interval '1 day'");
  await db.query("delete from sessions where expires_at < now()");
  return { ok: true, token, csrfToken, admin: { id: admin.id, email: admin.email }, expiresAt: new Date(session.expires_at) };
}

/** Valid session for a raw cookie token, or null. */
export async function getSession(db, token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const [row] = await db.query(
    `select s.id, s.csrf_token, s.last_seen_at, s.expires_at, a.id as admin_id, a.email
     from sessions s join admins a on a.id = s.admin_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    await db.query("update sessions set last_seen_at = now() where id = $1", [row.id]);
  }
  return { sessionId: row.id, csrfToken: row.csrf_token, expiresAt: new Date(row.expires_at), admin: { id: row.admin_id, email: row.email } };
}

export async function logout(db, token) {
  if (typeof token === "string" && token) await db.query("delete from sessions where token_hash = $1", [sha256(token)]);
}

/** Change password; signs out every other session. */
export async function changePassword(db, { adminId, sessionId, currentPassword, newPassword }) {
  const [admin] = await db.query("select password_hash from admins where id = $1", [adminId]);
  if (!admin || !(await verifyPassword(currentPassword, admin.password_hash))) return { ok: false, error: "Current password is incorrect." };
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, error: problem };
  if (currentPassword === newPassword) return { ok: false, error: "Choose a different password." };
  await db.query("update admins set password_hash = $2 where id = $1", [adminId, await hashPassword(newPassword)]);
  await db.query("delete from sessions where admin_id = $1 and id <> $2", [adminId, sessionId]);
  return { ok: true };
}
