import { useSignal, useSignalEffect } from "@preact/signals";
import type { LookupResult } from "../lib/dns.ts";
import DigForm from "./DigForm.tsx";
import DigResults from "./DigResults.tsx";

export interface DigLookupProps {
  initialHost: string;
  initialType: string;
  initialNameserver: string;
  initialCustomNs: string;
}

export default function DigLookup({
  initialHost,
  initialType,
  initialNameserver,
  initialCustomNs,
}: DigLookupProps) {
  const result = useSignal<LookupResult | null>(null);
  const loading = useSignal(false);
  const lastHost = useSignal(initialHost);
  const lastType = useSignal(initialType);
  const didInitialLookup = useSignal(false);

  async function doLookup(params: {
    host: string;
    type: string;
    nameserver: string;
    customNs: string;
  }) {
    loading.value = true;
    result.value = null;
    lastHost.value = params.host;
    lastType.value = params.type;
    try {
      const url = new URL("/api/lookup", globalThis.location.origin);
      url.searchParams.set("host", params.host);
      url.searchParams.set("type", params.type);
      url.searchParams.set("nameserver", params.nameserver);
      if (params.nameserver === "custom" && params.customNs) {
        url.searchParams.set("customNs", params.customNs);
      }
      const res = await fetch(url.toString());
      const data = (await res.json()) as LookupResult;
      result.value = data;
    } catch (err) {
      result.value = {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    } finally {
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
      nameserver: initialNameserver,
      customNs: initialCustomNs,
    });
  });

  return (
    <div class="flex flex-col gap-6">
      <DigForm
        initialHost={initialHost}
        initialType={initialType}
        initialNameserver={initialNameserver}
        initialCustomNs={initialCustomNs}
        onLookup={doLookup}
        loading={loading.value}
      />
      <DigResults
        result={result.value}
        host={lastHost.value}
        type={lastType.value}
      />
    </div>
  );
}
