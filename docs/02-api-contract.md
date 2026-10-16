# Public API contract

The homepage needs exactly two read endpoints. Both are CDN-cached and never call YouTube directly.

## `GET /api/site`

One payload with everything the first screen needs. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

```jsonc
{
  "generatedAt": "ISO",
  "settings": {
    "brand":    { "name", "nameTa", "greetingTa", "community", "logoUrl" },
    "hero":     { "heading", "headingTa", "tagline", "lead", "backgroundUrl", "ctas": [Cta] },
    "about":    { "title", "paragraphs": [""], "features": [""], "channelStart": "YYYY-MM-DD",
                  "genres": [""], "milestones": [{ "date", "title" }], "photoUrl" },
    "support":  { "title", "text", "methods": [SupportMethod], "perks": [""], "perksEnabled": bool },
    "footer":   { "text" },
    "links":    { "channel", "subscribe", "live", "streams", "join", "discord" },
    "appearance": { "primary", "secondary", "background", "radiusScale", "motion": "normal|subtle|off" },
    "sections": [{ "key": "hero|stats|latest|streams|videos|games|schedule|goal|community|support|about", "enabled": bool }]  // ordered
  },
  "channel": null | { "title", "subscriberCount", "subscribersHidden", "viewCount", "videoCount",
                      "streamCount", "avatarUrl", "bannerUrl", "syncedAt" },
  "live": { "state": "live|upcoming|offline", "video": Video | null },   // video = live stream, or the soonest upcoming one
  "latest": { "upload": Video | null, "stream": Video | null },
  "recentStreams": [Video],      // newest 6 completed streams
  "featured": [Video],
  "games": [Game],
  "schedule": { "timezone": "Asia/Kuala_Lumpur", "message", "rules": [{ "weekday": 0-6, "time": "HH:MM", "title" }],
                "events": [{ "startsAt": "ISO", "title", "description" }], "compareZones": [{ "label", "timeZone" }] },
  "goal": null | { "title", "description", "start", "target", "current", "deadline", "celebrate" },
  "socials": [{ "platform", "label", "description", "url", "icon", "accent" }],
  "videoFacets": { "total", "byKind": { "video", "stream", "short" } }
}
```

```jsonc
Video = { "id", "title", "description", "note" /* admin's website-only text or null */, "url", "publishedAt", "durationSeconds",
          "kind": "video|stream|short", "liveState": "none|upcoming|live|ended",
          "scheduledStart", "actualStart", "concurrentViewers",
          "views", "likes", "comments",
          "thumbnails": { "medium", "high", "maxres" },
          "game": null | { "slug", "name" }, "featured": bool }

Game  = { "slug", "name", "status": "playing|completed|upcoming|dropped|favourite",
          "genre", "releaseYear", "description", "coverUrl", "playlistUrl", "videoCount", "featured" }

Cta   = { "key", "label", "url", "style": "primary|youtube|ghost", "enabled" }
SupportMethod = { "key", "label", "description", "url", "enabled" }
```

Rules:
- Hidden videos/games and disabled socials/sections never appear in public payloads.
- Statistics are `null` when unknown (never invented). `subscribersHidden: true` means don't show the count.

## `GET /api/videos`

Library browsing with filters. Query: `type=all|video|stream|short`, `game=<slug>`, `q=<text>`, `page=1..`, `pageSize=12` (max 48).

```jsonc
{ "items": [Video], "page": 1, "pageSize": 12, "total": 42, "hasMore": true }
```
