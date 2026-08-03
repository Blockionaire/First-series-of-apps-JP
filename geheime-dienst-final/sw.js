/* =====================================================================
   GEHEIME DIENST — service worker
   =====================================================================
   Bewust minimaal: deze service worker slaat de app NIET op in een cache.
   Dat is met opzet — zo krijgt iedereen bij het openen altijd de nieuwste
   versie binnen, ook als de spelleider tijdens het spel nog iets aanpast.
   Hij bestaat alleen om meldingen te kunnen tonen; op iOS kan dat namelijk
   niet zonder service worker.

   Meldingen zijn altijd anoniem: nooit een naam, nooit de inhoud van een
   bericht en nooit in welke chat het staat. Iemand die over je schouder
   meekijkt mag er niets uit kunnen afleiden.
   ===================================================================== */

const TITEL = "🕵️ Geheime Dienst";
const TEKSTEN = {
  bericht:  "Je hebt een nieuw bericht",
  genoemd:  "Iemand heeft je genoemd",
  verzoek:  "Er ligt een verzoek voor je klaar",
  rol:      "De spelleider heeft iets voor je",
  deadline: "Er staat een nieuwe deadline",
};
const anoniem = soort => TEKSTEN[soort] || "Er is iets nieuws in de app";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let soort = "";
  try { soort = (event.data && event.data.json().soort) || ""; } catch (e) { /* platte tekst of leeg */ }
  event.waitUntil(self.registration.showNotification(TITEL, {
    body: anoniem(soort),
    icon: "kaarten/icon-192.png",
    badge: "kaarten/icon-192.png",
    tag: "gd-" + (soort || "algemeen"),
    renotify: true,
    data: {soort},
  }));
});

// tik je op de melding, dan opent (of focust) de app
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const lijst = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const open = lijst.find(c => c.url.includes(self.registration.scope));
    if (open) return open.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
