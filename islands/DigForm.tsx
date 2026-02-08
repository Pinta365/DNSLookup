import { useSignal } from "@preact/signals";
import { type NameserverId, NAMESERVERS } from "../lib/nameservers.ts";

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

export interface DigFormProps {
  initialHost: string;
  initialType: string;
  initialNameserver: string;
  initialCustomNs: string;
  onLookup: (params: {
    host: string;
    type: string;
    nameserver: string;
    customNs: string;
  }) => void;
  loading?: boolean;
}

export default function DigForm({
  initialHost,
  initialType,
  initialNameserver,
  initialCustomNs,
  onLookup,
  loading = false,
}: DigFormProps) {
  const host = useSignal(initialHost);
  const type = useSignal(initialType);
  const nameserver = useSignal(initialNameserver);
  const customNs = useSignal(initialCustomNs);

  function syncUrl() {
    const params = new URLSearchParams();
    if (host.value) params.set("host", host.value);
    if (type.value && type.value !== "A") params.set("type", type.value);
    if (nameserver.value && nameserver.value !== "cloudflare") {
      params.set("nameserver", nameserver.value);
    }
    if (nameserver.value === "custom" && customNs.value) {
      params.set("customNs", customNs.value);
    }
    const qs = params.toString();
    const url = qs
      ? `${globalThis.location.pathname}?${qs}`
      : globalThis.location.pathname;
    globalThis.history.replaceState({}, "", url);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    syncUrl();
    onLookup({
      host: host.value,
      type: type.value,
      nameserver: nameserver.value,
      customNs: customNs.value,
    });
  }

  const inputBase =
    "px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      class="flex flex-col gap-4 p-4 rounded-lg bg-white/80 shadow-sm border border-slate-200"
    >
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
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-sm font-medium text-slate-700">Resolver</span>
            <select
              value={nameserver.value}
              onChange={(e) => {
                nameserver.value = (e.target as HTMLSelectElement)
                  .value as NameserverId;
              }}
              class={`${inputBase} min-w-56`}
            >
              {NAMESERVERS.filter((n) => n.id !== "custom").map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} ({n.ip})
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          {nameserver.value === "custom" && (
            <label class="flex flex-col gap-1 min-w-0">
              <span class="text-sm font-medium text-slate-700">Custom IP</span>
              <input
                type="text"
                value={customNs.value}
                onInput={(
                  e,
                ) => (customNs.value = (e.target as HTMLInputElement).value)}
                placeholder="1.1.1.1"
                class={`${inputBase} font-mono text-sm min-w-56`}
              />
            </label>
          )}
        </div>
        <div class="flex flex-col gap-1">
          <span
            class="text-sm font-medium invisible select-none pointer-events-none"
            aria-hidden="true"
          >
            Resolver
          </span>
          <div class="flex justify-end sm:justify-start lg:justify-end">
            <button
              type="submit"
              disabled={loading}
              class="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Looking up…" : "Look up"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
