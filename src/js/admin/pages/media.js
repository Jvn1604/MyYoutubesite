/** Media library: upload, filter by type, edit alt text, delete (blocked while in use). */
import { $, html, render } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { icon } from "../../ui/icons.js";
import { openModal, confirmDialog } from "../../ui/modal.js";
import { load, save } from "../save.js";
import { KIND_LABELS, uploadImage, bindDropzone, dropzoneHtml, tile } from "../media-picker.js";

export async function mount(root) {
  let items = await load("/api/cms/media");
  let filter = "";

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Media</h2><p>Logos, profile pictures, hero images and game covers. Uploads are optimised automatically.</p></div></div>
    <section class="card panel">
      <div class="form-grid">
        <div class="field"><label class="field__label" for="up-kind">Upload as</label>
          <select class="select" id="up-kind" data-kind>${Object.entries(KIND_LABELS).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div>
        <div class="field"><label class="field__label" for="up-alt">Description (alt text)</label><input class="input" id="up-alt" data-alt maxlength="200" placeholder="e.g. DePhantom logo"></div>
      </div>
      <div data-zone>${dropzoneHtml()}</div>
    </section>
    <section class="card panel">
      <div class="panel__head"><h2 class="panel__title">Library</h2>
        <label class="visually-hidden" for="m-filter">Filter</label>
        <select class="select" id="m-filter" data-filter><option value="">All images</option>${Object.entries(KIND_LABELS).map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div>
      <div class="media-grid" data-grid></div>
    </section>`);

  const grid = $("[data-grid]", root);
  const draw = () => {
    const shown = filter ? items.filter((m) => m.kind === filter) : items;
    render(grid, shown.length ? shown.map((m) => html`<div class="stack stack--sm">${tile(m)}
      <div class="cluster"><button class="btn btn--ghost btn--sm" type="button" data-details="${m.id}">${icon("edit")}Details</button>
      <button class="icon-btn" type="button" data-delete="${m.id}" aria-label="Delete image">${icon("trash")}</button></div></div>`)
      : html`<p class="text-sm text-muted">No images yet.</p>`);
  };
  draw();

  bindDropzone($("[data-zone] .dropzone", root), async (files) => {
    for (const file of files) {
      const created = await uploadImage(file, { kind: $("[data-kind]", root).value, alt: $("[data-alt]", root).value });
      if (created) { items = [created, ...items]; draw(); }
    }
  });
  $("[data-filter]", root).addEventListener("change", (e) => { filter = e.target.value; draw(); });

  root.addEventListener("click", async (e) => {
    const det = e.target.closest("[data-details]");
    if (det) {
      const m = items.find((x) => x.id === Number(det.dataset.details));
      const { dialog, close } = openModal({
        title: KIND_LABELS[m.kind],
        body: html`<div class="stack"><img src="${m.variantUrls?.webp_800 ?? m.url}" alt="${m.alt}" width="${m.width}" height="${m.height}">
          <ul class="list-plain" role="list"><li><span>Size</span><span>${m.width}×${m.height} · ${Math.round(m.bytes / 1024)} KB</span></li>
          <li><span>Uploaded</span><span>${formatDate(m.createdAt)}</span></li><li><span>Versions</span><span>${Object.keys(m.variants).join(", ") || "original only"}</span></li></ul>
          <div class="field"><label class="field__label" for="alt-edit">Description (alt text)</label><input class="input" id="alt-edit" value="${m.alt}" maxlength="200"></div>
          <div class="field"><label class="field__label" for="url-copy">Image URL</label><input class="input mono" id="url-copy" value="${m.url}" readonly></div></div>`,
        footer: html`<button class="btn btn--ghost" type="button" data-close="">Close</button><button class="btn btn--primary" type="button" data-save>Save</button>`,
      });
      $("[data-save]", dialog).addEventListener("click", async () => {
        const res = await save(`/api/cms/media/${m.id}`, { method: "PATCH", body: { alt: $("#alt-edit", dialog).value }, success: "✓ Image updated" });
        if (res.ok) { items = items.map((x) => (x.id === m.id ? res.data : x)); draw(); close(); }
      });
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      if (!(await confirmDialog({ title: "Delete this image?", message: "It will be removed from storage. Images still in use can't be deleted.", confirmLabel: "Delete", danger: true }))) return;
      const res = await save(`/api/cms/media/${del.dataset.delete}`, { method: "DELETE", success: "✓ Image deleted", failure: "✕ Unable to delete image" });
      if (res.ok) { items = items.filter((x) => x.id !== Number(del.dataset.delete)); draw(); }
    }
  });
}
