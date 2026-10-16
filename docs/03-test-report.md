# Test report (phase 15)

Date: 2026-10-16 · Commit base: `1acbb2c` + phase 15 changes
Automated: **179 tests in 13 files, all passing** (`npm test`, ~15 s, no network or external services needed).

## How to run

```bash
npm test                 # unit + integration (PGlite in-memory Postgres, fake YouTube API)
npx vitest run tests/sync.test.js   # one file
```

Integration tests use a real Postgres engine (PGlite) and run the production driver
(postgres.js) over the wire in `tests/postgres-adapter.test.js`, so SQL behaves like Supabase.

## Spec checklist (§71) → coverage

| Requirement | Automated | Manual browser check |
|---|---|---|
| Homepage rendering | `site-payload`, `seo`, `resilience` | ✓ desktop + 320–1920 px, all states (`/?mock=live|upcoming|empty|goal`) |
| Navigation | – | ✓ anchors, active section, reordered nav follows CMS |
| Mobile navigation | – | ✓ open/close, Esc returns focus, axe clean with menu open |
| YouTube synchronization | `sync` (14), `youtube-client` (9), `classify` (34) | – (needs a real API key) |
| New video detection | `sync` › "What is Soulslike?" workflow | – |
| Live detection | `sync` › live lifecycle, `classify` | ✓ `/?mock=live` hero, card, schedule |
| Upcoming stream | `sync`, `time` (YouTube schedule overrides regular) | ✓ countdown |
| API failure | `sync` › failures (quota), `youtube-client` (retry, key redaction) | – |
| Cached fallback | `resilience` › last-good payload, 503 without leaks, edge falls back to static tags | – |
| Admin login / logout | `auth` (18) | ✓ wrong/right password, logout invalidates session |
| Protected routes | `auth`, `cms` › access control (401/403 CSRF/405) | ✓ `/admin/` redirects to login |
| Game CRUD | `cms` › games (create, duplicate slug 409, reorder, delete keeps videos) | ✓ create/edit/delete/reorder, cover picker |
| Social CRUD | `cms` › social links | ✓ add, hide/show reflected on homepage |
| Schedule update | `cms` › schedule (atomic replace, duplicates rejected, events) | ✓ rules + special event, timezone conversion |
| Goal update | `cms` › goals (one active), `sync` › goal achieved | ✓ progress, celebration once |
| Appearance settings | `cms` › settings validation, `contrast` (presets pass AA) | ✓ presets, live preview iframe, warnings, publish |
| Video hide/show | `cms` › videos, `sync` › overrides survive sync | ✓ toggles; hidden video disappears from site |
| Video feature | `cms`, `site-payload` › featured priority | ✓ Featured block on homepage |
| Image upload | `cms` › media (WebP/AVIF, SVG/disguised/tiny rejected, in-use delete blocked, missing storage → clear 503), `endpoints` › path traversal | ✓ upload, picker, delete |
| Mobile admin interface | – | ✓ all 14 pages at 375 px, no horizontal overflow, drawer nav |
| 404 handling | `cms`/`resilience` (API 404/405) | ✓ production build returns status 404 with themed page |
| API validation | `cms` (zod: bad URLs, `javascript:`, colours, timezones, slugs), `endpoints` › events | – |
| Responsive layouts | – | ✓ 320/375/430/768/1024/1440/1920 |
| Reduced motion | – | ✓ OS setting + admin "Off" stop infinite animations; counters skip |
| Keyboard navigation | – | ✓ skip link first, focus to `<main>`, dialogs trap focus + Esc |

## Quality checks (§73)

| Check | Result |
|---|---|
| Browser console | Clean on homepage, login, 404 and all admin pages (dev and production build) |
| JavaScript syntax | `node --check` on every server/function/frontend file: no errors |
| Production build | `npm run build` ✓; `netlify serve` production run ✓ (functions, edge function, headers) |
| Accessibility | axe-core: **0 violations** on homepage (default, live, video modal, mobile menu), login (incl. error state), 404, all 14 admin pages, admin dialogs |
| Lighthouse (local production build, uncompressed, mobile throttling) | Performance 85 · Accessibility 100 · Best Practices 100 · SEO 100 (re-measure after deploy; Netlify Brotli shrinks CSS 47 KB → 8.8 KB) |
| Security headers | CSP, HSTS, COOP, X-Frame-Options SAMEORIGIN on every production response; no CSP violations in normal use |
| Animation performance | Every running animation uses only `transform`/`opacity` (checked via `document.getAnimations()`) |

## Bugs found and fixed during testing

- postgres.js double-encoded JSON parameters (settings saved as strings): fixed in the DB adapter + driver-level regression test
- Admin router let a slow page render over the newly opened one; listeners accumulated across visits
- Modal promises depended on the dialog `close` event (delayed in background tabs)
- Table rows rebuilt from `<tr>` strings lost their cells
- `e.currentTarget` read after `await` (null) broke the Games dialog
- Screen-reader labels inside tables widened the page on phones
- Goal "Subscribe" button linked to `#`
- YouTube red failed WCAG contrast; built-in theme presets failed their own contrast check
- Browsers applied the CDN's `stale-while-revalidate`, showing visitors an older version once
- Uploads without storage configured returned a bare 500 (now a clear 503 for the admin; public pages never fail on it)
- `crypto.randomUUID` (secure contexts only) replaced in modals

## Not covered / limitations

- **Real YouTube API**: verified against saved API responses and a fake client only. Run `npm run sync -- all` once `YOUTUBE_API_KEY` is set and check the YouTube sync page.
- **Supabase Storage uploads**: the Supabase code path (`services/storage.js`) is untested until real credentials exist; the local storage path is fully tested.
- **Browsers**: tested in Chromium (desktop + mobile emulation). Firefox/Safari not run here; the code avoids experimental APIs. Minimum versions come from CSS `color-mix()`: Chrome 111, Safari 16.2, Firefox 113.
- **Load**: the local PGlite dev server handles one connection at a time (dev only); production uses Supabase's pooler.
