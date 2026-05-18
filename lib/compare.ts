/**
 * Shared types for the /api/compare endpoint and DigCompare island.
 */

import type { LookupResult, RecordType } from "./dns.ts";
import type { Provider } from "./doh.ts";

/** Result of a single provider's lookup within a comparison run. */
export interface CompareProviderResult {
  provider: Provider;
  label: string;
  durationMs: number;
  result: LookupResult;
}

/** Response from GET /api/compare: all provider results plus agreement flag. */
export interface CompareResponse {
  host: string;
  type: RecordType;
  /** True when all providers returned ok:true with identical (sorted) records. */
  allAgree: boolean;
  results: CompareProviderResult[];
}
