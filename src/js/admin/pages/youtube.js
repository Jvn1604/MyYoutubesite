/** YouTube connection status, sync history and manual "Sync now". */
import { $, html, render } from "../../core/dom.js";
import { formatNumber, formatRelative, formatDate } from "../../core/format.js";
import { icon } from "../../ui/icons.js";
import { toast } from "../../ui/toast.js";
import { adminApi } from "../session.js";
import { load } from "../save.js";
import { refreshSyncBadge } from "../main.js";

const JOBS = { live: "Live & newest uploads (every 2 min)", stats: "Channel statistics (every 15 min)", library: "Full library (every 6 h)", manual: "Manual sync" };

export async function mount(root) {
  let s = await load("/api/cms/youtube");

  const draw = () => render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">YouTube sync</h2>
      <p>Your channel syncs automatically. Use these buttons only to refresh right now or to troubleshoot.</p></div></div>

    ${!s.apiKeyConfigured ? html`<div class="alert alert--warning"><span class="alert__icon" aria-hidden="true">⚠</span>
      <span>No YouTube API key is configured. Add <code class="mono">YOUTUBE_API_KEY</code> to the site's environment variables (see README → YouTube API configuration).</span></div>` : ""}
    ${s.health === "error" ? html`<div class="alert alert--error"><span class="alert__icon" aria-hidden="true">!</span><span>⚠ API synchronization failed: ${s.jobs.find((j) => j.ok === false)?.error}</span></div>` : ""}

    <section class="kpis">
      <div class="card kpi"><span class="kpi__label">Channel</span><span class="kpi__value">${s.channelTitle ?? "–"}</span><span class="kpi__meta mono">${s.channelId}</span></div>
      <div class="card kpi"><span class="kpi__label">Last successful sync</span><span class="kpi__value">${s.lastSuccessAt ? formatRelative(s.lastSuccessAt) : "Never"}</span></div>
      <div class="card kpi"><span class="kpi__label">Quota used today</span><span class="kpi__value">${formatNumber(s.quota.used, "full")}</span><span class="kpi__meta">of ${formatNumber(s.quota.limit, "full")} free units</span></div>
      <div class="card kpi"><span class="kpi__label">Videos synced</span><span class="kpi__value">${formatNumber(s.videos.available, "full")}</span><span class="kpi__meta">${formatNumber(s.videos.total - s.videos.available, "full")} removed from YouTube</span></div>
    </section>

    <section class="card panel" aria-labelledby="sync-now">
      <h2 class="panel__title" id="sync-now">Sync now</h2>
      <div class="cluster">
        <button class="btn btn--primary" type="button" data-sync="live" ${s.apiKeyConfigured ? "" : "disabled"}>${icon("refresh")}Check live & new uploads</button>
        <button class="btn btn--ghost" type="button" data-sync="stats" ${s.apiKeyConfigured ? "" : "disabled"}>Refresh statistics</button>
        <button class="btn btn--ghost" type="button" data-sync="manual" ${s.apiKeyConfigured ? "" : "disabled"}>Full re-sync (slower)</button>
      </div>
      <h3 class="eyebrow">Last run per job</h3>
      <ul class="list-plain" role="list">${Object.keys(JOBS).filter((j) => j !== "manual").map((job) => {
        const r = s.jobs.find((x) => x.job === job);
        return html`<li><span>${JOBS[job]}</span><span>${r ? html`<span class="status-dot ${r.ok ? "status-dot--ok" : r.ok === false ? "status-dot--error" : "status-dot--warn"}"></span>${formatRelative(r.startedAt)}` : html`<span class="text-muted">never</span>`}</span></li>`;
      })}</ul>
    </section>

    <section class="card panel" aria-labelledby="history">
      <h2 class="panel__title" id="history">Sync history</h2>
      ${s.recent.length ? html`<div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">When</th><th scope="col">Job</th><th scope="col">Result</th><th scope="col">Changes</th><th scope="col">Units</th></tr></thead>
        <tbody>${s.recent.map((r) => html`<tr>
          <td>${formatDate(r.startedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
          <td>${r.job}</td>
          <td>${r.ok ? html`<span class="badge badge--synced">Synced</span>` : r.ok === false ? html`<span class="badge badge--error" title="${r.error ?? ""}">Error</span> <span class="text-xs text-muted">${r.error ?? ""}</span>` : html`<span class="badge badge--upcoming">Running</span>`}</td>
          <td class="tabular">${r.itemsChanged}</td><td class="tabular">${r.unitsUsed}</td></tr>`)}</tbody></table></div>`
        : html`<p class="text-sm text-muted">No syncs have run yet.</p>`}
    </section>`);
  draw();

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-sync]");
    if (!btn) return;
    btn.setAttribute("aria-busy", "true");
    const res = await adminApi("/api/cms/youtube/sync", { method: "POST", body: { job: btn.dataset.sync } });
    btn.removeAttribute("aria-busy");
    if (!res.ok) return toast.error(`✕ ${res.error}`);
    const r = res.data;
    if (r.skipped) toast.info("A sync is already running. Try again in a minute.");
    else if (r.ok) toast.success(`✓ YouTube synchronization complete · ${r.itemsChanged} change${r.itemsChanged === 1 ? "" : "s"}${r.inserted?.length ? ` · ${r.inserted.length} new` : ""}`);
    else toast.warning(`⚠ API synchronization failed: ${r.error}`);
    s = r.status;
    draw();
    refreshSyncBadge();
  });
}
