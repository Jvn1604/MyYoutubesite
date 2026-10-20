/**
 * Local overlay server for OBS.  Run:  npm run overlay
 *
 *   http://localhost:7777/control              control panel (also works as an OBS dock)
 *   http://localhost:7777/scenes/screen.html?mode=starting|brb|ending
 *   http://localhost:7777/scenes/ingame.html
 *   http://localhost:7777/scenes/chatting.html
 *
 * State lives in overlay/state.json (created from state.default.json). Every change made
 * in the control panel is pushed to all open scenes instantly over Server-Sent Events.
 * Listens on 127.0.0.1 only, so nothing outside this PC can reach it.
 */
import { createServer } from "node:http";
import { readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const HERE = import.meta.dirname;
const ROOT = resolve(HERE, "..");
const PORT = Number(process.env.OVERLAY_PORT) || 7777;
const STATE_FILE = resolve(HERE, "state.json");
const DEFAULT_FILE = resolve(HERE, "state.default.json");

// URL prefix → folder. /site/ exposes the website's shared JS (icons) read-only.
const MOUNTS = [
  ["/fonts/rajdhani/", resolve(ROOT, "node_modules/@fontsource/rajdhani/files")],
  ["/fonts/inter/", resolve(ROOT, "node_modules/@fontsource-variable/inter/files")],
  ["/site/", resolve(ROOT, "src/js")],
  ["/", HERE],
];

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
};

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Merge `patch` into `base`. Arrays and primitives replace; objects merge. */
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

const defaults = JSON.parse(await readFile(DEFAULT_FILE, "utf8"));
// Saved state is layered over defaults so new settings added later still get a value.
let state = existsSync(STATE_FILE) ? deepMerge(defaults, JSON.parse(await readFile(STATE_FILE, "utf8"))) : defaults;

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const tmp = `${STATE_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, STATE_FILE); // atomic: a crash never leaves half a file
  }, 250);
}

const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

function update(patch) {
  state = deepMerge(state, patch);
  persist();
  broadcast("state", state);
}

/* ---- Optional: pull the subscriber count from the website's public API ---- */
async function syncSubscribers() {
  const { autoFromSite, siteUrl } = state.goal ?? {};
  if (!autoFromSite || !siteUrl) return;
  try {
    const res = await fetch(new URL("/api/site", siteUrl), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const site = await res.json();
    const current = site.goal?.current ?? site.channel?.subscriberCount;
    if (Number.isFinite(current) && current !== state.goal.current) {
      update({ goal: { current } });
      console.log(`[overlay] subscriber count → ${current}`);
    }
  } catch (err) {
    console.warn(`[overlay] could not read subscribers from ${siteUrl}: ${err.message}`);
  }
}
setInterval(syncSubscribers, 5 * 60 * 1000);
syncSubscribers();

/* ---- HTTP ---- */
async function readBody(req, limit = 256 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function serveStatic(res, pathname) {
  if (pathname === "/" || pathname === "/control") pathname = "/control.html";
  for (const [prefix, dir] of MOUNTS) {
    if (!pathname.startsWith(prefix)) continue;
    const file = resolve(dir, "." + decodeURIComponent(pathname.slice(prefix.length - 1)));
    if (file !== dir && !file.startsWith(dir + sep)) return send(res, 403, "Forbidden", "text/plain");
    if (file === STATE_FILE) return send(res, 404, "Not found", "text/plain");
    try {
      const body = await readFile(file);
      return send(res, 200, body, TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
    } catch {
      if (prefix !== "/") return send(res, 404, "Not found", "text/plain");
    }
  }
  send(res, 404, "Not found", "text/plain");
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname === "/api/state" && req.method === "GET") return send(res, 200, state);

    if (pathname === "/api/state" && req.method === "POST") {
      const patch = JSON.parse(await readBody(req));
      if (!isObject(patch)) return send(res, 400, { error: "Expected a JSON object" });
      update(patch);
      return send(res, 200, state);
    }

    if (pathname === "/api/reset" && req.method === "POST") {
      state = structuredClone(defaults);
      persist();
      broadcast("state", state);
      return send(res, 200, state);
    }

    // One-off events (test alerts, "replay intro") that are not part of saved state
    if (pathname === "/api/trigger" && req.method === "POST") {
      const { name, data } = JSON.parse(await readBody(req));
      if (typeof name !== "string" || !/^[a-z-]{1,40}$/.test(name)) return send(res, 400, { error: "Bad trigger name" });
      broadcast("trigger", { name, data: data ?? null });
      return send(res, 200, { ok: true });
    }

    if (pathname === "/api/sync-subscribers" && req.method === "POST") {
      await syncSubscribers();
      return send(res, 200, state);
    }

    if (pathname === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(`retry: 2000\nevent: state\ndata: ${JSON.stringify(state)}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 20000);
      req.on("close", () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
    return serveStatic(res, pathname);
  } catch (err) {
    send(res, err.status ?? 400, { error: err instanceof SyntaxError ? "Invalid JSON" : err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  DePhantom overlay running\n`);
  console.log(`  Control panel   http://localhost:${PORT}/control`);
  console.log(`  Starting Soon   http://localhost:${PORT}/scenes/screen.html?mode=starting`);
  console.log(`  BRB             http://localhost:${PORT}/scenes/screen.html?mode=brb`);
  console.log(`  Ending          http://localhost:${PORT}/scenes/screen.html?mode=ending`);
  console.log(`  In-game         http://localhost:${PORT}/scenes/ingame.html`);
  console.log(`  Just Chatting   http://localhost:${PORT}/scenes/chatting.html\n`);
});
