/* Huisje OVS — Boodschappen: eenvoudige offline-cache.
   De app-schil wordt bewaard, de gedeelde lijst komt live van Firestore
   (die heeft zijn eigen offline-cache). */
const CACHE = "ovs-boodschappen-v2";
const SCHIL = ["./", "./index.html", "./firebase-config.js", "./manifest.json",
               "./icon.png", "./icon-180.png", "./icon-maskable.png"];

/* Hoe lang het net de kans krijgt om met iets nieuwers te komen voordat we
   pakken wat we al hebben. Netwerk-eerst zonder zo'n grens klinkt veilig,
   maar een verzoek dat blijft hangen geeft geen fout — het geeft niets. Dan
   staar je naar het opstartscherm van je telefoon terwijl de hele app al in
   de cache ligt. Dat gebeurt echt: met een VPN aan, in de trein, op een
   haperend netwerk. */
const GRENS = 2500;

/* Deze veranderen vrijwel nooit, en ze zitten wél in de weg: de browser
   ontdekt firebase-config.js pas als index.html binnen is, dus achter
   elkaar wachten betekent twee keer GRENS voordat je iets ziet. Die geven
   we meteen uit de cache en we verversen op de achtergrond. index.html
   zelf niet: daar zit de hele app in, en een nieuwe versie wil je zodra
   hij er is, niet pas de keer daarna. */
const VAST = ["/firebase-config.js", "/manifest.json",
              "/icon.png", "/icon-180.png", "/icon-maskable.png"];
const staatVast = url => VAST.some(v => url.pathname.endsWith(v));

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

async function netEersteMetGrens(e){
  const req = e.request;
  const eigenHuis = new URL(req.url).origin === location.origin;
  const cache = await caches.open(CACHE);
  const uitCache = await cache.match(req);

  const vanHetNet = fetch(req)
    .then(r => {
      if(r && r.status === 200 && eigenHuis) cache.put(req, r.clone()).catch(() => {});
      return r;
    })
    .catch(() => null);

  /* Niets in de cache? Dan zit er niets anders op dan wachten. */
  if(!uitCache){
    return (await vanHetNet)
        || (await cache.match("./index.html"))
        || new Response("Geen verbinding", {status:503, statusText:"Offline"});
  }

  /* Wat toch nooit verandert: meteen geven, op de achtergrond verversen. */
  if(staatVast(new URL(req.url))){
    e.waitUntil(vanHetNet);
    return uitCache;
  }

  /* De rest: het net krijgt even de tijd, maar niet eindeloos. */
  const opTijd = await Promise.race([
    vanHetNet,
    new Promise(r => setTimeout(() => r(null), GRENS))
  ]);
  if(opTijd) return opTijd;

  /* Te traag. We geven wat we hebben en laten het net op de achtergrond
     uitrazen, zodat de verse versie er de volgende keer wél staat. */
  e.waitUntil(vanHetNet);
  return uitCache;
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if(e.request.method !== "GET") return;
  // alles van Google/Firebase altijd rechtstreeks van het net halen
  if(url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com") ||
     url.hostname.endsWith("firebaseio.com")) return;

  e.respondWith(netEersteMetGrens(e));
});
