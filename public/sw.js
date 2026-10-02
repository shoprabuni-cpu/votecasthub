const CACHE = "vch-static-v1";
const STATIC_ASSETS = ["/offline.html", "/icons/votecasthub.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("vch-static-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html").then(page => page || Response.error())));
  }
});
