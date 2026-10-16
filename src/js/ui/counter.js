/**
 * Animated number counters: <span data-count="1352" data-format="compact">1.35K</span>
 * The final formatted value is rendered first (correct without JS / for screen readers);
 * the animation only runs when the element scrolls into view and motion is allowed.
 */
import { $$ } from "../core/dom.js";
import { formatNumber } from "../core/format.js";
import { motionAllowed } from "../core/motion.js";

const DURATION = 1600;
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

function animate(el) {
  const target = Number(el.dataset.count);
  const format = el.dataset.format || "compact";
  const final = formatNumber(target, format);
  if (!Number.isFinite(target) || !motionAllowed()) {
    el.textContent = final;
    return;
  }
  el.setAttribute("aria-label", final);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    el.textContent = formatNumber(Math.round(target * easeOutExpo(t)), format);
    if (t < 1) requestAnimationFrame(tick);
    else { el.textContent = final; el.removeAttribute("aria-label"); }
  };
  requestAnimationFrame(tick);
}

export function initCounters(root = document) {
  const els = $$("[data-count]:not([data-counted])", root);
  els.forEach((el) => {
    el.setAttribute("data-counted", "");
    el.textContent = formatNumber(Number(el.dataset.count), el.dataset.format || "compact");
  });
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}
