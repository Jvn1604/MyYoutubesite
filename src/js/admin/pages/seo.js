/** Search & social sharing metadata with a live preview of the Google result and share card. */
import { $, html, render } from "../../core/dom.js";
import { load, saveSetting } from "../save.js";
import { mountForm } from "../forms.js";

const FIELDS = [
  { name: "title", label: "Page title", type: "text", max: 70, wide: true, hint: "Shown in browser tabs and Google results (50–60 characters is ideal)." },
  { name: "description", label: "Description", type: "textarea", max: 170, rows: 3, hint: "Shown under the title in Google (120–160 characters)." },
  { name: "ogImageUrl", label: "Share image", type: "image", kind: "other", wide: true, hint: "1200×630 works best. Empty = your YouTube banner." },
  { name: "twitterHandle", label: "X / Twitter handle", type: "text", max: 16, placeholder: "@handle" },
];

export async function mount(root) {
  const settings = await load("/api/cms/settings");
  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">SEO & sharing</h2><p>How your site appears on Google and when the link is shared on WhatsApp, Discord or X.</p></div></div>
    <div data-form></div>
    <section class="card panel" aria-labelledby="serp-title">
      <h2 class="panel__title" id="serp-title">Google preview</h2>
      <div class="stack stack--sm" data-preview></div>
    </section>`);

  const preview = $("[data-preview]", root);
  const drawPreview = (v) => render(preview, html`
    <p class="text-xs text-muted">${location.host}</p>
    <p class="link">${v.title || "Untitled"}</p>
    <p class="text-sm text-soft">${v.description || "No description"}</p>
    <p class="text-xs text-muted">Title ${v.title.length}/60 · Description ${v.description.length}/160</p>`);

  const handle = mountForm($("[data-form]", root), {
    fields: FIELDS,
    values: settings.seo ?? {},
    onSubmit: (v) => saveSetting("seo", v, "✓ SEO settings saved"),
  });
  drawPreview(handle.read());
  handle.form.addEventListener("input", () => drawPreview(handle.read()));
  return { isDirty: handle.isDirty };
}
