# ◻︎ Koekenbakker Studio — concept 2

Het strakke concept voor de webshop van **Zara**: editorial, rustig, met een zichtbaar
raster en veel witruimte. Zelfde koekjes, zelfde 5 + 1-regel, andere vormtaal dan
[concept 1](../koekenbakker/) (speels en warm) en [concept 3](../koekenbakker-pocket/)
(donker en mobiel).

**🔗 Live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/koekenbakker-studio/

Eén bestand, geen build: `index.html` bevat de hele site.

---

## Het verschil met concept 1

| | Concept 1 — *De Koekenbakker* | Concept 2 — *Studio* |
|---|---|---|
| Toon | speels, warm, sticker-achtig | strak, editorial, rustig |
| Kleur | cacao, karamel, olijf | steen, inkt, walnoot |
| Type | dik display + grotesk | strakke grotesk + mono labels |
| Koekjes | volle illustraties met schaduw | vlakke zeefdruk-tekeningen |
| Beweging | laadscherm, koekjescursor, draaiende koekjes | alleen een voortgangslijn en zachte overgangen |
| Bestellen | mandje met losse aantallen | een doos van zes die je zelf vult |

---

## Wat er op de site staat

- **Index-navigatie** (01–05), zoals in een boekje: elke sectie heeft een nummer.
- **Configurator** — links de vijf koekjes, rechts een detailpaneel dat meebeweegt met
  specificaties (gewicht, doorsnede, cacaopercentage, baktijd) en drie meters.
- **De doos van zes** — het hart van de site. Je vult vijf vakjes zelf; daarna opent het
  zesde vakje en kies je gratis een smaak. Een vakje weer leeghalen doe je met één klik,
  en je kunt extra dozen toevoegen (tot vier).
- **Batch-sectie** — aftelklok naar de bakdag, hoeveel van de oplage al weg is, en de
  levertijden.
- **Interview met Zara** in vraag-en-antwoord, met korte quotes eronder.
- **Bestelpaneel** dat vanaf rechts openschuift en de bestelling als berichtje klaarzet
  voor WhatsApp of e-mail. De doos wordt onthouden tussen bezoeken (localStorage).

De koekjes zijn ook hier in code getekend (SVG), maar vlak en met een inktlijn, zodat ze
bij de rustigere stijl passen.

---

## Aanpassen

Bovenaan het `<script>`-blok staat hetzelfde instellingenblok als in concept 1:

```js
const CONFIG = {
  whatsapp: "",                  // bijv. "31612345678" — landcode, geen + of spaties
  email: "hoi@dekoekenbakker.nl",
  stad: "de stad",
  bezorgkosten: 2.50,
  gratisBezorgenVanaf: 6,
  bakdag: 5,                     // 0 = zondag, 5 = vrijdag
  bakuur: 16
};
```

**Nog invullen voordat dit live gaat:** WhatsApp-nummer, e-mailadres, stad, de Instagram-
en TikTok-links (staan nu op `#`), en het batchnummer plus de oplage (`Batch 064`, `18/40`
in de HTML — die zijn nu als voorbeeld ingevuld). De antwoorden van Zara in het interview
en de drie quotes zijn ook voorbeeldteksten.

Koekjes wijzig je in de lijst `KOEKJES`: naam, prijs, omschrijving, specificaties, meters
(1 t/m 5) en de twee kleuren van de tekening (`tint` voor het deeg, `brok` voor de chocolade).
