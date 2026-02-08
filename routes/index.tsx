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
        <footer class="mt-10 text-sm text-slate-500">
          <p>
            API: <code class="bg-slate-200 px-1 rounded">GET /api/lookup?host=example.com&amp;type=A</code>
          </p>
        </footer>
      </div>
    </div>
  );
});
