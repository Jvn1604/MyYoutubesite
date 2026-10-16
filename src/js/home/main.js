import { api } from "../core/api.js";

async function showApiStatus() {
  const status = document.getElementById("api-status");
  const { ok, data } = await api("/api/health");
  status.textContent = ok ? `online (${data.env})` : "offline";
}

showApiStatus();
