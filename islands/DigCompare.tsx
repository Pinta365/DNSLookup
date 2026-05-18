import { useSignal } from "@preact/signals";
import type { CompareResponse, CompareProviderResult } from "../lib/compare.ts";

/** Props for the comparison results card. */
export interface DigCompareProps {
  response: CompareResponse | null;
  loading?: boolean;
}

function formatRecord(record: unknown): string {
  if (record === null || record === undefined) return String(record);
  if (Array.isArray(record)) return record.join(", ");
  if (typeof record === "object") return JSON.stringify(record);
  return String(record);
}

function ProviderCard({ item }: { item: CompareProviderResult }) {
  const { label, durationMs, result } = item;

  if (!result.ok) {
    const isUnsupported = result.error === "DoT not available for this provider";
    return (
      <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden flex flex-col">
        <div class="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
          <span class="font-medium text-sm text-slate-700">{label}</span>
          <span class={`text-xs px-1.5 py-0.5 rounded font-medium ${isUnsupported ? "bg-slate-200 text-slate-500" : "bg-red-100 text-red-700"}`}>
            {isUnsupported ? "N/A" : "Error"}
          </span>
        </div>
        <div class="p-3 flex-1">
          <p class="text-xs text-slate-500 font-mono">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden flex flex-col">
      <div class="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
        <span class="font-medium text-sm text-slate-700">{label}</span>
        <span class="text-xs text-slate-500">{durationMs} ms</span>
      </div>
      <div class="p-3 flex-1">
        {result.records.length === 0
          ? <p class="text-xs text-slate-400">No records</p>
          : (
            <ul class="space-y-1.5">
              {result.records.map((r, i) => (
                <li
                  key={i}
                  class="font-mono text-xs py-1 px-2 rounded bg-slate-50 border border-slate-100 flex flex-wrap items-baseline justify-between gap-1"
                >
                  <span class="break-all">{formatRecord(r)}</span>
                  {result.ttls?.[i] != null && (
                    <span class="text-slate-400 shrink-0">TTL {result.ttls![i]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden animate-pulse">
      <div class="px-3 py-2 bg-slate-100 border-b border-slate-200 h-9" />
      <div class="p-3 space-y-2">
        <div class="h-3 bg-slate-200 rounded w-3/4" />
        <div class="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  );
}

/** Comparison results: provider grid with agree/differ banner, Copy JSON. */
export default function DigCompare({ response, loading = false }: DigCompareProps) {
  const copied = useSignal(false);

  function copyJson() {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response, null, 2)).then(() => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    });
  }

  if (loading) {
    return (
      <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
        <div class="px-4 py-3 bg-slate-100 border-b border-slate-200 h-11 animate-pulse" />
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!response) return null;

  const { host, type, allAgree, results } = response;

  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
      <div class="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-sm font-medium text-slate-700">
            Compare for {host} ({type})
          </span>
          <span
            class={`text-xs font-semibold px-2 py-1 rounded-full ${
              allAgree
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {allAgree ? "✓ All resolvers agree" : "⚠ Resolvers differ"}
          </span>
        </div>
        <button
          type="button"
          onClick={copyJson}
          class="text-sm px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
        >
          {copied.value ? "Copied!" : "Copy JSON"}
        </button>
      </div>
      <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((item) => <ProviderCard key={item.provider} item={item} />)}
      </div>
    </div>
  );
}
