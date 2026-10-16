import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { hashPassword, verifyPassword, passwordProblem } from "../server/services/passwords.js";
import { createAdmin, LOGIN_MAX_FAILURES } from "../server/services/auth.js";
import { routeAuth } from "../server/controllers/admin-auth.js";
import { handle } from "../server/middleware/http.js";

process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-0123456789";

const ORIGIN = "https://dephantom.example";
const EMAIL = "admin@dephantom.test";
const PASSWORD = "correct horse battery staple";

let db;
// Same wrapper the Netlify function uses: HttpErrors become JSON responses
const call = (req, context = { ip: "203.0.113.7" }) => handle((r, c) => routeAuth(r, db, c), { methods: ["GET", "POST"] })(req, context);

function request(path, { method = "GET", body, cookie, csrf, origin = ORIGIN } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  if (csrf) headers.set("x-csrf-token", csrf);
  if (origin && method !== "GET") headers.set("origin", origin);
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function signIn(ip = "203.0.113.7") {
  const res = await call(request("/api/admin/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } }), { ip });
  const cookie = res.headers.get("set-cookie");
  return { res, cookie: cookie?.split(";")[0], setCookie: cookie, body: await res.json() };
}

beforeAll(async () => {
  db = await createDb("pglite:memory");
  await migrate(db);
  await createAdmin(db, { email: EMAIL, password: PASSWORD });
}, 30_000);
beforeEach(async () => {
  await db.query("delete from login_attempts");
  await db.query("delete from sessions");
});
afterAll(() => db?.close());

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("a long enough secret");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain("a long enough secret");
    expect(await verifyPassword("a long enough secret", hash)).toBe(true);
    expect(await verifyPassword("a long enough secreT", hash)).toBe(false);
  });
  it("uses a fresh salt every time", async () => {
    expect(await hashPassword("same password here")).not.toBe(await hashPassword("same password here"));
  });
  it("rejects weak passwords", () => {
    expect(passwordProblem("short")).toMatch(/12 characters/);
    expect(passwordProblem("aaaaaaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("password123456")).toBeTruthy();
    expect(passwordProblem(PASSWORD)).toBeNull();
  });
  it("stores only the hash and refuses duplicate admins", async () => {
    const [row] = await db.query("select password_hash from admins where email = $1", [EMAIL]);
    expect(row.password_hash).not.toContain(PASSWORD);
    await expect(createAdmin(db, { email: EMAIL.toUpperCase(), password: PASSWORD })).rejects.toThrow(/already exists/);
  });
});

describe("login", () => {
  it("sets a hardened session cookie and returns a CSRF token", async () => {
    const { res, setCookie, body } = await signIn();
    expect(res.status).toBe(200);
    expect(setCookie).toMatch(/^__Host-dp_session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Secure/);
    expect(body.csrfToken).toMatch(/^[\w-]{40,}$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("stores only a hash of the session token", async () => {
    const { cookie } = await signIn();
    const token = decodeURIComponent(cookie.split("=")[1]);
    expect(await db.query("select 1 from sessions where token_hash = $1", [token])).toHaveLength(0);
    expect(await db.query("select 1 from sessions")).toHaveLength(1);
  });

  it("gives the same answer for unknown email and wrong password", async () => {
    const a = await call(request("/api/admin/login", { method: "POST", body: { email: "nobody@x.com", password: "whatever-1234" } }));
    const b = await call(request("/api/admin/login", { method: "POST", body: { email: EMAIL, password: "wrong password!!" } }));
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(await a.json()).toEqual(await b.json());
  });

  it(`locks an IP out after ${LOGIN_MAX_FAILURES} failures, even for the right password`, async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await call(request("/api/admin/login", { method: "POST", body: { email: EMAIL, password: `wrong-${i}-password` } }));
    }
    const { res } = await signIn();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    // another IP is unaffected
    expect((await signIn("198.51.100.1")).res.status).toBe(200);
  });

  it("never stores raw IPs", async () => {
    await signIn("203.0.113.7");
    const [row] = await db.query("select ip_hash from login_attempts limit 1");
    expect(row.ip_hash).not.toContain("203.0.113.7");
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("validates input and blocks cross-origin login posts", async () => {
    expect((await call(request("/api/admin/login", { method: "POST", body: { email: "not-an-email", password: "x" } }))).status).toBe(400);
    expect((await call(request("/api/admin/login", { method: "POST", body: { email: EMAIL, password: PASSWORD, extra: 1 } }))).status).toBe(400);
    expect((await call(request("/api/admin/login", { method: "POST", body: { email: EMAIL, password: PASSWORD }, origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("protected routes", () => {
  it("return 401 without a session", async () => {
    expect((await call(request("/api/admin/session"))).status).toBe(401);
    expect((await call(request("/api/admin/session", { cookie: "__Host-dp_session=forged-token-forged-token-forged" }))).status).toBe(401);
  });

  it("return the admin with a valid session", async () => {
    const { cookie, body } = await signIn();
    const res = await call(request("/api/admin/session", { cookie }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ admin: { email: EMAIL }, csrfToken: body.csrfToken });
  });

  it("require the CSRF token for state changes", async () => {
    const { cookie, body } = await signIn();
    expect((await call(request("/api/admin/logout", { method: "POST", cookie }))).status).toBe(403);
    expect((await call(request("/api/admin/logout", { method: "POST", cookie, csrf: "wrong" }))).status).toBe(403);
    expect((await call(request("/api/admin/logout", { method: "POST", cookie, csrf: body.csrfToken, origin: "https://evil.example" }))).status).toBe(403);
  });

  it("reject expired sessions", async () => {
    const { cookie } = await signIn();
    await db.query("update sessions set expires_at = now() - interval '1 minute'");
    expect((await call(request("/api/admin/session", { cookie }))).status).toBe(401);
  });

  it("logout invalidates the session server-side and clears the cookie", async () => {
    const { cookie, body } = await signIn();
    const res = await call(request("/api/admin/logout", { method: "POST", cookie, csrf: body.csrfToken }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect((await call(request("/api/admin/session", { cookie }))).status).toBe(401); // replaying the old cookie fails
  });

  it("rejects unknown methods/paths", async () => {
    expect((await call(request("/api/admin/session", { method: "POST", body: {} }))).status).toBe(405);
  });
});

describe("change password", () => {
  it("requires the current password and signs out other sessions", async () => {
    const first = await signIn();
    const second = await signIn();
    const wrong = await call(request("/api/admin/password", { method: "POST", cookie: second.cookie, csrf: second.body.csrfToken, body: { currentPassword: "nope nope nope", newPassword: "a brand new passphrase" } }));
    expect(wrong.status).toBe(400);
    const ok = await call(request("/api/admin/password", { method: "POST", cookie: second.cookie, csrf: second.body.csrfToken, body: { currentPassword: PASSWORD, newPassword: "a brand new passphrase" } }));
    expect(ok.status).toBe(200);
    expect((await call(request("/api/admin/session", { cookie: first.cookie }))).status).toBe(401);   // other device signed out
    expect((await call(request("/api/admin/session", { cookie: second.cookie }))).status).toBe(200);  // this one stays
    // restore for other tests
    await createAdmin(db, { email: EMAIL, password: PASSWORD, reset: true });
  });
});

describe("local development cookie", () => {
  it("uses a non-Secure, unprefixed cookie on http://localhost", async () => {
    const req = new Request("http://localhost:8888/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:8888" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const res = await call(req);
    expect(res.headers.get("set-cookie")).toMatch(/^dp_session=/);
    expect(res.headers.get("set-cookie")).not.toMatch(/Secure/);
  });
});
