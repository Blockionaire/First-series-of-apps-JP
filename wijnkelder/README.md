# 🍷 Wijnkelder

Je wijnkelder op zak. Welke flessen liggen er, wanneer moeten ze open, wat is de
kelder waard, en wat past er bij wat je vanavond eet.

Een web-app die je op je beginscherm zet en die daarna aanvoelt als een gewone
app: geen installatie, geen app store, en hij werkt zonder internet.

> **Let op:** dit is een eigen bouwsel, geen kopie van bestaande software. Het
> spaar-/beloningssysteem met kurken uit vergelijkbare apps zit er bewust **niet**
> in. Wat er wél in zit staat hieronder.

---

## Wat kan de app?

### De kelder
- **Flessen toevoegen** met een foto van het etiket (camera of bibliotheek).
  De foto wordt in de browser verkleind, dus een volle kelder blijft licht.
- **Slim invoeren**: kies een land en je krijgt de regio's; kies een regio en de
  appellaties en streekdruiven van dát gebied staan bovenaan. Typ je een
  appellatie die de app kent, dan vult hij land en regio zelf in. Typ je een
  producent die al in je kelder staat, dan neemt hij de herkomst over.
- **Meegeleverde catalogus**: 19 landen, 51 wijnstreken, ruim 420 appellaties
  en 168 druivenrassen. Je kunt altijd iets invullen wat er niet in
  staat — de app weigert nooit een wijn omdat hij hem niet kent.
- **Zoeken en filteren** op naam, producent, regio, druif of vaknummer, met
  filters voor kleur, land, rijpingsfase en favorieten. Accenten doen niet mee:
  `chateau` vindt ook `Château`.
- **Sorteren** op drinkvenster, naam, jaargang, nieuwste, waarde of aantal.
- **Wenslijst** voor wijnen die je nog niet hebt. Gekocht? Eén tik en hij
  verhuist naar de kelder, mét de prijs die je erbij zette.

### Rijping
- Elke fles krijgt een **drinkvenster**: van wanneer tot wanneer hij op zijn best
  is, en waar hij vandaag in dat venster staat.
- Vijf fases: *te jong · komt op dreef · op zijn top · drink nu · over hoogtepunt*.
- Het startscherm zet de flessen die aandacht vragen bovenaan, en waarschuwt
  als er iets voorbij zijn beste tijd raakt.
- **Weet jij het beter?** Vul op de wijnfiche je eigen venster in. Dat wint
  daarna altijd van de schatting.

### Spijs & wijn
- **46 gerechten** in elf groepen, van biefstuk tot sushi tot blauwe kaas.
- De app doorzoekt **je eigen kelder** en geeft per fles een score van 0 tot 100,
  met de reden erbij ("het frisse zuur snijdt door het gerecht heen").
- Filter op gelegenheid: *doordeweeks · gasten aan tafel · speciale gelegenheid ·
  moet nu open*.
- Andersom werkt het ook: op elke wijnfiche staat bij welke gerechten die fles
  het beste past, met zijn smaakprofiel (body, tannine, zuur, zoet).
- **Verras me** kiest willekeurig een fles die nú op zijn best is.

### Plattegrond
- Je rekken in een lichte 3D-kanteling, elk vakje in de kleur van de wijn die
  erin ligt. Tik op een vakje en je springt naar die fles.
- De afmetingen komen uit je flessen zelf: het hoogste rij- en vaknummer dat je
  gebruikt bepaalt hoe groot het rek getekend wordt. Je hoeft niets in te stellen.
- Licht alle rode wijnen uit, of alles wat drinkklaar is.

### Cijfers
Verdelingen over kleur, rijping, land, regio, jaargang, prijsklasse, producent en
flesformaat. Plus wat je per jaar uitgaf, je drinktempo over de laatste twaalf
maanden, en hoe lang je voorraad in dat tempo nog meegaat.

### Waarde
- Aankoopprijs en huidige waarde per fles, met het verschil in euro's en procenten.
- Kelderwaarde en rendement op het startscherm.
- **De app haalt geen marktprijzen op.** Wat je zelf invult is wat je ziet — en
  het rendement wordt alleen gerekend over de flessen waar je écht een huidige
  waarde bij zette, zodat je jezelf niet rijk rekent met je eigen bonnetjes.

### Proefnotities en historie
- Bij het openen van een fles noteer je datum, gelegenheid, score en wat je ervan
  vond. Blijft er niets over, dan verdwijnt de wijn uit je kelder maar **blijven
  je notities bestaan** — daar houd je het juist voor bij.
- Logboek van alles wat er in en uit ging, per jaar te filteren.

### Verder
- **Donker en licht thema**, standaard volgt hij je telefoon.
- **Back-up** als één JSON-bestand met alles erin, inclusief de etiketfoto's.
  Inlezen kan samenvoegend of vervangend.
- **Werkt offline.** Alles staat in de database van je telefoon zelf.
- Valuta instelbaar (euro, pond, dollar, frank) — alleen de weergave, er wordt
  niet omgerekend.

---

## Aan de slag

Open de link op je telefoon en kies in het deelmenu **"Zet op beginscherm"**.
Daarna staat Wijnkelder tussen je andere apps en opent hij zonder browserbalk.

De app werkt meteen. Een account is alleen nodig als je je kelder op meerdere
apparaten wilt hebben.

---

## Synchroniseren tussen apparaten (optioneel)

Zonder configuratie staat je kelder alleen op het apparaat waar je hem invoerde.
Wil je hem op je telefoon én je laptop, dan is er eenmalig wat werk:

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) en
   maak een gratis project aan (het Spark-plan is genoeg).
2. Voeg een **web-app** toe (het `</>`-icoontje) en kopieer het
   `firebaseConfig`-blok dat je krijgt.
3. Plak dat in **`firebase-config.js`**, in plaats van `firebase: null`.
4. Zet in de console **Authentication → Sign-in method → E-mail/wachtwoord** aan.
5. Maak een **Firestore-database** aan en zet deze regels erin:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Iedereen komt alleen bij zijn eigen kelder.
    match /gebruikers/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Daarna kun je in de app onder ⚙️ een account maken. Had je op dat apparaat al
flessen staan, dan gaan die meteen mee omhoog.

**Over die sleutel in `firebase-config.js`:** die hoort openbaar te zijn bij een
web-app en is geen wachtwoord. Wat je gegevens beschermt zijn de regels hierboven,
die alleen jouw account bij jouw eigen kelder laten.

---

## Technisch

- Eén map met losse bestanden, **geen build-stap en geen npm**. Openen in een
  browser en klaar.
- **ES-modules**, geen frameworks en geen externe bibliotheken. De grafieken zijn
  inline SVG.
- **IndexedDB** voor de opslag, niet localStorage: etiketfoto's tellen snel op en
  localStorage houdt het rond de 5 MB voor gezien.
- **Firestore** is een kopie bovenop de lokale opslag, geen vervanging. Bij het
  samenvoegen wint de versie met de laatste wijzigingstijd; verwijderen gaat via
  een grafsteen, zodat een ander apparaat een gewiste fles niet terugzet.
- De **service worker** haalt eerst het netwerk op en valt terug op de cache. Zo
  krijg je altijd de nieuwste versie zodra je online bent, en werkt de app
  volledig door als je dat niet bent.
- **Hosting:** GitHub Pages, direct vanuit deze repository.

### Bestanden

```
index.html              de schil
firebase-config.js      jouw instellingen (staat standaard op demo)
manifest.json  sw.js    installeerbaar maken en offline draaien
css/app.css             vormgeving, twee thema's
js/app.js               router en schermwissel
js/store.js             alle gegevens en alle wijzigingen
js/db.js                IndexedDB
js/sync.js              Firebase (optioneel)
js/util.js              opmaak, dialogen, foto's verkleinen, grafiekjes
js/data/catalog.js      landen, regio's, appellaties, druiven
js/data/aging.js        het rijpingsmodel
js/data/pairings.js     gerechten en de matching
js/views/*.js           één bestand per scherm
```

---

## Waar de app eerlijk over is

**Rijpingsvensters zijn schattingen.** Ze komen uit de regio, de kleur, de
druiven en wat je voor de fles betaalde — niet uit een database met echte
proefnotities. Ze kloppen aardig voor de grote lijnen en zitten er bij een
uitzonderlijke fles naast. Daarom kun je overal je eigen venster invullen.

**Waardes vul je zelf in.** Er wordt niets opgehaald bij veilingen of
wijnhandels. Dat is bewust: liever een getal waarvan je weet waar het vandaan
komt dan een schatting die er gezaghebbend uitziet.

**Etiketten worden niet automatisch herkend.** De camera maakt een foto die bij
de fles wordt bewaard; de velden vul je zelf in, geholpen door de catalogus.

---

## Opnieuw beginnen

Onder ⚙️ → *Alles wissen* gaan alle flessen, notities, historie en wensen eruit.
Maak eerst een back-up — dit kan niet ongedaan gemaakt worden.
