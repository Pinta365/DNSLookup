/**
 * DNS record types and API response shapes. DoH resolution in lib/doh.ts.
 */

const SUPPORTED_TYPES = [
  "A",
  "AAAA",
  "ANAME",
  "CAA",
  "CNAME",
  "MX",
  "NAPTR",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "TXT",
] as const;

/** Supported DNS record types for lookup. */
export type RecordType = (typeof SUPPORTED_TYPES)[number];

/**
 * Returns true if the string is a supported record type.
 * @param type - Case-insensitive record type string (e.g. "A", "AAAA").
 */
export function isSupportedType(type: string): type is RecordType {
  return SUPPORTED_TYPES.includes(type as RecordType);
}

/** Answer, authority, or additional section: records and their TTLs (same order). */
export interface DnsSection {
  records: unknown[];
  ttls: number[];
}

/** Successful lookup: answer records plus optional authority/additional sections. */
export interface LookupSuccess {
  ok: true;
  host: string;
  type: RecordType;
  records: unknown[];
  ttls?: number[];
  authority?: DnsSection | null;
  additional?: DnsSection | null;
}

/** Failed lookup: error message and optional authority/additional (e.g. NXDOMAIN). */
export interface LookupError {
  ok: false;
  host: string;
  type: RecordType;
  error: string;
  code?: string;
  authority?: DnsSection | null;
  additional?: DnsSection | null;
}

/** Result of a DNS lookup (success or error); responses include host and type. */
export type LookupResult = LookupSuccess | LookupError;
