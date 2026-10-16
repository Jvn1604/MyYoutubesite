/** Channel statistics from YouTube (never invented: unknown values are omitted). */
import { html, render } from "../core/dom.js";
import { formatRelative } from "../core/format.js";
import { initCounters } from "../ui/counter.js";
import { emptyState } from "./templates.js";

export function renderStats(slot, { channel }) {
  if (!channel) {
    render(slot, emptyState({ title: "Channel stats will appear after the first YouTube sync" }));
    slot.classList.add("stats__grid--empty");
    return;
  }
  const items = [
    { value: channel.subscriberCount, label: "Subscribers" },
    { value: channel.viewCount, label: "Total views" },
    { value: channel.videoCount, label: "Videos" },
    { value: channel.streamCount, label: "Livestreams" },
  ].filter((s) => Number.isFinite(s.value));

  render(slot, items.map((s) => html`
    <div class="card stat">
      <dt class="stat__label">${s.label}</dt>
      <dd class="stat__value text-gradient" data-count="${s.value}">${s.value}</dd>
    </div>`));
  slot.title = channel.syncedAt ? `Updated ${formatRelative(channel.syncedAt)} from YouTube` : "";
  initCounters(slot);
}
