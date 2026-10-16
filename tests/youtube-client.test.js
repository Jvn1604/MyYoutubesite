import { describe, it, expect } from "vitest";
import { createYouTubeClient, YouTubeApiError, uploadsPlaylistFor } from "../server/services/youtube.js";

const KEY = "AIzaTEST-secret-key";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status, reason, message = "Request failed") => json({ error: { code: status, message, errors: [{ reason }] } }, status);

/** Fake fetch: routes by resource name, records every URL. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const route = routes[u.pathname.split("/").pop()];
    return typeof route === "function" ? route(u, calls.length) : route;
  };
  return { impl, calls };
}
const client = (fetchImpl) => createYouTubeClient({ apiKey: KEY, fetchImpl, sleep: async () => {} });

describe("YouTube client", () => {
  it("requires an API key", () => {
    expect(() => createYouTubeClient({ apiKey: "" })).toThrow(YouTubeApiError);
  });

  it("derives the uploads playlist from the channel id", () => {
    expect(uploadsPlaylistFor("UC6REYc9lkrj8Em4kjCYsG7A")).toBe("UU6REYc9lkrj8Em4kjCYsG7A");
    expect(uploadsPlaylistFor("bogus")).toBeNull();
  });

  it("follows playlist pagination and counts one unit per page", async () => {
    const { impl, calls } = fakeFetch({
      playlistItems: (u) => u.searchParams.get("pageToken") === "P2"
        ? json({ items: [{ contentDetails: { videoId: "ccccccccccc" } }] })
        : json({ items: [{ contentDetails: { videoId: "aaaaaaaaaaa" } }, { contentDetails: { videoId: "bbbbbbbbbbb" } }], nextPageToken: "P2" }),
    });
    const yt = client(impl);
    expect(await yt.listAllPlaylistIds("UU6REYc9lkrj8Em4kjCYsG7A")).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
    expect(calls).toHaveLength(2);
    expect(yt.unitsUsed).toBe(2);
    expect(calls[0].searchParams.get("key")).toBe(KEY);
  });

  it("batches video lookups 50 ids per call and dedupes", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `vid${String(i).padStart(8, "0")}`);
    const { impl, calls } = fakeFetch({
      videos: (u) => json({ items: u.searchParams.get("id").split(",").map((id) => ({ id })) }),
    });
    const yt = client(impl);
    const items = await yt.getVideos([...ids, ids[0]]);
    expect(items).toHaveLength(51);
    expect(calls.map((c) => c.searchParams.get("id").split(",").length)).toEqual([50, 1]);
    expect(calls[0].searchParams.get("part")).toContain("liveStreamingDetails");
    expect(yt.unitsUsed).toBe(2);
  });

  it("retries once on a 5xx and then succeeds", async () => {
    const { impl, calls } = fakeFetch({
      channels: (_u, n) => (n === 1 ? apiError(503, "backendError") : json({ items: [{ id: "UC6REYc9lkrj8Em4kjCYsG7A" }] })),
    });
    expect((await client(impl).getChannel("UC6REYc9lkrj8Em4kjCYsG7A")).id).toBe("UC6REYc9lkrj8Em4kjCYsG7A");
    expect(calls).toHaveLength(2);
  });

  it("fails fast on quota exhaustion with a typed error", async () => {
    const { impl, calls } = fakeFetch({ channels: apiError(403, "quotaExceeded", "The request cannot be completed because you have exceeded your quota.") });
    const err = await client(impl).getChannel("x").catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeApiError);
    expect(err).toMatchObject({ status: 403, reason: "quotaExceeded", retryable: false });
    expect(calls).toHaveLength(1);
  });

  it("never leaks the API key in error messages", async () => {
    const { impl } = fakeFetch({ videos: apiError(400, "keyInvalid", `API key not valid: ${KEY}`) });
    const err = await client(impl).getVideos(["aaaaaaaaaaa"]).catch((e) => e);
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain("[redacted]");
  });

  it("reports network failures after one retry", async () => {
    let attempts = 0;
    const impl = async () => { attempts++; throw new TypeError("fetch failed"); };
    const err = await client(impl).getChannel("x").catch((e) => e);
    expect(err).toMatchObject({ reason: "network", retryable: true });
    expect(attempts).toBe(2);
  });

  it("returns null for an unknown channel", async () => {
    const { impl } = fakeFetch({ channels: json({ items: [] }) });
    expect(await client(impl).getChannel("UCnope")).toBeNull();
  });
});
