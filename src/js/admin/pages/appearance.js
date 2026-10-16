/** Theme colours, roundness and motion with a live preview of the real homepage. */
import { $, $$, html, render } from "../../core/dom.js";
import { icon } from "../../ui/icons.js";
import { load, saveSetting } from "../save.js";
import { appearanceWarnings } from "../contrast.js";

export const PRESETS = {
  phantom: { label: "Phantom Purple", primary: "#a855f7", secondary: "#e04bff", background: "#0a0a0f" },
  // Every preset keeps white button text ≥ 3:1 on both accents (see contrast.js)
  blood: { label: "Blood Red", primary: "#e11d48", secondary: "#ea580c", background: "#0c0708" },
  abyss: { label: "Abyss", primary: "#0284c7", secondary: "#6366f1", background: "#060a12" },
  minimal: { label: "Minimal Dark", primary: "#71717a", secondary: "#52525b", background: "#09090b" },
};

export async function mount(root) {
  const settings = await load("/api/cms/settings");
  const saved = { radiusScale: 1, motion: "normal", ...settings.appearance };
  let value = { ...saved };
  const dirty = () => JSON.stringify(value) !== JSON.stringify(saved);

  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Appearance</h2><p>Changes preview instantly on the right. Nothing goes live until you publish.</p></div></div>
    <div class="preview-wrap">
      <form class="card panel" novalidate data-form>
        <fieldset class="stack"><legend class="field__label">Presets</legend>
          <div class="form-grid">${Object.entries(PRESETS).map(([key, p]) => html`
            <button class="preset" type="button" data-preset="${key}" aria-pressed="false">
              <span class="preset__chips"><span data-chip="${p.primary}"></span><span data-chip="${p.secondary}"></span><span data-chip="${p.background}"></span></span>${p.label}
            </button>`)}</div>
        </fieldset>
        ${["primary", "secondary", "background"].map((k) => html`
          <div class="field"><label class="field__label" for="c-${k}">${{ primary: "Primary accent", secondary: "Secondary accent", background: "Background" }[k]}</label>
            <span class="color-input"><input type="color" id="c-${k}" data-color="${k}"><input class="input mono" type="text" maxlength="7" data-hex="${k}" aria-label="${k} hex"></span></div>`)}
        <div class="field"><label class="field__label" for="radius">Corner roundness</label>
          <input id="radius" type="range" min="0" max="1.5" step="0.25" data-radius aria-describedby="radius-hint">
          <span class="field__hint" id="radius-hint" data-radius-label></span></div>
        <div class="field"><label class="field__label" for="motion">Animation</label>
          <select class="select" id="motion" data-motion><option value="normal">Full</option><option value="subtle">Subtle</option><option value="off">Off</option></select>
          <span class="field__hint">Visitors who ask their device for reduced motion always get minimal animation.</span></div>
        <div class="stack stack--sm" data-warnings aria-live="polite"></div>
        <div class="form-actions">
          <button class="btn btn--ghost" type="button" data-reset>Discard changes</button>
          <button class="btn btn--primary" type="submit">Publish</button>
        </div>
      </form>
      <div class="stack stack--sm">
        <div class="cluster cluster--between"><span class="text-sm text-muted">Live preview (not saved)</span>
          <div class="cluster"><button class="btn btn--ghost btn--sm" type="button" data-device="mobile">Phone</button><button class="btn btn--ghost btn--sm" type="button" data-device="desktop">Desktop</button></div></div>
        <iframe class="preview-frame" src="/" title="Homepage preview" data-frame></iframe>
      </div>
    </div>`);

  const form = $("[data-form]", root);
  const frame = $("[data-frame]", root);
  $$("[data-chip]", root).forEach((el) => el.style.setProperty("--chip", el.dataset.chip));

  function applyToPreview() {
    const doc = frame.contentDocument;
    if (!doc?.documentElement) return;
    const s = doc.documentElement.style;
    s.setProperty("--brand-primary", value.primary);
    s.setProperty("--brand-secondary", value.secondary);
    s.setProperty("--brand-bg", value.background);
    s.setProperty("--radius-scale", String(value.radiusScale));
    if (value.motion === "normal") delete doc.documentElement.dataset.motion;
    else doc.documentElement.dataset.motion = value.motion;
  }

  function sync() {
    ["primary", "secondary", "background"].forEach((k) => {
      $(`[data-color="${k}"]`, form).value = value[k];
      $(`[data-hex="${k}"]`, form).value = value[k];
    });
    $("[data-radius]", form).value = value.radiusScale;
    $("[data-radius-label]", form).textContent = value.radiusScale === 0 ? "Square" : value.radiusScale < 1 ? "Subtle" : value.radiusScale === 1 ? "Default" : "Round";
    $("[data-motion]", form).value = value.motion;
    const preset = Object.entries(PRESETS).find(([, p]) => p.primary === value.primary && p.secondary === value.secondary && p.background === value.background)?.[0];
    $$("[data-preset]", form).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === preset)));
    const warnings = appearanceWarnings(value);
    render($("[data-warnings]", form), warnings.map((w) => html`<div class="alert alert--${w.level}"><span class="alert__icon" aria-hidden="true">${w.level === "error" ? "!" : "⚠"}</span><span>${w.message}</span></div>`));
    applyToPreview();
  }

  frame.addEventListener("load", applyToPreview);
  form.addEventListener("click", (e) => {
    const preset = e.target.closest("[data-preset]");
    if (preset) {
      const { label, ...colors } = PRESETS[preset.dataset.preset];
      value = { ...value, ...colors, preset: preset.dataset.preset };
      sync();
    }
    if (e.target.closest("[data-reset]")) { value = { ...saved }; sync(); }
  });
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.color) value = { ...value, [t.dataset.color]: t.value, preset: "custom" };
    if (t.dataset.hex && /^#[0-9a-f]{6}$/i.test(t.value)) value = { ...value, [t.dataset.hex]: t.value.toLowerCase(), preset: "custom" };
    if (t.matches("[data-radius]")) value = { ...value, radiusScale: Number(t.value) };
    if (t.matches("[data-motion]")) value = { ...value, motion: t.value };
    if (!t.dataset.hex) sync(); else applyToPreview();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (appearanceWarnings(value).some((w) => w.level === "error")) {
      const { confirmDialog } = await import("../../ui/modal.js");
      if (!(await confirmDialog({ title: "Publish hard-to-read colours?", message: "Some text will be very hard to read with these colours. Publish anyway?", confirmLabel: "Publish anyway", danger: true }))) return;
    }
    const btn = $("button[type=submit]", form);
    btn.setAttribute("aria-busy", "true");
    const res = await saveSetting("appearance", value, "✓ Appearance published");
    btn.removeAttribute("aria-busy");
    if (res.ok) Object.assign(saved, value);
  });
  root.addEventListener("click", (e) => {
    const d = e.target.closest("[data-device]");
    if (d) frame.style.width = d.dataset.device === "mobile" ? "390px" : "100%";
  });
  sync();
  return { isDirty: dirty };
}

export { icon };
