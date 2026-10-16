/**
 * Tiny dependency-free charts for the admin.
 * lineChart: single series over time (title names the series → no legend),
 *   2px line, soft area, recessive grid, crosshair + tooltip on hover/focus,
 *   and a data table alternative for screen readers / exact values.
 * barList: magnitude ranking, one hue, values in text colour.
 */
import { $, html, render } from "../core/dom.js";
import { formatNumber, formatDate } from "../core/format.js";

const W = 640, H = 220, PAD = { t: 16, r: 16, b: 28, l: 48 };

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step = 10 ** Math.floor(Math.log10((max - min) / count));
  const err = ((max - min) / count) / step;
  const nice = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const lo = Math.floor(min / nice) * nice;
  const hi = Math.ceil(max / nice) * nice;
  const ticks = [];
  for (let v = lo; v <= hi + nice / 2; v += nice) ticks.push(v);
  return ticks;
}

/** points: [{ x: "YYYY-MM-DD", y: number }] */
export function lineChart(container, points, { label = "Value", format = (v) => formatNumber(v, "full") } = {}) {
  const data = points.filter((p) => Number.isFinite(p.y));
  if (data.length < 2) {
    render(container, html`<div class="empty"><p class="empty__title">Not enough history yet</p><p class="text-sm">A data point is recorded every day after YouTube sync runs.</p></div>`);
    return;
  }
  const ys = data.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const [y0, y1] = [ticks[0], ticks.at(-1)];
  const x = (i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
  const line = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1).toFixed(1)},${H - PAD.b}L${PAD.l},${H - PAD.b}Z`;
  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  render(container, html`
    <figure class="stack stack--sm">
      <div class="chart-wrap">
        <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} over the last ${data.length} days, from ${format(data[0].y)} to ${format(data.at(-1).y)}" tabindex="0">
          ${ticks.map((t) => html`<line class="chart__grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"></line><text x="${PAD.l - 8}" y="${y(t) + 4}" text-anchor="end">${formatNumber(t)}</text>`)}
          ${xLabels.map((i) => html`<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}">${formatDate(data[i].x, { day: "numeric", month: "short" })}</text>`)}
          <path class="chart__area" d="${area}"></path>
          <path class="chart__line" d="${line}"></path>
          <line class="chart__grid" data-cross x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"></line>
          <circle class="chart__dot" data-dot r="4" visibility="hidden"></circle>
          <rect x="${PAD.l}" y="0" width="${W - PAD.l - PAD.r}" height="${H}" fill="transparent" data-hit></rect>
        </svg>
        <div class="chart-tip card card--elevated" role="status" hidden data-tip></div>
      </div>
      <details><summary class="text-xs text-muted">Show data table</summary>
        <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">${label}</th></tr></thead>
        <tbody>${[...data].reverse().map((p) => html`<tr><td>${formatDate(p.x)}</td><td class="tabular">${format(p.y)}</td></tr>`)}</tbody></table></div>
      </details>
    </figure>`);

  const svg = $("svg", container);
  const tip = $("[data-tip]", container);
  const cross = $("[data-cross]", svg);
  const dot = $("[data-dot]", svg);
  const show = (i) => {
    const p = data[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(p.y)); dot.setAttribute("visibility", "visible");
    tip.textContent = `${formatDate(p.x)} · ${label}: ${format(p.y)}`;
    tip.hidden = false;
    const box = svg.getBoundingClientRect();
    const left = (x(i) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(left - 90, 0), box.width - 180)}px`;
    tip.style.top = "-8px";
  };
  const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); };
  let active = data.length - 1;
  svg.addEventListener("pointermove", (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    active = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    show(Math.max(0, Math.min(data.length - 1, active)));
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("focus", () => show(active));
  svg.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    active = Math.max(0, Math.min(data.length - 1, active + (e.key === "ArrowLeft" ? -1 : 1)));
    show(active);
  });
}

/** rows: [{ label, value }] */
export function barList(container, rows, { format = (v) => formatNumber(v, "full"), empty = "No data yet" } = {}) {
  if (!rows.length) return render(container, html`<p class="text-sm text-muted">${empty}</p>`);
  const max = Math.max(...rows.map((r) => r.value), 1);
  render(container, html`<ul class="bar-list" role="list">
    ${rows.map((r) => html`<li class="bar-list__row">
      <span class="truncate-2">${r.label}</span>
      <span class="bar-list__track" aria-hidden="true"><span class="bar-list__bar" data-scale="${(r.value / max).toFixed(3)}"></span></span>
      <span class="tabular text-soft">${format(r.value)}</span>
    </li>`)}
  </ul>`);
  container.querySelectorAll("[data-scale]").forEach((bar) => { bar.style.transform = `scaleX(${bar.dataset.scale})`; });
}
