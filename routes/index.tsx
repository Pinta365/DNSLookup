import { define } from "../utils.ts";
import DigLookup from "../islands/DigLookup.tsx";

export default define.page(function Home(ctx) {
  const url = ctx.url;
  const host = url.searchParams.get("host") ?? "";
  const type = url.searchParams.get("type") ?? "A";
  const provider = url.searchParams.get("provider") ?? "cloudflare";
  const transport = url.searchParams.get("transport") ?? "doh";
  const mode = url.searchParams.get("mode") ?? "single";

  return (
    <div class="min-h-screen bg-linear-to-br from-slate-100 to-slate-200">
      <div class="max-w-3xl mx-auto px-4 py-10">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-slate-800">DNS Lookup</h1>
          <p class="text-slate-600 mt-1">
            Look up DNS records over HTTPS (DoH) or TLS (DoT) with shareable
            URLs and a public API.
          </p>
        </header>
        <DigLookup
          initialHost={host}
          initialType={type}
          initialProvider={provider}
          initialTransport={transport}
          initialMode={mode}
        />
        <footer class="mt-10 pt-6 border-t border-slate-200 text-center">
          <a
            href="/api"
            class="text-sm text-slate-600 hover:text-slate-800 hover:underline"
          >
            API documentation
          </a>
        </footer>
      </div>
    </div>
  );
});
