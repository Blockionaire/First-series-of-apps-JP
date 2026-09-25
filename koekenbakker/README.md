# 🍪 De Koekenbakker

De webshop van **Zara** — verse chocoladekoekjes, één bakdag per week.
Dit is **concept 1**: speels van vorm, rustig van kleur. De hele site staat in vier
beigetinten — papier, room, zand en een tint dieper voor de banden — met walnoot als
enige accent. De andere twee richtingen staan in
[`koekenbakker-studio/`](../koekenbakker-studio/) (strak en editorial) en
[`koekenbakker-pocket/`](../koekenbakker-pocket/) (donker en mobiel).

**🔗 De site staat live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/koekenbakker/

Eén bestand, geen build, geen server: `index.html` bevat de hele site (opmaak, tekeningen en
logica). Open 'm lokaal met dubbelklikken of zet 'm op GitHub Pages.

---

## Wat er op de site staat

- **Laadscherm** — een koekje dat in de oven ligt terwijl de pagina inlaadt.
- **Koekjescursor** — op laptop en desktop volgt een koekje je muis en laat kruimels achter.
  Uit te zetten onderaan de pagina; de keuze wordt onthouden.
- **Hero** — een draaiend koekje met kleinere koekjes eromheen in een baan.
- **Assortiment** — vijf koekjes met prijs, gewicht, allergenen en een smaakmeter.
  Tik op een koekje en er gaat een hap uit (na drie happen krijg je een knipoog terug).
- **Spaarregel 5 + 1** — zes gleuven die meelopen met je mandje. Bij elke vijf koekjes
  verschijnt er automatisch een gratis koekje, waarvan je zelf de smaak kiest.
- **Verrassingsbox** — één knop in de hero legt een box van zes koekjes in je mandje.
  Wat erin zit blijft een verrassing: in het mandje staat alleen *1× Verrassingsbox
  (6 koekjes)*. De box telt niet mee voor de spaarregel, want de zesde zit er al in.
- **Bakdag** — een aftelklok naar de eerstvolgende bakdag (standaard vrijdag 16:00).
- **Welk koekje ben jij?** — drie vragen, en het koekje dat eruit komt kun je direct
  in je mandje leggen.
- **Over Zara**, **reviews** en een **vragenlijst**.
- **Mandje** — schuift open vanaf de rechterkant, onthoudt zichzelf tussen bezoeken
  (localStorage) en zet de bestelling klaar als berichtje. Naam en telefoon/e-mail zijn
  verplicht; ontbreekt er iets, dan springt het veld in het rood en gaat de bestelling
  niet weg.
- **Afhaalmoment** — kies je afhalen, dan kies je een dag en een tijdslot (met de datum
  van de eerstvolgende bakdag erbij), of "maakt me niet uit".
- **Bestelbalk onderaan** op de telefoon, zodat bestellen altijd één tik weg is.

Alle koekjes zijn getekend in code (SVG), dus er zijn geen foto's nodig en de site laadt
direct. Elk koekje heeft een eigen `seed`, waardoor de brokken chocolade er per smaak
anders uitzien maar altijd hetzelfde blijven.

---

## Aanpassen

Bovenaan het `<script>`-blok in `index.html` staat één instellingenblok:

```js
const CONFIG = {
  whatsapp: "",                  // bijv. "31612345678" — landcode, geen + of spaties
  email: "hoi@dekoekenbakker.nl",
  stad: "de stad",
  bezorgkosten: 2.50,
  gratisBezorgenVanaf: 6,
  bakdag: 5,                     // 0 = zondag, 5 = vrijdag
  bakuur: 16,
  boxPrijs: 14.50,               // verrassingsbox: zes koekjes, je betaalt er vijf
  afhaalKeuze: true,             // op false: geen vaste tijdsloten, je spreekt het zelf af
  afhaalmomenten: [
    {dagNr: 5, tijden: ["17:00 – 18:00", "18:00 – 19:00"]},
    {dagNr: 6, tijden: ["10:00 – 11:00", "11:00 – 12:00"]}
  ]
};
```

De afhaalmomenten rekenen zichzelf uit vanaf de eerstvolgende bakdag: `dagNr` 5 is
vrijdag, 6 is zaterdag. Wil je geen tijdsloten aanbieden, zet dan `afhaalKeuze` op
`false` — het hele blok verdwijnt dan uit het bestelformulier en je spreekt het
moment af in je bevestiging. De prijs van de verrassingsbox staat los van de losse
koekjes; met `boxPrijs` bepaal je die zelf.

**Nog invullen voordat de site echt live gaat:**

1. `whatsapp` — zolang dit leeg is, gaat een bestelling via e-mail in plaats van WhatsApp.
2. `email` en `stad`.
3. De Instagram- en TikTok-links in de footer (staan nu op `#`).
4. De teksten over Zara en de drie reviews — die zijn nu als voorbeeld ingevuld.

Een koekje toevoegen of veranderen doe je in de lijst `KOEKJES`: naam, prijs, gewicht,
omschrijving, labels, smaakmeter (1 t/m 5), en de kleuren van het deeg, de korst en de
chocoladebrokken. Zet je er een zesde bij, dan schuift het raster vanzelf mee.

---

## Bestellen — hoe het werkt

De site verwerkt geen betalingen. Een bestelling wordt opgemaakt als berichtje met alle
koekjes, het totaal, afhalen of bezorgen en de gegevens van de klant. Die tekst gaat naar
WhatsApp (als het nummer is ingevuld) of naar de mail, en wordt tegelijk naar het klembord
gekopieerd. Zara bevestigt daarna zelf.

Wil je later echt online afrekenen, dan is een betaallink (Mollie, Tikkie) de kleinste stap:
die kan als extra knop naast "Bestelling versturen".
