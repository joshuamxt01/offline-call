// Minimal service worker for the Nexa PWA — offline app-shell caching.
// Realtime data (chats/calls) always requires the network; this only makes the
// shell installable and instantly available.
const CACHE = "nexa-shell-v1";
const SHELL = ["/", "/chats", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never cache API or socket traffic.
  if (request.method !== "GET" || request.url.includes("/api/") || request.url.includes("/rt")) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match("/"))),
  );
});
