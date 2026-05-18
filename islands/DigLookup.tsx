import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { LookupResult } from "../lib/dns.ts";
import type { CompareResponse } from "../lib/compare.ts";
import DigForm from "./DigForm.tsx";
import DigResults from "./DigResults.tsx";
import DigCompare from "./DigCompare.tsx";
import LookupHistory, { type LookupHistoryItem } from "./LookupHistory.tsx";

const HISTORY_STORAGE_KEY = "dnslookup:history:v1";
const HISTORY_MAX_ITEMS = 30;

function normalizeMode(mode: string): "single" | "compare" {
  return mode === "compare" ? "compare" : "single";
}

function historyIdentity(item: LookupHistoryItem): string {
  return [
    item.host.toLowerCase(),
    item.type,
    item.provider,
    item.transport,
    item.mode,
  ].join("|");
}

function parseHistory(raw: string | null): LookupHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LookupHistoryItem => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return (
          typeof candidate.host === "string" &&
          typeof candidate.type === "string" &&
          typeof candidate.provider === "string" &&
          typeof candidate.transport === "string" &&
          (candidate.mode === "single" || candidate.mode === "compare") &&
          typeof candidate.timestamp === "number"
        );
      })
      .slice(0, HISTORY_MAX_ITEMS);
  } catch {
    return [];
  }
}

function summarizeSingleResult(result: LookupResult): string {
  if (!result.ok) return result.error;
  if (result.records.length === 0) return "No records";
  return String(result.records[0]);
}

function summarizeCompareResult(result: CompareResponse): string {
  const uniqueRecords: string[] = [];
  const seen = new Set<string>();

  for (const item of result.results) {
    if (!item.result.ok) continue;
    for (const record of item.result.records) {
      const value = String(record);
      if (seen.has(value)) continue;
      seen.add(value);
      uniqueRecords.push(value);
    }
  }

  const status = result.allAgree ? "All resolvers agree" : "Resolvers differ";
  if (uniqueRecords.length === 0) return status;

  const preview = uniqueRecords.slice(0, 2).join(", ");
  const more = uniqueRecords.length > 2 ? ` +${uniqueRecords.length - 2} more` : "";
  return `${status}: ${preview}${more}`;
}

/** Props for the main lookup widget: initial URL params (host, type, provider, transport, mode). */
export interface DigLookupProps {
  initialHost: string;
  initialType: string;
  initialProvider: string;
  initialTransport: string;
  initialMode?: string;
}

/** Orchestrates form + results; runs initial lookup from URL and doLookup on submit. */
export default function DigLookup({
  initialHost,
  initialType,
  initialProvider,
  initialTransport,
  initialMode = "single",
}: DigLookupProps) {
  const normalizedInitialMode = normalizeMode(initialMode);
  const result = useSignal<LookupResult | null>(null);
  const compareResult = useSignal<CompareResponse | null>(null);
  const loading = useSignal(false);
  const lastHost = useSignal(initialHost);
  const lastType = useSignal(initialType);
  const durationMs = useSignal<number | null>(null);
  const didInitialLookup = useSignal(false);
  const mode = useSignal<"single" | "compare">(normalizedInitialMode);
  const historyItems = useSignal<LookupHistoryItem[]>([]);
  const historyExpanded = useSignal(false);
  const formSeed = useSignal({
    host: initialHost,
    type: initialType,
    provider: initialProvider,
    transport: initialTransport,
    mode: normalizedInitialMode,
  });
  const formKey = useSignal(0);

  function persistHistory(items: LookupHistoryItem[]) {
    try {
      globalThis.localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(items),
      );
    } catch {
      // Ignore storage write errors (private mode, quota, unavailable API).
    }
  }

  function pushHistory(
    params: {
      host: string;
      type: string;
      provider: string;
      transport: string;
      mode: string;
    },
    summary: string,
  ) {
    const entry: LookupHistoryItem = {
      host: params.host,
      type: params.type,
      provider: params.mode === "compare" ? "compare" : params.provider,
      transport: params.transport,
      mode: normalizeMode(params.mode),
      timestamp: Date.now(),
      summary,
    };
    const identity = historyIdentity(entry);
    const deduped = historyItems.value.filter((item) =>
      historyIdentity(item) !== identity
    );
    const next = [entry, ...deduped].slice(0, HISTORY_MAX_ITEMS);
    historyItems.value = next;
    persistHistory(next);
  }

  function runHistoryItem(item: LookupHistoryItem) {
    formSeed.value = {
      host: item.host,
      type: item.type,
      provider: item.mode === "compare" ? "cloudflare" : item.provider,
      transport: item.transport,
      mode: item.mode,
    };
    formKey.value += 1;
    doLookup({
      host: item.host,
      type: item.type,
      provider: item.mode === "compare" ? "cloudflare" : item.provider,
      transport: item.transport,
      mode: item.mode,
    });
  }

  useEffect(() => {
    try {
      historyItems.value = parseHistory(
        globalThis.localStorage.getItem(HISTORY_STORAGE_KEY),
      );
    } catch {
      historyItems.value = [];
    }
  }, []);

  async function doLookup(params: {
    host: string;
    type: string;
    provider: string;
    transport: string;
    mode: string;
  }) {
    loading.value = true;
    result.value = null;
    compareResult.value = null;
    durationMs.value = null;
    lastHost.value = params.host;
    lastType.value = params.type;
    mode.value = normalizeMode(params.mode);
    const start = performance.now();
    try {
      if (params.mode === "compare") {
        const url = new URL("/api/compare", globalThis.location.origin);
        url.searchParams.set("host", params.host);
        url.searchParams.set("type", params.type);
        if (params.transport !== "doh") {
          url.searchParams.set("transport", params.transport);
        }
        const res = await fetch(url.toString());
        const data = (await res.json()) as CompareResponse;
        compareResult.value = data;
        pushHistory(params, summarizeCompareResult(data));
      } else {
        const url = new URL("/api/lookup", globalThis.location.origin);
        url.searchParams.set("host", params.host);
        url.searchParams.set("type", params.type);
        url.searchParams.set("provider", params.provider);
        if (params.transport !== "doh") {
          url.searchParams.set("transport", params.transport);
        }
        const res = await fetch(url.toString());
        const data = (await res.json()) as LookupResult;
        result.value = data;
        pushHistory(params, summarizeSingleResult(data));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      result.value = {
        ok: false,
        host: params.host,
        type: params.type as import("../lib/dns.ts").RecordType,
        error: message,
      };
      pushHistory(params, message);
    } finally {
      durationMs.value = Math.round(performance.now() - start);
      loading.value = false;
    }
  }

  useSignalEffect(() => {
    if (!initialHost || didInitialLookup.value) return;
    didInitialLookup.value = true;
    lastHost.value = initialHost;
    lastType.value = initialType;
    doLookup({
      host: initialHost,
      type: initialType,
      provider: initialProvider,
      transport: initialTransport,
      mode: initialMode,
    });
  });

  const hasResult = mode.value === "compare"
    ? compareResult.value !== null
    : result.value !== null;

  return (
    <div class="flex flex-col gap-6">
      <DigForm
        key={formKey.value}
        initialHost={formSeed.value.host}
        initialType={formSeed.value.type}
        initialProvider={formSeed.value.provider}
        initialTransport={formSeed.value.transport}
        initialMode={formSeed.value.mode}
        onLookup={doLookup}
        onStartOver={() => {
          result.value = null;
          compareResult.value = null;
          mode.value = "single";
        }}
        loading={loading.value}
      />
      {!hasResult && !loading.value
        ? (
          <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm p-4 text-sm text-slate-600">
            <p class="font-medium text-slate-700 mb-2">How it works</p>
            <ul class="list-disc list-inside space-y-1">
              <li>
                <strong>Hostname</strong>{" "}
                — the domain to look up (e.g. example.com).
              </li>
              <li>
                <strong>Record type</strong> — A, AAAA, MX, NS, TXT, etc.
              </li>
              <li>
                <strong>Transport</strong>{" "}
                — DoH (HTTPS) or DoT (TLS on port 853).
              </li>
              <li>
                <strong>Resolver</strong>{" "}
                — which provider runs the lookup (Cloudflare, Google, Quad9, …).
              </li>
              <li>
                <strong>Compare all resolvers</strong>{" "}
                — query all 5 providers at once to check propagation.
              </li>
            </ul>
          </div>
        )
        : mode.value === "compare"
        ? (
          <DigCompare
            response={compareResult.value}
            loading={loading.value}
          />
        )
        : (
          <DigResults
            result={result.value}
            host={lastHost.value}
            type={lastType.value}
            durationMs={durationMs.value}
          />
        )}
      <LookupHistory
        items={historyItems.value}
        expanded={historyExpanded.value}
        onToggle={() => {
          historyExpanded.value = !historyExpanded.value;
        }}
        onRun={runHistoryItem}
        onClear={() => {
          historyItems.value = [];
          persistHistory([]);
        }}
      />
    </div>
  );
}
