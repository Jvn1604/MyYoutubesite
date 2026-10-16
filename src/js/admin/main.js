// Admin app entry: verify the session before showing anything. The dashboard router arrives in phase 11.
import { $ } from "../core/dom.js";
import { requireSession, signOut } from "./session.js";

async function main() {
  const admin = await requireSession();
  $('[data-slot="admin-email"]').textContent = admin.email;
  $('[data-action="logout"]').addEventListener("click", signOut);
  document.documentElement.classList.remove("auth-pending");
}

main();
