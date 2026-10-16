/** Consistent save/delete flows with toasts for the CMS pages. */
import { adminApi } from "./session.js";
import { toast } from "../ui/toast.js";

/** Send a write; toast the outcome. Returns { ok, data, error }. */
export async function save(path, { method = "PUT", body, success = "✓ Saved", failure = "✕ Couldn't save" } = {}) {
  const res = await adminApi(path, { method, body });
  if (res.ok) toast.success(success);
  else if (res.status !== 401) toast.error(`${failure}: ${res.error ?? "unknown error"}`);
  return res;
}

export const saveSetting = (key, value, success = "✓ Settings saved") =>
  save(`/api/cms/settings/${key}`, { method: "PUT", body: { value }, success });

/** Fetch JSON for a page; renders nothing itself. Throws on failure so the router shows an error state. */
export async function load(path) {
  const res = await adminApi(path);
  if (!res.ok) throw new Error(res.error ?? `Request failed (${res.status})`);
  return res.data;
}
