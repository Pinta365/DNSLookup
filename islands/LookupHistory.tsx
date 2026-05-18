/** Stored local history item for quick reruns. */
export interface LookupHistoryItem {
  host: string;
  type: string;
  provider: string;
  transport: string;
  mode: "single" | "compare";
  timestamp: number;
  summary?: string;
}

export interface LookupHistoryProps {
  items: LookupHistoryItem[];
  expanded: boolean;
  onToggle: () => void;
  onRun: (item: LookupHistoryItem) => void;
  onClear: () => void;
}

function modeLabel(item: LookupHistoryItem): string {
  if (item.mode === "compare") return "Compare all";
  return item.provider;
}

/** Collapsible recent lookup list backed by localStorage in DigLookup. */
export default function LookupHistory(
  { items, expanded, onToggle, onRun, onClear }: LookupHistoryProps,
) {
  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
      <div class="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          class="text-sm font-medium text-slate-700 hover:text-slate-900"
          aria-expanded={expanded}
        >
          Recent lookups ({items.length}) {expanded ? "-" : "+"}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={items.length === 0}
          class="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {expanded && (
        <div class="p-3">
          {items.length === 0
            ? <p class="text-sm text-slate-500">No recent lookups yet.</p>
            : (
              <div class="max-h-72 overflow-auto space-y-2">
                {items.map((item, index) => (
                  <button
                    key={`${item.host}:${item.type}:${item.mode}:${item.provider}:${item.transport}:${item.timestamp}:${index}`}
                    type="button"
                    onClick={() => onRun(item)}
                    class="w-full text-left rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-mono text-sm text-slate-800 break-all">
                        {item.host}
                      </span>
                      <span class="text-xs text-slate-500 shrink-0">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div class="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{item.type}</span>
                      <span>•</span>
                      <span>{item.transport.toUpperCase()}</span>
                      <span>•</span>
                      <span>{modeLabel(item)}</span>
                      {item.summary && (
                        <>
                          <span>•</span>
                          <span class="text-slate-500">{item.summary}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
