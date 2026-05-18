import { define } from "../../utils.ts";
import { isSupportedType, type RecordType } from "../../lib/dns.ts";
import { dohLookup, type Provider, PROVIDERS } from "../../lib/doh.ts";
import { dotLookup, isDotSupported } from "../../lib/dot.ts";
import { defaultLimiter, getClientKey } from "../../lib/rateLimit.ts";
import type {
  CompareProviderResult,
  CompareResponse,
} from "../../lib/compare.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

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

function isValidHostname(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  const labels = trimmed.split(".");
  if (labels.some((l) => !l.length || l.length > 63)) return false;
  const validLabel = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/i;
  return labels.every((l) => validLabel.test(l) || l === "*");
}

const VALID_TRANSPORTS = ["doh", "dot"] as const;
type Transport = (typeof VALID_TRANSPORTS)[number];
const DOT_UNSUPPORTED_ERROR = "DoT not available for this provider";

/**
 * GET /api/compare?host=&type=&transport=
 * Runs parallel lookups across all providers and returns a CompareResponse.
 * DoT is only used for providers that support it; others get an N/A result.
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
    const transportParam = url.searchParams.get("transport") ?? "doh";

    if (!VALID_TRANSPORTS.includes(transportParam as Transport)) {
      return jsonResponse(
        { ok: false, error: "invalid_transport" },
        400,
        rateLimitHeaders,
      );
    }
    const transport = transportParam as Transport;

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
    const recordType = type as RecordType;

    const providerLookups = PROVIDERS.map(
      async ({ id, label }): Promise<CompareProviderResult> => {
        const start = performance.now();

        let result;
        if (transport === "dot") {
          if (!isDotSupported(id as Provider)) {
            result = {
              ok: false as const,
              host: trimmedHost,
              type: recordType,
              error: DOT_UNSUPPORTED_ERROR,
            };
          } else {
            const r = await dotLookup(trimmedHost, recordType, id as Provider);
            result = { ...r, host: trimmedHost, type: recordType };
          }
        } else {
          const r = await dohLookup(trimmedHost, recordType, id as Provider);
          result = { ...r, host: trimmedHost, type: recordType };
        }

        return {
          provider: id as Provider,
          label,
          durationMs: Math.round(performance.now() - start),
          result,
        };
      },
    );

    const settled = await Promise.allSettled(providerLookups);
    const results: CompareProviderResult[] = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      return {
        provider: PROVIDERS[i].id as Provider,
        label: PROVIDERS[i].label,
        durationMs: 0,
        result: {
          ok: false as const,
          host: trimmedHost,
          type: recordType,
          error: s.reason instanceof Error ? s.reason.message : "Unknown error",
        },
      };
    });

    const comparableResults = results.filter((r) =>
      r.result.ok || r.result.error !== DOT_UNSUPPORTED_ERROR
    );
    const successResults = comparableResults.filter((r) => r.result.ok);
    const allAgree = successResults.length > 0 &&
      successResults.length === comparableResults.length &&
      (() => {
        const sorted = successResults.map((r) =>
          [...(r.result as { records: unknown[] }).records].map(String).sort()
        );
        return sorted.every((r) =>
          JSON.stringify(r) === JSON.stringify(sorted[0])
        );
      })();

    const response: CompareResponse = {
      host: trimmedHost,
      type: recordType,
      allAgree,
      results,
    };

    return jsonResponse(response, 200, rateLimitHeaders);
  },
});
