import { useSignal } from "@preact/signals";
import { PROVIDERS } from "../lib/doh.ts";
import { isDotSupported } from "../lib/dot.ts";
import type { Provider } from "../lib/doh.ts";

const RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "TXT",
  "CAA",
  "NAPTR",
  "ANAME",
] as const;

const RECORD_TYPE_HINT: Record<string, string> = {
  A: "IPv4 address",
  AAAA: "IPv6 address",
  ANAME: "Alias (ANAME record)",
  CAA: "Certificate authority authorization",
  CNAME: "Canonical name (alias to another name)",
  MX: "Mail exchange (mail server)",
  NAPTR: "Naming authority pointer",
  NS: "Name server (delegation)",
  PTR: "Pointer (reverse DNS)",
  SOA: "Start of authority (zone info)",
  SRV: "Service record",
  TXT: "Text record",
};

const TRANSPORTS = [
  { id: "doh", label: "DoH" },
  { id: "dot", label: "DoT" },
] as const;

/** Props for the lookup form (host, type, provider, transport, mode, submit callback). */
export interface DigFormProps {
  initialHost: string;
  initialType: string;
  initialProvider: string;
  initialTransport: string;
  initialMode?: string;
  onLookup: (params: {
    host: string;
    type: string;
    provider: string;
    transport: string;
    mode: string;
  }) => void;
  onStartOver?: () => void;
  loading?: boolean;
}

/** Form: hostname, record type, provider, transport, mode toggle; submits to onLookup and syncs URL. */
export default function DigForm({
  initialHost,
  initialType,
  initialProvider,
  initialTransport,
  initialMode = "single",
  onLookup,
  onStartOver,
  loading = false,
}: DigFormProps) {
  const host = useSignal(initialHost);
  const type = useSignal(initialType);
  const provider = useSignal(initialProvider);
  const transport = useSignal(
    initialTransport === "dot" ? "dot" : "doh",
  );
  const mode = useSignal(initialMode === "compare" ? "compare" : "single");

  function syncUrl() {
    const params = new URLSearchParams();
    if (host.value) params.set("host", host.value);
    if (type.value && type.value !== "A") params.set("type", type.value);
    if (mode.value === "compare") {
      params.set("mode", "compare");
    } else {
      if (provider.value !== "cloudflare") {
        params.set("provider", provider.value);
      }
    }
    if (transport.value !== "doh") {
      params.set("transport", transport.value);
    }
    const qs = params.toString();
    const url = qs
      ? `${globalThis.location.pathname}?${qs}`
      : globalThis.location.pathname;
    globalThis.history.replaceState({}, "", url);
  }

  const dotUnavailable = transport.value === "dot" &&
    mode.value === "single" &&
    !isDotSupported(provider.value as Provider);

  function handleStartOver(e: Event) {
    e.preventDefault();
    host.value = "";
    type.value = "A";
    provider.value = "cloudflare";
    transport.value = "doh";
    mode.value = "single";
    globalThis.history.replaceState({}, "", globalThis.location.pathname);
    onStartOver?.();
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    syncUrl();
    onLookup({
      host: host.value,
      type: type.value,
      provider: provider.value,
      transport: transport.value,
      mode: mode.value,
    });
  }

  const inputBase =
    "px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      class="flex flex-col gap-4 p-4 rounded-lg bg-white/80 shadow-sm border border-slate-200"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-slate-600 mr-1">Mode:</span>
        <button
          type="button"
          onClick={() => { mode.value = "single"; syncUrl(); }}
          class={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
            mode.value === "single"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Single resolver
        </button>
        <button
          type="button"
          onClick={() => { mode.value = "compare"; syncUrl(); }}
          class={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
            mode.value === "compare"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Compare all resolvers
        </button>
      </div>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-slate-700">Hostname</span>
        <input
          type="text"
          value={host.value}
          onInput={(e) => (host.value = (e.target as HTMLInputElement).value)}
          placeholder="example.com"
          class={`${inputBase} w-full min-w-0 font-mono text-sm`}
          required
        />
      </label>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-slate-700">Record type</span>
          <select
            value={type.value}
            onChange={(
              e,
            ) => (type.value = (e.target as HTMLSelectElement).value)}
            class={inputBase}
            title={RECORD_TYPE_HINT[type.value] ?? ""}
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {RECORD_TYPE_HINT[type.value] && (
            <span
              class="text-xs text-slate-500"
              title={RECORD_TYPE_HINT[type.value]}
            >
              {RECORD_TYPE_HINT[type.value]}
            </span>
          )}
        </label>
        <label class="flex flex-col gap-1 min-w-0">
          <span class="text-sm font-medium text-slate-700">
            Transport
          </span>
          <select
            value={transport.value}
            onChange={(
              e,
            ) => (transport.value = (e.target as HTMLSelectElement).value)}
            class={inputBase}
          >
            {TRANSPORTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {mode.value === "compare" && transport.value === "dot" && (
            <span class="text-xs text-amber-600">
              DoT not available for Mullvad &amp; Control D
            </span>
          )}
        </label>
        {mode.value === "single" && (
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-sm font-medium text-slate-700">
              Resolver
            </span>
            <select
              value={provider.value}
              onChange={(
                e,
              ) => (provider.value = (e.target as HTMLSelectElement).value)}
              class={`${inputBase} min-w-56`}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {dotUnavailable && (
              <span class="text-xs text-amber-600">
                DoT not available for this provider
              </span>
            )}
          </label>
        )}
        <div class="flex flex-col gap-1">
          <span
            class="text-sm font-medium invisible select-none pointer-events-none"
            aria-hidden="true"
          >
            Resolver
          </span>
          <div class="flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={handleStartOver}
              class="px-4 py-2 rounded-md border border-emerald-300 text-emerald-700 font-medium bg-emerald-50/80 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              Start over
            </button>
            <button
              type="submit"
              disabled={loading || dotUnavailable}
              class="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Looking up…" : mode.value === "compare" ? "Compare" : "Look up"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
