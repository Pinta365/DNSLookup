import { define } from "../../utils.ts";
import { isSupportedType, type RecordType } from "../../lib/dns.ts";
import { dohLookup, type Provider } from "../../lib/doh.ts";
import { defaultLimiter, getClientKey } from "../../lib/rateLimit.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

/** JSON response with CORS, optional status and extra headers. */
function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

/** True if host is a valid DNS hostname (labels, length, character set). */
function isValidHostname(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  const labels = trimmed.split(".");
  if (labels.some((l) => !l.length || l.length > 63)) return false;
  const validLabel = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/i;
  return labels.every((l) => validLabel.test(l) || l === "*");
}

const VALID_PROVIDERS: Provider[] = [
  "cloudflare",
  "google",
  "quad9",
  "mullvad",
  "controld",
];

/**
 * GET /api/lookup?host=&type=&provider=
 * Returns JSON: { ok, host, type, records?, ttls?, authority?, additional? } or { ok: false, error }.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const key = getClientKey(
      ctx.req,
      (ctx as { remoteAddr?: unknown }).remoteAddr,
    );
    const rate = defaultLimiter.check(key);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(rate.limit),
      "X-RateLimit-Remaining": String(rate.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
    };
    if (!rate.allowed) {
      const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000);
      const resetAt = Math.ceil(rate.resetAt / 1000);
      return jsonResponse(
        {
          ok: false,
          host: "",
          type: "A",
          error: "rate_limit_exceeded",
          retry_after: retryAfter,
          reset_at: resetAt,
        },
        429,
        { ...rateLimitHeaders, "Retry-After": String(retryAfter) },
      );
    }

    const url = new URL(ctx.req.url);
    const host = url.searchParams.get("host") ?? "";
    const type = (url.searchParams.get("type") ?? "A").toUpperCase();
    const providerParam = url.searchParams.get("provider") ?? "cloudflare";
    const provider: Provider = VALID_PROVIDERS.includes(
        providerParam as Provider,
      )
      ? (providerParam as Provider)
      : "cloudflare";

    if (!host.trim()) {
      return jsonResponse(
        { ok: false, error: "Missing or invalid host" },
        400,
        rateLimitHeaders,
      );
    }
    if (!isValidHostname(host.trim())) {
      return jsonResponse(
        { ok: false, error: "invalid_host" },
        400,
        rateLimitHeaders,
      );
    }
    if (!isSupportedType(type)) {
      return jsonResponse(
        { ok: false, error: "invalid_type" },
        400,
        rateLimitHeaders,
      );
    }

    const trimmedHost = host.trim();
    const result = await dohLookup(
      trimmedHost,
      type as RecordType,
      provider,
    );
    return jsonResponse(
      {
        ...result,
        host: trimmedHost,
        type: type as RecordType,
      },
      200,
      rateLimitHeaders,
    );
  },
});
