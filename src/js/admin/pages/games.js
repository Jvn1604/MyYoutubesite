/** Games: create / edit / delete / hide / reorder. */
import { $, html, render } from "../../core/dom.js";
import { icon } from "../../ui/icons.js";
import { openModal, confirmDialog } from "../../ui/modal.js";
import { load, save } from "../save.js";
import { makeSortable } from "../sortable.js";
import { fieldHtml, enhanceFields, readFields, highlightError } from "../forms.js";
import { GAME_STATUS } from "../../home/games.js";

const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const fieldsFor = (game) => [
  { name: "name", label: "Name", type: "text", max: 120 },
  { name: "slug", label: "Slug (URL name)", type: "text", max: 80, hint: "Lowercase, numbers and dashes." },
  { name: "status", label: "Status", type: "select", options: Object.entries(GAME_STATUS).map(([value, s]) => ({ value, label: s.label })) },
  { name: "genre", label: "Genre", type: "text", max: 60 },
  { name: "releaseYear", label: "Release year", type: "number", min: 1970, step: 1 },
  { name: "playlistUrl", label: "YouTube playlist", type: "url", max: 500, placeholder: "https://www.youtube.com/playlist?list=…" },
  { name: "coverMediaId", label: "Cover (portrait)", type: "image", kind: "game_cover", returns: "id", previewUrl: game?.coverUrl ?? "", hint: "Empty = thumbnail of the newest video for this game." },
  { name: "bannerMediaId", label: "Banner (wide)", type: "image", kind: "game_banner", returns: "id" },
  { name: "description", label: "Description", type: "textarea", max: 1000 },
  { name: "titleKeywords", label: "Auto-assign keywords", type: "list", addLabel: "Add keyword", max: 60, hint: "Synced videos whose title contains one of these are linked to this game automatically." },
  { name: "featured", label: "Featured", type: "switch", switchLabel: "Featured" },
  { name: "hidden", label: "Visibility", type: "switch", switchLabel: "Hidden from website" },
];

export async function mount(root) {
  let games = await load("/api/cms/games");

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Games</h2><p>Your game library. Drag to change the order on the website.</p></div>
      <button class="btn btn--primary" type="button" data-new>${icon("plus")}Add game</button></div>
    <section class="card panel"><ol class="sortable" role="list" data-list></ol></section>`);
  const list = $("[data-list]", root);

  const draw = () => render(list, games.length ? games.map((g) => html`
    <li class="sortable__item" data-sort-id="${g.id}">
      <span class="sortable__handle" data-sort-handle title="Drag to reorder" aria-hidden="true">⋮⋮</span>
      <span class="sortable__main">
        ${g.coverUrl ? html`<img src="${g.coverUrl}" alt="" width="44" height="44">` : html`<span class="avatar" aria-hidden="true"></span>`}
        <span><strong>${g.name}</strong><br><span class="text-xs text-muted">${GAME_STATUS[g.status]?.label} · ${g.videoCount} video${g.videoCount === 1 ? "" : "s"}${g.genre ? ` · ${g.genre}` : ""}</span></span>
        ${g.featured ? html`<span class="badge badge--featured">Featured</span>` : ""}${g.hidden ? html`<span class="badge badge--hidden">Hidden</span>` : ""}
      </span>
      <span class="sortable__tools">
        <button class="icon-btn" type="button" data-sort-move="up" aria-label="Move ${g.name} up">${icon("up")}</button>
        <button class="icon-btn" type="button" data-sort-move="down" aria-label="Move ${g.name} down">${icon("down")}</button>
        <button class="icon-btn" type="button" data-edit="${g.id}" aria-label="Edit ${g.name}">${icon("edit")}</button>
        <button class="icon-btn" type="button" data-delete="${g.id}" aria-label="Delete ${g.name}">${icon("trash")}</button>
      </span>
    </li>`) : html`<li class="empty"><p class="empty__title">No games yet</p><p class="text-sm">Add the games you play so visitors can browse by game.</p></li>`);
  draw();

  makeSortable(list, {
    onChange: async (ids) => {
      const res = await save("/api/cms/games/reorder", { method: "POST", body: { ids: ids.map(Number) }, success: "✓ Order saved" });
      if (res.ok) games = ids.map((id) => games.find((g) => g.id === Number(id)));
    },
  });

  function editor(game = null) {
    const fields = fieldsFor(game);
    const values = game ?? { status: "playing", titleKeywords: [], featured: false, hidden: false };
    const { dialog, close } = openModal({
      title: game ? `Edit ${game.name}` : "Add game",
      wide: true,
      body: html`<form class="form-grid" data-form novalidate>${fields.map((f) => fieldHtml(f, values[f.name]))}</form>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-save>${game ? "Save game" : "Add game"}</button>`,
    });
    const form = $("[data-form]", dialog);
    enhanceFields(form);
    const name = form.querySelector('[data-field="name"]');
    const slug = form.querySelector('[data-field="slug"]');
    let slugTouched = Boolean(game);
    slug.addEventListener("input", () => { slugTouched = true; });
    name.addEventListener("input", () => { if (!slugTouched) slug.value = slugify(name.value); });

    $("[data-save]", dialog).addEventListener("click", async (e) => {
      const btn = e.currentTarget; // currentTarget is null after the await below
      const v = readFields(form, fields);
      const body = { ...v, releaseYear: v.releaseYear || null, coverMediaId: v.coverMediaId || null, bannerMediaId: v.bannerMediaId || null };
      btn.setAttribute("aria-busy", "true");
      const res = await save(game ? `/api/cms/games/${game.id}` : "/api/cms/games", { method: game ? "PUT" : "POST", body, success: game ? "✓ Game saved" : "✓ Game added" });
      btn.removeAttribute("aria-busy");
      if (!res.ok) return highlightError(form, res.error);
      games = game ? games.map((g) => (g.id === game.id ? res.data : g)) : [...games, res.data];
      draw();
      close();
    });
  }

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor();
    const edit = e.target.closest("[data-edit]");
    if (edit) return editor(games.find((g) => g.id === Number(edit.dataset.edit)));
    const del = e.target.closest("[data-delete]");
    if (del) {
      const g = games.find((x) => x.id === Number(del.dataset.delete));
      const ok = await confirmDialog({ title: `Delete ${g.name}?`, message: `Its ${g.videoCount} video(s) stay on the website, just without a game. This can't be undone.`, confirmLabel: "Delete game", danger: true });
      if (!ok) return;
      const res = await save(`/api/cms/games/${g.id}`, { method: "DELETE", success: "✓ Game deleted" });
      if (res.ok) { games = games.filter((x) => x.id !== g.id); draw(); }
    }
  });
}
