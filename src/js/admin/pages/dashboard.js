import { $, html, render, safeUrl } from "../../core/dom.js";
import { formatNumber, formatRelative, formatDate } from "../../core/format.js";
import { icon } from "../../ui/icons.js";
import { load } from "../save.js";
import { lineChart } from "../charts.js";

const kpi = (label, value, meta = "") => html`
  <div class="card kpi"><span class="kpi__label">${label}</span><span class="kpi__value">${value}</span>${meta ? html`<span class="kpi__meta">${meta}</span>` : ""}</div>`;

const HEALTH = {
  ok: ["status-dot--ok", "Healthy"], error: ["status-dot--error", "Last run failed"],
  never_synced: ["status-dot--warn", "Never synced"], not_configured: ["status-dot--warn", "API key missing"],
};

export async function mount(root) {
  const d = await load("/api/cms/overview");
  const c = d.channel;
  const yt = d.youtube;
  const goal = d.goal;
  const pct = goal && goal.current != null ? Math.min(100, Math.round(((goal.current - goal.startValue) / (goal.goalValue - goal.startValue)) * 100)) : null;
  const [dot, healthLabel] = HEALTH[yt.health] ?? HEALTH.never_synced;

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Welcome back 👋</h2><p>Here's how the channel and website are doing.</p></div>
      <a class="btn btn--ghost btn--sm" href="/" target="_blank" rel="noopener">${icon("external")}Open website</a></div>

    <section class="kpis" aria-label="Key numbers">
      ${kpi("Subscribers", c?.subscriberCount != null ? formatNumber(c.subscriberCount, "full") : c?.subscribersHidden ? "Hidden" : "–", c ? `Updated ${formatRelative(c.syncedAt)}` : "Waiting for first sync")}
      ${kpi("Total views", c?.viewCount != null ? formatNumber(c.viewCount) : "–")}
      ${kpi("Videos", formatNumber(d.counts.videos), `${formatNumber(d.counts.shorts)} Shorts`)}
      ${kpi("Livestreams", formatNumber(d.counts.streams), d.counts.liveNow ? "🔴 Live right now" : "")}
      ${kpi("Current goal", pct != null ? `${pct}%` : "–", goal ? `${formatNumber(goal.current ?? 0, "full")} / ${formatNumber(goal.goalValue, "full")}` : "No active goal")}
      ${kpi("Next stream", d.nextStream ? formatDate(d.nextStream.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "–",
        d.nextStream ? ({ youtube: "Scheduled on YouTube", event: "Special event", schedule: "Regular schedule" })[d.nextStream.source] : "")}
      ${kpi("Last YouTube sync", yt.lastSuccessAt ? formatRelative(yt.lastSuccessAt) : "Never", html`<span><span class="status-dot ${dot}"></span>${healthLabel}</span>`)}
    </section>

    <div class="dash-grid">
      <section class="card panel" aria-labelledby="growth-title">
        <div class="panel__head"><div><h2 class="panel__title" id="growth-title">Subscribers, last 90 days</h2><p class="panel__sub">One point per day from the stats sync.</p></div></div>
        <div data-slot="chart"></div>
      </section>

      <section class="card panel" aria-labelledby="status-title">
        <h2 class="panel__title" id="status-title">System status</h2>
        <ul class="list-plain" role="list">
          <li><span>Website</span><span><span class="status-dot status-dot--ok"></span>Online</span></li>
          <li><span>YouTube API</span><span><span class="status-dot ${yt.apiKeyConfigured ? "status-dot--ok" : "status-dot--warn"}"></span>${yt.apiKeyConfigured ? "Connected" : "Not configured"}</span></li>
          <li><span>Sync</span><span><span class="status-dot ${dot}"></span>${healthLabel}</span></li>
          <li><span>Quota used today</span><span class="tabular">${formatNumber(yt.quota.used, "full")} / ${formatNumber(yt.quota.limit, "full")}</span></li>
          <li><span>Videos in library</span><span class="tabular">${formatNumber(yt.videos.available, "full")}</span></li>
        </ul>
        ${yt.health === "error" ? html`<div class="alert alert--error"><span class="alert__icon" aria-hidden="true">!</span><span>${yt.jobs.find((j) => j.ok === false)?.error ?? "Sync failed"}</span></div>` : ""}
        <a class="btn btn--ghost btn--sm" href="#/youtube">${icon("refresh")}Manage YouTube sync</a>
      </section>
    </div>

    <section class="card panel" aria-labelledby="recent-title">
      <div class="panel__head"><h2 class="panel__title" id="recent-title">Recent content</h2><a class="btn btn--text btn--sm" href="#/videos">All videos →</a></div>
      ${d.recent.length ? html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Video</th><th scope="col">Type</th><th scope="col">Published</th><th scope="col">Views</th><th scope="col">Website</th></tr></thead>
          <tbody>${d.recent.map((v) => html`<tr>
            <td><div class="cluster"><img class="table__thumb" src="${safeUrl(v.thumbnails?.medium ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`)}" alt="" loading="lazy" width="96" height="54"><span class="table__title truncate-2">${v.title}</span></div></td>
            <td>${v.liveState === "live" ? html`<span class="badge badge--live">Live</span>` : v.liveState === "upcoming" ? html`<span class="badge badge--upcoming">Upcoming</span>` : html`<span class="badge">${v.kind}</span>`}</td>
            <td>${formatRelative(v.publishedAt)}</td>
            <td class="tabular">${v.views != null ? formatNumber(v.views) : "–"}</td>
            <td>${v.hidden ? html`<span class="badge badge--hidden">Hidden</span>` : html`<span class="badge badge--published">Published</span>`} ${v.featured ? html`<span class="badge badge--featured">Featured</span>` : ""}</td>
          </tr>`)}</tbody>
        </table></div>` : html`<div class="empty"><p class="empty__title">No videos yet</p><p class="text-sm">They'll appear after the first YouTube sync.</p></div>`}
    </section>`);

  lineChart($('[data-slot="chart"]', root), d.snapshots.map((s) => ({ x: s.day, y: s.subscribers })), { label: "Subscribers" });
}
