/* KontaFlow service worker: safe app shell, offline fallback and update control. */
const VERSION = "kontaflow-v6";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const IMAGE_CACHE = `${VERSION}-images`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
const OFFLINE_PAGES = ["/en/offline", "/fr/offline", "/pcm/offline"];
const CORE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled([...CORE, ...OFFLINE_PAGES].map((url) => precachePage(cache, url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "KONTAFLOW_CLEAR_RUNTIME") {
    event.waitUntil(Promise.all([caches.delete(RUNTIME_CACHE), caches.delete(IMAGE_CACHE)]));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "kontaflow-outbox") event.waitUntil(notifyClientsToSync());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/illustrations/")
  ) {
    event.respondWith(staleWhileRevalidateImage(request));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // A gateway/proxy 502-504 is a network failure for an offline-first app,
    // not a page the user should see.
    if (response.status >= 500 && response.status <= 504) throw new Error("server_unavailable");
    return response;
  } catch {
    const url = new URL(request.url);
    const locale = ["en", "fr", "pcm"].includes(url.pathname.split("/")[1]) ? url.pathname.split("/")[1] : "en";
    const offlinePath = `/${locale}/offline`;

    if (url.pathname === offlinePath) {
      const cached = await caches.match(request);
      if (cached) return cached;
    }

    const cachedOffline = await caches.match(offlinePath);
    if (cachedOffline) {
      return Response.redirect(new URL(offlinePath, self.location.origin).toString(), 302);
    }

    const fallback = await caches.match("/offline.html");
    return fallback || new Response("You are offline.", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidateImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimCache(IMAGE_CACHE, 60);
      }
      return response;
    })
    .catch(() => null);

  return cached || (await network) || new Response("", { status: 504 });
}

async function precachePage(cache, url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put(url, response);

    const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((value) => value.startsWith("/_next/static/") || value.startsWith("/icons/"));
    const cssUrls = assetUrls.filter((value) => value.endsWith(".css"));
    const otherUrls = assetUrls.filter((value) => !value.endsWith(".css"));

    await Promise.allSettled(
      [...new Set(otherUrls)].map(async (asset) => {
        if (await cache.match(asset)) return;
        const assetResponse = await fetch(asset, { cache: "reload" });
        if (assetResponse.ok) await cache.put(asset, assetResponse);
      }),
    );

    for (const css of [...new Set(cssUrls)]) {
      const cssResponse = await fetch(css, { cache: "reload" });
      if (!cssResponse.ok) continue;
      const cssText = await cssResponse.clone().text();
      await cache.put(css, cssResponse);
      const fontUrls = [...cssText.matchAll(/url\(([^)]+)\)/g)]
        .map((match) => match[1].replace(/['"]/g, "").trim())
        .filter((value) => value.startsWith("/_next/static/"));
      await Promise.allSettled(
        [...new Set(fontUrls)].map(async (font) => {
          if (await cache.match(font)) return;
          const fontResponse = await fetch(font, { cache: "reload" });
          if (fontResponse.ok) await cache.put(font, fontResponse);
        }),
      );
    }
  } catch {
    // A failed optional asset must not prevent the offline page from installing.
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "KONTAFLOW_SYNC" });
}
