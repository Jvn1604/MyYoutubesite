/** Homepage section order + visibility (Hero stays first). */
import { $, html, render } from "../../core/dom.js";
import { icon } from "../../ui/icons.js";
import { load, saveSetting } from "../save.js";
import { makeSortable } from "../sortable.js";

const LABELS = {
  hero: ["Hero", "Name, live status, buttons"], stats: ["Channel stats", "Subscribers, views, videos"],
  latest: ["Latest", "Latest upload and livestream"], streams: ["Recent streams", "Newest finished streams"],
  videos: ["Video library", "All videos with filters and search"], games: ["Games", "Game library cards"],
  worlds: ["Game worlds", "Cinematic scroll story of your top games"],
  schedule: ["Schedule", "Weekly schedule and next stream"], goal: ["Subscriber goal", "Progress bar"],
  community: ["Community", "Social links"], support: ["Support", "Membership, Super Chat"], about: ["About", "Creator profile"],
};

export async function mount(root) {
  const settings = await load("/api/cms/settings");
  let sections = settings.sections;
  let dirty = false;

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Homepage sections</h2><p>Turn sections on or off and drag to reorder them. The hero always stays at the top.</p></div></div>
    <form class="card panel" novalidate>
      <ol class="sortable" role="list" data-list></ol>
      <div class="form-actions"><button class="btn btn--primary" type="submit">Save order</button></div>
    </form>`);
  const list = $("[data-list]", root);

  const draw = () => render(list, sections.map((s) => {
    const [label, desc] = LABELS[s.key];
    const fixed = s.key === "hero";
    return html`<li class="sortable__item" ${fixed ? "" : html`data-sort-id="${s.key}"`}>
      <span class="sortable__handle" ${fixed ? html`aria-hidden="true"` : html`data-sort-handle title="Drag to reorder" aria-hidden="true"`}>${fixed ? "•" : "⋮⋮"}</span>
      <span class="sortable__main"><span><strong>${label}</strong><br><span class="text-xs text-muted">${desc}</span></span></span>
      <span class="sortable__tools">
        ${fixed ? html`<span class="badge">Always first</span>` : html`
          <button class="icon-btn" type="button" data-sort-move="up" aria-label="Move ${label} up">${icon("up")}</button>
          <button class="icon-btn" type="button" data-sort-move="down" aria-label="Move ${label} down">${icon("down")}</button>`}
        <label class="switch"><input type="checkbox" data-toggle="${s.key}" ${s.enabled ? "checked" : ""} ${fixed ? "disabled" : ""}><span class="visually-hidden">Show ${label}</span></label>
      </span>
    </li>`;
  }));
  draw();

  // Only non-hero items are sortable; the hero <li> stays first.
  makeSortable(list, {
    onChange: (keys) => {
      sections = [sections[0], ...keys.map((k) => sections.find((s) => s.key === k))];
      dirty = true;
    },
  });
  list.addEventListener("change", (e) => {
    const key = e.target.dataset.toggle;
    if (!key) return;
    sections = sections.map((s) => (s.key === key ? { ...s, enabled: e.target.checked } : s));
    dirty = true;
  });
  $("form", root).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", root);
    btn.setAttribute("aria-busy", "true");
    const res = await saveSetting("sections", sections, "✓ Section order saved");
    btn.removeAttribute("aria-busy");
    if (res.ok) dirty = false;
  });
  return { isDirty: () => dirty };
}
