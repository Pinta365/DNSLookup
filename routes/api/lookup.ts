import { define } from "../../utils.ts";
import { resolveDns, isSupportedType, type RecordType } from "../../lib/dns.ts";
import { getNameserverIp } from "../../lib/nameservers.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

/** Reject private/local IPs when used as custom nameserver (SSRF). */
function isPrivateOrLocalIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return true;
  // IPv4 private ranges
  if (/^10\./.test(trimmed)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(trimmed)) return true;
  if (/^192\.168\./.test(trimmed)) return true;
  if (/^127\./.test(trimmed)) return true;
  if (trimmed === "0.0.0.0") return true;
  // IPv6 loopback
  if (/^::1$/.test(trimmed)) return true;
  if (/^fe80:/i.test(trimmed)) return true;
  return false;
}

function isValidHostname(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  const labels = trimmed.split(".");
  if (labels.some((l) => !l.length || l.length > 63)) return false;
  // Allow letters, digits, hyphens, underscores (e.g. _acme-challenge, _dmarc)
  const validLabel = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/i;
  return labels.every((l) => validLabel.test(l) || l === "*");
}

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const host = url.searchParams.get("host") ?? "";
    const type = (url.searchParams.get("type") ?? "A").toUpperCase();
    const nameserverId = url.searchParams.get("nameserver") ?? "cloudflare";
    const customNs = url.searchParams.get("customNs") ?? "";

    if (!host.trim()) {
      return jsonResponse({ ok: false, error: "Missing or invalid host" }, 400);
    }
    if (!isValidHostname(host.trim())) {
      return jsonResponse({ ok: false, error: "invalid_host" }, 400);
    }
    if (!isSupportedType(type)) {
      return jsonResponse({ ok: false, error: "invalid_type" }, 400);
    }

    const ip = getNameserverIp(
      nameserverId as "cloudflare" | "google" | "quad9" | "opendns" | "custom",
      customNs
    );
    if (nameserverId === "custom") {
      if (!ip) {
        return jsonResponse(
          { ok: false, error: "Custom nameserver IP required" },
          400
        );
      }
      if (isPrivateOrLocalIp(ip)) {
        return jsonResponse(
          { ok: false, error: "Custom nameserver cannot be a private/local IP" },
          400
        );
      }
    }

    const result = await resolveDns(host.trim(), type as RecordType, {
      nameServer: ip ? { ipAddr: ip, port: 53 } : undefined,
    });

    return jsonResponse(result);
  },
});
