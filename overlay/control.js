/**
 * Control panel: every input with data-path="a.b" edits that state value.
 * Changes are sent to the overlay server, which pushes them to all scenes instantly.
 */
import { get, remaining, formatClock, escapeHtml } from "/shared/overlay.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const PLATFORMS = ["youtube", "discord", "instagram", "whatsapp", "linktree", "link"];
const PRESETS = [
  ["#a855f7", "#e04bff", "#0a0a0f"], // Phantom (default)
  ["#ef4444", "#f97316", "#0c0807"], // Ember
  ["#22d3ee", "#3b82f6", "#060a10"], // Frost
  ["#22c55e", "#a3e635", "#070b07"], // Toxic
  ["#f59e0b", "#fde047", "#0b0905"], // Gold
  ["#f43f5e", "#a855f7", "#0b070c"], // Blood moon
];
const CAM_RECT = {
  "top-right": "X 1400 · Y 40", "top-left": "X 40 · Y 40",
  "bottom-right": "X 1400 · Y 770", "bottom-left": "X 40 · Y 770",
};
const SCENES = [
  ["Starting Soon", "/scenes/screen.html?mode=starting"],
  ["BRB", "/scenes/screen.html?mode=brb"],
  ["Ending", "/scenes/screen.html?mode=ending"],
  ["In-game", "/scenes/ingame.html"],
  ["Just Chatting", "/scenes/chatting.html"],
];

let state = {};

/* ---------- Server ---------- */
async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

/** Builds {a:{b:value}} from "a.b" and sends it. */
function save(path, value) {
  const patch = {};
  const keys = path.split(".");
  keys.reduce((o, k, i) => (o[k] = i === keys.length - 1 ? value : {}), patch);
  post("/api/state", patch).catch((err) => toast(`Not saved: ${err.message}`));
}

const timers = new Map();
const debounced = (key, fn, ms = 300) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(fn, ms)); };

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------- Generic fields ---------- */
function readField(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? 0 : Number(el.value);
  return el.value;
}

$$("[data-path]").forEach((el) => {
  const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
  el.addEventListener(evt, () => debounced(el.dataset.path, () => save(el.dataset.path, readField(el)), evt === "change" ? 0 : 300));
});

function fillFields() {
  $$("[data-path]").forEach((el) => {
    if (el === document.activeElement) return; // never fight the person typing
    const value = get(state, el.dataset.path);
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  });
  $("#camHint").innerHTML = `Place your webcam source at <code>${CAM_RECT[state.layout?.camCorner] ?? CAM_RECT["top-right"]}</code>, size <code>480 × 270</code>.`;
  $("#motion").checked = state.theme?.motion !== 0;
  if (document.activeElement !== $("#ticker")) $("#ticker").value = (state.ticker ?? []).join("\n");
  if (!$("#socials").contains(document.activeElement)) renderSocials();
}

/* ---------- Countdown ---------- */
const startTimer = (minutes) => {
  const target = new Date(Date.now() + minutes * 60_000).toISOString();
  post("/api/state", { countdown: { target, minutes } }).then(() => toast(`Timer set: ${minutes} min`));
};
$$("[data-minutes]").forEach((b) => b.addEventListener("click", () => startTimer(Number(b.dataset.minutes))));
$("#cdStart").addEventListener("click", () => {
  const m = Number($("#cdCustom").value);
  if (m > 0) startTimer(m);
});
$("#cdAdd").addEventListener("click", () => {
  const base = Math.max(Date.now(), new Date(state.countdown?.target ?? 0).getTime() || 0);
  post("/api/state", { countdown: { target: new Date(base + 60_000).toISOString() } });
});
$("#cdClear").addEventListener("click", () => post("/api/state", { countdown: { target: null } }).then(() => toast("Timer cleared")));
setInterval(() => {
  const ms = remaining(state.countdown?.target);
  $("#cdLeft").textContent = ms === null ? "No timer" : ms > 0 ? formatClock(ms) : "00:00 · finished";
}, 250);

/* ---------- Goal ---------- */
$$("[data-sub]").forEach((b) => b.addEventListener("click", () => {
  const current = Math.max(0, (Number(state.goal?.current) || 0) + Number(b.dataset.sub));
  post("/api/state", { goal: { current } });
}));
$("#syncSubs").addEventListener("click", async () => {
  if (!state.goal?.autoFromSite) return toast("Turn on automatic count first");
  const before = state.goal.current;
  const next = await post("/api/sync-subscribers");
  toast(next.goal.current !== before ? `Subscribers: ${next.goal.current}` : "No change (see server window for errors)");
});

/* ---------- Ticker ---------- */
$("#ticker").addEventListener("input", (e) => debounced("ticker", () =>
  post("/api/state", { ticker: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }), 500));

/* ---------- Socials ---------- */
function renderSocials() {
  $("#socials").innerHTML = (state.socials ?? []).map((s, i) => `
    <div class="social-row" data-i="${i}">
      <select data-k="platform" aria-label="Platform">${PLATFORMS.map((p) => `<option ${p === s.platform ? "selected" : ""}>${p}</option>`).join("")}</select>
      <input type="text" data-k="handle" value="${escapeHtml(s.handle)}" aria-label="Handle or link text">
      <span class="row" style="flex-wrap:nowrap">
        <label class="check" style="margin:0" title="Show"><input type="checkbox" data-k="show" ${s.show ? "checked" : ""}></label>
        <button data-k="remove" title="Remove" aria-label="Remove">✕</button>
      </span>
    </div>`).join("");
}
function saveSocials() {
  const socials = $$("#socials .social-row").map((row) => ({
    platform: row.querySelector('[data-k="platform"]').value,
    handle: row.querySelector('[data-k="handle"]').value,
    show: row.querySelector('[data-k="show"]').checked,
  }));
  state.socials = socials;
  debounced("socials", () => post("/api/state", { socials }), 300);
}
$("#socials").addEventListener("input", saveSocials);
$("#socials").addEventListener("change", saveSocials);
$("#socials").addEventListener("click", (e) => {
  if (e.target.dataset.k !== "remove") return;
  e.target.closest(".social-row").remove();
  saveSocials();
});
$("#addSocial").addEventListener("click", () => {
  state.socials = [...(state.socials ?? []), { platform: "link", handle: "", show: true }];
  renderSocials();
  $("#socials .social-row:last-child input[type=text]").focus();
});

/* ---------- Theme ---------- */
$("#presets").innerHTML = PRESETS.map(([p, s, bg], i) =>
  `<button data-preset="${i}" style="background:linear-gradient(135deg,${p},${s})" title="Preset ${i + 1}" aria-label="Colour preset ${i + 1}"></button>`).join("");
$("#presets").addEventListener("click", (e) => {
  const preset = PRESETS[e.target.dataset.preset];
  if (preset) post("/api/state", { theme: { primary: preset[0], secondary: preset[1], background: preset[2] } });
});
$("#motion").addEventListener("change", (e) => post("/api/state", { theme: { motion: e.target.checked ? 1 : 0 } }));

/* ---------- Misc ---------- */
$("#replay").addEventListener("click", () => post("/api/trigger", { name: "replay" }).then(() => toast("Intro replayed")));
$("#reset").addEventListener("click", () => {
  if (confirm("Reset every overlay setting to the defaults?")) post("/api/reset").then(() => toast("Reset to defaults"));
});

$("#links").innerHTML = SCENES.map(([name, path]) =>
  `<div><b>${name}</b><code title="Click to copy">${location.origin}${path}</code></div>`).join("");
$("#links").addEventListener("click", (e) => {
  const code = e.target.closest("code");
  if (!code) return;
  navigator.clipboard?.writeText(code.textContent).then(() => toast("Copied"), () => toast("Copy failed, select it manually"));
});

/* ---------- Live connection ---------- */
const es = new EventSource("/api/events");
es.addEventListener("state", (e) => {
  state = JSON.parse(e.data);
  $("#status").textContent = "Live";
  $("#status").classList.add("ok");
  fillFields();
});
es.onerror = () => {
  $("#status").textContent = "Server offline";
  $("#status").classList.remove("ok");
};
