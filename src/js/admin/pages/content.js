/** Website text: brand, hero + CTAs, about, support, footer, links. One card per setting group. */
import { html, render } from "../../core/dom.js";
import { load, saveSetting } from "../save.js";
import { mountForm } from "../forms.js";

const GROUPS = [
  {
    key: "brand", title: "Brand", description: "Name and greeting used across the site.",
    fields: [
      { name: "name", label: "Name", type: "text", max: 40 },
      { name: "nameTa", label: "Tamil name", type: "text", max: 40 },
      { name: "greetingTa", label: "Tamil greeting", type: "text", max: 80 },
      { name: "community", label: "Community name", type: "text", max: 60 },
      { name: "logoUrl", label: "Logo", type: "image", kind: "logo", wide: true },
    ],
  },
  {
    key: "hero", title: "Hero", description: "The first screen visitors see.",
    fields: [
      { name: "heading", label: "Heading", type: "text", max: 60 },
      { name: "headingTa", label: "Tamil heading", type: "text", max: 60 },
      { name: "tagline", label: "Tagline", type: "text", max: 120, wide: true },
      { name: "lead", label: "Description", type: "textarea", max: 600 },
      { name: "backgroundUrl", label: "Background image", type: "image", kind: "hero", hint: "Leave empty to use your YouTube banner.", wide: true },
      {
        name: "ctas", label: "Buttons", type: "repeat", addLabel: "Add button",
        hint: "“Watch Live” automatically becomes the main button while you're live.",
        fields: [
          { name: "label", label: "Label", type: "text", max: 40 },
          { name: "url", label: "Link", type: "text", max: 500, placeholder: "https://… or #section" },
          { name: "key", label: "Type", type: "select", options: ["latest", "live", "subscribe", "discord", "custom"].map((v) => ({ value: v, label: v })) },
          { name: "style", label: "Style", type: "select", options: [{ value: "primary", label: "Primary" }, { value: "youtube", label: "YouTube red" }, { value: "ghost", label: "Subtle" }] },
          { name: "enabled", label: "Show", type: "switch" },
        ],
      },
    ],
  },
  {
    key: "about", title: "About", description: "Your creator profile.",
    fields: [
      { name: "title", label: "Title", type: "text", max: 120 },
      { name: "channelStart", label: "Channel start date", type: "date" },
      { name: "photoUrl", label: "Profile picture", type: "image", kind: "avatar", hint: "Leave empty to use your YouTube avatar.", wide: true },
      { name: "paragraphs", label: "Bio paragraphs", type: "list", itemType: "textarea", addLabel: "Add paragraph", max: 1500 },
      { name: "features", label: "Highlights", type: "list", addLabel: "Add highlight", max: 60 },
      { name: "genres", label: "Favourite genres", type: "list", addLabel: "Add genre", max: 40 },
      {
        name: "milestones", label: "Milestones & achievements", type: "repeat", addLabel: "Add milestone",
        fields: [{ name: "date", label: "Date (YYYY-MM or YYYY-MM-DD)", type: "text", max: 10 }, { name: "title", label: "What happened", type: "text", max: 140 }],
      },
    ],
  },
  {
    key: "support", title: "Support", description: "Ways fans can support the channel.",
    fields: [
      { name: "title", label: "Title", type: "text", max: 120 },
      { name: "perksEnabled", label: "Show member perks", type: "switch", switchLabel: "Show perks" },
      { name: "text", label: "Text", type: "textarea", max: 800 },
      {
        name: "methods", label: "Support options", type: "repeat", addLabel: "Add option",
        fields: [
          { name: "label", label: "Label", type: "text", max: 60 },
          { name: "description", label: "Description", type: "text", max: 140 },
          { name: "url", label: "Link (https)", type: "url", max: 500 },
          { name: "key", label: "Type", type: "select", options: ["membership", "superchat", "subscribe", "discord", "custom"].map((v) => ({ value: v, label: v })) },
          { name: "enabled", label: "Show", type: "switch" },
        ],
      },
      { name: "perks", label: "Member perks", type: "list", addLabel: "Add perk", max: 120 },
    ],
  },
  {
    key: "links", title: "Channel links", description: "Used by buttons across the site.",
    fields: ["channel", "subscribe", "live", "streams", "join", "discord"].map((n) => ({ name: n, label: n[0].toUpperCase() + n.slice(1), type: "url", max: 500 })),
  },
  { key: "footer", title: "Footer", fields: [{ name: "text", label: "Footer text", type: "text", max: 200, wide: true }] },
];

export async function mount(root) {
  const settings = await load("/api/cms/settings");
  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Website content</h2><p>Edit the words, images and buttons on your homepage. Changes go live within a minute of saving.</p></div></div>
    ${GROUPS.map((g) => html`<div data-group="${g.key}"></div>`)}`);

  const forms = GROUPS.map((g) => mountForm(root.querySelector(`[data-group="${g.key}"]`), {
    title: g.title,
    description: g.description,
    fields: g.fields,
    values: settings[g.key] ?? {},
    submitLabel: `Save ${g.title.toLowerCase()}`,
    onSubmit: (values) => saveSetting(g.key, values, `✓ ${g.title} saved`),
  }));
  return { isDirty: () => forms.some((f) => f.isDirty()) };
}
