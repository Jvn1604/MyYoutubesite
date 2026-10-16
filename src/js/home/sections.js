/** Applies CMS settings to the static homepage shell: section order/visibility, text, links, SEO, icons. */
import { $, $$ } from "../core/dom.js";

export function applySections(container, sections) {
  const enabled = sections.map((s) => s.key);
  const all = $$("[data-section]", container);
  all.forEach((el) => { el.hidden = !enabled.includes(el.dataset.section); });

  // Hero always stays first; the rest follow the saved order
  enabled.filter((k) => k !== "hero").forEach((key) => {
    const el = $(`[data-section="${key}"]`, container);
    if (el) container.append(el);
  });

  // Nav links: hide disabled sections and follow the same order as the page
  const menu = $("#site-menu");
  const cta = $(".nav-links__cta", menu);
  enabled.forEach((key) => {
    const link = $(`[data-nav="${key}"]`, menu);
    if (link) menu.insertBefore(link, cta);
  });
  $$("[data-nav]").forEach((link) => { link.hidden = !enabled.includes(link.dataset.nav); });
}

function setMeta(selector, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, key, name] = /\[(\w+)="([^"]+)"\]/.exec(selector);
    el.setAttribute(key, name);
    document.head.append(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Fill text nodes marked data-bind="group.field" and hrefs marked data-link="key".
 * An empty value hides the element (e.g. the admin cleared the Tamil heading).
 */
export function bindSettings(settings) {
  $$("[data-bind]").forEach((el) => {
    const [group, field] = el.dataset.bind.split(".");
    if (!field) return;
    const value = settings[group]?.[field];
    if (typeof value !== "string") return;
    el.textContent = value;
    el.hidden = value.trim() === "";
  });
  $$("[data-link]").forEach((el) => {
    const url = settings.links?.[el.dataset.link];
    if (url) el.href = url;
  });

  const logo = settings.brand?.logoUrl;
  if (logo) {
    $$('img[data-bind="logo"]').forEach((img) => { img.src = logo; });
    const icon = document.head.querySelector('link[rel="icon"]');
    if (icon) { icon.href = logo; icon.type = logo.endsWith(".svg") ? "image/svg+xml" : "image/webp"; }
  }

  // SEO for browsers/JS-capable crawlers; the server injects the same tags for link previews (phase 14)
  const seo = settings.seo ?? {};
  if (seo.title) document.title = seo.title;
  setMeta('meta[name="description"]', "content", seo.description);
}
