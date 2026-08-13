/* =====================================================================
   WIJNKELDER — service worker
   =====================================================================
   Twee dingen: de app installeerbaar maken, en hem laten werken zonder
   internet. Je kelder staat in IndexedDB op je telefoon, dus offline is
   niet half werkend maar volledig — je kunt flessen toevoegen, drinken
   en doorzoeken zonder verbinding.

   Strategie per soort verzoek:
   - de app zelf (HTML, CSS, JS):  eerst het netwerk, dan de cache.
     Zo krijg je altijd de nieuwste versie zodra je online bent, maar
     blijft de app werken als je dat niet bent.
   - Firebase en andere hosts:     nooit uit de cache. Die gaan altijd
     rechtstreeks naar het netwerk, anders krijg je oude gegevens te
     zien of blijft een schrijfactie in de cache hangen.
   ===================================================================== */

const CACHE = "wijnkelder-v1";

const SCHIL = [
  "./",
  "index.html",
  "manifest.json",
  "firebase-config.js",
  "css/app.css",
  "js/app.js",
  "js/store.js",
  "js/sync.js",
  "js/db.js",
  "js/util.js",
  "js/data/catalog.js",
  "js/data/aging.js",
  "js/data/pairings.js",
  "js/views/onderdelen.js",
  "js/views/start.js",
  "js/views/kelder.js",
  "js/views/kelder3d.js",
  "js/views/toevoegen.js",
  "js/views/fiche.js",
  "js/views/combineer.js",
  "js/views/cijfers.js",
  "js/views/historie.js",
  "js/views/wenslijst.js",
  "js/views/profiel.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      /* Eén ontbrekend bestand mag de hele installatie niet laten
         mislukken — daarom stuk voor stuk in plaats van addAll. */
      .then(cache => Promise.all(
        SCHIL.map(pad => cache.add(pad).catch(() => { /* komt later wel */ }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const verzoek = event.request;
  if (verzoek.method !== "GET") return;

  const url = new URL(verzoek.url);

  /* Alles wat niet van deze site komt (Firebase, de Firebase-SDK)
     laten we met rust. */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(verzoek)
      .then(antwoord => {
        /* Alleen geldige antwoorden bewaren. */
        if (antwoord && antwoord.status === 200 && antwoord.type === "basic") {
          const kopie = antwoord.clone();
          caches.open(CACHE).then(cache => cache.put(verzoek, kopie));
        }
        return antwoord;
      })
      .catch(async () => {
        const uitCache = await caches.match(verzoek);
        if (uitCache) return uitCache;

        /* Diep gelinkte pagina's bestaan niet als bestand — die horen
           allemaal bij index.html. */
        if (verzoek.mode === "navigate") {
          const schil = await caches.match("index.html") || await caches.match("./");
          if (schil) return schil;
        }
        return new Response("Offline en niet in de cache.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
