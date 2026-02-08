import { useSignal } from "@preact/signals";
import type { LookupResult } from "../lib/dns.ts";

/** Props for the results card: last lookup result, host/type label, optional duration. */
export interface DigResultsProps {
  result: LookupResult | null;
  host: string;
  type: string;
  durationMs?: number | null;
}

function formatRecord(record: unknown): string {
  if (record === null || record === undefined) return String(record);
  if (Array.isArray(record)) return record.join(", ");
  if (typeof record === "object") return JSON.stringify(record);
  return String(record);
}

function SectionList({
  records,
  ttls,
}: { records: unknown[]; ttls?: number[] }) {
  return (
    <ul class="space-y-2">
      {records.length === 0
        ? <li class="text-slate-500 text-sm">—</li>
        : records.map((r, i) => (
          <li
            key={i}
            class="font-mono text-sm py-1 px-2 rounded bg-slate-50 border border-slate-100 flex flex-wrap items-baseline justify-between gap-2"
          >
            <span>{formatRecord(r)}</span>
            {ttls?.[i] != null && (
              <span class="text-slate-500 font-normal text-xs">
                TTL {ttls[i]}
              </span>
            )}
          </li>
        ))}
    </ul>
  );
}

function hasAuthorityOrAdditional(result: LookupResult): boolean {
  const auth = result.authority?.records?.length ?? 0;
  const add = result.additional?.records?.length ?? 0;
  return auth > 0 || add > 0;
}

/** Results card: answer list, optional authority/additional, Raw JSON and Copy. */
export default function DigResults({
  result,
  host,
  type,
  durationMs = null,
}: DigResultsProps) {
  const showRaw = useSignal(false);
  const copied = useSignal(false);
  const showAuthorityAdditional = useSignal(false);
  const showExtra = showAuthorityAdditional.value;

  function copyRaw() {
    if (!result) return;
    const payload: Record<string, unknown> = result.ok
      ? {
        ok: true,
        host: result.host,
        type: result.type,
        records: result.records,
        ...(result.ttls && result.ttls.length ? { ttls: result.ttls } : {}),
        ...(result.authority != null ? { authority: result.authority } : {}),
        ...(result.additional != null ? { additional: result.additional } : {}),
      }
      : {
        ok: false,
        host: result.host,
        type: result.type,
        error: result.error,
        ...(result.retry_after != null
          ? { retry_after: result.retry_after }
          : {}),
        ...(result.reset_at != null ? { reset_at: result.reset_at } : {}),
        ...(result.authority != null ? { authority: result.authority } : {}),
        ...(result.additional != null ? { additional: result.additional } : {}),
      };
    const text = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    });
  }

  if (result === null) return null;

  if (!result.ok) {
    const errAuthority = result.authority;
    const errAdditional = result.additional;
    const errHasExtra = hasAuthorityOrAdditional(result);
    const errorPayload = {
      ok: false as const,
      host: result.host,
      type: result.type,
      error: result.error,
      ...(result.retry_after != null
        ? { retry_after: result.retry_after }
        : {}),
      ...(result.reset_at != null ? { reset_at: result.reset_at } : {}),
      ...(result.authority != null ? { authority: result.authority } : {}),
      ...(result.additional != null ? { additional: result.additional } : {}),
    };
    const errorRawJson = JSON.stringify(errorPayload, null, 2);
    return (
      <div class="rounded-lg border border-red-200 bg-red-50/80 overflow-hidden">
        <div class="px-4 py-2 bg-red-100/80 border-b border-red-200 flex flex-wrap justify-between items-center gap-2">
          <span class="text-sm font-medium text-red-800">
            {result.error === "rate_limit_exceeded"
              ? "Rate limit exceeded"
              : result.host
              ? `Lookup failed for ${result.host} (${result.type})`
              : "Lookup failed"}
            {durationMs != null && (
              <span class="ml-2 font-normal text-red-600/80">
                · Failed after {durationMs} ms
              </span>
            )}
          </span>
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => (showRaw.value = !showRaw.value)}
              class="text-sm px-2 py-1 rounded text-red-700 hover:bg-red-200/80"
            >
              {showRaw.value ? "Formatted" : "Raw JSON"}
            </button>
            <button
              type="button"
              onClick={copyRaw}
              class="text-sm px-2 py-1 rounded text-red-700 hover:bg-red-200/80"
            >
              {copied.value ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div class="p-4">
          {showRaw.value
            ? (
              <pre class="text-xs font-mono overflow-x-auto bg-slate-900 text-slate-100 p-4 rounded overflow-y-auto max-h-96">
                {errorRawJson}
              </pre>
            )
            : (
              <>
                <p class="font-medium text-red-800">Lookup failed</p>
                <p class="text-sm mt-1 text-red-700">{result.error}</p>
                {result.error === "rate_limit_exceeded" &&
                  (result.retry_after != null || result.reset_at != null) && (
                  <p class="text-sm mt-2 text-red-600/90">
                    {result.retry_after != null
                      ? `Try again in ${result.retry_after} second${
                        result.retry_after === 1 ? "" : "s"
                      }.`
                      : result.reset_at != null
                      ? `Limit resets at ${
                        new Date(result.reset_at * 1000).toLocaleTimeString()
                      }.`
                      : null}
                  </p>
                )}
                {errHasExtra && (
                  <label class="flex items-center gap-2 cursor-pointer mt-3">
                    <input
                      type="checkbox"
                      checked={showAuthorityAdditional.value}
                      onChange={() => (showAuthorityAdditional.value =
                        !showAuthorityAdditional.value)}
                      class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span class="text-sm text-slate-600">
                      Authority &amp; Additional
                    </span>
                  </label>
                )}
              </>
            )}
        </div>
        {!showRaw.value && showExtra && errHasExtra && (
          <div class="border-t border-red-200 p-4 pt-2">
            <div class="space-y-4">
              <div>
                <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Authority
                </h3>
                <SectionList
                  records={errAuthority?.records ?? []}
                  ttls={errAuthority?.ttls}
                />
              </div>
              <div>
                <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Additional
                </h3>
                <SectionList
                  records={errAdditional?.records ?? []}
                  ttls={errAdditional?.ttls}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { records, ttls, authority, additional } = result;
  const rawPayload: Record<string, unknown> = {
    ok: true,
    host: result.host,
    type: result.type,
    records,
    ...(ttls && ttls.length ? { ttls } : {}),
    ...(authority != null ? { authority } : {}),
    ...(additional != null ? { additional } : {}),
  };
  const rawJson = JSON.stringify(rawPayload, null, 2);
  const hasExtra = showExtra;
  const hasExtraData = hasAuthorityOrAdditional(result);

  return (
    <div class="rounded-lg border border-slate-200 bg-white/80 shadow-sm overflow-hidden">
      <div class="px-4 py-2 bg-slate-100 border-b border-slate-200 flex flex-col gap-2">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="text-sm font-medium text-slate-700">
            Results for {host} ({type})
            {durationMs != null && (
              <span class="ml-2 font-normal text-slate-500">
                · Resolved in {durationMs} ms
              </span>
            )}
          </span>
          <div class="flex flex-wrap items-center gap-3">
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
        {hasExtraData && (
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAuthorityAdditional.value}
              onChange={() => (showAuthorityAdditional.value =
                !showAuthorityAdditional.value)}
              class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span class="text-sm text-slate-600">
              Authority &amp; Additional
            </span>
          </label>
        )}
      </div>
      <div class="p-4">
        {showRaw.value
          ? (
            <pre class="text-xs font-mono overflow-x-auto bg-slate-900 text-slate-100 p-4 rounded overflow-y-auto max-h-96">
            {rawJson}
            </pre>
          )
          : (
            <div class="space-y-4">
              <div>
                {records.length === 0
                  ? <p class="text-slate-500 text-sm">No records found.</p>
                  : <SectionList records={records} ttls={ttls} />}
              </div>
              {hasExtra && (
                <>
                  <div>
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Authority
                    </h3>
                    <SectionList
                      records={authority?.records ?? []}
                      ttls={authority?.ttls}
                    />
                  </div>
                  <div>
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Additional
                    </h3>
                    <SectionList
                      records={additional?.records ?? []}
                      ttls={additional?.ttls}
                    />
                  </div>
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
