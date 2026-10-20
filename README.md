# DePhantom தமிழ் — creator website + CMS

The official website for the YouTube channel **DePhantom தமிழ்** ([@ImDePhantom](https://www.youtube.com/@ImDePhantom)): Tamil gaming livestreams, soulslike and action RPGs.

- **The homepage updates itself from YouTube.** New uploads, livestreams, live/upcoming status and channel stats are synced automatically. You never edit code to add a video.
- **A private admin dashboard** at `/admin` lets you edit everything else: text, buttons, games, schedule, subscriber goal, social links, colours, section order, SEO and images.
- **Built to keep running.** If YouTube or the database has a problem, visitors still see the last good version of the site.

> **Streaming?** The OBS overlay (scenes, control panel, alerts, chat) lives in [`overlay/`](overlay/README.md). Start it with `npm run overlay`.

> Returning after a while? Start with [Day-to-day use](#day-to-day-use), then [Troubleshooting](#troubleshooting).

---

## Contents

1. [How it works](#how-it-works)
2. [Tech stack](#tech-stack)
3. [Folder structure](#folder-structure)
4. [Run it on your computer](#run-it-on-your-computer)
5. [Environment variables](#environment-variables)
6. [Database](#database)
7. [YouTube API key](#youtube-api-key)
8. [Admin account](#admin-account)
9. [YouTube synchronisation](#youtube-synchronisation)
10. [Deploy to production](#deploy-to-production)
11. [Media storage](#media-storage)
12. [Day-to-day use](#day-to-day-use)
13. [Backups](#backups)
14. [Troubleshooting](#troubleshooting)
15. [Security notes](#security-notes)
16. [Further docs](#further-docs)

---

## How it works

```
YouTube Data API ──(scheduled sync every 2 min / 15 min / 6 h)──▶ Postgres (Supabase)
                                                                     │
          Admin dashboard (/admin) ──(edits website settings)──────▶ │
                                                                     ▼
Visitor ──▶ Netlify CDN ──▶ /api/site (cached 60 s) ──▶ database ──▶ homepage renders
                │
                └─ edge function adds SEO / link-preview tags to the HTML
```

- **YouTube is the source of truth** for videos (titles, thumbnails, dates, views, live state) and channel stats.
- **The website database is the source of truth** for your choices: hidden/featured videos, game assignments, custom descriptions, games, schedule, goals, links, text and appearance.
- A sync **never overwrites your website choices**. Hiding a video on the site doesn't touch YouTube, and a YouTube title change doesn't undo your settings.

## Tech stack

| Part | Choice | Why |
|---|---|---|
| Frontend | Plain HTML/CSS/JavaScript modules, built with **Vite** | Fast, no framework to maintain |
| Backend | **Netlify Functions** (Node 22) + 1 Edge Function | No server to look after; scheduled functions run the sync |
| Database | **Postgres on Supabase** (free tier) | Real relational database with a dashboard |
| Images | **Supabase Storage**, optimised with **sharp** (WebP + AVIF) | Uploads are resized and cleaned automatically |
| Auth | Own single-admin login (scrypt, HttpOnly cookie, CSRF, rate limit) | Simple and auditable for one admin |
| Validation | **zod** on every admin input | Never trusts the browser |
| Tests | **Vitest** + PGlite (real Postgres in memory) | 180+ tests run offline in ~15 s |

## Folder structure

```
├── index.html, 404.html          Homepage shell and "You Died" 404 page
├── admin/                        Admin app (index.html) and login page
├── src/
│   ├── css/                      Design system: tokens, components, animations, page styles
│   ├── js/core/                  Shared helpers (safe HTML, formatting, time zones, motion)
│   ├── js/ui/                    Toasts, modals, reveal, counters, icons, menu
│   ├── js/home/                  Homepage sections
│   └── js/admin/                 Admin router, forms, pages/
├── public/                       Copied as-is: boot.js, icons, manifest, fallback images
├── netlify/
│   ├── functions/                API endpoints + scheduled sync jobs
│   ├── edge-functions/seo.js     Injects meta / Open Graph / JSON-LD into the homepage
│   └── production-headers        CSP + security headers (production builds only)
├── server/
│   ├── config.js                 Environment variables
│   ├── db/                       Client, migrations/, seed, backup
│   ├── services/                 YouTube client, classifier, sync, auth, images, storage, SEO
│   ├── repositories/             Database reads/writes
│   ├── controllers/              Admin API handlers (cms/)
│   ├── middleware/               HTTP helpers, auth/CSRF
│   └── validation/               zod schemas
├── scripts/                      CLI tools (db, sync, admin, backup, icons, local database)
├── tests/                        Vitest suites (+ saved YouTube API responses)
├── docs/                         Architecture, API contract, test report
└── legacy/index.html             The original single-file site, kept for reference
```

## Run it on your computer

Requirements: **Node.js 22.9 or newer** ([nodejs.org](https://nodejs.org)) and Git.

```bash
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and set `SESSION_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then use two terminals:

```bash
# Terminal 1: local Postgres (no install needed; data saved in .data/db)
npm run db:local
```

```bash
# Terminal 2
npm run db:setup              # create tables + load starting content
npm run admin:create -- you@example.com
npm run sync -- demo          # sample videos so the page isn't empty (no API key needed)
npm run dev                   # http://localhost:8888  (admin: http://localhost:8888/admin)
```

Useful extras:

| URL / command | What it does |
|---|---|
| `http://localhost:8888/?mock=live` | Preview the homepage as if you were live (also `upcoming`, `empty`, `goal`) |
| `http://localhost:8888/styleguide.html` | Design system reference (dev only) |
| `npm test` | Run all tests |
| `npm run build` | Production build into `dist/` |
| `npm run icons` | Regenerate app icons from `public/fallback/avatar.svg` |

> Don't run `netlify serve` and `npm run dev` at the same time. They share the `.netlify/` folder and the dev server breaks (restart it to fix).

## Environment variables

Locally they live in `.env` (never committed). In production, set them in **Netlify → Site configuration → Environment variables**.

| Variable | Required | Example / where to get it |
|---|---|---|
| `YOUTUBE_API_KEY` | for sync | Google Cloud API key ([steps](#youtube-api-key)) |
| `YOUTUBE_CHANNEL_ID` | yes | `UC6REYc9lkrj8Em4kjCYsG7A` |
| `DATABASE_URL` | yes | Local: `postgres://postgres:postgres@127.0.0.1:54329/postgres` · Production: Supabase *transaction pooler* URL (port **6543**) |
| `SUPABASE_URL` | production | `https://xxxx.supabase.co` (Supabase → Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | production | Supabase → Project Settings → API → `service_role` key. **Secret.** |
| `SUPABASE_MEDIA_BUCKET` | no | `media` (default) |
| `SESSION_SECRET` | yes | 48+ random characters (command above). Changing it signs everyone out. |
| `ADMIN_EMAIL` | no | Default email for `npm run admin:create` |
| `SITE_URL` | production | `https://dephantomtamil.netlify.app` (canonical links, sitemap, previews) |

Without Supabase variables, local development stores uploads in `.data/media/`.

## Database

**Local:** `npm run db:local` runs a real Postgres (PGlite) on port 54329. Data lives in `.data/db/` (git-ignored). Delete that folder to start fresh.

**Production (Supabase, free):**

1. Create an account at [supabase.com](https://supabase.com) → **New project** → region **Singapore** (closest to Malaysia/India) → choose a strong database password and save it in your password manager.
2. **Connect** (top bar) → **Transaction pooler** → copy the URI and put your password in it. It looks like
   `postgres://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
3. Create the tables and starting content from your computer. Temporarily put that URI in `.env` as `DATABASE_URL`, then:
   ```bash
   npm run db:setup
   npm run admin:create -- you@example.com
   ```
   Switch `.env` back to the local URL afterwards so local experiments don't touch the live site.

Commands:

| Command | Effect |
|---|---|
| `npm run db:status` | Show applied / pending migrations |
| `npm run db:migrate` | Apply new migrations (safe to run any time) |
| `npm run db:seed` | Insert starting content **only where missing**; never overwrites your edits |
| `npm run db:setup` | Migrate + seed |

Schema changes go in a new file `server/db/migrations/002_description.sql`. Migrations only move forward and each runs once.

## YouTube API key

Free, about 10 minutes. The site uses roughly 2,000 of the 10,000 free daily quota units.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (e.g. "DePhantom website").
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Click the new key → **API restrictions → Restrict key → YouTube Data API v3** → Save.
   (Leave *application restrictions* at "None": the key is only used server-side, never in the browser.)
5. Put it in `.env` as `YOUTUBE_API_KEY` (and later in Netlify). Then test:
   ```bash
   npm run sync -- all
   ```

## Admin account

```bash
npm run admin:create -- you@example.com            # create (password typed hidden, min 12 chars)
npm run admin:create -- you@example.com --reset    # forgot password / change it (signs out everywhere)
```

Run these against the production database by temporarily pointing `DATABASE_URL` at Supabase. Inside the dashboard, **Settings** changes the password. Five wrong passwords lock out that network for 15 minutes.

## YouTube synchronisation

Runs automatically on Netlify as scheduled functions:

| Job | Schedule | Does | Quota |
|---|---|---|---|
| `sync-live` | every 2 min | newest 10 uploads + anything live/upcoming | ~2 units |
| `sync-stats` | every 15 min | subscribers, views, daily snapshot, goal reached? | 1 unit |
| `sync-library` | every 6 h | the whole uploads playlist, detects deleted/private videos | ~20 units |

What happens when you…

- **Upload a video:** it appears as *Latest upload* within ~3 minutes (2 min sync + 1 min CDN cache).
- **Go live:** the hero switches to **🔴 LIVE NOW** within ~3 minutes; when you end, the stream moves into *Recent streams*.
- **Schedule a stream on YouTube:** it becomes *Next stream* with a countdown, overriding your regular schedule.
- **Delete or privatise a video:** it disappears from the site; your website settings for it are kept in case it returns.
- **Upload a Short:** detected by its vertical format (or `#shorts`) and kept out of the *Latest upload* card. You can fix any wrong type in **Admin → Videos → Edit**.

Games are matched to videos automatically by title keywords (**Admin → Games → Auto-assign keywords**). A game you pick by hand in **Videos** is never changed by sync.

Manual sync: **Admin → YouTube sync** (for checks), or from your computer:

```bash
npm run sync -- live | stats | library | all
```

> On Netlify, normal functions time out after ~10 s. The dashboard's "Full re-sync" is fine for normal use. For the very first import of a large channel, run `npm run sync -- all` from your computer against the production database.

## Deploy to production

You need free accounts on **GitHub**, **Netlify** and **Supabase** (and the YouTube key above).

1. **Supabase:** create the project, run `db:setup` and create your admin ([Database](#database)). Then **Storage → New bucket** named `media`, set to **Public**.
2. **GitHub:** create a private repository and push this project:
   ```bash
   git remote add origin https://github.com/<you>/dephantom-website.git
   git push -u origin main
   ```
3. **Netlify:** **Add new site → Import an existing project → GitHub** → pick the repo. Build settings come from `netlify.toml`, so just click **Deploy**.
4. **Environment variables** (Netlify → Site configuration → Environment variables): add every *production* variable from the [table](#environment-variables). Mark the key, `DATABASE_URL`, service-role key and session secret as **secret**. Set `SITE_URL` to your Netlify address.
5. **Redeploy** (Deploys → Trigger deploy) so the functions pick up the variables.
6. **First full import:** `npm run sync -- all` from your computer with `.env` pointing at production (see the note above).
7. **Check:**
   - the homepage shows real numbers;
   - `/admin` signs you in;
   - **Admin → YouTube sync** shows "Synced";
   - **Netlify → Functions** lists `sync-live`, `sync-stats`, `sync-library` as *Scheduled*;
   - share the link in WhatsApp or Discord to see the preview card.
8. **Optional custom domain:** Netlify → Domain management (~$10–12/year for a `.com`). Update `SITE_URL` afterwards.

Every `git push` to `main` redeploys automatically. **Content changes made in the admin need no deploy.**

Free-tier notes (limits change, so check the current Netlify and Supabase pricing pages): the scheduled sync makes about 25,000 function calls a month, and visitor traffic is mostly served from the CDN cache. Supabase pauses inactive free projects; the sync touches the database every 2 minutes, which should keep it active. If it is ever paused, press **Restore** in the Supabase dashboard.

## Media storage

Uploads (**Admin → Media**, or *Choose image* in any form) are validated (real image check, max 4 MB, 64–8000 px; SVG rejected for safety), re-encoded to remove metadata, and saved as WebP plus AVIF/WebP variants in the Supabase `media` bucket. Images that are still used by a game or a setting can't be deleted.

To use a different logo as the browser/app icon, replace `public/fallback/avatar.svg` (or pass any image path) and run `npm run icons`.

## Day-to-day use

| I want to… | Where |
|---|---|
| Change hero text, buttons, About, support options | Admin → **Content** |
| Hide/feature a video, give it a website description or game | Admin → **Videos** |
| Add a game, cover, playlist, status | Admin → **Games** |
| Change stream days/time, add a special stream | Admin → **Schedule** |
| Start a new subscriber goal | Admin → **Goals** |
| Add or hide a social link, change order | Admin → **Social links** |
| Change colours, roundness, animation | Admin → **Appearance** (live preview, then *Publish*) |
| Reorder or hide homepage sections | Admin → **Sections** |
| Change the Google/WhatsApp preview text or image | Admin → **SEO & sharing** |
| See growth and website clicks | Admin → **Analytics** |

Changes appear on the public site within about a minute (CDN cache).

## Backups

What to back up:

| Data | How | Needed? |
|---|---|---|
| Website content (settings, games, schedule, goals, links, video settings, image list) | `npm run backup` | **Yes**: monthly, and before big changes |
| Uploaded image files | Supabase → Storage → `media` → select all → Download | Yes, occasionally |
| Full database | `pg_dump` (below) | Optional extra safety |
| YouTube videos/stats | not needed | A sync rebuilds them |

```bash
npm run backup                                    # → backups/website-YYYY-MM-DD-HHMM.json
npm run restore -- backups/website-….json         # replaces website content in DATABASE_URL
```

`backups/` is git-ignored; keep copies somewhere safe (Google Drive etc.). Admin accounts aren't in the backup; recreate them with `npm run admin:create`.

Full database dump (needs the [Postgres client tools](https://www.postgresql.org/download/)). Use Supabase's **Session pooler** or direct connection string (port 5432) for this:

```bash
pg_dump "postgres://postgres.xxxx:PASSWORD@...:5432/postgres" --no-owner -Fc -f dephantom.dump
pg_restore --no-owner -d "<connection string>" dephantom.dump
```

**Restoring onto a brand-new Supabase project:** `npm run db:setup` → `npm run sync -- all` → `npm run restore -- <file>` → `npm run admin:create` → re-upload the image files to the `media` bucket with the same names.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Admin shows **"YouTube not connected"** | `YOUTUBE_API_KEY` missing in Netlify env → add it and redeploy |
| **Sync error: quotaExceeded** | Daily quota used up (resets at midnight US Pacific). The site keeps showing the last data. Check nothing else uses the key. |
| **Sync error: keyInvalid / forbidden** | Key deleted or API restriction wrong. Re-check step 4 of [YouTube API key](#youtube-api-key). |
| New video not showing after 5 min | Admin → YouTube sync → history. Hidden in Admin → Videos? Private on YouTube? |
| Homepage says **"Couldn't load the latest content"** | Database unreachable: Supabase paused (press Restore) or wrong `DATABASE_URL`. Check Netlify → Functions → `site` logs. |
| **Image storage isn't set up yet** when uploading | Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, create the public `media` bucket, redeploy |
| Can't sign in / "Too many failed attempts" | Wait 15 min, or reset: `npm run admin:create -- you@example.com --reset` |
| Everyone got signed out | `SESSION_SECRET` changed. Normal after a change. |
| Link preview shows old text | WhatsApp/Discord cache previews. Test at [opengraph.xyz](https://www.opengraph.xyz) or add `?v=2` to the link. |
| Local: `ECONNREFUSED 127.0.0.1:54329` | Start `npm run db:local` in another terminal |
| Local: `/api/site` 500 "Cannot find module … functions-serve" | You ran `netlify serve` alongside dev. Restart `npm run dev`. |
| Local page loads but live-reload is blocked by CSP | A production build left `dist/_headers`. Run `npm run build` (without `CONTEXT`) or delete `dist/`. |
| Build fails on Netlify with an env-file error | Node version too old. `netlify.toml` pins Node 22. Don't override it. |

Logs: **Netlify → Logs → Functions** (each sync logs one line, e.g. `[sync:live] ok · 1 changed · 2 units`). Sync history is also in **Admin → YouTube sync**.

## Security notes

- Secrets live only in environment variables, never in browser code or the repo (`.env` is git-ignored).
- The admin API requires a session cookie (HttpOnly, SameSite=Strict, Secure) **and** a CSRF token on every change. Login is rate-limited and stores only password hashes (scrypt), session-token hashes and HMAC'd IPs.
- All input is validated server-side (zod). All output is escaped, uploads are re-encoded, and SVG is refused.
- Production responses send a strict Content-Security-Policy, HSTS and frame protection (`netlify/production-headers`).
- Analytics counts clicks only: no cookies, IPs or user agents are stored.

## Further docs

- [docs/01-audit-and-architecture.md](docs/01-audit-and-architecture.md): original audit, architecture decisions, database design, quota plan
- [docs/02-api-contract.md](docs/02-api-contract.md): `/api/site` and `/api/videos` payloads
- [docs/03-test-report.md](docs/03-test-report.md): what's tested and how, known limitations
