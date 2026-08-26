# Geldzaken

Een huishoudboekje dat aanvoelt als een app: wat komt er binnen, wat gaat eruit,
wat staat er in de potjes, en hoeveel kun je deze maand nog uitgeven.

Werkt op je telefoon, tablet en laptop. Geen abonnement, geen bank die meekijkt,
geen build-stap — het is een map met bestanden die je in een browser opent.

Met een (gratis) Firebase-project erachter komt er een inlogscherm bij en houden
al je apparaten dezelfde cijfers vast. En dan geldt de belangrijkste regel van
deze app: **iedereen kan zich aanmelden, maar alleen jij bepaalt wie erbij mag.**

---

## Wat kan het

**Je maand in één oogopslag**
- Bovenaan het bedrag waar het om gaat: wat je deze maand nog te besteden hebt,
  inclusief de vaste lasten die nog moeten komen.
- Een verdeelbalk: hoeveel gaat naar vast, hoeveel naar losse uitgaven, hoeveel
  gaat opzij, en wat blijft er over.
- Een prognose op basis van je uitgeeftempo: "zo eindig je op € 240".
- Signalen die pas verschijnen als ze ergens over gaan: een budget dat bijna op
  is, een vaste last die te laat is, een maand die duurder loopt dan normaal.

**Inkomsten en uitgaven**
- Boeken in vier smaken: uitgave, inkomst, opzij zetten en overboeken.
- De categorie wordt geraden uit de omschrijving — en de app onthoudt jouw
  correcties, dus hij wordt er elke maand beter in.
- Zoeken door alles, filteren op soort, categorie en persoon.
- Snelknoppen voor wat je vaak boekt.

**Vaste lasten**
- Per maand, kwartaal, half jaar, jaar of week, met de dag waarop ze afgeschreven
  worden.
- De app herkent zelf of een vaste last al geboekt is — ook als je hem gewoon met
  de hand hebt ingevoerd of je afschrift hebt ingelezen.
- Kwartaal- en jaarrekeningen worden omgerekend naar een maandbedrag, met één
  knop om daar meteen een potje voor te maken. Nooit meer schrikken in januari.

**Potjes**
- Enveloppen waar elke maand automatisch een bedrag in gaat: vakantie, auto,
  kleding, buffer.
- Een uitgave kun je uit een potje betalen. Dat geld was in eerdere maanden al
  gereserveerd, dus het drukt niet op de maand die je nu bekijkt — precies zoals
  enveloppen bedoeld zijn.

**Spaardoelen**
- Streefbedrag en streefdatum. De app rekent uit wat er per maand bij moet, en
  of je met je huidige tempo op schema ligt.

**Rekeningen en vermogen**
- Betaal-, spaar- en beleggingsrekeningen, contant geld en schulden.
- Saldo's worden berekend uit je boekingen; met één knop zet je ze weer gelijk
  met je bank (het verschil wordt netjes een correctieboeking).
- Je vermogen in een lijn over de afgelopen maanden.

**Cijfers**
- Erin en eruit per maand, 6 / 12 / 24 maanden of alleen dit jaar.
- Waar het geld heen ging, gemiddeld per maand.
- Vast tegenover los — hoe lager je vaste deel, hoe makkelijker je een
  tegenvaller opvangt.
- Spaarquote, beste en zwaarste maand, grootste uitgaven, jaartotalen.

**Bankbestand inlezen**
- CSV uit ING, Rabobank, ABN AMRO of bunq wordt vanzelf herkend; een andere bank
  koppel je zelf in drie klikken.
- Regels die je al hebt staan worden herkend en uitgevinkt, dus niets komt dubbel
  binnen.

**En verder**
- Privacyknop: één tik en alle bedragen worden ••••.
- Meerdere personen in één huishouden, met bij elke boeking van wie hij was.
- Donker en licht thema.
- Back-up als één bestand, en boekingen exporteren als CSV.
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
js/util.js              opmaak, maanden, dialogen, grafiekjes
js/data/standaard.js    categorieën, potjesvoorstellen, bankprofielen
js/views/*.js           de schermen
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

**Ik heb per ongeluk alles gewist.**
Als je een back-up hebt (⚙️ → Back-up downloaden) zet je die terug met
*Terugzetten*. Zonder back-up en met synchronisatie aan staat het meestal nog op
een ander apparaat dat nog niet ververst heeft — open dat apparaat en gebruik
*Dit apparaat als bron gebruiken*.
