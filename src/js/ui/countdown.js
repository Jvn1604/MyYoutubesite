/**
 * One shared 1-second ticker for every <span data-countdown="ISO">.
 * Pauses while the tab is hidden. When a countdown reaches zero it
 * dispatches "countdown:done" on the element.
 */
import { $$, html, render } from "../core/dom.js";
import { splitDuration } from "../core/time.js";

let timer = null;
const pad = (n) => String(n).padStart(2, "0");

export function countdownMarkup(target) {
  return html`<span class="countdown" data-countdown="${new Date(target).toISOString()}" role="timer" aria-live="off"></span>`;
}

function paint(el, now) {
  const target = Date.parse(el.dataset.countdown);
  const { days, hours, minutes, seconds } = splitDuration(target - now);
  const units = days ? [[days, "d"], [hours, "h"], [minutes, "m"]] : [[hours, "h"], [minutes, "m"], [seconds, "s"]];
  render(el, html`${units.map(([v, u], i) => html`${i ? html`<span class="countdown__sep" aria-hidden="true">:</span>` : ""}<span class="countdown__unit">${pad(v)}<small>${u}</small></span>`)}`);
  el.setAttribute("aria-label", `${days ? `${days} days ` : ""}${hours} hours ${minutes} minutes`);
  if (target <= now && !el.hasAttribute("data-done")) {
    el.setAttribute("data-done", "");
    el.dispatchEvent(new CustomEvent("countdown:done", { bubbles: true }));
  }
}

function tick() {
  const now = Date.now();
  const els = $$("[data-countdown]");
  els.forEach((el) => paint(el, now));
  if (!els.length) stop();
}

function stop() { clearInterval(timer); timer = null; }
function start() { if (!timer) { tick(); timer = setInterval(tick, 1000); } }

export function initCountdowns() {
  start();
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}
