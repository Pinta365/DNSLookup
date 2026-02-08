import { useSignal, useSignalEffect } from "@preact/signals";
import type { LookupResult } from "../lib/dns.ts";
import DigForm from "./DigForm.tsx";
import DigResults from "./DigResults.tsx";

/** Props for the main lookup widget: initial URL params (host, type, dohProvider). */
export interface DigLookupProps {
  initialHost: string;
  initialType: string;
  initialDohProvider: string;
}

/** Orchestrates form + results; runs initial lookup from URL and doLookup on submit. */
export default function DigLookup({
  initialHost,
  initialType,
  initialDohProvider,
}: DigLookupProps) {
  const result = useSignal<LookupResult | null>(null);
  const loading = useSignal(false);
  const lastHost = useSignal(initialHost);
  const lastType = useSignal(initialType);
  const durationMs = useSignal<number | null>(null);
  const didInitialLookup = useSignal(false);

  async function doLookup(params: {
    host: string;
    type: string;
    dohProvider: string;
  }) {
    loading.value = true;
    result.value = null;
    durationMs.value = null;
    lastHost.value = params.host;
    lastType.value = params.type;
    const start = performance.now();
    try {
      const url = new URL("/api/lookup", globalThis.location.origin);
      url.searchParams.set("host", params.host);
      url.searchParams.set("type", params.type);
      url.searchParams.set("dohProvider", params.dohProvider);
      const res = await fetch(url.toString());
      const data = (await res.json()) as LookupResult;
      result.value = data;
    } catch (err) {
      result.value = {
        ok: false,
        host: params.host,
        type: params.type,
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
      dohProvider: initialDohProvider,
    });
  });

  return (
    <div class="flex flex-col gap-6">
      <DigForm
        initialHost={initialHost}
        initialType={initialType}
        initialDohProvider={initialDohProvider}
        onLookup={doLookup}
        loading={loading.value}
      />
      <DigResults
        result={result.value}
        host={lastHost.value}
        type={lastType.value}
        durationMs={durationMs.value}
      />
    </div>
  );
}
