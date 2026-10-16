-- 001_init: core schema for the DePhantom website + CMS.
-- Ownership rule: YouTube is the source of truth for `videos` and `channel_stats`;
-- the website owns everything else (overrides, games, settings, ...).
-- Sync code must never write to website-owned tables.

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- auth
create table admins (
  id             bigint generated always as identity primary key,
  email          text not null unique check (email = lower(email) and position('@' in email) > 1),
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

create table sessions (
  id            bigint generated always as identity primary key,
  admin_id      bigint not null references admins(id) on delete cascade,
  token_hash    text not null unique,          -- sha-256 of the cookie token; raw token never stored
  csrf_token    text not null,
  user_agent    text not null default '',
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index sessions_expires_idx on sessions (expires_at);

create table login_attempts (
  id            bigint generated always as identity primary key,
  ip_hash       text not null,                 -- salted hash, never the raw IP
  succeeded     boolean not null default false,
  attempted_at  timestamptz not null default now()
);
create index login_attempts_ip_idx on login_attempts (ip_hash, attempted_at desc);

-- ---------------------------------------------------------------- settings
create table site_settings (
  key          text primary key check (key in ('brand', 'hero', 'about', 'support', 'footer', 'links', 'appearance', 'sections', 'seo', 'schedule')),
  value        jsonb not null,
  draft_value  jsonb,                          -- unpublished edits (appearance preview etc.)
  updated_at   timestamptz not null default now()
);
create trigger site_settings_updated before update on site_settings for each row execute function set_updated_at();

-- ---------------------------------------------------------------- media
create table media (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('logo', 'avatar', 'hero', 'game_cover', 'game_banner', 'background', 'other')),
  path        text not null unique,            -- storage object key
  mime        text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml')),
  width       integer check (width > 0),
  height      integer check (height > 0),
  bytes       integer not null check (bytes > 0),
  variants    jsonb not null default '{}',     -- { "webp_800": "path", "avif_800": "path", ... }
  alt         text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- games
create table games (
  id               bigint generated always as identity primary key,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (length(name) between 1 and 120),
  status           text not null default 'completed' check (status in ('playing', 'completed', 'upcoming', 'dropped', 'favourite')),
  genre            text not null default '',
  release_year     integer check (release_year between 1970 and 2100),
  description      text not null default '',
  cover_media_id   bigint references media(id) on delete set null,
  banner_media_id  bigint references media(id) on delete set null,
  playlist_url     text not null default '' check (playlist_url = '' or playlist_url ~* '^https://'),
  title_keywords   text[] not null default '{}', -- auto-assign videos whose title contains one of these
  featured         boolean not null default false,
  hidden           boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index games_order_idx on games (sort_order, id);
create trigger games_updated before update on games for each row execute function set_updated_at();

-- ---------------------------------------------------------------- videos (YouTube-owned)
create table videos (
  youtube_id          text primary key check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title               text not null,
  description         text not null default '',
  published_at        timestamptz not null,
  duration_seconds    integer check (duration_seconds >= 0),
  thumbnails          jsonb not null default '{}',
  kind                text not null check (kind in ('video', 'short', 'stream')),
  live_state          text not null default 'none' check (live_state in ('none', 'upcoming', 'live', 'ended')),
  scheduled_start     timestamptz,
  actual_start        timestamptz,
  actual_end          timestamptz,
  concurrent_viewers  integer check (concurrent_viewers >= 0),
  view_count          bigint check (view_count >= 0),
  like_count          bigint check (like_count >= 0),
  comment_count       bigint check (comment_count >= 0),
  is_available        boolean not null default true, -- false once deleted/private on YouTube
  first_seen_at       timestamptz not null default now(),
  synced_at           timestamptz not null default now()
);
create index videos_published_idx on videos (published_at desc);
create index videos_kind_idx on videos (kind, published_at desc);
create index videos_live_idx on videos (live_state) where live_state in ('live', 'upcoming');

-- Website-owned presentation settings per video. Sync never touches this table.
create table video_overrides (
  youtube_id          text primary key references videos(youtube_id) on delete cascade,
  hidden              boolean not null default false,
  featured            boolean not null default false,
  game_id             bigint references games(id) on delete set null,
  game_locked         boolean not null default false, -- true = admin chose the game; auto-assign must not change it
  kind_override       text check (kind_override in ('video', 'short', 'stream')),
  custom_description  text,
  priority            integer not null default 0,
  updated_at          timestamptz not null default now()
);
create index video_overrides_game_idx on video_overrides (game_id);
create trigger video_overrides_updated before update on video_overrides for each row execute function set_updated_at();

-- ---------------------------------------------------------------- channel (YouTube-owned)
create table channel_stats (
  id                  smallint primary key default 1 check (id = 1), -- single row
  channel_id          text not null,
  title               text not null default '',
  description         text not null default '',
  subscriber_count    bigint,
  subscribers_hidden  boolean not null default false,
  view_count          bigint,
  video_count         integer,
  avatar_url          text not null default '',
  banner_url          text not null default '',
  synced_at           timestamptz not null default now()
);

create table analytics_snapshots (
  day               date primary key,
  subscriber_count  bigint,
  view_count        bigint,
  video_count       integer,
  stream_count      integer
);

create table youtube_sync_logs (
  id             bigint generated always as identity primary key,
  job            text not null check (job in ('live', 'stats', 'library', 'manual')),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean,
  units_used     integer not null default 0,
  items_changed  integer not null default 0,
  error          text
);
create index youtube_sync_logs_job_idx on youtube_sync_logs (job, started_at desc);

-- ---------------------------------------------------------------- schedule
create table schedule_rules (
  id          bigint generated always as identity primary key,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  timezone    text not null default 'Asia/Kuala_Lumpur',
  title       text not null default '',
  enabled     boolean not null default true,
  unique (weekday, start_time)
);

create table schedule_events (
  id           bigint generated always as identity primary key,
  starts_at    timestamptz not null,
  title        text not null check (length(title) between 1 and 120),
  description  text not null default '',
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index schedule_events_start_idx on schedule_events (starts_at);

-- ---------------------------------------------------------------- goals
create table subscriber_goals (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text not null default '',
  start_value  integer not null check (start_value >= 0),
  goal_value   integer not null,
  deadline     date,
  enabled      boolean not null default true,
  celebrate    boolean not null default true,
  achieved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (goal_value > start_value)
);
-- At most one active goal at a time
create unique index subscriber_goals_one_enabled on subscriber_goals ((true)) where enabled;
create trigger subscriber_goals_updated before update on subscriber_goals for each row execute function set_updated_at();

-- ---------------------------------------------------------------- community
create table social_links (
  id           bigint generated always as identity primary key,
  platform     text not null check (platform ~ '^[a-z0-9_-]{1,30}$'),
  label        text not null check (length(label) between 1 and 60),
  description  text not null default '',
  url          text not null check (url ~* '^https://'),
  icon         text not null default 'link',
  accent       text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  enabled      boolean not null default true,
  sort_order   integer not null default 0
);

-- ---------------------------------------------------------------- analytics
create table site_events (
  id          bigint generated always as identity primary key,
  event       text not null check (event ~ '^[a-z0-9_]{1,40}$'),
  target      text check (length(target) <= 80),
  created_at  timestamptz not null default now()
);
create index site_events_created_idx on site_events (created_at);
