/* =====================================================================
   GELDZAKEN — service worker
   =====================================================================
   Twee dingen: de app installeerbaar maken, en hem laten werken zonder
   internet. Je boekhouding staat in IndexedDB op je eigen apparaat, dus
   offline is niet half werkend maar volledig — je kunt boeken, zoeken
   en rekenen zonder verbinding. Zodra je weer online bent gaat alles
   vanzelf naar de cloud.

   Strategie per soort verzoek:
   - de app zelf (HTML, CSS, JS):  eerst het netwerk, dan de cache.
     Zo krijg je altijd de nieuwste versie zodra je online bent, maar
     blijft de app werken als je dat niet bent.
   - Firebase en andere hosts:     nooit uit de cache. Die gaan altijd
     rechtstreeks naar het netwerk, anders zie je oude cijfers of blijft
     een schrijfactie in de cache hangen.
   ===================================================================== */

const CACHE = "geldzaken-v6";

const SCHIL = [
  "./",
  "index.html",
  "manifest.json",
  "firebase-config.js",
  "css/app.css",
  "js/app.js",
  "js/store.js",
  "js/sync.js",
  "js/koppeling.js",
  "js/db.js",
  "js/util.js",
  "js/bereken.js",
  "js/data/standaard.js",
  "js/views/onderdelen.js",
  "js/views/toegang.js",
  "js/views/dashboard.js",
  "js/views/overzicht.js",
  "js/views/verdelen.js",
  "js/views/inkomen.js",
  "js/views/maand.js",
  "js/views/boeken.js",
  "js/views/vast.js",
  "js/views/potjes.js",
  "js/views/doelen.js",
  "js/views/rekeningen.js",
  "js/views/cijfers.js",
  "js/views/instellingen.js",
  "js/views/beheer.js",
  "js/views/importeren.js",
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
        if (antwoord && antwoord.status === 200 && antwoord.type === "basic") {
          const kopie = antwoord.clone();
          caches.open(CACHE).then(cache => cache.put(verzoek, kopie));
        }
        return antwoord;
      })
      .catch(async () => {
        const uitCache = await caches.match(verzoek);
        if (uitCache) return uitCache;

        /* Diep gelinkte schermen bestaan niet als bestand — die horen
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
