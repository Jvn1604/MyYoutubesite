/**
 * Response helpers shared by every function.
 * `handle()` wraps a handler so unexpected errors become a clean 500 without leaking internals.
 */

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

/**
 * Public, CDN-cached responses. Browsers must always revalidate (so visitors never see an
 * older version than the CDN has); only Netlify's CDN keeps a copy and serves it stale
 * while refreshing / during an outage.
 */
export function cdnCache(seconds, { swr = seconds * 5, staleIfError = 86400 } = {}) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${swr}, stale-if-error=${staleIfError}`,
  };
}

export function error(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handle(handler, { methods = ["GET"] } = {}) {
  return async (req, context) => {
    if (!methods.includes(req.method)) {
      return error(405, "Method not allowed");
    }
    try {
      return await handler(req, context);
    } catch (err) {
      if (err instanceof HttpError) return error(err.status, err.message);
      console.error(`[${new URL(req.url).pathname}]`, err);
      return error(500, "Internal server error");
    }
  };
}
