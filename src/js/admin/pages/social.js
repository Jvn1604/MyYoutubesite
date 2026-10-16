/** Social links CRUD with drag-and-drop ordering. */
import { $, html, render } from "../../core/dom.js";
import { icon } from "../../ui/icons.js";
import { openModal, confirmDialog } from "../../ui/modal.js";
import { load, save } from "../save.js";
import { makeSortable } from "../sortable.js";
import { fieldHtml, enhanceFields, readFields, highlightError } from "../forms.js";

const ICONS = ["youtube", "discord", "whatsapp", "instagram", "linktree", "link"];
const FIELDS = [
  { name: "label", label: "Label", type: "text", max: 60 },
  { name: "platform", label: "Platform id", type: "text", max: 30, hint: "Lowercase, e.g. discord, tiktok" },
  { name: "url", label: "Link (https)", type: "url", max: 500, wide: true },
  { name: "description", label: "Description", type: "text", max: 140, wide: true },
  { name: "icon", label: "Icon", type: "select", options: ICONS.map((v) => ({ value: v, label: v })) },
  { name: "accent", label: "Accent colour", type: "color" },
  { name: "enabled", label: "Show", type: "switch" },
];

export async function mount(root) {
  let links = await load("/api/cms/socials");

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Social links</h2><p>Shown in the Community section and footer. Drag to reorder.</p></div>
      <button class="btn btn--primary" type="button" data-new>${icon("plus")}Add link</button></div>
    <section class="card panel"><ol class="sortable" role="list" data-list></ol></section>`);
  const list = $("[data-list]", root);

  const draw = () => render(list, links.length ? links.map((l) => html`
    <li class="sortable__item" data-sort-id="${l.id}">
      <span class="sortable__handle" data-sort-handle title="Drag to reorder" aria-hidden="true">⋮⋮</span>
      <span class="sortable__main">${icon(ICONS.includes(l.icon) ? l.icon : "link")}
        <span><strong>${l.label}</strong><br><span class="text-xs text-muted truncate-2">${l.url}</span></span>
        ${l.enabled ? "" : html`<span class="badge badge--hidden">Hidden</span>`}</span>
      <span class="sortable__tools">
        <button class="icon-btn" type="button" data-sort-move="up" aria-label="Move ${l.label} up">${icon("up")}</button>
        <button class="icon-btn" type="button" data-sort-move="down" aria-label="Move ${l.label} down">${icon("down")}</button>
        <label class="switch"><input type="checkbox" data-toggle="${l.id}" ${l.enabled ? "checked" : ""}><span class="visually-hidden">Show ${l.label}</span></label>
        <button class="icon-btn" type="button" data-edit="${l.id}" aria-label="Edit ${l.label}">${icon("edit")}</button>
        <button class="icon-btn" type="button" data-delete="${l.id}" aria-label="Delete ${l.label}">${icon("trash")}</button>
      </span>
    </li>`) : html`<li class="empty"><p class="empty__title">No links yet</p></li>`);
  draw();

  makeSortable(list, {
    onChange: async (ids) => {
      const res = await save("/api/cms/socials/reorder", { method: "POST", body: { ids: ids.map(Number) }, success: "✓ Order saved" });
      if (res.ok) links = ids.map((id) => links.find((l) => l.id === Number(id)));
    },
  });

  const payload = (v) => ({ ...v, accent: /^#[0-9a-f]{6}$/i.test(v.accent ?? "") ? v.accent : null });

  function editor(link = null) {
    const values = link ?? { icon: "link", enabled: true, accent: "#a855f7" };
    const { dialog, close } = openModal({
      title: link ? `Edit ${link.label}` : "Add link",
      body: html`<form class="form-grid" data-form novalidate>${FIELDS.map((f) => fieldHtml(f, values[f.name]))}</form>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-save>Save link</button>`,
    });
    const form = $("[data-form]", dialog);
    enhanceFields(form);
    $("[data-save]", dialog).addEventListener("click", async () => {
      const res = await save(link ? `/api/cms/socials/${link.id}` : "/api/cms/socials", { method: link ? "PUT" : "POST", body: payload(readFields(form, FIELDS)), success: "✓ Link saved" });
      if (!res.ok) return highlightError(form, res.error);
      links = link ? links.map((l) => (l.id === link.id ? res.data : l)) : [...links, res.data];
      draw();
      close();
    });
  }

  list.addEventListener("change", async (e) => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const l = links.find((x) => x.id === Number(t.dataset.toggle));
    const { id, sortOrder, ...rest } = l;
    const res = await save(`/api/cms/socials/${id}`, { method: "PUT", body: payload({ ...rest, enabled: t.checked }), success: t.checked ? "✓ Link shown" : "✓ Link hidden" });
    if (res.ok) { links = links.map((x) => (x.id === id ? res.data : x)); draw(); } else t.checked = !t.checked;
  });

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor();
    const edit = e.target.closest("[data-edit]");
    if (edit) return editor(links.find((l) => l.id === Number(edit.dataset.edit)));
    const del = e.target.closest("[data-delete]");
    if (del) {
      const l = links.find((x) => x.id === Number(del.dataset.delete));
      if (!(await confirmDialog({ title: `Delete ${l.label}?`, message: l.url, confirmLabel: "Delete", danger: true }))) return;
      const res = await save(`/api/cms/socials/${l.id}`, { method: "DELETE", success: "✓ Link deleted" });
      if (res.ok) { links = links.filter((x) => x.id !== l.id); draw(); }
    }
  });
}
