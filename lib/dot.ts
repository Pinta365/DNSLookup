/**
 * DNS over TLS (DoT) via RFC 7858. Port 853, TCP length framing per RFC 1035.
 */

import type { RecordType } from "./dns.ts";
import {
  decodeResponse,
  type DohLookupResult,
  encodeQuery,
  type Provider,
  RCODE_NAMES,
} from "./doh.ts";

const DOT_PORT = 853;

/** DoT hostnames per provider; only providers with an entry support DoT. */
export const DOT_HOSTS: Partial<Record<Provider, string>> = {
  cloudflare: "one.one.one.one",
  google: "dns.google",
  quad9: "dns.quad9.net",
};

/** Providers that support DoT (subset of Provider). */
export const DOT_PROVIDERS = Object.keys(DOT_HOSTS) as Provider[];

export function isDotSupported(provider: Provider): boolean {
  return provider in DOT_HOSTS;
}

/** Read exactly n bytes from the connection. */
async function readExact(
  conn: Deno.Conn,
  n: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const buf = new Uint8Array(n);
  let got = 0;
  const deadline = Date.now() + timeoutMs;
  while (got < n) {
    if (Date.now() >= deadline) throw new Error("DoT read timeout");
    const chunk = buf.subarray(got);
    const r = await conn.read(chunk);
    if (r === null) throw new Error("DoT connection closed");
    got += r;
  }
  return buf;
}

/** Write bytes to the connection. */
async function writeAll(
  conn: Deno.Conn,
  data: Uint8Array,
  timeoutMs: number,
): Promise<void> {
  let written = 0;
  const deadline = Date.now() + timeoutMs;
  while (written < data.length) {
    if (Date.now() >= deadline) throw new Error("DoT write timeout");
    const n = await conn.write(data.subarray(written));
    written += n;
  }
}

/**
 * Resolve a DNS name via DoT (TLS on port 853, RFC 1035 TCP framing).
 * Only works for providers in DOT_HOSTS.
 */
export async function dotLookup(
  hostname: string,
  recordType: RecordType,
  provider: Provider,
): Promise<DohLookupResult> {
  const host = DOT_HOSTS[provider];
  if (!host) {
    return { ok: false, error: "DoT not available for this provider" };
  }

  let queryBytes: Uint8Array;
  try {
    queryBytes = encodeQuery(hostname, recordType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  const timeoutMs = 10_000;

  try {
    const conn = await Deno.connectTls({
      hostname: host,
      port: DOT_PORT,
    });
    try {
      const lenBuf = new Uint8Array(2);
      new DataView(lenBuf.buffer).setUint16(0, queryBytes.length, false);
      await writeAll(
        conn,
        new Uint8Array([...lenBuf, ...queryBytes]),
        timeoutMs,
      );

      const respLenBuf = await readExact(conn, 2, timeoutMs);
      const respLen = new DataView(respLenBuf.buffer).getUint16(0, false);
      if (respLen < 12 || respLen > 65535) {
        throw new Error("Invalid DoT response length");
      }
      const respBuf = await readExact(conn, respLen, timeoutMs);
      const decoded = decodeResponse(respBuf);

      if (decoded.rcode !== 0) {
        const errorMsg = RCODE_NAMES[decoded.rcode] ?? `RCODE ${decoded.rcode}`;
        return {
          ok: false,
          error: errorMsg,
          authority: decoded.authority,
          additional: decoded.additional,
        };
      }

      return {
        ok: true,
        records: decoded.records,
        ttls: decoded.ttls,
        authority: decoded.authority,
        additional: decoded.additional,
      };
    } finally {
      conn.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
