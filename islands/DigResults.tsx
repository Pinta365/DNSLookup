import { useSignal } from "@preact/signals";
import type { LookupResult } from "../lib/dns.ts";

export interface DigResultsProps {
  result: LookupResult | null;
  host: string;
  type: string;
}

function formatRecord(record: unknown): string {
  if (record === null || record === undefined) return String(record);
  if (Array.isArray(record)) return record.join(", ");
  if (typeof record === "object") return JSON.stringify(record);
  return String(record);
}

export default function DigResults({
  result,
  host,
  type,
}: DigResultsProps) {
  const showRaw = useSignal(false);
  const copied = useSignal(false);

  function copyRaw() {
    if (!result || !result.ok) return;
    const text = JSON.stringify(
      result.raw ?? result.records,
      null,
      2
    );
    navigator.clipboard.writeText(text).then(() => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    });
  }

  if (result === null) return null;

  if (!result.ok) {
    return (
      <div class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
        <p class="font-medium">Lookup failed</p>
        <p class="text-sm mt-1">{result.error}</p>
      </div>
    );
  }

  const { records } = result;
  const rawJson = JSON.stringify(result.raw ?? records, null, 2);

  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
      <div class="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
        <span class="text-sm font-medium text-slate-700">
          Results for {host} ({type})
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={() => (showRaw.value = !showRaw.value)}
            class="text-sm px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
          >
            {showRaw.value ? "Formatted" : "Raw JSON"}
          </button>
          <button
            type="button"
            onClick={copyRaw}
            class="text-sm px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
          >
            {copied.value ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <div class="p-4">
        {showRaw.value ? (
          <pre class="text-xs font-mono overflow-x-auto bg-slate-900 text-slate-100 p-4 rounded overflow-y-auto max-h-96">
            {rawJson}
          </pre>
        ) : (
          <ul class="space-y-2">
            {records.length === 0 ? (
              <li class="text-slate-500 text-sm">No records found.</li>
            ) : (
              records.map((r, i) => (
                <li
                  key={i}
                  class="font-mono text-sm py-1 px-2 rounded bg-slate-50 border border-slate-100"
                >
                  {formatRecord(r)}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
