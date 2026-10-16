# DePhantom தமிழ் website: audit, architecture and build plan

Status: **Phases 1–3 done (audit, inventory, architecture). Waiting for the stack/hosting decision before Phase 4.**
Source audited: `website/index.html` (single file, 30 KB, written 2026-10-16).

---

## Phase 1: Audit of `website/index.html`

### 1.1 Sections and features

| # | Section | What it does today |
|---|---|---|
| 1 | Fixed nav | Logo + "DePhantom தமிழ்", 6 anchor links, Subscribe CTA. Turns solid on scroll. Burger menu below 900px (no ARIA state, no focus trap, no Esc to close). |
| 2 | Hero | Banner background at 28% opacity, radial glow, "LIVE every night" pill with a pulsing dot (**always shown, even when offline**), H1 "DePhantom / தமிழ்", Tamil greeting + tagline, buttons: Watch Live, Subscribe + 🔔, Join Discord. Floating avatar ring. |
| 3 | Stats | 4 tiles: 1.35K+ subs, 219K+ views, 490+ streams, 11K+ hours. **All hardcoded.** |
| 4 | Latest stream | Click-to-load YouTube embed (nocookie) on the first item of the hardcoded `streams` array, plus title, date, views, blurb and a Watch button. |
| 5 | Recent streams | Grid of the other 8 hardcoded streams with i.ytimg thumbnails. Every item is labelled "Stream" (no classification). |
| 6 | Schedule | "Live every night", converts 21:00 MYT to the visitor's timezone and to MY/IN/LK/SG, plus day chips. **Manual only, no real live/upcoming detection.** |
| 7 | Road to 1,652 | Progress bar from `challenge {start, goal, now, deadline}`. **`now` is typed in by hand.** No celebration when the goal is reached. |
| 8 | Games | 11 text chips, 2 with tags ("NOW", "77K views"). No covers, status, or link to videos. |
| 9 | Community | 4 cards: Discord, WhatsApp channel, Instagram, Linktree, with inline SVG icons. |
| 10 | Support | Membership + Super Chat buttons, 4 perk rows. **The perks are guesses that were never confirmed.** |
| 11 | About | Logo image, 2 bio paragraphs, 6 feature tiles. |
| 12 | Footer | Brand + © year. |
| – | Behaviour | Scroll reveal (IntersectionObserver), nav scroll state, burger toggle, reduced-motion media query. |

### 1.2 Hardcoded content (everything below must move out of the HTML/JS)

- **Comes from YouTube** (remove from the code): stats tiles, `streams[]` (ids, titles, dates, views), latest-stream blurb, subscriber "now", avatar URL, banner URL.
- **Becomes admin-managed (database)**: nav labels, hero headings/tagline/greeting/CTAs, `links{}` (9 URLs), `schedule{hour, minute, days}`, `challenge{start, goal, deadline}`, `games[]`, `perks[]`, About text and feature tiles, footer text, SEO meta/OG tags.
- **Public config (non-secret)**: channel id, handle, base timezone `Asia/Kuala_Lumpur`, comparison timezones.

### 1.3 Inline CSS

- About 250 lines in one `<style>` block. It has some tokens (`--bg`, `--violet`…), but there are many magic numbers (radii 10/12/16/20/24, paddings, font sizes, rgba glows repeated around 8 times).
- 9 `style="…"` attributes in the markup (section backgrounds, inline Tamil colour, button alignment, badge positioning).

### 1.4 Inline JS

- About 120 lines in one `<script>`: CONFIG object, DOM rendering via `innerHTML` template strings (escaped with a local `esc()`), click-to-play, schedule conversion, challenge bar, nav, reveal.
- An inline `onerror=` attribute on the player thumbnail.
- Global `CONFIG`, `$`, `esc`, `io` and others.

### 1.5 External dependencies and assets

| Asset | Source | Notes |
|---|---|---|
| Fonts | Google Fonts: Rajdhani, Inter, Noto Sans Tamil | Render-blocking stylesheet. Self-host or `display=swap` + preload. |
| Logo / favicon / OG image | `yt3.googleusercontent.com/IRzp…` | Hotlinked. Move to local media (logo is creator-owned). |
| Banner | `yt3.googleusercontent.com/7NGW…` | Hotlinked. Move to local media. |
| Thumbnails | `i.ytimg.com/vi/{id}/…` | Fine (official YouTube thumbnails). |
| Embed | `youtube-nocookie.com/embed/{id}` | Keep (privacy-enhanced). |
| JS libraries | none | Good. Keep dependencies minimal. |

### 1.6 Accessibility, SEO and performance gaps

- Burger has no `aria-expanded`/`aria-controls`. Menu links aren't reachable logically when it's closed. No skip link. Focus styles rely on browser defaults.
- The "LIVE" pill claims live status that may be false, and live status is shown by colour + dot only.
- No canonical URL, no Twitter card, no JSON-LD, no sitemap/robots, no 404 page, no manifest.
- The hero background image is not preloaded or responsive. The fade-in reveal hides content until JS runs (bad if JS fails).
- `lang="ta"` while most copy is English. It should be `lang="en"` with `lang="ta"` on the Tamil spans.

---

## Phase 2: Content to carry over (nothing gets lost)

| Content | New home |
|---|---|
| Brand "DePhantom தமிழ்", greeting "வணக்கம் நண்பர்களே!", "Phantom Troupe" | `site_settings` (hero/brand group), seeded |
| Tagline, hero lead, About paragraphs, 6 About tiles | `site_settings` (content group), seeded |
| Links: channel, subscribe, live, streams, join, Discord `discord.gg/RdwRFEeb8K`, WhatsApp `whatsapp.com/channel/0029VbEPJeHBfxo9s4pYMU1b`, Instagram `ig.me/j/FJjObnPWb6NMA9yD/`, Linktree `linktr.ee/dephantomtamil` | `social_links` + `site_settings.cta`, seeded |
| Schedule: daily 21:00 MYT | `schedule_rules`, seeded (flagged "confirm in admin") |
| Challenge: start 1,352 → goal 1,652 by 16 Jan 2027 | `subscriber_goals`, seeded |
| Games: Valor Mortis (Currently Playing), CONTROL Resonant, The Blood of Dawnwalker, Onimusha: Way of the Sword, Crimson Desert, Black Myth: Wukong (Favourite), Elden Ring (Completed), Bloodborne (Favourite), A Plague Tale, Mortal Shell, Party Animals | `games`, seeded. Statuses are a best guess, editable in admin. |
| Membership perks (4) | `site_settings.support.perks`, seeded **disabled until confirmed** |
| Stream list, stats, avatar, banner | **Not seeded.** They come from YouTube sync (avatar/banner are copied once into media). |

---

## Phase 3: Architecture

### 3.1 Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Vanilla HTML/CSS/ES modules, built by Vite** (multi-page: `/`, `/admin`, `/404`) | The site is content + a CMS, so React/Next adds weight without solving a real problem. Vite gives hashed bundles, CSS splitting and a dev server with almost no config. |
| Backend | **Node.js serverless functions on Netlify** (`netlify/functions/*` thin entry points → shared `server/` controllers/services) | Netlify is the host you were already setting up. Functions keep the YouTube key server-side. **Scheduled Functions** run the sync without a server to babysit. No cold-sleeping VM (unlike Render's free tier). |
| Database | **Supabase Postgres** (free tier) via the `postgres` driver + SQL migrations | Real relational DB with backups and a dashboard. The sync job touches it every few minutes, so the free project never idles into pause. |
| Media | **Supabase Storage** (public bucket), uploads only through our authenticated API | 1 GB free. Image resizing/WebP is done with `sharp` in the upload function. |
| Auth | **Own minimal single-admin auth**: bcrypt password hash in `admins`, HMAC-signed `HttpOnly; Secure; SameSite=Strict` session cookie, CSRF token header on mutating requests, login rate-limit table | One admin doesn't need an identity provider. This is small, auditable, and keeps the "browser never talks to the DB" rule. |
| YouTube | **YouTube Data API v3**, official endpoints only | No HTML scraping (I'll stop using the RSS/page tricks I used before). |

Runs locally with `npm run dev` (`netlify dev` = Vite + functions together), against either a local Postgres or the Supabase dev project.

### 3.2 Directory structure

```
DePhantomTamil/
├── index.html                 # homepage shell (sections rendered from API data)
├── 404.html
├── admin/
│   ├── index.html             # CMS shell (sidebar app, hash routes)
│   └── login.html
├── src/
│   ├── css/  tokens.css reset.css base.css layout.css components.css
│   │         animations.css home.css admin.css
│   ├── js/
│   │   ├── core/   api.js dom.js format.js time.js store.js
│   │   ├── ui/     toast.js modal.js skeleton.js reveal.js counter.js menu.js
│   │   ├── home/   main.js hero.js live.js stats.js videos.js games.js
│   │   │           schedule.js goal.js community.js support.js about.js theme.js
│   │   └── admin/  main.js router.js pages/{dashboard,content,videos,games,schedule,
│   │               goals,social,appearance,media,youtube,analytics,seo,settings}.js
│   └── assets/ logos/ icons/ backgrounds/ fallback/
├── public/  robots.txt manifest.webmanifest favicon.*      # copied as-is
├── netlify/functions/          # thin HTTP/cron entry points only
│   ├── public-site.mjs   (GET /api/site: one cached payload for the homepage)
│   ├── public-videos.mjs (GET /api/videos?type=&game=&q=&page=)
│   ├── live.mjs          (GET /api/live)
│   ├── admin-*.mjs       (auth, settings, videos, games, schedule, goals, social, media, sync)
│   ├── sitemap.mjs
│   └── youtube-sync.mjs  (scheduled)
├── server/
│   ├── config.js               # env loading + validation (fails loudly)
│   ├── db/ client.js  migrations/001_init.sql …  seed.js
│   ├── services/ youtube.js sync.js classify.js cache.js media.js auth.js settings.js
│   ├── controllers/ …           # request → validate → service → response
│   ├── middleware/ requireAdmin.js csrf.js rateLimit.js http.js (errors, headers)
│   └── validation/ schemas.js   # zod schemas for every admin input
├── scripts/ create-admin.js migrate.js
├── tests/                       # vitest: classify, schedule math, sync merge, auth
├── .env.example  .gitignore  netlify.toml  package.json  README.md
└── legacy/index.html            # the current file, kept for reference
```

### 3.3 YouTube sync and quota strategy

The free quota is 10,000 units/day. The plan below uses **about 2,200**:

| Job | Calls | Cost | Frequency | Per day |
|---|---|---|---|---|
| **Live/recent check** | `playlistItems.list` on the uploads playlist `UU6REYc9lkrj8Em4kjCYsG7A` (newest 10) + `videos.list` (snippet, contentDetails, statistics, liveStreamingDetails) | 2 | every 2 min | ~1,440 |
| **Channel stats** | `channels.list` (statistics, snippet, brandingSettings) | 1 | every 15 min | 96 |
| **Library refresh** | page through the whole uploads playlist (≈450 items → 9 pages) + `videos.list` in batches of 50 | ~18 | every 6 h | 72 |
| Admin "Sync now" | full run | ~20 | manual | – |

- **No `search.list`** (100 units per call). Live and scheduled broadcasts appear in the uploads playlist, and `liveBroadcastContent` + `liveStreamingDetails` give live/upcoming/ended, scheduled start, and concurrent viewers.
- **Fallback for scheduled streams**: if a scheduled broadcast is slow to appear in the uploads playlist (this can happen), an hourly `search.list?eventType=upcoming` (100 units × 24 = 2,400/day) still keeps the total under 5,000. It gets enabled only if testing shows it's needed.
- **Classification** (`server/services/classify.js`):
  - `liveStreamingDetails` present → **stream** (sub-state live / upcoming / ended)
  - duration ≤ 180 s or `#shorts` in the title/description → **short** (the public API doesn't expose aspect ratio, so this is a heuristic and the admin can correct it)
  - otherwise → **video**
  - The admin can override the category.
- **Merge rule**: sync writes only YouTube-owned columns in `videos`. Website-owned fields live in `video_overrides`, which sync never touches. Videos missing from the API are marked `is_available=false` (private/deleted), not deleted, so overrides survive.
- **Cached serving**: visitors hit `/api/site`, which reads from Postgres and is sent with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (Netlify CDN). `/api/live` uses `s-maxage=30`. **Visitors never trigger YouTube calls.**
- **Failure handling**: every run writes `youtube_sync_logs`. On error, the DB keeps the last good data and the homepage still renders. The admin dashboard shows the error and API health. If the DB has never synced, the homepage shows designed empty states.

**Your example: you upload "What is Soulslike?"**
1. Within about 2 minutes the cron sees a new id in the uploads playlist.
2. Sync inserts it into `videos` and classifies it as a video.
3. `/api/site` now returns it as `latestUpload`.
4. Within about 1 more minute (CDN TTL), the homepage shows it with its thumbnail, title, date, views and link.

**Going live:**
1. The next 2-minute run sees `liveBroadcastContent=live`.
2. The hero switches to 🔴 LIVE NOW with viewer count and a Watch Live button.
3. When the stream ends, `actualEndTime` appears, the stream moves into Recent Streams, and the hero falls back to NEXT STREAM (a real scheduled broadcast if one exists, otherwise your regular schedule).

### 3.4 Database (Postgres)

```
admins              id, email UNIQUE, password_hash, created_at, last_login_at
sessions            id, admin_id→admins, token_hash, csrf_token, expires_at, user_agent
login_attempts      ip_hash, attempted_at                       (rate limiting)
site_settings       key PK, value JSONB, draft_value JSONB, updated_at
                    keys: brand, hero, cta, about, support, footer, seo, appearance, sections
social_links        id, platform, label, description, url, icon, enabled, sort_order
games               id, slug UNIQUE, name, status(enum), genre, release_year, description,
                    cover_media_id→media, banner_media_id→media, playlist_url,
                    featured, hidden, sort_order
videos              youtube_id UNIQUE PK, title, description, published_at, duration_s,
                    thumbnails JSONB, kind(video|short|stream), live_state(none|upcoming|live|ended),
                    scheduled_start, actual_start, actual_end, concurrent_viewers,
                    view_count, like_count, comment_count, is_available, synced_at
video_overrides     youtube_id PK→videos, hidden, featured, game_id→games, kind_override,
                    custom_description, priority
schedule_rules      id, weekday 0–6, start_time, timezone default 'Asia/Kuala_Lumpur', title, enabled
schedule_events     id, starts_at timestamptz, title, description, enabled  (specials/overrides)
subscriber_goals    id, title, description, start_value, goal_value, deadline,
                    enabled, celebrate, achieved_at
channel_stats       singleton: subscriber_count, subs_hidden, view_count, video_count,
                    title, description, avatar_url, banner_url, synced_at
analytics_snapshots date PK, subscriber_count, view_count, video_count  (daily, powers growth chart)
media               id, kind, path, mime, width, height, bytes, variants JSONB, alt, created_at
youtube_sync_logs   id, job, started_at, finished_at, ok, units_used, items_changed, error
site_events         id, event, target, created_at   (privacy-friendly click counters, no IPs)
```

### 3.5 Security summary

- Secrets (`YOUTUBE_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) live only in Netlify env vars and are never sent to the browser.
- Every admin route: session check → CSRF header check → zod validation → parameterised SQL.
- Login: bcrypt (cost 12), 5 attempts per 15 min per IP, generic error messages.
- Uploads: MIME sniffing (not the file extension), 5 MB cap, re-encoded with sharp (this strips EXIF and anything malicious), WebP + AVIF variants.
- Output escaping everywhere on the frontend (`textContent` / a single `html` tagged template that escapes). Strict CSP headers via `netlify.toml`.

---

## Implementation plan (phases 4–16)

| Phase | Deliverable | Done when |
|---|---|---|
| 4 | Scaffold: package.json, Vite multi-page, netlify.toml, folders, .env.example, .gitignore, git init | `npm run dev` serves an empty shell and a function `/api/health` |
| 5 | Design system: tokens.css + base/components/animations | Token sheet page renders all components |
| 6 | Homepage frontend against a **mock** `/api/site` fixture | All sections responsive 320–1920 px, skeletons, empty states |
| 7 | DB migrations + seed (all Phase 2 content) | `npm run db:migrate && npm run db:seed` works on Supabase |
| 8 | YouTube service + classifier (+ unit tests on real response fixtures) | Tests green |
| 9 | Sync job, merge rules, cache headers, `/api/site`, `/api/videos`, `/api/live` | The homepage shows real channel data from the DB |
| 10 | Auth: create-admin script, login/logout, sessions, CSRF, rate limit | Protected routes return 401 without a session |
| 11 | Admin CMS: dashboard, content, videos, games, schedule, goals, social, media, YouTube, appearance (live preview), sections, SEO | Every CRUD flow works with toasts/modals |
| 12 | Wire CMS settings → homepage (appearance tokens, section order/toggles) | Changing a setting in admin changes the site without a deploy |
| 13 | Animation/micro-interaction polish, celebration, counters, parallax (reduced-motion aware) | – |
| 14 | SEO (JSON-LD Person/WebSite/VideoObject, OG/Twitter, sitemap, robots), a11y pass, Lighthouse | Lighthouse ≥ 90 on all four categories, mobile |
| 15 | Test pass (list from spec §71), console/network clean | – |
| 16 | README (setup, env, DB, YouTube key, admin, deploy, cron, backups, troubleshooting) | – |

### What you'll need to create yourself (I can't create accounts)

1. **Google Cloud** project → enable *YouTube Data API v3* → create an API key (restricted to that API).
2. **Supabase** free project → copy the connection string (pooler) + service role key.
3. **Netlify** account (you may already have one from Netlify Drop) + a **GitHub** account so Netlify redeploys on every code push.

All free.
