/**
 * DoH (DNS over HTTPS) via RFC 8484 wire format; DNS message encoding per RFC 1035.
 */

import type { RecordType } from "./dns.ts";

/** Resolver provider id; used for GET ?provider= and PROVIDERS list. */
export type Provider =
  | "cloudflare"
  | "google"
  | "quad9"
  | "mullvad"
  | "controld";

const DOH_ENDPOINTS: Record<Provider, string> = {
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/dns-query",
  quad9: "https://dns.quad9.net/dns-query",
  mullvad: "https://doh.mullvad.net/dns-query",
  controld: "https://freedns.controld.com/p2",
};

/** Provider list for UI dropdown: id and display label. */
export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "cloudflare", label: "Cloudflare" },
  { id: "google", label: "Google" },
  { id: "quad9", label: "Quad9" },
  { id: "mullvad", label: "Mullvad" },
  { id: "controld", label: "Control D" },
];

const RECORD_TYPE_TO_NUM: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  NAPTR: 35,
  CAA: 257,
  ANAME: 65422,
};

/** RCODE to human-readable string; shared with DoT for error mapping. */
export const RCODE_NAMES: Record<number, string> = {
  0: "No error",
  1: "Format error",
  2: "Server failure",
  3: "NXDOMAIN",
  4: "Not implemented",
  5: "Refused",
};

function getTypeNum(recordType: string): number {
  const n = RECORD_TYPE_TO_NUM[recordType.toUpperCase()];
  return n ?? 1;
}

/** Encode hostname to RFC 1035 QNAME (sequence of length-prefixed labels + null). */
function encodeQName(hostname: string): Uint8Array {
  const labels = hostname.trim().toLowerCase().split(".").filter(Boolean);
  const parts: number[] = [];
  for (const label of labels) {
    if (label.length > 63) throw new Error("Label too long");
    parts.push(label.length, ...Array.from(label).map((c) => c.charCodeAt(0)));
  }
  parts.push(0);
  return new Uint8Array(parts);
}

/** Build a DNS query message: 12-byte header + question (QNAME, QTYPE, QCLASS IN). Shared with DoT. */
export function encodeQuery(
  hostname: string,
  recordType: RecordType,
): Uint8Array {
  const qname = encodeQName(hostname);
  const typeNum = getTypeNum(recordType);
  const headerLen = 12;
  const questionLen = qname.length + 4;
  const buf = new Uint8Array(headerLen + questionLen);
  const view = new DataView(buf.buffer);

  const id = Math.floor(Math.random() * 0x10000);
  view.setUint16(0, id, false);
  view.setUint16(2, 0x0100, false);
  view.setUint16(4, 1, false);
  view.setUint16(6, 0, false);
  view.setUint16(8, 0, false);
  view.setUint16(10, 0, false);

  buf.set(qname, 12);
  view.setUint16(12 + qname.length, typeNum, false);
  view.setUint16(12 + qname.length + 2, 1, false);

  return buf;
}

/** Base64url encode (RFC 4648), no padding, for DoH ?dns= parameter. */
function base64urlEncode(bytes: Uint8Array): string {
  const len = bytes.length;
  let binary = "";
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Read a domain name from the buffer at offset; supports RFC 1035 name compression.
 * @param msgStart - Start of the DNS message (0); pointers are relative to this.
 * @returns Decoded name and the offset after the name.
 */
function readName(
  buf: Uint8Array,
  view: DataView,
  offset: number,
  msgStart: number,
): { name: string; offset: number } {
  const parts: string[] = [];
  let pos = offset;
  const seen = new Set<number>();

  while (pos < buf.length) {
    if (seen.has(pos)) throw new Error("Compression loop");
    seen.add(pos);
    const len = buf[pos++];
    if (len === 0) break;
    if ((len & 0xc0) === 0xc0) {
      const low = buf[pos++];
      const ptr = ((len & 0x3f) << 8) | low;
      if (ptr >= msgStart + 12) {
        const resolved = readName(buf, view, ptr, msgStart);
        parts.push(...resolved.name.split("."));
      }
      break;
    }
    if (len > 63) break;
    let label = "";
    for (let i = 0; i < len && pos < buf.length; i++) {
      label += String.fromCharCode(buf[pos++]);
    }
    parts.push(label);
  }
  return { name: parts.join("."), offset: pos };
}

/**
 * Decode RDATA to a human-readable string by type (A, AAAA, CNAME, MX, SOA, etc.).
 * Unknown types and validation failures fall back to hex.
 */
function decodeRdata(
  buf: Uint8Array,
  view: DataView,
  type: number,
  offset: number,
  rdlength: number,
  msgStart: number,
): string {
  const end = offset + rdlength;
  if (end > buf.length) throw new Error("RDATA overrun");

  switch (type) {
    case 1: {
      if (rdlength < 4) break;
      return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${
        buf[offset + 3]
      }`;
    }
    case 28: {
      if (rdlength < 16) break;
      const segments: string[] = [];
      for (let i = 0; i < 16; i += 2) {
        segments.push(
          (buf[offset + i] << 8 | buf[offset + i + 1]).toString(16),
        );
      }
      return segments.join(":");
    }
    case 5:
    case 2:
    case 12: {
      const { name } = readName(buf, view, offset, msgStart);
      return name;
    }
    case 15: {
      if (rdlength < 2) break;
      const pref = view.getUint16(offset, false);
      const { name } = readName(buf, view, offset + 2, msgStart);
      return `${pref} ${name}`;
    }
    case 16: {
      const parts: string[] = [];
      let p = offset;
      const isPrintable = (b: number) =>
        (b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d;
      while (p < end) {
        const l = buf[p++];
        if (l > 0 && p + l <= end) {
          const chunk = buf.subarray(p, p + l);
          const allPrintable = Array.from(chunk).every(isPrintable);
          parts.push(
            allPrintable ? String.fromCharCode(...chunk) : Array.from(chunk)
              .map((b) => "\\x" + b.toString(16).padStart(2, "0"))
              .join(""),
          );
          p += l;
        }
      }
      return parts.join(" ");
    }
    case 33: {
      if (rdlength < 6) break;
      const priority = view.getUint16(offset, false);
      const weight = view.getUint16(offset + 2, false);
      const port = view.getUint16(offset + 4, false);
      const { name } = readName(buf, view, offset + 6, msgStart);
      return `${priority} ${weight} ${port} ${name}`;
    }
    case 6: {
      const { name: mname, offset: o1 } = readName(buf, view, offset, msgStart);
      const { name: rname, offset: o2 } = readName(buf, view, o1, msgStart);
      if (o2 + 20 <= end) {
        const serial = view.getUint32(o2, false);
        const refresh = view.getUint32(o2 + 4, false);
        const retry = view.getUint32(o2 + 8, false);
        const expire = view.getUint32(o2 + 12, false);
        const minimum = view.getUint32(o2 + 16, false);
        return `${mname} ${rname} ${serial} ${refresh} ${retry} ${expire} ${minimum}`;
      }
      return `${mname} ${rname}`;
    }
    case 257: {
      if (rdlength < 2) break;
      const flags = buf[offset];
      const tagLen = buf[offset + 1];
      const tag = String.fromCharCode(
        ...buf.subarray(offset + 2, offset + 2 + tagLen),
      );
      const value = buf[offset + 2 + tagLen] !== undefined
        ? new TextDecoder().decode(buf.subarray(offset + 2 + tagLen, end))
        : "";
      return `${flags} ${tag} "${value}"`;
    }
    case 41: {
      const chunk = buf.subarray(
        offset,
        Math.min(offset + rdlength, buf.length),
      );
      return Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(
        " ",
      );
    }
    default: {
      const chunk = buf.subarray(
        offset,
        Math.min(offset + rdlength, buf.length),
      );
      return Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
    }
  }
  const chunk = buf.subarray(offset, Math.min(offset + rdlength, buf.length));
  return Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parsed authority or additional section: record strings and TTLs (same order). */
export interface DnsSection {
  records: string[];
  ttls: number[];
}

/**
 * Parse a DNS response buffer into rcode, answer records, and authority/additional. Shared with DoT.
 */
export function decodeResponse(buf: Uint8Array): {
  rcode: number;
  records: string[];
  ttls: number[];
  authority: DnsSection | null;
  additional: DnsSection | null;
} {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 12) throw new Error("Response too short");

  const flags = view.getUint16(2, false);
  const rcode = flags & 0x0f;

  const qdcount = view.getUint16(4, false);
  const ancount = view.getUint16(6, false);
  const nscount = view.getUint16(8, false);
  const arcount = view.getUint16(10, false);

  let pos = 12;

  for (let i = 0; i < qdcount; i++) {
    const { offset } = readName(buf, view, pos, 0);
    pos = offset + 4;
  }

  const parseRR = (
    count: number,
    outRecords: string[],
    outTtls: number[],
  ) => {
    for (let i = 0; i < count && pos < buf.length; i++) {
      const { offset: nameEnd } = readName(buf, view, pos, 0);
      pos = nameEnd;
      if (pos + 10 > buf.length) break;
      const type = view.getUint16(pos, false);
      pos += 2;
      pos += 2;
      const ttl = view.getUint32(pos, false);
      pos += 4;
      const rdlength = view.getUint16(pos, false);
      pos += 2;
      const rdataStr = decodeRdata(buf, view, type, pos, rdlength, 0);
      outRecords.push(rdataStr);
      outTtls.push(ttl);
      pos += rdlength;
    }
  };

  const answerRecords: string[] = [];
  const answerTtls: number[] = [];
  const authRecords: string[] = [];
  const authTtls: number[] = [];
  const addRecords: string[] = [];
  const addTtls: number[] = [];

  parseRR(ancount, answerRecords, answerTtls);
  parseRR(nscount, authRecords, authTtls);
  parseRR(arcount, addRecords, addTtls);

  return {
    rcode,
    records: answerRecords,
    ttls: answerTtls,
    authority: authRecords.length > 0
      ? { records: authRecords, ttls: authTtls }
      : null,
    additional: addRecords.length > 0
      ? { records: addRecords, ttls: addTtls }
      : null,
  };
}

/** Successful DoH lookup: answer records and optional authority/additional (null when empty). */
export interface DohLookupSuccess {
  ok: true;
  records: unknown[];
  ttls?: number[];
  authority: DnsSection | null;
  additional: DnsSection | null;
}

/** Failed DoH lookup: error string; authority/additional present for DNS errors (e.g. NXDOMAIN). */
export interface DohLookupError {
  ok: false;
  error: string;
  authority?: DnsSection | null;
  additional?: DnsSection | null;
}

/** Result of dohLookup: either success with records or error with message. */
export type DohLookupResult = DohLookupSuccess | DohLookupError;

/**
 * Resolve a DNS name via DoH (GET ?dns=base64url(query)).
 * @param hostname - Name to look up (e.g. "example.com").
 * @param recordType - Record type (A, AAAA, MX, etc.).
 * @param provider - DoH resolver; defaults to cloudflare.
 * @returns Promise resolving to success (records + optional authority/additional) or error.
 */
export async function dohLookup(
  hostname: string,
  recordType: RecordType,
  provider: Provider = "cloudflare",
): Promise<DohLookupResult> {
  const endpoint = DOH_ENDPOINTS[provider];
  let queryBytes: Uint8Array;
  try {
    queryBytes = encodeQuery(hostname, recordType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  const dnsParam = base64urlEncode(queryBytes);
  const url = `${endpoint}?dns=${dnsParam}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/dns-message" },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/dns-message")) {
      return { ok: false, error: "Response is not application/dns-message" };
    }
    const body = await res.arrayBuffer();
    const buf = new Uint8Array(body);
    const decoded = decodeResponse(buf);

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
