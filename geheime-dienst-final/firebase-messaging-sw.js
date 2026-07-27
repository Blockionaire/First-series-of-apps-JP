/* =====================================================================
   GEHEIME DIENST — meldingen via Firebase Cloud Messaging
   =====================================================================
   Deze service worker vangt meldingen op die binnenkomen terwijl de app
   dicht is. Hij werkt pas zodra je in firebase-config.js een vapidKey
   invult én de Cloud Function uit de map functions/ hebt uitgerold — zie
   README.md, kopje "Pushmeldingen aanzetten".

   Net als sw.js slaat hij niets op in een cache: iedereen krijgt altijd
   de nieuwste versie van de app te zien.

   De inhoud van een melding is altijd anoniem. De Cloud Function stuurt
   alleen mee wélk soort melding het is, nooit een naam of berichttekst.
   ===================================================================== */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
importScripts("firebase-config.js");

const TITEL = "🕵️ Geheime Dienst";
const TEKSTEN = {
  bericht:  "Je hebt een nieuw bericht",
  verzoek:  "Er ligt een verzoek voor je klaar",
  rol:      "De spelleider heeft iets voor je",
  deadline: "Er staat een nieuwe deadline",
};

const cfg = (self.GD_CONFIG || {}).firebase;
if (cfg && cfg.apiKey) {
  firebase.initializeApp(cfg);
  firebase.messaging().onBackgroundMessage(payload => {
    const soort = (payload && payload.data && payload.data.soort) || "";
    self.registration.showNotification(TITEL, {
      body: TEKSTEN[soort] || "Er is iets nieuws in de app",
      icon: "kaarten/icon-192.png",
      badge: "kaarten/icon-192.png",
      tag: "gd-" + (soort || "algemeen"),
      renotify: true,
    });
  });
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const lijst = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const open = lijst.find(c => c.url.includes(self.registration.scope));
    if (open) return open.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
