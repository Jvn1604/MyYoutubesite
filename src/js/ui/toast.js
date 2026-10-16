/**
 * Accessible toasts. toast.success("Settings saved")
 * Success/info are announced politely; warnings/errors assertively.
 */
import { html, render } from "../core/dom.js";

const ICONS = { success: "✓", info: "i", warning: "⚠", error: "✕" };
const DURATION = { success: 4000, info: 5000, warning: 7000, error: 9000 };

let regions;

function getRegions() {
  if (!regions) {
    const stack = Object.assign(document.createElement("div"), { className: "toast-region" });
    const make = (role, live) => {
      const el = Object.assign(document.createElement("div"), { className: "toast-live" });
      el.setAttribute("role", role);
      el.setAttribute("aria-live", live);
      return el;
    };
    regions = { polite: make("status", "polite"), assertive: make("alert", "assertive") };
    stack.append(regions.assertive, regions.polite);
    document.body.append(stack);
  }
  return regions;
}

function dismiss(el) {
  if (!el.isConnected || el.hasAttribute("data-leaving")) return;
  el.setAttribute("data-leaving", "");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 400); // fallback when animations are off
}

export function showToast(message, type = "info", { duration = DURATION[type] } = {}) {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  render(el, html`
    <span class="toast__icon" aria-hidden="true">${ICONS[type]}</span>
    <p class="toast__msg">${message}</p>
    <button class="toast__close" type="button" aria-label="Dismiss notification">×</button>`);
  el.querySelector(".toast__close").addEventListener("click", () => dismiss(el));

  const { polite, assertive } = getRegions();
  (type === "error" || type === "warning" ? assertive : polite).append(el);

  let timer = setTimeout(() => dismiss(el), duration);
  // Pause while hovered so people can read it
  el.addEventListener("pointerenter", () => clearTimeout(timer));
  el.addEventListener("pointerleave", () => { timer = setTimeout(() => dismiss(el), 2000); });
  return el;
}

export const toast = {
  success: (m, o) => showToast(m, "success", o),
  info: (m, o) => showToast(m, "info", o),
  warning: (m, o) => showToast(m, "warning", o),
  error: (m, o) => showToast(m, "error", o),
};
