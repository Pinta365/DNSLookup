import { define } from "../utils.ts";
import DigLookup from "../islands/DigLookup.tsx";

export default define.page(function Home(ctx) {
  const url = ctx.url;
  const host = url.searchParams.get("host") ?? "";
  const type = url.searchParams.get("type") ?? "A";
  const nameserver = url.searchParams.get("nameserver") ?? "cloudflare";
  const customNs = url.searchParams.get("customNs") ?? "";

  return (
    <div class="min-h-screen bg-linear-to-br from-slate-100 to-slate-200">
      <div class="max-w-3xl mx-auto px-4 py-10">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-slate-800">DNS Lookup</h1>
          <p class="text-slate-600 mt-1">
            Look up DNS records with shareable URLs and a public API.
          </p>
        </header>
        <DigLookup
          initialHost={host}
          initialType={type}
          initialNameserver={nameserver}
          initialCustomNs={customNs}
        />
        <footer class="mt-10 pt-6 border-t border-slate-200">
          <h2 class="text-lg font-semibold text-slate-700 mb-3">API</h2>
          <p class="text-slate-600 text-sm mb-3">
            <code class="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-xs">
              GET /api/lookup
            </code>{" "}
            returns JSON. CORS is enabled for all origins.
          </p>
          <dl class="text-sm text-slate-600 mb-3 space-y-1">
            <div>
              <dt class="font-medium text-slate-700 inline">host</dt>
              <dd class="inline">
                — required. Hostname to look up (e.g. example.com).
              </dd>
            </div>
            <div>
              <dt class="font-medium text-slate-700 inline">type</dt>
              <dd class="inline">
                — optional, default{" "}
                <code class="bg-slate-100 px-1 rounded">A</code>. Record type:
                A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT, CAA, NAPTR, ANAME.
              </dd>
            </div>
            <div>
              <dt class="font-medium text-slate-700 inline">nameserver</dt>
              <dd class="inline">
                — optional, default{" "}
                <code class="bg-slate-100 px-1 rounded">cloudflare</code>.
                Resolver: cloudflare, google, quad9, opendns, or custom.
              </dd>
            </div>
            <div>
              <dt class="font-medium text-slate-700 inline">customNs</dt>
              <dd class="inline">
                — required when nameserver=custom. IP of the resolver (e.g.
                1.1.1.1). Private/local IPs are rejected.
              </dd>
            </div>
          </dl>
          <p class="text-slate-600 text-sm mb-1">Success:</p>
          <pre class="bg-slate-100 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto mb-3">
{`{ "ok": true, "records": ["93.184.216.34"] }`}
          </pre>
          <p class="text-slate-600 text-sm mb-1">Error:</p>
          <pre class="bg-slate-100 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto mb-3">
{`{ "ok": false, "error": "invalid_host" }`}
          </pre>
          <p class="text-slate-600 text-sm mb-1">Example:</p>
          <pre class="bg-slate-100 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 overflow-x-auto">
{`curl "https://your-domain.com/api/lookup?host=example.com&type=A"`}
          </pre>
        </footer>
      </div>
    </div>
  );
});
