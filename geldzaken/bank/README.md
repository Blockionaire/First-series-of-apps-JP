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

## 1. Enable Banking

1. Maak een account op [enablebanking.com](https://enablebanking.com) en ga naar
   het Control Panel.
2. Registreer een applicatie in de **productie**-omgeving. Je browser maakt dan
   een privésleutel aan en zet die in je downloadmap, als `<app-id>.pem`.
   **Bewaar dat bestand goed — je krijgt hem niet opnieuw.**
3. Noteer het **Application ID**.
4. Koppel je eigen rekening onder **"Activate by linking accounts"**. Zonder dat
   blijft de applicatie inactief. Hiermee wordt het een *restricted* applicatie:
   hij kan uitsluitend bij rekeningen die jij zelf hebt gekoppeld. Precies wat je
   wil, en het is de route die Enable Banking aanwijst voor *"individual
   non-commercial use"*.

Zet de sleutel zo nodig om naar de vorm die browsers en Workers kunnen lezen:

```sh
openssl pkcs8 -topk8 -nocrypt -in <app-id>.pem -out sleutel.pk8.pem
```

Begint je bestand met `-----BEGIN PRIVATE KEY-----`, dan is het al goed.
Staat er `BEGIN RSA PRIVATE KEY`, dan heb je bovenstaande regel nodig.

---

## 2. Verzin een woord

Een lang, willekeurig woord dat alleen jij kent. Bijvoorbeeld:

```sh
openssl rand -base64 32
```

Dit is wat de dienst en de app aan elkaar herkent. Zonder dit woord krijgt niemand
iets te zien.

---

## 3. De dienst neerzetten

Je hebt een (gratis) Cloudflare-account nodig. Geen creditcard.

```sh
cd geldzaken/bank
npx wrangler login
npx wrangler deploy
```

Daarna de vier instellingen erin. De eerste drie zijn geheim:

```sh
npx wrangler secret put EB_APP_ID          # het Application ID
npx wrangler secret put EB_SLEUTEL         # de hele inhoud van sleutel.pk8.pem
npx wrangler secret put GELDZAKEN_WOORD    # het woord uit stap 2
npx wrangler secret put HERKOMST           # https://jouwnaam.github.io
```

`HERKOMST` is het adres waarop jouw Geldzaken draait — alleen het begin, dus
zónder pad. Meerdere adressen scheid je met een komma, bijvoorbeeld als je ook
lokaal wilt testen:

```
https://jouwnaam.github.io,http://127.0.0.1:8123
```

Na `wrangler deploy` krijg je het adres van je dienst te zien, zoiets als
`https://geldzaken-bank.jouwnaam.workers.dev`.

---

## 4. In de app

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
Zie de `openssl`-regel in stap 1.

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
