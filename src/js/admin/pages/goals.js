/** Subscriber goals: one active at a time; the current count comes from YouTube. */
import { $, html, render } from "../../core/dom.js";
import { formatNumber, formatDate } from "../../core/format.js";
import { icon } from "../../ui/icons.js";
import { openModal, confirmDialog } from "../../ui/modal.js";
import { load, save } from "../save.js";
import { fieldHtml, enhanceFields, readFields, highlightError } from "../forms.js";

const FIELDS = [
  { name: "title", label: "Title", type: "text", max: 120, wide: true },
  { name: "startValue", label: "Starting subscribers", type: "number", min: 0, step: 1 },
  { name: "goalValue", label: "Goal", type: "number", min: 1, step: 1 },
  { name: "deadline", label: "Deadline", type: "date" },
  { name: "description", label: "Message", type: "textarea", max: 400, rows: 3 },
  { name: "enabled", label: "Show on website", type: "switch", switchLabel: "Active (only one at a time)" },
  { name: "celebrate", label: "Celebration", type: "switch", switchLabel: "Celebrate when reached" },
];

export async function mount(root) {
  let { goals, current } = await load("/api/cms/goals");

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Subscriber goals</h2>
      <p>The current subscriber count updates automatically from YouTube${current != null ? ` (now ${formatNumber(current, "full")})` : ""}.</p></div>
      <button class="btn btn--primary" type="button" data-new>${icon("plus")}New goal</button></div>
    <div class="stack" data-list></div>`);

  const progress = (g) => {
    if (current == null) return null;
    return Math.max(0, Math.min(100, Math.round(((current - g.startValue) / (g.goalValue - g.startValue)) * 100)));
  };

  const draw = () => render($("[data-list]", root), goals.length ? goals.map((g) => {
    const pct = progress(g);
    return html`<section class="card panel">
      <div class="panel__head"><div><h2 class="panel__title">${g.title}</h2>
        <p class="panel__sub">${formatNumber(g.startValue, "full")} → ${formatNumber(g.goalValue, "full")}${g.deadline ? ` · by ${formatDate(g.deadline)}` : ""}</p></div>
        <div class="cluster">${g.enabled ? html`<span class="badge badge--published">Active</span>` : html`<span class="badge badge--hidden">Inactive</span>`}
          ${g.achievedAt ? html`<span class="badge badge--featured">Reached 🎉</span>` : ""}
          <button class="btn btn--ghost btn--sm" type="button" data-edit="${g.id}">${icon("edit")}Edit</button>
          <button class="icon-btn" type="button" data-delete="${g.id}" aria-label="Delete ${g.title}">${icon("trash")}</button></div></div>
      ${pct != null ? html`<div class="progress" role="progressbar" aria-label="${g.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress__fill" data-pct="${pct / 100}"></div></div>
        <p class="text-sm text-muted">${pct}% · ${formatNumber(Math.max(0, current - g.startValue), "full")} gained · ${formatNumber(Math.max(0, g.goalValue - current), "full")} to go</p>` : ""}
    </section>`;
  }) : html`<div class="empty"><p class="empty__title">No goals yet</p><p class="text-sm">Create one to show a progress bar on your homepage.</p></div>`);

  const paint = () => {
    draw();
    requestAnimationFrame(() => root.querySelectorAll("[data-pct]").forEach((el) => el.style.setProperty("--progress", el.dataset.pct)));
  };
  paint();

  function editor(goal = null) {
    const values = goal ?? { title: "", startValue: current ?? 0, goalValue: (current ?? 0) + 100, enabled: true, celebrate: true };
    const { dialog, close } = openModal({
      title: goal ? "Edit goal" : "New goal",
      body: html`<form class="form-grid" data-form novalidate>${FIELDS.map((f) => fieldHtml(f, values[f.name]))}</form>`,
      footer: html`<button class="btn btn--ghost" type="button" data-close="">Cancel</button><button class="btn btn--primary" type="button" data-save>Save goal</button>`,
    });
    const form = $("[data-form]", dialog);
    enhanceFields(form);
    $("[data-save]", dialog).addEventListener("click", async () => {
      const v = readFields(form, FIELDS);
      const body = { ...v, deadline: v.deadline || null };
      const res = await save(goal ? `/api/cms/goals/${goal.id}` : "/api/cms/goals", { method: goal ? "PUT" : "POST", body, success: "✓ Goal saved" });
      if (!res.ok) return highlightError(form, res.error);
      ({ goals, current } = await load("/api/cms/goals")); // enabling one may disable another
      paint();
      close();
    });
  }

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return editor();
    const edit = e.target.closest("[data-edit]");
    if (edit) return editor(goals.find((g) => g.id === Number(edit.dataset.edit)));
    const del = e.target.closest("[data-delete]");
    if (del) {
      const g = goals.find((x) => x.id === Number(del.dataset.delete));
      if (!(await confirmDialog({ title: "Delete goal?", message: g.title, confirmLabel: "Delete", danger: true }))) return;
      const res = await save(`/api/cms/goals/${g.id}`, { method: "DELETE", success: "✓ Goal deleted" });
      if (res.ok) { goals = goals.filter((x) => x.id !== g.id); paint(); }
    }
  });
}
