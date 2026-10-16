/** Media library modal: pick an existing image or upload a new one. Resolves to the media item or null. */
import { $, $$, html, render } from "../core/dom.js";
import { openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { icon } from "../ui/icons.js";
import { adminApi, csrfHeader } from "./session.js";
import { formatDate } from "../core/format.js";

export const KIND_LABELS = {
  logo: "Logo", avatar: "Profile picture", hero: "Hero background", game_cover: "Game cover",
  game_banner: "Game banner", background: "Background", other: "Other",
};

export const tile = (m, { selectable = false } = {}) => html`
  <${selectable ? "button" : "div"} class="media-tile" ${selectable ? html`type="button" aria-pressed="false" data-media-id="${m.id}"` : ""}>
    <img src="${m.variantUrls?.webp_400 ?? m.url}" alt="${m.alt || ""}" loading="lazy" width="150" height="150">
    <span class="media-tile__meta">${KIND_LABELS[m.kind] ?? m.kind} · ${m.width}×${m.height} · ${Math.round(m.bytes / 1024)} KB</span>
  </${selectable ? "button" : "div"}>`;

/** Upload one File; returns the created media item or null (errors are toasted). */
export async function uploadImage(file, { kind = "other", alt = "" } = {}) {
  if (!file.type.startsWith("image/")) { toast.error("✕ Only image files can be uploaded"); return null; }
  if (file.size > 4 * 1024 * 1024) { toast.error("✕ Images must be 4 MB or smaller"); return null; }
  const body = new FormData();
  body.append("file", file);
  body.append("kind", kind);
  body.append("alt", alt);
  try {
    const res = await fetch("/api/cms/media", { method: "POST", body, headers: csrfHeader(), credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(`✕ Unable to upload image: ${data.error ?? res.statusText}`); return null; }
    toast.success("✓ Image uploaded");
    return data;
  } catch {
    toast.error("✕ Unable to upload image: network error");
    return null;
  }
}

export function bindDropzone(zone, onFiles) {
  const input = $("input[type=file]", zone);
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.setAttribute("data-over", ""); });
  zone.addEventListener("dragleave", () => zone.removeAttribute("data-over"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.removeAttribute("data-over"); onFiles([...e.dataTransfer.files]); });
  input.addEventListener("change", () => { onFiles([...input.files]); input.value = ""; });
}

export const dropzoneHtml = (label = "Drop an image here or") => html`
  <label class="dropzone">
    ${icon("upload", { className: "empty__icon" })}
    <span>${label} <span class="link">browse</span></span>
    <span class="text-xs">JPG, PNG, WebP, AVIF or GIF · max 4 MB · auto-converted to WebP/AVIF</span>
    <input class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif">
  </label>`;

export function openMediaPicker({ kind = "other" } = {}) {
  return new Promise((resolve) => {
    let items = [];
    let chosen = null;
    const { dialog, close } = openModal({
      title: `Choose ${KIND_LABELS[kind]?.toLowerCase() ?? "image"}`,
      wide: true,
      body: html`<div class="stack"><div data-zone>${dropzoneHtml()}</div><div class="media-grid" data-grid aria-busy="true"><span class="skeleton skeleton--media"></span></div></div>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-close="use" disabled data-use>Use image</button>`,
      onClose: (value) => resolve(value === "use" ? chosen : null),
    });
    const grid = $("[data-grid]", dialog);
    const draw = () => {
      render(grid, items.length ? items.map((m) => tile(m, { selectable: true })) : html`<p class="text-muted text-sm">No ${KIND_LABELS[kind]?.toLowerCase()} images yet. Upload one above.</p>`);
      grid.removeAttribute("aria-busy");
    };
    const select = (id) => {
      chosen = items.find((m) => m.id === id) ?? null;
      $$("[data-media-id]", grid).forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.mediaId) === id)));
      $("[data-use]", dialog).disabled = !chosen;
    };
    grid.addEventListener("click", (e) => { const b = e.target.closest("[data-media-id]"); if (b) select(Number(b.dataset.mediaId)); });
    grid.addEventListener("dblclick", (e) => { if (e.target.closest("[data-media-id]") && chosen) close("use"); });
    bindDropzone($("[data-zone] .dropzone", dialog), async (files) => {
      const created = await uploadImage(files[0], { kind });
      if (created) { items = [created, ...items]; draw(); select(created.id); }
    });
    adminApi(`/api/cms/media?kind=${encodeURIComponent(kind)}`).then((res) => {
      items = res.ok ? res.data : [];
      draw();
    });
  });
}

export { formatDate };
