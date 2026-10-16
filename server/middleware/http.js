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
