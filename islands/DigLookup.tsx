import { useSignal, useSignalEffect } from "@preact/signals";
import type { LookupResult } from "../lib/dns.ts";
import type { CompareResponse } from "../lib/compare.ts";
import DigForm from "./DigForm.tsx";
import DigResults from "./DigResults.tsx";
import DigCompare from "./DigCompare.tsx";

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
  const result = useSignal<LookupResult | null>(null);
  const compareResult = useSignal<CompareResponse | null>(null);
  const loading = useSignal(false);
  const lastHost = useSignal(initialHost);
  const lastType = useSignal(initialType);
  const durationMs = useSignal<number | null>(null);
  const didInitialLookup = useSignal(false);
  const mode = useSignal(initialMode === "compare" ? "compare" : "single");

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
    mode.value = params.mode === "compare" ? "compare" : "single";
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
      }
    } catch (err) {
      result.value = {
        ok: false,
        host: params.host,
        type: params.type as import("../lib/dns.ts").RecordType,
        error: err instanceof Error ? err.message : "Network error",
      };
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
        initialHost={initialHost}
        initialType={initialType}
        initialProvider={initialProvider}
        initialTransport={initialTransport}
        initialMode={initialMode}
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
    </div>
  );
}
