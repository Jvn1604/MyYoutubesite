/**
 * Thin fetch wrapper for our own /api routes.
 * Always resolves to { ok, status, data, error } so callers never need try/catch.
 */
export async function api(path, { method = "GET", body, headers = {}, signal } = {}) {
  const init = { method, headers: { Accept: "application/json", ...headers }, signal, credentials: "same-origin" };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(path, init);
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data?.error ?? res.statusText };
  } catch (err) {
    if (err.name === "AbortError") throw err;
    return { ok: false, status: 0, data: null, error: "Network error" };
  }
}
