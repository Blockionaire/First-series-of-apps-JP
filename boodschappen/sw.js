/* Huisje OVS — Boodschappen: eenvoudige offline-cache.
   De app-schil wordt bewaard, de gedeelde lijst komt live van Firestore
   (die heeft zijn eigen offline-cache). */
const CACHE = "ovs-boodschappen-v1";
const SCHIL = ["./", "./index.html", "./firebase-config.js", "./manifest.json",
               "./icon.png", "./icon-180.png", "./icon-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SCHIL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if(e.request.method !== "GET") return;
  // alles van Google/Firebase altijd rechtstreeks van het net halen
  if(url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com") ||
     url.hostname.endsWith("firebaseio.com")) return;

  // netwerk eerst, cache als achtervang (zo krijg je updates meteen te zien)
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r && r.status === 200 && url.origin === location.origin){
          const kopie = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, kopie));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
