import { define } from "../../utils.ts";
import { isSupportedType, type RecordType } from "../../lib/dns.ts";
import { dohLookup, type DohProvider } from "../../lib/doh.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

/** JSON response with CORS and optional status. */
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
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

const VALID_DOH: DohProvider[] = [
  "cloudflare",
  "google",
  "quad9",
  "mullvad",
  "controld",
];

/**
 * GET /api/lookup?host=&type=&dohProvider=
 * Returns JSON: { ok, host, type, records?, ttls?, authority?, additional? } or { ok: false, error }.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const host = url.searchParams.get("host") ?? "";
    const type = (url.searchParams.get("type") ?? "A").toUpperCase();
    const dohProviderParam = url.searchParams.get("dohProvider") ??
      "cloudflare";
    const dohProvider: DohProvider = VALID_DOH.includes(
        dohProviderParam as DohProvider,
      )
      ? (dohProviderParam as DohProvider)
      : "cloudflare";

    if (!host.trim()) {
      return jsonResponse({ ok: false, error: "Missing or invalid host" }, 400);
    }
    if (!isValidHostname(host.trim())) {
      return jsonResponse({ ok: false, error: "invalid_host" }, 400);
    }
    if (!isSupportedType(type)) {
      return jsonResponse({ ok: false, error: "invalid_type" }, 400);
    }

    const trimmedHost = host.trim();
    const result = await dohLookup(
      trimmedHost,
      type as RecordType,
      dohProvider,
    );
    return jsonResponse({
      ...result,
      host: trimmedHost,
      type: type as RecordType,
    });
  },
});
