/** Account: change password, session info, environment status. */
import { $, html, render } from "../../core/dom.js";
import { mountForm } from "../forms.js";
import { save } from "../save.js";
import { currentAdmin } from "../session.js";
import { toast } from "../../ui/toast.js";

export async function mount(root) {
  render(root, html`
    <div class="page-head"><div><h2 class="section-header__title">Settings</h2><p>Your admin account.</p></div></div>
    <section class="card panel" aria-labelledby="acct-title">
      <h2 class="panel__title" id="acct-title">Account</h2>
      <ul class="list-plain" role="list"><li><span>Signed in as</span><strong>${currentAdmin()?.email ?? ""}</strong></li></ul>
    </section>
    <div data-password></div>`);

  const handle = mountForm($("[data-password]", root), {
    title: "Change password",
    description: "At least 12 characters. Changing it signs you out on every other device.",
    fields: [
      { name: "currentPassword", label: "Current password", type: "password" },
      { name: "newPassword", label: "New password", type: "password" },
      { name: "confirmPassword", label: "Repeat new password", type: "password" },
    ],
    submitLabel: "Change password",
    onSubmit: async (v) => {
      if (v.newPassword !== v.confirmPassword) {
        toast.error("✕ The new passwords don't match");
        return { ok: false, error: "confirmPassword: passwords don't match" };
      }
      const res = await save("/api/admin/password", { method: "POST", body: { currentPassword: v.currentPassword, newPassword: v.newPassword }, success: "✓ Password changed", failure: "✕ Password not changed" });
      if (res.ok) handle.form.reset();
      return res;
    },
  });
  handle.form.querySelectorAll("input").forEach((i) => { i.type = "password"; i.autocomplete = i.dataset.field === "currentPassword" ? "current-password" : "new-password"; });
  return { isDirty: handle.isDirty };
}
