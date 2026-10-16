/**
 * Small declarative form builder for the CMS. A form is a list of field specs:
 *   { name, label, type, hint?, wide?, options?, placeholder?, max?, kind? (image), fields? (repeat), addLabel? }
 * types: text | url | email | number | date | time | datetime | textarea | select | switch | color | image | list | repeat
 * Values in/out are plain objects, so a form maps 1:1 onto an API payload.
 */
import { $, $$, html, render, raw, escapeHtml } from "../core/dom.js";
import { icon } from "../ui/icons.js";
import { openMediaPicker } from "./media-picker.js";

let uid = 0;
const nextId = () => `f${++uid}`;

function inputType(type) {
  return { url: "url", email: "email", number: "number", date: "date", time: "time", datetime: "datetime-local", password: "password" }[type] ?? "text";
}

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function scalarField(f, value, id) {
  const common = html`id="${id}" name="${f.name}" data-field="${f.name}" data-type="${f.type}"
    ${f.required ? raw("required") : ""} ${f.max ? html`maxlength="${f.max}"` : ""} ${f.placeholder ? html`placeholder="${f.placeholder}"` : ""}
    ${f.hint ? html`aria-describedby="${id}-hint"` : ""}`;
  switch (f.type) {
    case "textarea":
      return html`<textarea class="textarea" ${common} rows="${f.rows ?? 4}">${value ?? ""}</textarea>`;
    case "select":
      return html`<select class="select" ${common}>${f.options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value ?? "") ? raw("selected") : ""}>${o.label}</option>`)}</select>`;
    case "switch":
      return html`<label class="switch"><input type="checkbox" ${common} ${value ? raw("checked") : ""}> <span>${f.switchLabel ?? "Enabled"}</span></label>`;
    case "color":
      return html`<span class="color-input"><input type="color" ${common} value="${value || "#a855f7"}"><input class="input mono" type="text" value="${value || ""}" data-color-mirror="${f.name}" maxlength="7" aria-label="${f.label} hex value"></span>`;
    case "image":
      return html`
        <span class="image-field" data-image-field="${f.kind ?? "other"}" data-return="${f.returns ?? "url"}">
          <input type="hidden" ${common} value="${value ?? ""}">
          <img class="image-field__preview" alt="" data-preview src="${f.previewUrl ?? (typeof value === "string" ? value : "") ?? ""}" ${value ? "" : raw("hidden")}>
          <button class="btn btn--ghost btn--sm" type="button" data-pick-image>${icon("image")}Choose image</button>
          <button class="btn btn--text btn--sm" type="button" data-clear-image ${value ? "" : raw("hidden")}>Remove</button>
        </span>`;
    case "datetime":
      return html`<input class="input" type="datetime-local" ${common} value="${toLocalInput(value)}">`;
    default:
      return html`<input class="input" type="${inputType(f.type)}" ${common} value="${value ?? ""}" ${f.step ? html`step="${f.step}"` : ""} ${f.min != null ? html`min="${f.min}"` : ""}>`;
  }
}

function repeatRow(f, item) {
  const sub = f.type === "list" ? [{ name: "value", label: f.itemLabel ?? f.label, type: f.itemType ?? "text", max: f.max }] : f.fields;
  const values = f.type === "list" ? { value: item } : item ?? {};
  return html`
    <div class="repeat__row" data-row>
      <div class="repeat__fields">${sub.map((s) => fieldHtml(s, values[s.name], { compact: true }))}</div>
      <div class="repeat__tools">
        <button class="icon-btn" type="button" data-move="-1" aria-label="Move up">${icon("up")}</button>
        <button class="icon-btn" type="button" data-move="1" aria-label="Move down">${icon("down")}</button>
        <button class="icon-btn" type="button" data-remove-row aria-label="Remove">${icon("trash")}</button>
      </div>
    </div>`;
}

export function fieldHtml(f, value, { compact = false } = {}) {
  const id = nextId();
  if (f.type === "list" || f.type === "repeat") {
    return html`
      <fieldset class="repeat" data-repeat="${f.name}" data-type="${f.type}">
        <div class="repeat__head"><legend class="field__label">${f.label}</legend>
          <button class="btn btn--ghost btn--sm" type="button" data-add-row>${icon("plus")}${f.addLabel ?? "Add"}</button></div>
        ${f.hint ? html`<p class="field__hint">${f.hint}</p>` : ""}
        <div class="repeat" data-rows>${(value ?? []).map((item) => repeatRow(f, item))}</div>
        <template data-row-template>${repeatRow(f, f.type === "list" ? "" : {})}</template>
      </fieldset>`;
  }
  const isSwitch = f.type === "switch";
  return html`
    <div class="field ${f.wide || f.type === "textarea" ? "field--wide" : ""}">
      ${isSwitch ? html`<span class="field__label" id="${id}-label">${f.label}</span>` : html`<label class="field__label ${compact ? "" : ""}" for="${id}">${f.label}</label>`}
      ${scalarField(f, value, id)}
      ${f.hint ? html`<span class="field__hint" id="${id}-hint">${f.hint}</span>` : ""}
    </div>`;
}

function readScalar(el) {
  const type = el.dataset.type;
  if (type === "switch") return el.checked;
  if (type === "number") return el.value === "" ? null : Number(el.value);
  if (type === "datetime") return el.value ? new Date(el.value).toISOString() : null;
  if (type === "image" && el.closest("[data-return]")?.dataset.return === "id") return el.value ? Number(el.value) : null;
  return el.value.trim();
}

/** Read values for `fields` from `root` (repeat/list fields included). */
export function readFields(root, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === "list" || f.type === "repeat") {
      const box = root.querySelector(`[data-repeat="${f.name}"]`);
      const rows = $$(":scope > [data-rows] > [data-row]", box);
      out[f.name] = rows.map((row) => {
        const sub = f.type === "list" ? [{ name: "value", type: f.itemType ?? "text" }] : f.fields;
        const values = Object.fromEntries(sub.map((s) => [s.name, readScalar(row.querySelector(`[data-field="${s.name}"]`))]));
        return f.type === "list" ? values.value : values;
      }).filter((v) => (f.type === "list" ? v !== "" : true));
    } else {
      const el = root.querySelector(`:scope [data-field="${f.name}"]:not([data-row] [data-field])`) ?? root.querySelector(`[data-field="${f.name}"]`);
      out[f.name] = el ? readScalar(el) : undefined;
    }
  }
  return out;
}

/** Wire repeat rows, colour mirrors and image pickers inside `root` (event delegation, idempotent). */
export function enhanceFields(root, { onChange } = {}) {
  if (root.dataset.enhanced) return;
  root.dataset.enhanced = "1";
  const changed = () => onChange?.();

  root.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-add-row]")) {
      const box = t.closest("[data-repeat]");
      const tpl = $(":scope > template[data-row-template]", box);
      $(":scope > [data-rows]", box).append(tpl.content.cloneNode(true));
      $(":scope > [data-rows] > [data-row]:last-child input, :scope > [data-rows] > [data-row]:last-child textarea", box)?.focus();
      changed();
    } else if (t.matches("[data-remove-row]")) {
      t.closest("[data-row]").remove();
      changed();
    } else if (t.matches("[data-move]")) {
      const row = t.closest("[data-row]");
      const sibling = t.dataset.move === "-1" ? row.previousElementSibling : row.nextElementSibling;
      if (sibling) {
        t.dataset.move === "-1" ? sibling.before(row) : sibling.after(row);
        t.focus();
        changed();
      }
    } else if (t.matches("[data-pick-image]")) {
      const wrap = t.closest("[data-image-field]");
      const picked = await openMediaPicker({ kind: wrap.dataset.imageField });
      if (!picked) return;
      const input = $("input[type=hidden]", wrap);
      input.value = wrap.dataset.return === "id" ? String(picked.id) : picked.url;
      const img = $("[data-preview]", wrap);
      img.src = picked.variantUrls?.webp_400 ?? picked.url;
      img.hidden = false;
      $("[data-clear-image]", wrap).hidden = false;
      changed();
    } else if (t.matches("[data-clear-image]")) {
      const wrap = t.closest("[data-image-field]");
      $("input[type=hidden]", wrap).value = "";
      $("[data-preview]", wrap).hidden = true;
      t.hidden = true;
      changed();
    }
  });

  root.addEventListener("input", (e) => {
    const mirror = e.target.closest("[data-color-mirror]");
    if (mirror && /^#[0-9a-f]{6}$/i.test(mirror.value)) {
      mirror.parentElement.querySelector("input[type=color]").value = mirror.value;
    } else if (e.target.type === "color") {
      const text = e.target.parentElement.querySelector("[data-color-mirror]");
      if (text) text.value = e.target.value;
    }
    changed();
  });
  root.addEventListener("change", changed);
}

/**
 * Build a complete card form: fields + sticky Save bar + dirty tracking.
 * onSubmit(values) must return { ok, error? }.
 */
export function mountForm(container, { fields, values = {}, onSubmit, submitLabel = "Save changes", title, description, extraActions = "" }) {
  render(container, html`
    <form class="card panel" novalidate>
      ${title ? html`<div class="panel__head"><div><h2 class="panel__title">${title}</h2>${description ? html`<p class="panel__sub">${description}</p>` : ""}</div></div>` : ""}
      <div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name]))}</div>
      <div class="form-actions form-actions--sticky">
        <span class="cluster text-sm text-muted" data-dirty hidden><span class="dirty-dot" aria-hidden="true"></span>Unsaved changes</span>
        ${extraActions}
        <button class="btn btn--primary" type="submit">${submitLabel}</button>
      </div>
    </form>`);
  const form = $("form", container);
  const dirtyLabel = $("[data-dirty]", form);
  const setDirty = (dirty) => { form.dataset.dirty = dirty ? "1" : ""; dirtyLabel.hidden = !dirty; };
  enhanceFields(form, { onChange: () => setDirty(true) });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    btn.setAttribute("aria-busy", "true");
    const result = await onSubmit(readFields(form, fields));
    btn.removeAttribute("aria-busy");
    if (result?.ok) setDirty(false);
    else if (result?.error) highlightError(form, result.error);
  });
  return { form, read: () => readFields(form, fields), isDirty: () => Boolean(form.dataset.dirty), setDirty };
}

/** Server errors look like "field.path: message" → focus + mark the first matching field. */
export function highlightError(form, message) {
  $$("[aria-invalid=true]", form).forEach((el) => el.removeAttribute("aria-invalid"));
  const path = String(message).split(":")[0].split(".");
  const name = path.find((p) => form.querySelector(`[data-field="${CSS.escape(p)}"], [data-repeat="${CSS.escape(p)}"]`));
  const el = name && form.querySelector(`[data-field="${CSS.escape(name)}"], [data-repeat="${CSS.escape(name)}"] input`);
  if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); }
}

export { escapeHtml };
