/* =====================================================================
   GOALS — service worker
   =====================================================================
   Network first, cache second. Online you always get the newest
   version; offline the app keeps working from the last one it saw.

   Your goals are not in here — they live in IndexedDB. This only
   caches the app itself.
   ===================================================================== */

const CACHE = "goals-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./firebase-config.js",
  "./css/app.css",
  "./js/app.js",
  "./js/store.js",
  "./js/progress.js",
  "./js/db.js",
  "./js/sync.js",
  "./js/util.js",
  "./js/data/seed.js",
  "./js/data/types.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL).catch(e => console.warn("Partial cache:", e)))
      .then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;   // Firebase talks for itself

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match("./index.html"))));
});
