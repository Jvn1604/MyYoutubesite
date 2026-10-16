/**
 * Central access to environment variables.
 * Values are read lazily so a function only fails if it actually needs a missing secret.
 * Nothing in this module may ever be returned to the browser.
 */

const DEFAULTS = {
  YOUTUBE_CHANNEL_ID: "UC6REYc9lkrj8Em4kjCYsG7A",
  SUPABASE_MEDIA_BUCKET: "media",
  SITE_URL: "http://localhost:8888",
};

export class ConfigError extends Error {
  constructor(name) {
    super(`Missing required environment variable: ${name}`);
    this.name = "ConfigError";
    this.variable = name;
  }
}

/** Optional value (falls back to a default, or undefined). */
export function env(name) {
  const value = process.env[name]?.trim();
  return value || DEFAULTS[name];
}

/** Required value. Throws ConfigError when missing. */
export function requireEnv(name) {
  const value = env(name);
  if (!value) throw new ConfigError(name);
  return value;
}

/** Which integrations are configured (booleans only, safe for the admin health view). */
export function configStatus() {
  return {
    youtube: Boolean(env("YOUTUBE_API_KEY")),
    database: Boolean(env("DATABASE_URL")),
    storage: Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")),
    session: (env("SESSION_SECRET")?.length ?? 0) >= 32,
  };
}

export function runtimeEnv() {
  return process.env.CONTEXT || (process.env.NETLIFY_DEV ? "dev" : process.env.NODE_ENV || "development");
}
