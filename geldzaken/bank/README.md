# Je bank rechtstreeks uitlezen

Hiermee haalt Geldzaken je bankafschrift zelf op, in plaats van dat jij elke
maand een bestand downloadt. Het werkt met **Enable Banking**, dat één API voor
ruim 2500 Europese banken biedt — Rabobank, ING en ABN AMRO daaronder.

Opzetten kost een half uurtje. Daarna hoef je er een half jaar niet meer naar om
te kijken.

---

## Waarom hier een apart dienstje voor nodig is

Enable Banking wil een JWT dat ondertekend is met een RSA-privésleutel. Hun eigen
documentatie zegt erbij: *"keep the private key in secret (e.g. don't expose it
to client)"*.

Geldzaken is een map met bestanden in een openbare repo. Alles wat daarin staat
is door iedereen te lezen. Die sleutel kan daar dus niet in. Vandaar dit stukje:
het draait bij Cloudflare, alleen jij kent de sleutel, en de app praat ermee via
een woord dat jullie samen afspreken.

**Wat de dienst wel doet:** een token ondertekenen, bij Enable Banking ophalen wat
jij vraagt, en het antwoord doorgeven.

**Wat hij niet doet:**

- niets opslaan — geen database, geen bestanden, geen logboek met bedragen of
  namen. Je sessie bij de bank staat in de app, op jouw apparaat, en gaat bij elk
  verzoek mee.
- niets betalen — er zit geen enkel pad in dat een overboeking kan doen, hoe de
  API dat ook toestaat.
- niemand anders te woord staan — alleen jouw app-adres krijgt antwoord, en
  alleen met het afgesproken woord erbij.

---

## 1. Eerst de dienst neerzetten

Dit moet als eerste, want je hebt het adres ervan nodig bij Enable Banking.

Je hebt een gratis Cloudflare-account nodig, zonder creditcard. Er zijn twee wegen;
de eerste vraagt niets van je computer.

**Via de website (geen installatie nodig)**

1. Maak een account op [dash.cloudflare.com](https://dash.cloudflare.com) en ga naar
   **Compute (Workers)** → **Create** → **Start with Hello World** → **Deploy**.
   Noem hem `geldzaken-bank`. De eerste keer vraagt Cloudflare je een naam voor je
   `workers.dev`-adres te kiezen; die mag je zelf verzinnen.
2. Klik op **Edit code**, gooi alles weg wat erin staat, en plak de volledige inhoud van
   [`worker.js`](worker.js) erin. Dat is één bestand zonder afhankelijkheden, dus meer is
   er niet. **Deploy.**
3. Bovenin staat nu het adres, iets als
   `https://geldzaken-bank.jouwnaam.workers.dev`. **Schrijf dat op.**

Open het adres eens in je browser. Je hoort `{"fout":"Dit adres mag hier niet bij."}` te
zien — dat is goed nieuws: hij draait, en hij laat je browser er niet bij.

**Via de opdrachtregel (als je Node al hebt)**

```sh
cd geldzaken/bank
npx wrangler login
npx wrangler deploy
```

---

## 2. Verzin een woord

Een lang, willekeurig woord dat alleen jij kent:

```sh
openssl rand -base64 32
```

Geen zin in een opdrachtregel? Elk willekeurig wachtwoord van twintig tekens of meer
voldoet, als je het maar nergens anders gebruikt. Dit is wat de dienst en de app aan
elkaar herkent.

---

## 3. Enable Banking

1. Maak een account op [enablebanking.com](https://enablebanking.com) en ga naar het
   Control Panel, naar **Applications**.
2. **Add a new application**, en kies **Production**. Let op: sandbox en productie zijn
   niet uitwisselbaar — een sandbox-app kun je later niet omzetten, en met je echte
   Rabobank heb je productie nodig.
3. Vul in:
   - **Name** — bijvoorbeeld `Geldzaken`.
   - **Redirect URLs** — hier komt het adres van je dienst met `/klaar` erachter:
     `https://geldzaken-bank.jouwnaam.workers.dev/klaar`
     Dit is de stap waar het misgaat als je hem vergeet: Enable Banking weigert dan
     het inloggen met `REDIRECT_URI_NOT_ALLOWED`.
   - **Description, data protection email, privacy policy URL, terms of service URL** —
     productie-registratie vraagt hier om, ook als je de app alleen voor jezelf gebruikt.
     Volgens hun eigen FAQ wordt er in deze modus niet op gecontroleerd, dus iets
     redelijks volstaat; je eigen e-mailadres en de link naar deze repo bijvoorbeeld.
4. Je browser maakt bij het aanmaken een **privésleutel** en zet die in je downloadmap,
   als `<app-id>.pem`. **Bewaar dat bestand goed — je krijgt hem niet opnieuw.**
5. Noteer het **Application ID**.

Zet de sleutel zo nodig om naar de vorm die Workers kan lezen:

```sh
openssl pkcs8 -topk8 -nocrypt -in <app-id>.pem -out sleutel.pk8.pem
```

Begint je bestand met `-----BEGIN PRIVATE KEY-----`, dan is het al goed. Staat er
`BEGIN RSA PRIVATE KEY`, dan heb je die regel nodig. De dienst zegt het trouwens ook
gewoon als het de verkeerde vorm is.

---

## 4. Je rekening koppelen bij Enable Banking

Je nieuwe app staat op **Inactive**. Klik op **Activate by linking accounts**. Je gaat
dan langs Enable Banking's eigen toestemmingsscherm, daarna naar je bank, en autoriseert
daar de toegang. Daarna staat de app op **Active** in *restricted mode*: hij kan
uitsluitend bij rekeningen die jij zo hebt gekoppeld.

Koppel elke rekening die je wilt gebruiken. Autoriseer je later een rekening die hier
niet bij zat, dan krijgt de app een lege lijst terug.

---

## 5. De vier instellingen in de dienst

Terug bij Cloudflare, bij je Worker: **Settings** → **Variables and Secrets** →
**Add**, type **Secret**. Vier stuks:

| Naam | Waarde |
|---|---|
| `EB_APP_ID` | het Application ID uit stap 3 |
| `EB_SLEUTEL` | de hele inhoud van je `.pem`-bestand, inclusief de `-----BEGIN`- en `-----END`-regels |
| `GELDZAKEN_WOORD` | het woord uit stap 2 |
| `HERKOMST` | het adres waarop jouw Geldzaken draait, bijvoorbeeld `https://jouwnaam.github.io` |

`HERKOMST` is alléén het begin van het adres: geen pad erachter, geen schuine streep aan
het eind. Meerdere adressen scheid je met een komma, bijvoorbeeld als je ook lokaal wilt
testen: `https://jouwnaam.github.io,http://127.0.0.1:8123`

Met de opdrachtregel gaat hetzelfde zo:

```sh
npx wrangler secret put EB_APP_ID
npx wrangler secret put EB_SLEUTEL
npx wrangler secret put GELDZAKEN_WOORD
npx wrangler secret put HERKOMST
```

---

## 6. In de app

Ga naar **⚙️ → Je bank** en vul in:

- het adres van je dienst
- hetzelfde woord

Tik op **Verbinding testen**. Gaat dat goed, dan **Rekening koppelen**: je kiest
je bank, logt in met de app van je bank, en komt terug in Geldzaken.

Daarna staat er bij **Bankbestand inlezen** een knop **Transacties ophalen**. Wat
binnenkomt gaat eerst naar het nakijkscherm — pas als jij op *Toevoegen* drukt
staat het in je boekhouding.

Deze gegevens staan **alleen op dit apparaat**. Ze gaan niet mee naar de cloud,
ook niet als je Geldzaken met Firebase gebruikt. Op je telefoon vul je ze dus
opnieuw in.

---

## Vrij vragen met Claude (optioneel)

In de app zit een vraagbalk (💬 rechtsboven) die je gegevens doorzoekt **op je eigen
apparaat**: direct, gratis, offline, en er verlaat geen cijfer je telefoon. Dat vangt de
gewone vragen af — uitgaven per potje, wat er nog over is, waar je geld heen gaat, je
inkomen, je spaardoelen, je budget.

Wil je ook vragen kunnen stellen die ik niet heb voorzien, dan kan de app ze doorgeven
aan Claude. Dat gaat via dezelfde dienst, met jouw eigen sleutel:

```sh
npx wrangler secret put CLAUDE_SLEUTEL      # een sleutel van console.anthropic.com
```

Zet het daarna aan onder **⚙️ → Je bank → Vrij vragen met Claude**. Zonder sleutel
bestaat dat pad niet: de dienst weigert de vraag gewoon.

**Wat er dan wordt verstuurd:** een samenvatting in cijfers. Je inkomen, per potje het
maandbedrag en wat eruit ging, je spaarsaldo's, je doelen, en hoeveel boekingen je nog
niet hebt ingedeeld. **Niet** je losse boekingen, niet de namen van winkels, niet je
rekeningnummers. Je kunt precies nalezen wat eroverheen gaat in `samenvatting()` in
`js/vraag.js`.

Staat het uit, dan zegt de vraagbalk bij een onbekende vraag gewoon dat hij het niet
weet. Er wordt dan niets verstuurd.

Kosten zijn een paar cent per vraag, rechtstreeks bij Anthropic op jouw account.

---

## Wat je mag verwachten

| | |
|---|---|
| **Hoe vaak** | De meeste banken staan ongeveer vier ophaalrondes per dag toe zonder dat jij erbij bent. Dit is geen live-koppeling; je haalt op wanneer je wil. |
| **Hoe lang** | De toestemming geldt bij de meeste banken 180 dagen. Daarna moet je opnieuw inloggen bij je bank — een wettelijke eis, daar komt niemand onderuit. De app waarschuwt twee weken van tevoren. |
| **Hoe ver terug** | De eerste ronde pakt zoveel historie als je bank geeft. Daarna beperken de meeste banken het tot de laatste 90 dagen. Ruim genoeg, want je haalt regelmatig op. |
| **Dubbel** | Elke boeking komt met een kenmerk van de bank zelf. Daarop herkent de app wat er al in staat, dus ophalen kan geen kwaad. |

---

## Problemen

**"De bankdienst is niet bereikbaar"** — het adres klopt niet, of de dienst staat
er nog niet. Open het adres eens in je browser: je hoort `{"fout":"Dit adres mag
hier niet bij."}` te zien, want je browser is dan geen bekende herkomst. Dat is
goed nieuws: hij draait.

**"Het woord klopt niet met dat van de dienst"** — controleer `GELDZAKEN_WOORD`.
Let op spaties aan het eind bij het plakken.

**"De dienst laat dit adres niet toe"** — `HERKOMST` komt niet overeen met het
adres waarop je de app opent. Het moet exact hetzelfde zijn, inclusief `https://`
en zonder schuine streep aan het eind.

**"De toestemming bij je bank is verlopen"** — koppel opnieuw onder ⚙️ → Je bank.

**"Je bank staat even geen nieuwe ophaalronde toe"** — je zit aan de limiet van je
bank. Een paar uur wachten.

**Een fout over de privésleutel** — die staat waarschijnlijk nog in de oude vorm.
Zie de `openssl`-regel in stap 3.

**`REDIRECT_URI_NOT_ALLOWED` of een foutmelding bij het inloggen bij je bank** — het
terugkeeradres staat niet (of niet precies zo) bij je Enable Banking-app. Het moet exact
`https://<jouw-dienst>/klaar` zijn. Je kunt het in het Control Panel alsnog bijzetten via
**Edit** bij je applicatie.

**De bank accepteert de taal niet** — de dienst vraagt om Nederlands (`language: "nl"`).
Documentatie noemt geen lijst van ondersteunde talen. Klaagt je bank hierover, haal dan
de regel `language: "nl",` uit `worker.js` en zet hem opnieuw neer.

---

## De stekker eruit

In de app: **⚙️ → Je bank → Koppeling verbreken**. Dat trekt de toestemming bij je
bank in.

De dienst helemaal weghalen:

```sh
npx wrangler delete
```

En in het Enable Banking Control Panel kun je de applicatie verwijderen. Wat je al
had opgehaald blijft gewoon in Geldzaken staan: dat is van jou.
