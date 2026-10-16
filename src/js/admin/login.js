import { $ } from "../core/dom.js";
import { api } from "../core/api.js";
import { safeNext } from "./session.js";

const form = $("#login-form");
const errorBox = $('[data-slot="error"]');
const submit = $('button[type="submit"]', form);
const next = safeNext(new URLSearchParams(location.search).get("next"));

function showError(message) {
  $('[data-slot="error-text"]').textContent = message;
  errorBox.hidden = false;
}

// Already signed in? Skip the form.
api("/api/admin/session").then((res) => { if (res.ok) location.replace(next); });

$("[data-toggle-password]").addEventListener("click", (e) => {
  const input = form.elements.password;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  e.currentTarget.textContent = show ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-pressed", String(show));
  input.focus();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  form.elements.email.setAttribute("aria-invalid", String(!email));
  form.elements.password.setAttribute("aria-invalid", String(!password));
  if (!email || !password) return showError("Enter your email and password.");

  submit.setAttribute("aria-busy", "true");
  const res = await api("/api/admin/login", { method: "POST", body: { email, password } });
  submit.removeAttribute("aria-busy");

  if (res.ok) return location.replace(next);
  form.elements.password.value = "";
  form.elements.password.focus();
  if (res.status === 429) showError("Too many failed attempts. Please wait 15 minutes and try again.");
  else if (res.status === 401) showError("Incorrect email or password.");
  else if (res.status === 0) showError("Can't reach the server. Check your connection.");
  else showError(res.error ?? "Sign-in failed. Please try again.");
});
