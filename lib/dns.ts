/**
 * Wrapper around Deno.resolveDns. Normalizes response for the API.
 * @see https://docs.deno.com/api/deno/~/Deno.resolveDns
 */

export type RecordType =
  | "A"
  | "AAAA"
  | "ANAME"
  | "CAA"
  | "CNAME"
  | "MX"
  | "NAPTR"
  | "NS"
  | "PTR"
  | "SOA"
  | "SRV"
  | "TXT";

const SUPPORTED_TYPES: RecordType[] = [
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
];

export function isSupportedType(type: string): type is RecordType {
  return SUPPORTED_TYPES.includes(type as RecordType);
}

export interface LookupOptions {
  nameServer?: { ipAddr: string; port?: number };
}

export interface LookupSuccess {
  ok: true;
  records: unknown[];
  raw?: unknown;
}

export interface LookupError {
  ok: false;
  error: string;
  code?: string;
}

export type LookupResult = LookupSuccess | LookupError;

export async function resolveDns(
  hostname: string,
  recordType: RecordType,
  options: LookupOptions = {}
): Promise<LookupResult> {
  const nameServer = options.nameServer?.ipAddr
    ? {
        ipAddr: options.nameServer.ipAddr,
        port: options.nameServer.port ?? 53,
      }
    : undefined;

  try {
    const records = await Deno.resolveDns(hostname, recordType, {
      nameServer,
    });
    return {
      ok: true,
      records: Array.isArray(records) ? [...records] : [records],
      raw: records,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
      code: err instanceof Error ? (err as { code?: string }).code : undefined,
    };
  }
}
