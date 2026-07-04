/* TogetherWealth service worker — minimal and safe.
 *
 * - Cache-first for immutable static assets (/icons/, /_next/static/).
 * - Network-first for page navigations, falling back to /offline.
 * - Never touches non-GET requests, cross-origin requests (e.g. Supabase),
 *   or auth routes.
 */

const CACHE_VERSION = "tw-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · TogetherWealth</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#fafaf9;color:#292524;
    display:flex;min-height:100svh;align-items:center;justify-content:center;margin:0;padding:1rem}
  main{text-align:center;max-width:24rem}
  h1{font-size:1.125rem;margin:0 0 .5rem}
  p{font-size:.875rem;color:#78716c;line-height:1.5;margin:0 0 1.25rem}
  a{display:inline-block;background:#0f766e;color:#fff;text-decoration:none;
    padding:.625rem 1.25rem;border-radius:.75rem;font-size:.875rem}
  @media (prefers-color-scheme:dark){body{background:#1c1917;color:#fafaf9}p{color:#a8a29e}}
</style>
</head>
<body><main>
<h1>You're offline</h1>
<p>TogetherWealth needs a connection to load your latest numbers. Everything is saved — it will all be here once you're back online.</p>
<a href="/dashboard">Try again</a>
</main></body>
</html>`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      try {
        const response = await fetch(OFFLINE_URL);
        if (response.ok && !response.redirected) {
          await cache.put(OFFLINE_URL, response);
        }
      } catch {
        // Offline during install — the inline fallback covers us.
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET requests, only our own origin (never Supabase or other APIs).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept auth flows.
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return;

  // Cache-first for immutable static assets.
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Network-first for page navigations, with an offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        if (offline) return offline;
        return new Response(OFFLINE_FALLBACK_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
    );
  }
});
