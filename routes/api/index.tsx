import { define } from "../../utils.ts";

export default define.page(function ApiDocs() {
  return (
    <div class="min-h-screen bg-linear-to-br from-slate-100 to-slate-200">
      <div class="max-w-3xl mx-auto px-4 py-10">
        <header class="mb-8">
          <a
            href="/"
            class="text-sm text-slate-600 hover:text-slate-800 mb-4 inline-block"
          >
            ← DNS Lookup
          </a>
          <h1 class="text-3xl font-bold text-slate-800">API</h1>
          <p class="text-slate-600 mt-1">
            JSON API for DNS lookups over DoH (RFC 8484). CORS enabled for all
            origins.
          </p>
        </header>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-700 mb-3">Endpoint</h2>
          <p class="text-slate-600 text-sm mb-2">
            <code class="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-sm">
              GET /api/lookup
            </code>
          </p>
          <p class="text-slate-600 text-sm">
            Returns JSON. All responses include the requested{" "}
            <code class="bg-slate-100 px-1 rounded">host</code> and{" "}
            <code class="bg-slate-100 px-1 rounded">type</code>{" "}
            so the payload is self-contained.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-700 mb-3">
            Query parameters
          </h2>
          <dl class="text-sm text-slate-600 space-y-4">
            <div class="flex flex-col gap-1">
              <dt class="font-medium text-slate-700">
                <code class="bg-slate-100 px-1 rounded">host</code>
                <span class="font-normal text-slate-500 ml-2">required</span>
              </dt>
              <dd>
                Hostname to look up (e.g.{" "}
                <code>example.com</code>). Must be a valid DNS name (labels,
                length, character set).
              </dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="font-medium text-slate-700">
                <code class="bg-slate-100 px-1 rounded">type</code>
                <span class="font-normal text-slate-500 ml-2">
                  optional, default <code>A</code>
                </span>
              </dt>
              <dd>
                Record type. One of: A, AAAA, ANAME, CAA, CNAME, MX, NAPTR, NS,
                PTR, SOA, SRV, TXT.
              </dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="font-medium text-slate-700">
                <code class="bg-slate-100 px-1 rounded">provider</code>
                <span class="font-normal text-slate-500 ml-2">
                  optional, default <code>cloudflare</code>
                </span>
              </dt>
              <dd>
                Resolver: <code>cloudflare</code>, <code>google</code>,{" "}
                <code>quad9</code>, <code>mullvad</code>, or{" "}
                <code>controld</code>. Resolution uses RFC 8484 DoH wire format.
              </dd>
            </div>
          </dl>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-700 mb-3">Response</h2>

          <h3 class="text-sm font-semibold text-slate-600 mt-4 mb-2">
            Success (200)
          </h3>
          <pre class="bg-slate-100 border border-slate-200 rounded p-4 text-xs font-mono text-slate-700 overflow-x-auto mb-4">
{`{
  "ok": true,
  "host": "example.com",
  "type": "A",
  "records": ["93.184.216.34"],
  "ttls": [3600],
  "authority": null,
  "additional": null
}`}
          </pre>
          <p class="text-slate-600 text-sm mb-4">
            <code>records</code> and <code>ttls</code>{" "}
            are parallel arrays (same order). <code>authority</code> and{" "}
            <code>additional</code>{" "}
            are present when the DNS response included those sections; otherwise
            {" "}
            <code>null</code>.
          </p>

          <h3 class="text-sm font-semibold text-slate-600 mt-4 mb-2">
            Error (200 with <code>ok: false</code> or 400)
          </h3>
          <pre class="bg-slate-100 border border-slate-200 rounded p-4 text-xs font-mono text-slate-700 overflow-x-auto mb-2">
{`{ "ok": false, "host": "example.com", "type": "A", "error": "NXDOMAIN", "authority": { "records": ["..."], "ttls": [900] }, "additional": null }`}
          </pre>
          <p class="text-slate-600 text-sm mb-4">
            For DNS errors (e.g. NXDOMAIN), <code>authority</code> and{" "}
            <code>additional</code>{" "}
            may be included when the resolver returned them. For invalid input,
            the API returns 400 with e.g.{" "}
            <code>{'{ "ok": false, "error": "invalid_host" }'}</code>.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-700 mb-3">
            Rate limiting
          </h2>
          <p class="text-slate-600 text-sm mb-2">
            Limits are applied per client (by IP or <code>X-Forwarded-For</code>
            / <code>X-Real-IP</code>{" "}
            when behind a proxy). Default: 60 requests per minute. When
            exceeded, the API returns 429 with{" "}
            <code>{'{ "ok": false, "error": "rate_limit_exceeded" }'}</code>
            {" "}
            and a <code>Retry-After</code> header (seconds).
          </p>
          <p class="text-slate-600 text-sm">
            Successful responses include <code>X-RateLimit-Limit</code>,{" "}
            <code>X-RateLimit-Remaining</code>, and{" "}
            <code>X-RateLimit-Reset</code> (Unix timestamp).
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-xl font-semibold text-slate-700 mb-3">Examples</h2>
          <pre class="bg-slate-900 text-slate-100 rounded p-4 text-xs font-mono overflow-x-auto">
{`# Basic A record
curl "https://your-domain.com/api/lookup?host=example.com&type=A"

# With DoH provider
curl "https://your-domain.com/api/lookup?host=example.com&type=A&provider=google"

# MX records
curl "https://your-domain.com/api/lookup?host=example.com&type=MX"`}
          </pre>
        </section>

        <p class="text-slate-500 text-sm">
          <a href="/" class="hover:text-slate-700">Back to lookup</a>
        </p>
      </div>
    </div>
  );
});
