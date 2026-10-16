/** Weekly schedule (base timezone), timezone/message settings and special events. */
import { $, $$, html, render } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { formatTimeIn, resolveNextStream } from "../../core/time.js";
import { icon } from "../../ui/icons.js";
import { openModal, confirmDialog } from "../../ui/modal.js";
import { load, save, saveSetting } from "../save.js";
import { mountForm, fieldHtml, enhanceFields, readFields, highlightError } from "../forms.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function mount(root) {
  let data = await load("/api/cms/schedule");
  let rulesDirty = false;

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Stream schedule</h2>
      <p>Your regular streaming times. Visitors automatically see them in their own timezone. A stream you schedule on YouTube always overrides this for “Next stream”.</p></div></div>
    <section class="card panel" aria-labelledby="week-title">
      <div class="panel__head"><div><h2 class="panel__title" id="week-title">Regular schedule</h2><p class="panel__sub" data-tz></p></div><p class="text-sm" data-next></p></div>
      <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Day</th><th scope="col">Streams</th><th scope="col">Start time</th><th scope="col">Title</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody data-rules></tbody></table></div>
      <div class="form-actions"><button class="btn btn--primary" type="button" data-save-rules>Save schedule</button></div>
    </section>
    <div data-settings></div>
    <section class="card panel" aria-labelledby="events-title">
      <div class="panel__head"><div><h2 class="panel__title" id="events-title">Special events</h2><p class="panel__sub">One-off streams like “Saturday Special”. Shown as Next stream when they're sooner than your regular slot.</p></div>
        <button class="btn btn--ghost btn--sm" type="button" data-new-event>${icon("plus")}Add event</button></div>
      <div data-events></div>
    </section>`);

  const tz = () => data.settings?.timezone ?? "Asia/Kuala_Lumpur";
  const rows = () => $$("[data-rule]", root).map((tr) => ({
    weekday: Number(tr.dataset.rule), time: $("[data-time]", tr).value, title: $("[data-title]", tr).value.trim(), enabled: $("[data-on]", tr).checked,
  }));

  function drawRules() {
    // One row per day; days with several streams get several rows
    const byDay = DAYS.map((_, d) => data.rules.filter((r) => r.weekday === d));
    render($("[data-rules]", root), byDay.flatMap((rules, d) => (rules.length ? rules : [{ weekday: d, time: "21:00", title: "", enabled: false }]).map((r, i) => html`
      <tr data-rule="${d}">
        <th scope="row">${i === 0 ? DAYS[d] : html`<span class="visually-hidden">${DAYS[d]}</span>`}</th>
        <td><label class="switch"><input type="checkbox" data-on ${r.enabled ? "checked" : ""}><span>${r.enabled ? "Live" : "Off"}</span></label></td>
        <td><label class="visually-hidden" for="t-${d}-${i}">${DAYS[d]} start time</label><input class="input" id="t-${d}-${i}" type="time" data-time value="${r.time}" required></td>
        <td><label class="visually-hidden" for="n-${d}-${i}">${DAYS[d]} title</label><input class="input" id="n-${d}-${i}" type="text" data-title value="${r.title}" maxlength="80" placeholder="Nightly stream"></td>
        <td class="table__actions">${i === 0
          ? html`<button class="btn btn--text btn--sm" type="button" data-add-slot="${d}">+ Another stream</button>`
          : html`<button class="icon-btn" type="button" data-remove-slot aria-label="Remove this ${DAYS[d]} stream">${icon("trash")}</button>`}</td>
      </tr>`)));
    $("[data-tz]", root).textContent = `Times are in ${tz().replace(/_/g, " ")}.`;
    const next = resolveNextStream({ rules: data.rules, events: data.events.filter((e) => e.enabled), timeZone: tz() });
    $("[data-next]", root).textContent = next ? `Next: ${formatDate(next.startsAt, { weekday: "long" })} ${formatTimeIn(next.startsAt, tz())}` : "No upcoming stream";
  }

  function drawEvents() {
    const events = [...data.events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    render($("[data-events]", root), events.length ? html`<ul class="sortable" role="list">${events.map((e) => html`
      <li class="sortable__item"><span aria-hidden="true">${icon("calendar")}</span>
        <span class="sortable__main"><span><strong>${e.title}</strong><br><span class="text-xs text-muted">${formatDate(e.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${new Date(e.startsAt) < new Date() ? " · past" : ""}</span></span>
          ${e.enabled ? "" : html`<span class="badge badge--hidden">Disabled</span>`}</span>
        <span class="sortable__tools"><button class="icon-btn" type="button" data-edit-event="${e.id}" aria-label="Edit ${e.title}">${icon("edit")}</button>
          <button class="icon-btn" type="button" data-delete-event="${e.id}" aria-label="Delete ${e.title}">${icon("trash")}</button></span></li>`)}</ul>`
      : html`<p class="text-sm text-muted">No special events.</p>`);
  }

  function eventEditor(ev = null) {
    const fields = [
      { name: "title", label: "Title", type: "text", max: 120 },
      { name: "startsAt", label: "Starts (your computer's time)", type: "datetime" },
      { name: "description", label: "Description", type: "textarea", max: 500, rows: 3 },
      { name: "enabled", label: "Show", type: "switch" },
    ];
    const { dialog, close } = openModal({
      title: ev ? "Edit event" : "Add special event",
      body: html`<form class="stack" data-form novalidate>${fields.map((f) => fieldHtml(f, ev ? ev[f.name] : f.name === "enabled" ? true : ""))}</form>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-save>Save event</button>`,
    });
    const form = $("[data-form]", dialog);
    enhanceFields(form);
    $("[data-save]", dialog).addEventListener("click", async () => {
      const v = readFields(form, fields);
      if (!v.startsAt) return highlightError(form, "startsAt: required");
      const res = await save(ev ? `/api/cms/schedule/events/${ev.id}` : "/api/cms/schedule/events", { method: ev ? "PUT" : "POST", body: v, success: "✓ Event saved" });
      if (!res.ok) return highlightError(form, res.error);
      data.events = ev ? data.events.map((x) => (x.id === ev.id ? res.data : x)) : [...data.events, res.data];
      drawEvents();
      drawRules();
      close();
    });
  }

  drawRules();
  drawEvents();

  const settingsForm = mountForm($("[data-settings]", root), {
    title: "Timezone & message",
    fields: [
      { name: "timezone", label: "Your timezone", type: "text", max: 64, hint: "e.g. Asia/Kuala_Lumpur" },
      { name: "message", label: "Schedule message", type: "text", max: 200, wide: true },
      { name: "compareZones", label: "Times shown for", type: "repeat", addLabel: "Add country", fields: [{ name: "label", label: "Label", type: "text", max: 30 }, { name: "timeZone", label: "Timezone", type: "text", max: 64 }] },
    ],
    values: data.settings ?? {},
    onSubmit: async (v) => {
      const res = await saveSetting("schedule", v, "✓ Schedule settings saved");
      if (res.ok) { data.settings = res.data.value; drawRules(); }
      return res;
    },
  });

  root.addEventListener("input", (e) => { if (e.target.closest("[data-rules]")) rulesDirty = true; });
  root.addEventListener("change", (e) => {
    const on = e.target.closest("[data-on]");
    if (on) { on.nextElementSibling.textContent = on.checked ? "Live" : "Off"; rulesDirty = true; }
  });
  root.addEventListener("click", async (e) => {
    const add = e.target.closest("[data-add-slot]");
    if (add) { data.rules = [...rows(), { weekday: Number(add.dataset.addSlot), time: "15:00", title: "", enabled: true }]; drawRules(); rulesDirty = true; return; }
    const rm = e.target.closest("[data-remove-slot]");
    if (rm) { rm.closest("tr").remove(); data.rules = rows(); drawRules(); rulesDirty = true; return; }
    if (e.target.closest("[data-save-rules]")) {
      const btn = e.target.closest("[data-save-rules]");
      btn.setAttribute("aria-busy", "true");
      const res = await save("/api/cms/schedule/rules", { method: "PUT", body: { rules: rows().filter((r) => r.enabled || r.title) }, success: "✓ Schedule saved" });
      btn.removeAttribute("aria-busy");
      if (res.ok) { data = res.data; rulesDirty = false; drawRules(); }
      return;
    }
    if (e.target.closest("[data-new-event]")) return eventEditor();
    const edit = e.target.closest("[data-edit-event]");
    if (edit) return eventEditor(data.events.find((x) => x.id === Number(edit.dataset.editEvent)));
    const del = e.target.closest("[data-delete-event]");
    if (del) {
      const ev = data.events.find((x) => x.id === Number(del.dataset.deleteEvent));
      if (!(await confirmDialog({ title: "Delete event?", message: ev.title, confirmLabel: "Delete", danger: true }))) return;
      const res = await save(`/api/cms/schedule/events/${ev.id}`, { method: "DELETE", success: "✓ Event deleted" });
      if (res.ok) { data.events = data.events.filter((x) => x.id !== ev.id); drawEvents(); drawRules(); }
    }
  });
  return { isDirty: () => rulesDirty || settingsForm.isDirty() };
}
