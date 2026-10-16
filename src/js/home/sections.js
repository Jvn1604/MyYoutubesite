/** Applies settings.sections: order, visibility, matching nav links. */
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

  $$("[data-nav]").forEach((link) => { link.hidden = !enabled.includes(link.dataset.nav); });
}

/** Fill text nodes marked data-bind="group.field" and hrefs marked data-link="key". */
export function bindSettings(settings) {
  $$("[data-bind]").forEach((el) => {
    const [group, field] = el.dataset.bind.split(".");
    const value = field ? settings[group]?.[field] : undefined;
    if (typeof value === "string" && value) el.textContent = value;
  });
  $$("[data-link]").forEach((el) => {
    const url = settings.links?.[el.dataset.link];
    if (url) el.href = url;
  });
  $$('img[data-bind="logo"]').forEach((img) => { if (settings.brand.logoUrl) img.src = settings.brand.logoUrl; });
}
