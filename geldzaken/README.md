# Geldzaken

Een huishoudboekje dat aanvoelt als een app: wat komt er binnen, wat gaat eruit,
wat staat er in de potjes, en hoeveel kun je deze maand nog uitgeven.

Werkt op je telefoon, tablet en laptop. Geen abonnement, geen bank die meekijkt,
geen build-stap — het is een map met bestanden die je in een browser opent.

Met een (gratis) Firebase-project erachter komt er een inlogscherm bij en houden
al je apparaten dezelfde cijfers vast. En dan geldt de belangrijkste regel van
deze app: **iedereen kan zich aanmelden, maar alleen jij bepaalt wie erbij mag.**

---

## Twee manieren van bijhouden

De app kan meebewegen met hoe precies je wilt zijn. Je kiest onder ⚙️, en je kunt
altijd wisselen zonder iets kwijt te raken.

### Op hoofdlijnen (standaard)

Je houdt je **inkomen** bij en verdeelt dat over **potjes**. Losse uitgaven hoef je
niet te boeken: de hypotheek is gewoon een stuk van de taart, want die gaat er toch
elke maand af.

- **Overzicht** — je inkomen groot bovenaan, daaronder een cirkeldiagram met de
  verdeling. Elk potje een stuk, en wat je niet hebt verdeeld blijft grijs. Tik op een
  schijf (of op zijn regel) en hij komt eruit: het midden van de cirkel vertelt dan om
  welk potje het gaat en welk deel van je inkomen dat is. Nog een tik en hij zakt terug.
- **Spaardoelen op je overzicht** — de doelen die nog lopen staan er compact onder, met
  hun voortgang en wat er per maand bij moet.
- **Verdelen** — alle potjes onder elkaar met een bedrag erachter. Bovenin staat
  live wat er nog te verdelen is, dus je hoeft nooit zelf te rekenen. Is er iets
  over, dan zet je dat met één knop in een potje.
- **Drie soorten potjes**, want je wilt per soort iets anders weten:

  | | |
  |---|---|
  | **Vaste last** | Hypotheek, energie, verzekering. Gaat er elke maand af, verder niets bij te houden. Geen saldo. |
  | **Vrij te besteden** | Boodschappen, uitgaan. Bedoeld om op te maken. Boek je wel eens iets, dan zie je wat er déze maand nog over is. |
  | **Sparen** | Vakantie, buffer, onderhoud. Dit bouwt op; het saldo blijft staan. |

- **Een potje kan uit onderdelen bestaan** — "Vaste lasten € 500" zegt weinig; open je
  het potje, dan zie je waar die 500 uit is opgebouwd: hypotheek 300, energie 120,
  verzekeringen 80, met een balkje en het aandeel per onderdeel. Het maandbedrag van
  het potje ís die som, dus je vult nooit twee getallen in die uit elkaar kunnen lopen.
  Op het overzicht verschijnt de opbouw zodra je de schijf van dat potje aantikt.

- **Inkomen** — salaris, toeslagen, het inkomen van je partner. Eén keer instellen,
  daarna rekent de app er elke maand mee. Een bonus of teruggave boek je los.
- **Cijfers** — hoe je maanden zich tot elkaar verhouden.

### Alles bijhouden

Wil je wél elke boeking invoeren, dan zet je de andere modus aan. Daarmee komen
erbij:

- **Boekingen** — uitgaven, inkomsten, sparen en overboekingen, met zoeken en
  filteren. De categorie wordt geraden uit de omschrijving en de app onthoudt je
  correcties.
- **Startscherm met "nog te besteden"** — inclusief prognose op je uitgeeftempo en
  waarschuwingen bij budgetten die vollopen.
- **Vaste lasten** als aparte posten (per maand, kwartaal, half jaar of jaar), met
  herkenning van boekingen die erbij horen en een maandbedrag voor de
  jaarrekeningen.
- **Budgetten per categorie**.

### In allebei

- **Bankbestand inlezen** — CSV of CAMT (camt.053, het XML-bestand dat elke bank
  aanbiedt). CSV van ING, Rabobank, ABN AMRO en bunq wordt vanzelf herkend; een
  andere bank koppel je zelf in drie klikken. Boekingen die je al hebt staan
  worden herkend en uitgevinkt, dus niets komt dubbel binnen. Op hoofdlijnen hang
  je elke uitgave meteen aan een potje — bij een potje *vrij te besteden* zie je
  daarna precies wat er deze maand nog over is.
- **Meelezen met de boodschappenapp** — zet je onder ⚙️ → Koppelingen aan. Geldzaken
  leest dan live mee met de bonnen uit de boodschappenapp van het huisje en laat zien
  wat er deze maand is afgerekend. Hang het aan je potje Boodschappen en je ziet
  meteen wat er nog over is. Er wordt alleen gelezen: er komen geen boekingen bij, dus
  er telt ook niets dubbel als je daarnaast je bankafschrift inleest.
- **Spaardoelen** met streefbedrag en datum: wat moet er per maand bij, en lig je
  op schema?
- **Rekeningen en vermogen**, met saldo gelijkzetten met je bank.
- **Privacyknop**: één tik en alle bedragen worden ••••.
- Meerdere personen, back-up als één bestand, CSV-export.
- Werkt volledig offline en is te installeren op je beginscherm.

---

## Beginnen

Open `index.html` in een browser, of zet de map online (GitHub Pages werkt
prima). Je kunt meteen boeken; er staat al een set categorieën klaar.

Op de telefoon: open de app in Safari of Chrome en kies **Zet op beginscherm**.
Daarna opent hij zonder browserbalk en werkt hij ook zonder internet.

Zo staat alles alleen op dít apparaat. Wil je meer, lees dan verder.

---

## Samen bijhouden, met de deur op slot

Hiervoor heb je een gratis Firebase-project nodig. Eenmalig een kwartiertje werk.

### 1. Project maken

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) en
   maak een nieuw project (Google Analytics mag uit).
2. Klik op het `</>`-icoontje om een web-app toe te voegen.
3. Kopieer het `firebaseConfig`-blok dat je krijgt.

### 2. Inloggen aanzetten

Ga naar **Authentication → Sign-in method** en zet **E-mail/wachtwoord** aan.

### 3. Database maken

Ga naar **Firestore Database → Create database**. Kies een locatie in Europa
(bijvoorbeeld `eur3`) en start in **production mode** — de regels zetten we in
stap 5 goed.

### 4. `firebase-config.js` invullen

```js
window.GELDZAKEN_CONFIG = {
  firebase: {
    apiKey: "AIza…",
    authDomain: "mijn-geldzaken.firebaseapp.com",
    projectId: "mijn-geldzaken",
    storageBucket: "mijn-geldzaken.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  // Jouw eigen adres. Dit is de enige manier om de eerste beheerder te worden.
  beheerders: ["jij@voorbeeld.nl"],

  huisNaam: "Huishouden Jansen",
  ruimte: "thuis"
};
```

### 5. De beveiligingsregels plaatsen

Open `firestore.rules` uit deze map, **zet je eigen e-mailadres in
`beheerderMails()`**, en plak de hele inhoud in de Firebase Console onder
**Firestore Database → Rules → Publish**.

Dit is de belangrijkste stap. Zonder deze regels staat je database open; mét deze
regels kan iemand die niet is goedgekeurd letterlijk niets lezen — ook niet als
hij de app openbreekt of de database rechtstreeks aanroept.

### 6. Jezelf toelaten

Open de app, maak een account met hetzelfde adres als in stap 4, en je bent
meteen binnen als beheerder.

---

## Wie mag erbij

Zo werkt de toegang:

| | |
|---|---|
| **Aanmelden** | Iedereen met de link kan een account maken. Zo'n account is niet meer dan een verzoek: een naam en een e-mailadres in jouw wachtrij. Diegene ziet een wachtkamer, geen cijfers. |
| **Toelaten** | Jij ziet de aanmelding onder ⚙️ → *Wie mag erbij*, met naam, adres, wanneer diegene zich meldde en of het e-mailadres bevestigd is. Jij kiest of hij erin mag, en met welke rechten. |
| **Rollen** | **Kijker** mag alles zien en niets wijzigen. **Bewerker** mag boekingen, potjes en vaste lasten aanpassen. **Beheerder** mag dat, én mag anderen toelaten. |
| **Terugdraaien** | Toegang pauzeren kan altijd; diegene blijft in de lijst staan zodat je hem later weer kunt toelaten. Verwijderen haalt hem helemaal uit de lijst. |

Niemand kan zichzelf promoveren. In de regels staat dat je bij het bijwerken van
je eigen ledendocument je status en rol precies moet laten staan zoals ze waren —
een poging om dat te veranderen wordt door Firestore geweigerd, niet door de app.

**Over de sleutel in `firebase-config.js`:** die hoort openbaar te zijn bij een
web-app en is geen wachtwoord. Wat je gegevens beschermt zijn de regels uit stap
5.

---

## Technisch

- Eén map met losse bestanden, **geen build-stap en geen npm**. Openen in een
  browser en klaar.
- **ES-modules**, geen frameworks en geen externe bibliotheken. De grafieken zijn
  inline SVG.
- **IndexedDB** voor de opslag, niet localStorage: een paar jaar boekingen zijn
  zo tienduizenden regels, en localStorage blokkeert bovendien de pagina bij elk
  schrijfje.
- **Firestore** is een kopie bovenop de lokale opslag, geen vervanging. Bij het
  samenvoegen wint de versie met de laatste wijzigingstijd; verwijderen gaat via
  een grafsteen, zodat een ander apparaat een gewiste boeking niet terugzet.
- Alle afgeleide cijfers staan in `js/bereken.js`, op één plek — anders telt het
  startscherm net iets anders op dan het cijferscherm.
- De **service worker** haalt eerst het netwerk op en valt terug op de cache. Zo
  krijg je altijd de nieuwste versie zodra je online bent, en werkt de app
  volledig door als je dat niet bent.
- **Hosting:** GitHub Pages, direct vanuit deze repository.

### Bestanden

```
index.html              de schil
firebase-config.js      jouw instellingen (staat standaard op demo)
firestore.rules         de beveiliging — hoort in de Firebase Console
manifest.json           voor het installeren op je beginscherm
sw.js                   offline en installeerbaar
css/app.css             alle vormgeving, twee thema's
js/app.js               router, tabbalk en de poort
js/store.js             alle gegevens en alle wijzigingen
js/bereken.js           alle afgeleide cijfers
js/db.js                IndexedDB
js/sync.js              inloggen, lidmaatschap en Firestore
js/koppeling.js         meelezen met de boodschappenapp (Firestore REST)
js/util.js              opmaak, maanden, dialogen, grafiekjes
js/data/standaard.js    categorieën, potjesvoorstellen, bankprofielen
js/views/overzicht.js   de taart: inkomen en verdeling
js/views/verdelen.js    inkomen over potjes verdelen
js/views/inkomen.js     waar je geld vandaan komt
js/views/*.js           de overige schermen
```

### Hoe een boeking op je rekeningen werkt

```
inkomst      erbij op `rekening`
uitgave      eraf van `rekening`
overboeking  eraf van `rekening`, erbij op `naarRekening`
sparen       hetzelfde, én het potje of doel groeit
opname       hetzelfde, én het potje of doel slinkt
```

Potjes zijn geen aparte bankrekening maar een afspraak met jezelf: het geld staat
gewoon op je betaal- of spaarrekening. Daarom verandert een storting in een potje
zonder tegenrekening je vermogen niet — alleen je bestemming.

---

## Veelgestelde vragen

**Ik zie mijn cijfers niet meer na het inloggen.**
Dan wacht je nog op goedkeuring, of je bent op een leeg apparaat begonnen. Onder
⚙️ → Account staat wat je rol is. Stond je boekhouding alleen lokaal en is de
cloud nog leeg, gebruik dan *Dit apparaat als bron gebruiken*.

**Kan ik twee huishoudens uit elkaar houden?**
Ja: zet `ruimte` in `firebase-config.js` op iets anders. Die twee delen dan
niets, ook geen ledenlijst.

**Wat gebeurt er met een uitgave uit een potje?**
Die telt gewoon mee in je categorieën en in het jaartotaal, maar niet in de
losse uitgaven van deze maand — dat geld was al gereserveerd.

**Welke bankbestanden kan ik uploaden?**
CSV en CAMT (camt.053). Bij CSV herkent de app ING, Rabobank, ABN AMRO en bunq aan
hun kolomnamen; kent hij jouw bank niet, dan wijs je zelf aan welke kolom de datum,
het bedrag en de omschrijving is. CAMT is XML en heeft niets nodig: daar staan
datum, bedrag, tegenpartij en omschrijving met naam en toenaam in, en een
verzamelboeking wordt netjes uit elkaar gehaald. MT940 wordt (nog) niet gelezen.

**Hoe werkt het meelezen met de boodschappenapp?**
Die app bewaart zijn bonnen in Firestore (collectie `ovs_bonnen` in het project
`geheime-dienst`). Geldzaken haalt die op met een gewone `fetch` naar de REST-kant van
Firestore — geen Firebase-SDK, dus niets extra's te laden en het werkt ook op netwerken
waar dat adres dicht staat. Bij het openen van de app, zodra je terugkomt, en verder elke
vijf minuten. Je hoeft er niets voor in te stellen: aanzetten onder ⚙️ → Koppelingen is
genoeg, en dit staat helemaal los van of Geldzaken zelf een cloud heeft. Het bedrag
verschijnt op je overzicht en gaat af van het potje dat je eraan hangt, maar het wordt
géén boeking in Geldzaken — dat is precies waarom er niets dubbel kan tellen. Wil je een
andere app of een andere ruimte meelezen, dan pas je het blok `koppelingen` in
`firebase-config.js` aan.

**Waarom staat mijn hypotheekpotje altijd op nul?**
Dat klopt: een potje van het soort *vaste last* houdt geen saldo bij. Het bedrag
gaat er elke maand af en telt mee in je verdeling, meer valt er niet over te
zeggen. Wil je het toch volgen, zet het potje dan op *sparen* of *vrij te
besteden*.

**Ik zie een oude versie van de app.**
Dat hoort niet meer te gebeuren. Staat de app op je beginscherm, dan sluit je hem
nooit echt af, en dan bleef de oude versie draaien tot de browser toevallig besloot
opnieuw te kijken. De app vraagt nu bij elke start én zodra je terugkomt of er een
nieuwe versie klaarstaat, en ververst dan één keer vanzelf. Zit je toch vast: sluit
de app helemaal af en open hem opnieuw. Op de iPhone veeg je hem daarvoor weg uit
de appwisselaar.

**Ik heb per ongeluk alles gewist.**
Als je een back-up hebt (⚙️ → Back-up downloaden) zet je die terug met
*Terugzetten*. Zonder back-up en met synchronisatie aan staat het meestal nog op
een ander apparaat dat nog niet ververst heeft — open dat apparaat en gebruik
*Dit apparaat als bron gebruiken*.
