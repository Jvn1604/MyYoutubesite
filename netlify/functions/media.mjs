import { handle, error } from "../../server/middleware/http.js";
import { storageKind, readLocalObject } from "../../server/services/storage.js";

// Development only: serves uploads from ./.data/media. In production media is served by Supabase Storage directly.
export default handle(async (req) => {
  if (storageKind() !== "local") return error(404, "Not found");
  const path = decodeURIComponent(new URL(req.url).pathname.replace(/^\/media\//, ""));
  try {
    const body = await readLocalObject(path);
    const type = path.endsWith(".avif") ? "image/avif" : "image/webp";
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return error(404, "Not found");
  }
});

export const config = { path: "/media/*" };
