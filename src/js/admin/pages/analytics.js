/** Channel growth over time + privacy-friendly website click events. */
import { $, html, render } from "../../core/dom.js";
import { load } from "../save.js";
import { lineChart, barList } from "../charts.js";

const EVENT_LABELS = {
  subscribe_click: "Subscribe clicks", watch_live: "Watch live clicks", watch_video: "Video clicks", watch_stream: "Stream clicks",
  discord_click: "Discord clicks", membership_click: "Membership clicks", game_select: "Game selections", cta_latest: "Watch latest clicks",
  cta_live: "Hero Watch Live", cta_subscribe: "Hero Subscribe", cta_discord: "Hero Discord", whatsapp_click: "WhatsApp clicks",
  instagram_click: "Instagram clicks", linktree_click: "Linktree clicks", youtube_click: "YouTube link clicks",
  nav_home: "Logo clicks", watch_upcoming: "Reminder clicks",
};

export async function mount(root) {
  let days = 90;
  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Analytics</h2>
      <p>Channel growth from daily YouTube snapshots, plus anonymous click counts from your website (no cookies, no personal data).</p></div>
      <div class="cluster" role="group" aria-label="Time range">${[30, 90, 365].map((d) => html`<button class="chip" type="button" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`)}</div></div>
    <div class="dash-grid">
      <section class="card panel"><h2 class="panel__title">Subscribers</h2><div data-subs></div></section>
      <section class="card panel"><h2 class="panel__title">Total views</h2><div data-views></div></section>
    </div>
    <div class="dash-grid">
      <section class="card panel"><h2 class="panel__title">Website clicks</h2><p class="panel__sub" data-range></p><div data-events></div></section>
      <section class="card panel"><h2 class="panel__title">Most clicked (30 days)</h2><div data-targets></div></section>
    </div>`);

  async function draw() {
    const d = await load(`/api/cms/analytics?days=${days}`);
    lineChart($("[data-subs]", root), d.snapshots.map((s) => ({ x: s.day, y: s.subscribers })), { label: "Subscribers" });
    lineChart($("[data-views]", root), d.snapshots.map((s) => ({ x: s.day, y: s.views })), { label: "Views" });
    $("[data-range]", root).textContent = `Last ${Math.min(days, 90)} days`;
    barList($("[data-events]", root), d.events.map((e) => ({ label: EVENT_LABELS[e.event] ?? e.event, value: e.count })), { empty: "No clicks recorded yet." });
    barList($("[data-targets]", root), d.topTargets.map((t) => ({ label: `${EVENT_LABELS[t.event] ?? t.event}: ${t.target}`, value: t.count })), { empty: "No data yet." });
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-days]");
    if (!b) return;
    days = Number(b.dataset.days);
    root.querySelectorAll("[data-days]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  await draw();
}
