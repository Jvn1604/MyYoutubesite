/**
 * Synced YouTube videos with website-only controls (hide, feature, game, type, description, priority).
 * Nothing here changes the video on YouTube.
 */
import { $, html, render, safeUrl } from "../../core/dom.js";
import { formatNumber, formatDate, formatDuration } from "../../core/format.js";
import { icon } from "../../ui/icons.js";
import { openModal } from "../../ui/modal.js";
import { adminApi } from "../session.js";
import { load, save } from "../save.js";
import { fieldHtml, enhanceFields, readFields } from "../forms.js";

const KIND = { video: "Video", short: "Short", stream: "Stream" };

export async function mount(root) {
  const games = await load("/api/cms/games");
  const state = { q: "", type: "all", game: "", status: "all", page: 1 };

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Videos</h2>
      <p>Everything here comes from YouTube automatically. These settings only change how a video appears on your website.</p></div></div>
    <section class="card panel">
      <form class="toolbar" role="search" data-filters>
        <div class="input-group">${icon("search")}<label class="visually-hidden" for="v-q">Search videos</label><input class="input" id="v-q" type="search" name="q" placeholder="Search titles…" maxlength="80"></div>
        <label class="visually-hidden" for="v-type">Type</label>
        <select class="select" id="v-type" name="type"><option value="all">All types</option><option value="video">Videos</option><option value="stream">Livestreams</option><option value="short">Shorts</option></select>
        <label class="visually-hidden" for="v-game">Game</label>
        <select class="select" id="v-game" name="game"><option value="">All games</option><option value="none">No game</option>${games.map((g) => html`<option value="${g.id}">${g.name}</option>`)}</select>
        <label class="visually-hidden" for="v-status">Status</label>
        <select class="select" id="v-status" name="status"><option value="all">Any status</option><option value="visible">Visible</option><option value="hidden">Hidden</option><option value="featured">Featured</option><option value="unavailable">Removed from YouTube</option></select>
      </form>
      <p class="text-sm text-muted" aria-live="polite" data-count></p>
      <div data-table></div>
      <div class="cluster cluster--between" data-pager></div>
    </section>`);

  const table = $("[data-table]", root);
  const gameName = (id) => games.find((g) => g.id === id)?.name;

  const row = (v) => html`<tr data-id="${v.id}">
    <td><div class="cluster"><img class="table__thumb" src="${safeUrl(v.thumbnails?.medium ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`)}" alt="" loading="lazy" width="96" height="54">
      <span><a class="table__title truncate-2" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${v.title}</a>
      <span class="text-xs text-muted">${formatDate(v.publishedAt)}${v.durationSeconds ? ` · ${formatDuration(v.durationSeconds)}` : ""} · ${v.views != null ? `${formatNumber(v.views)} views` : "–"}</span></span></div></td>
    <td>${v.liveState === "live" ? html`<span class="badge badge--live">Live</span>` : v.liveState === "upcoming" ? html`<span class="badge badge--upcoming">Upcoming</span>` : html`<span class="badge">${KIND[v.kindOverride ?? v.kind]}</span>`}
      ${v.kindOverride ? html`<span class="badge badge--info" title="Type set manually">Manual</span>` : ""}</td>
    <td>${v.gameId ? gameName(v.gameId) ?? "–" : html`<span class="text-muted">–</span>`}</td>
    <td>${!v.isAvailable ? html`<span class="badge badge--error">Removed</span>` : ""}
      <label class="switch"><input type="checkbox" data-toggle="hidden" ${v.hidden ? "" : "checked"}><span>${v.hidden ? "Hidden" : "Visible"}</span></label></td>
    <td><label class="switch"><input type="checkbox" data-toggle="featured" ${v.featured ? "checked" : ""}><span class="visually-hidden">Featured</span></label></td>
    <td class="table__actions"><button class="btn btn--ghost btn--sm" type="button" data-edit>${icon("edit")}Edit</button></td>
  </tr>`;

  let items = [];
  async function refresh() {
    table.setAttribute("aria-busy", "true");
    const params = new URLSearchParams({ ...state, page: String(state.page) });
    const res = await adminApi(`/api/cms/videos?${params}`);
    table.removeAttribute("aria-busy");
    if (!res.ok) return render(table, html`<div class="empty empty--error"><p class="empty__title">Couldn't load videos</p><p class="text-sm">${res.error}</p></div>`);
    items = res.data.items;
    $("[data-count]", root).textContent = `${formatNumber(res.data.total, "full")} video${res.data.total === 1 ? "" : "s"}`;
    render(table, items.length ? html`<div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Video</th><th scope="col">Type</th><th scope="col">Game</th><th scope="col">On website</th><th scope="col">Featured</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${items.map(row)}</tbody></table></div>`
      : html`<div class="empty"><p class="empty__title">No videos match</p><p class="text-sm">Try different filters, or run a YouTube sync.</p></div>`);
    render($("[data-pager]", root), html`
      <button class="btn btn--ghost btn--sm" type="button" data-page="-1" ${state.page > 1 ? "" : "disabled"}>← Newer</button>
      <span class="text-sm text-muted">Page ${state.page}</span>
      <button class="btn btn--ghost btn--sm" type="button" data-page="1" ${res.data.hasMore ? "" : "disabled"}>Older →</button>`);
  }

  async function patch(id, body, msg) {
    const res = await save(`/api/cms/videos/${encodeURIComponent(id)}`, { method: "PATCH", body, success: msg });
    if (res.ok) {
      const i = items.findIndex((v) => v.id === id);
      items[i] = res.data;
      // Parse inside a <tbody>: <tr> markup parsed out of table context loses its tags
      const tmp = document.createElement("tbody");
      tmp.innerHTML = row(res.data).value;
      $(`tr[data-id="${CSS.escape(id)}"]`, table)?.replaceWith(tmp.firstElementChild);
    }
    return res;
  }

  function edit(v) {
    const fields = [
      { name: "gameId", label: "Game", type: "select", options: [{ value: "", label: "No game" }, ...games.map((g) => ({ value: g.id, label: g.name }))], hint: "Choosing a game here overrides automatic matching." },
      { name: "kindOverride", label: "Type", type: "select", options: [{ value: "", label: `Automatic (${KIND[v.kind]})` }, ...Object.entries(KIND).map(([value, label]) => ({ value, label }))] },
      { name: "priority", label: "Display priority", type: "number", min: -100, step: 1, hint: "Higher shows first among featured videos." },
      { name: "customDescription", label: "Website description", type: "textarea", max: 2000, hint: "Shown on the website only. YouTube is not changed." },
    ];
    const { dialog, close } = openModal({
      title: v.title,
      body: html`<form class="stack" data-edit-form>${fields.map((f) => fieldHtml(f, f.name === "gameId" ? v.gameId ?? "" : f.name === "kindOverride" ? v.kindOverride ?? "" : v[f.name]))}</form>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-save>Save</button>`,
    });
    const form = $("[data-edit-form]", dialog);
    enhanceFields(form);
    $("[data-save]", dialog).addEventListener("click", async (e) => {
      const btn = e.currentTarget; // currentTarget is null after the await below
      const f = readFields(form, fields);
      btn.setAttribute("aria-busy", "true");
      const gameId = f.gameId ? Number(f.gameId) : null;
      const res = await patch(v.id, {
        // Only send the game when it changed: sending it locks it against auto-assignment
        ...(gameId !== (v.gameId ?? null) ? { gameId } : {}),
        kindOverride: f.kindOverride || null,
        priority: Number(f.priority) || 0,
        customDescription: f.customDescription || null,
      }, "✓ Video updated");
      btn.removeAttribute("aria-busy");
      if (res.ok) close();
    });
  }

  let debounce;
  const filters = $("[data-filters]", root);
  filters.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { Object.assign(state, readFields(filters, ["q", "type", "game", "status"].map((name) => ({ name }))), { page: 1 }); refresh(); }, 250);
  });
  filters.addEventListener("submit", (e) => e.preventDefault());
  filters.querySelectorAll("input,select").forEach((el) => { el.dataset.field = el.name; });

  root.addEventListener("click", (e) => {
    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn) { state.page += Number(pageBtn.dataset.page); refresh(); return; }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) edit(items.find((v) => v.id === editBtn.closest("tr").dataset.id));
  });
  table.addEventListener("change", (e) => {
    const toggle = e.target.closest("[data-toggle]");
    if (!toggle) return;
    const id = toggle.closest("tr").dataset.id;
    if (toggle.dataset.toggle === "hidden") patch(id, { hidden: !toggle.checked }, toggle.checked ? "✓ Video shown on website" : "✓ Video hidden from website");
    else patch(id, { featured: toggle.checked }, toggle.checked ? "✓ Video featured" : "✓ Video unfeatured");
  });

  await refresh();
}
