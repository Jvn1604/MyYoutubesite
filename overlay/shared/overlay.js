/**
 * Shared runtime for every overlay scene: live state from the local server,
 * theme colours, text bindings, countdowns and rotating text.
 *
 *   data-bind="stream.game"        → textContent follows that state path
 *   data-show="layout.showGoal"    → element hidden when the value is falsy
 */
import { icon as siteIcon } from "/site/ui/icons.js";

export const icon = (name) => siteIcon(name).value;

export const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Subscribe to state. Calls onState(state) on connect and on every change,
 * onTrigger({name, data}) for one-off events. Reconnects by itself if the server restarts.
 */
export function connect({ onState, onTrigger } = {}) {
  let warned = false;
  const open = () => {
    const es = new EventSource("/api/events");
    es.addEventListener("state", (e) => {
      warned = false;
      document.documentElement.dataset.offline = "false";
      const state = JSON.parse(e.data);
      applyTheme(state);
      bindAll(document, state);
      onState?.(state);
    });
    es.addEventListener("trigger", (e) => onTrigger?.(JSON.parse(e.data)));
    es.onerror = () => {
      document.documentElement.dataset.offline = "true";
      if (!warned) console.warn("[overlay] lost connection to overlay server, retrying…");
      warned = true;
    };
  };
  open();
}

export function applyTheme({ theme = {} }) {
  const root = document.documentElement.style;
  if (theme.primary) root.setProperty("--p", theme.primary);
  if (theme.secondary) root.setProperty("--s", theme.secondary);
  if (theme.background) root.setProperty("--bg", theme.background);
  document.documentElement.dataset.motion = theme.motion === 0 ? "off" : "on";
}

export function bindAll(root, state) {
  root.querySelectorAll("[data-bind]").forEach((el) => {
    const value = get(state, el.dataset.bind);
    const text = value == null ? "" : String(value);
    if (el.textContent !== text) el.textContent = text;
  });
  root.querySelectorAll("[data-show]").forEach((el) => {
    el.hidden = !get(state, el.dataset.show);
  });
}

/** "mm:ss" (or "h:mm:ss") until target. Returns null when no target is set. */
export function remaining(targetIso, now = Date.now()) {
  if (!targetIso) return null;
  const ms = new Date(targetIso).getTime() - now;
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Cycles through items inside `el`, fading between them.
 * Returns a setter so the list can change live without restarting the cycle.
 */
export function rotator(el, { interval = 7000, render = (item) => escapeHtml(item), after } = {}) {
  let items = [];
  let index = 0;
  let signature = "";
  const show = () => {
    if (!items.length) { el.innerHTML = ""; return; }
    index %= items.length;
    el.classList.remove("is-in");
    void el.offsetWidth; // restart the CSS animation
    el.innerHTML = render(items[index]);
    el.classList.add("is-in");
    after?.(el, items[index]);
  };
  setInterval(() => { if (items.length > 1) { index++; show(); } }, interval);
  return (next) => {
    const sig = JSON.stringify(next);
    if (sig === signature) return;
    signature = sig;
    items = next;
    index = 0;
    show();
  };
}

export const visibleSocials = (state) => (state.socials ?? []).filter((s) => s.show && s.handle);

export const socialHtml = (s) =>
  `<span class="social social--${escapeHtml(s.platform)}">${icon(s.platform)}<span>${escapeHtml(s.handle)}</span></span>`;

export function goalProgress({ goal = {} }) {
  const start = Number(goal.start) || 0;
  const target = Number(goal.target) || 0;
  const current = Number(goal.current) || 0;
  const span = target - start;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((current - start) / span) * 100)) : 0;
  return { start, target, current, pct, reached: target > 0 && current >= target };
}

export const fmt = (n) => Number(n || 0).toLocaleString("en-US");

/** Renders the goal bar into any `.goal` element. Returns how much the count went up. */
export function renderGoal(el, state) {
  const { current, target, pct, reached } = goalProgress(state);
  if (!el.querySelector(".goal__tip")) el.querySelector(".goal__track").insertAdjacentHTML("beforeend", '<div class="goal__tip"></div>');
  const before = el._count;
  el._count = current;
  el.classList.toggle("is-reached", reached);
  el.querySelector(".goal__label").textContent = state.goal?.label ?? "";
  el.querySelector(".goal__count").innerHTML = `<b>${fmt(current)}</b> / ${fmt(target)}`;
  el.style.setProperty("--pct", `${Math.max(pct, 1.5)}%`);
  return before === undefined ? 0 : current - before;
}
