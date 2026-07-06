# Anno 1780 — Verbouwingswebsite Oud-Beijerland

Een website die het volledige voor en na laat zien van de verbouwing van een
appartement uit 1780 in het oude centrum van Oud-Beijerland.

## Wat zit erin?

- **Hero** — paginavullende voor/na-schuif van het appartement
- **Het verhaal** — introductie met tellende cijfers (bouwjaar, maanden, …)
- **Tijdlijn** — de fases van de verbouwing, elk met foto
- **Plattegrond** — schuifbaar tussen oude en nieuwe indeling; klik op een
  ruimte (in allebei de plattegronden) om naar die ruimte te springen.
  De vakken pas je aan in `js/content.js` bij `floorplan` (x/y/w/h in
  procenten)
- **Ruimte voor ruimte** — per ruimte een voor/na-schuif met klikbare tabs
  (*Wat we deden / Obstakels / Onze keuzes*) en optionele hotspot-stipjes op de
  foto met extra uitleg
- **De verbouwing in cijfers** — grappige tellende statistieken (zakken puin,
  keer naar de RAD, …); aantallen pas je aan bij `funStats`
- **Galerij** — fotogrid met filter (voor / tijdens / na) en lightbox
- **Footer** — Instagram-knop met daaronder een selectie posts (links en
  afbeeldingen pas je aan bij `instaPosts`)

De site is puur HTML/CSS/JavaScript — geen installatie of build nodig.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `index.html` | De opbouw van de pagina (normaal niet aanpassen) |
| `js/content.js` | **Alle teksten en foto-verwijzingen — dit is het bestand dat je aanpast** |
| `js/main.js` | De interactie (schuiven, tabs, lightbox — niet aanpassen) |
| `css/style.css` | De vormgeving (kleuren wijzig je bovenaan bij `:root`) |
| `images/` | Alle foto's — nu nog placeholders |

## Eigen foto's plaatsen

1. Zet je foto's in de map `images/` (jpg, png of webp — alles werkt).
   Liggende foto's (bijv. 1600×1100) werken het mooist.
2. Open `js/content.js` en pas de paden aan, bijvoorbeeld:
   ```js
   before: "images/woonkamer-voor.jpg",
   after:  "images/woonkamer-na.jpg",
   ```
3. Klaar. Je kunt ook simpelweg de placeholder-bestandsnamen aanhouden en
   alleen de extensie in `content.js` aanpassen.

**Belangrijk voor de schuiven:** maak de voor- en na-foto van een ruimte zoveel
mogelijk vanaf hetzelfde standpunt — dan is het schuif-effect het mooist.

## Teksten aanpassen

Alles staat in `js/content.js`, met uitleg in het bestand zelf:

- Titels, verhaal, tijdlijn en cijfers
- Per ruimte de drie tabs (*Wat we deden / Obstakels / Onze keuzes*)
- Hotspots: stipjes op de na-foto (`x` en `y` in procenten vanaf linksboven)
- Instagram-naam en -link bovenaan bij `site.instagram`
- Ruimtes toevoegen of verwijderen: gewoon een blok in de lijst `rooms`
  toevoegen of weghalen — de pagina bouwt zichzelf op

## Lokaal bekijken

Dubbelklik op `index.html`, of start een mini-server:

```bash
cd renovation-showcase
python3 -m http.server 8000
# open daarna http://localhost:8000
```

## Online zetten (GitHub Pages)

1. Ga in GitHub naar **Settings → Pages**
2. Kies bij *Source*: **Deploy from a branch**, branch `main`, map `/ (root)`
3. Na een minuut staat de site op
   `https://<gebruikersnaam>.github.io/<repo-naam>/renovation-showcase/`
