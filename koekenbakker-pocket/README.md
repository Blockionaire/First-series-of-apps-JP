# 📱 Koekenbakker Pocket — concept 3

Het mobiele concept voor de webshop van **Zara**: donker, app-achtig en gebouwd voor de
link in haar bio. Eén kolom, swipebare koekjes, bestellen via een vaste balk onderin.

**🔗 Live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/koekenbakker-pocket/

Ook hier: één bestand, geen build.

---

## Waarom dit concept

Zara verkoopt vooral via Instagram en TikTok. Vrijwel al haar bezoek komt dus via een
link in haar bio, op een telefoon, met een paar seconden aandacht. Concept 1 en 2 zijn
websites die zich netjes naar mobiel vouwen; dit concept is andersom gebouwd — de
telefoon is het ontwerp, de laptop krijgt dezelfde kolom netjes gecentreerd te zien.

Praktisch betekent dat: alles binnen duimbereik, de bestelknop altijd in beeld, en
grote raakvlakken in plaats van kleine linkjes.

---

## De drie concepten naast elkaar

| | 1 — [De Koekenbakker](../koekenbakker/) | 2 — [Studio](../koekenbakker-studio/) | 3 — Pocket |
|---|---|---|---|
| Toon | speels en warm | strak en editorial | app-achtig, donker |
| Grond | crème | steen | diep cacaobruin |
| Bouw | volle website | website met raster | één kolom van 480 px |
| Koekjes | volle illustraties | vlakke zeefdruk | zacht met randlicht |
| Bestellen | mandje van rechts | doos van zes vakjes | balk onderin + bottom sheet |
| Sterkte | valt op, veel karakter | volwassen en rustig | snelste weg naar een bestelling |

---

## Wat er op de site staat

- **Swipebare carrousel** met de vijf koekjes; één tik op de plusknop legt er een in je
  doos, met een teller op de kaart en (op de telefoon) een korte trilling.
- **Spaarring** in plaats van een balk: een cirkel die vult tot vijf, waarna je gratis
  koekje verschijnt en je de smaak kiest.
- **Verhaalkaartjes** — vier tegels in stories-formaat over het deeg, de ingrediënten,
  de bezorging en de oplage.
- **Profielkaart van Zara** met haar cijfers en knoppen voor Instagram, TikTok en delen
  (gebruikt het deelvenster van de telefoon zelf).
- **Reviews als chatbubbels**, zoals ze binnenkomen na een bezorging.
- **Bestellen in een bottom sheet**: aantallen aanpassen, gegevens invullen, versturen
  naar WhatsApp of e-mail. De doos wordt onthouden tussen bezoeken.
- **Aftelpil** bovenin die laat zien hoe lang het nog duurt tot de bakdag.

---

## Aanpassen

Zelfde instellingenblok bovenaan het script als in de andere twee concepten:

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

**Nog invullen:** WhatsApp-nummer, e-mail, stad, en de echte links voor Instagram en
TikTok (die knoppen tonen nu een melding). De chatberichten zijn voorbeeldteksten.

Koekjes wijzig je in de lijst `KOEKJES`. Per koekje staan vier kleuren: `licht`, `deeg`
en `donker` voor het verloop van het koekje, en `brok` voor de chocolade.
