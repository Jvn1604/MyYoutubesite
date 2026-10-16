/**
 * DOM helpers. `html` is the ONLY way markup is built from data:
 * every interpolated value is escaped unless wrapped with `raw()`
 * or is itself the result of another `html` call.
 */

const SAFE = Symbol("safe-html");

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Mark a trusted, already-safe string (e.g. a static SVG icon). */
export const raw = (markup) => ({ [SAFE]: true, value: String(markup) });

function serialize(value) {
  if (value == null || value === false) return "";
  if (Array.isArray(value)) return value.map(serialize).join("");
  if (value[SAFE]) return value.value;
  return escapeHtml(value);
}

/** Tagged template: html`<p>${userText}</p>` → safe markup object. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += serialize(v) + strings[i + 1]; });
  return raw(out);
}

/** Replace an element's content with html`` output (or an array of them). */
export function render(el, markup) {
  if (el) el.innerHTML = serialize(markup);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Only allow http(s)/mailto/relative URLs in attributes built from data. */
export function safeUrl(url, fallback = "#") {
  if (typeof url !== "string" || !url.trim()) return fallback;
  try {
    const u = new URL(url, location.origin);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : fallback;
  } catch {
    return fallback;
  }
}

/** Fade images in once loaded; swap to a fallback on error (no inline handlers). */
export function enhanceImages(root = document, fallbackSrc) {
  $$("img[data-src-fallback], img[loading='lazy']", root).forEach((img) => {
    if (img.complete && img.naturalWidth) return;
    const useFallback = () => {
      const fb = img.dataset.srcFallback || fallbackSrc;
      if (fb && img.src !== new URL(fb, location.href).href) img.src = fb;
      else img.removeAttribute("data-loading");
    };
    img.setAttribute("data-loading", "");
    img.addEventListener("load", function onLoad() {
      // YouTube serves a 120×90 grey placeholder (HTTP 200) for missing thumbnails
      if (img.src.includes("i.ytimg.com") && img.naturalWidth <= 120) return useFallback();
      img.removeAttribute("data-loading");
      img.removeEventListener("load", onLoad);
    });
    img.addEventListener("error", useFallback, { once: true });
  });
}
