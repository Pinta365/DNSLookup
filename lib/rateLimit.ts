/**
 * In-memory fixed-window rate limiter. Use a single key per client (e.g. IP).
 * Not distributed: resets on process restart; not shared across instances.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Create a rate limiter with a fixed window.
 * @param limit - Max requests per window per key.
 * @param windowMs - Window length in milliseconds.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const store = new Map<string, Window>();

  function check(key: string): RateLimitResult {
    const now = Date.now();
    let w = store.get(key);

    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      store.set(key, w);
    }

    w.count++;
    const remaining = Math.max(0, limit - w.count);
    const allowed = w.count <= limit;

    return {
      allowed,
      remaining,
      limit,
      resetAt: w.resetAt,
    };
  }

  return { check };
}

/** Default: 60 requests per minute per client. */
export const defaultLimiter = createRateLimiter(4, 60_000);

/**
 * Get a stable key for the client from the request (e.g. for rate limiting).
 * Prefers X-Forwarded-For / X-Real-IP when behind a proxy; otherwise uses a fallback.
 */
export function getClientKey(req: Request, remoteAddr?: unknown): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  if (
    remoteAddr && typeof remoteAddr === "object" && "hostname" in remoteAddr
  ) {
    return String((remoteAddr as { hostname: string }).hostname);
  }
  return "anonymous";
}
