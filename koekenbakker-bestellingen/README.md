# 📋 Bestellingen — de portal van De Koekenbakker

De werkkant van de webshop: hier komen alle bestellingen live binnen, staat het bakbriefje
voor de week, en zet je het baklimiet. Alleen Zara komt erin.

**🔗 Live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/koekenbakker-bestellingen/

De webshop zelf staat in [`koekenbakker/`](../koekenbakker/). Ze praten met hetzelfde
Firebase-project.

---

## Wat je ziet

### Deze week
- **Baklimiet** — hoeveel koekjes er deze week besteld zijn, tegen het limiet dat je zelf
  zet. De webshop kijkt naar ditzelfde getal en zet de bestelknop op slot als de week vol is.
- **Bakbriefje** — het belangrijkste scherm: per smaak opgeteld wat er de oven in moet,
  over alle bestellingen van de week heen. Verrassingsboxen en gratis koekjes staan apart
  als "zelf uitkiezen", want daar bepaal jij de smaak.
- **Afhalen en bezorgen** — wie wanneer langskomt, gegroepeerd per tijdslot, en de
  bezorgadressen bij elkaar.

### Bestellingen
Alle bestellingen van de week, nieuwste eerst, met een filter per status. Tik een
bestelling open en je ziet de regels, het contactgegeven (met knoppen om te bellen, te
appen of te mailen), het afhaalmoment of adres en de opmerking.

Een bestelling loopt langs vier stappen: **nieuw → bevestigd → gebakken → afgerond**.
Annuleren kan altijd; het aantal koekjes gaat dan automatisch weer van de weekteller af.

### Instellingen
Het baklimiet voor deze week, en een knop om bestellingen te sluiten — dan zegt de webshop
dat de week vol zit. Nam je een bestelling buiten de site om aan, dan kun je de teller met
de hand bijstellen.

De weken staan los van elkaar: met de pijltjes bovenin blader je naar de vorige of
volgende week, inclusief de bestellingen en het limiet van die week.

---

## Zo zet je het aan

Je hebt één Firebase-project nodig voor de webshop én de portal. Gratis, en ruim binnen de
gratis grens bij dit soort aantallen.

1. **Project maken** — ga naar [console.firebase.google.com](https://console.firebase.google.com),
   maak een project (bijvoorbeeld `de-koekenbakker`). Google Analytics mag je uitzetten.
2. **Web-app toevoegen** — klik op het `</>`-icoontje, geef de app een naam en kopieer het
   `firebaseConfig`-blok dat je krijgt.
3. **Config invullen** — plak dat blok in **twee** bestanden, op de plek waar nu `null`
   staat: [`../koekenbakker/firebase-config.js`](../koekenbakker/firebase-config.js) en
   [`firebase-config.js`](firebase-config.js) hiernaast. Zorg dat `ruimte` in beide
   hetzelfde woord is.
4. **Inloggen aanzetten** — Console → Build → Authentication → Get started →
   *E-mail/wachtwoord* aanzetten. Voeg daarna onder *Users* je eigen account toe met een
   e-mailadres en wachtwoord. Daarmee log je in de portal in.
5. **Database maken** — Console → Build → Firestore Database → Create database →
   productiemodus, regio `europe-west` (bijvoorbeeld België of Frankfurt).
6. **Regels plakken** — open [`firestore.rules`](firestore.rules), zet je eigen e-mailadres
   in `bakkerMails()`, en plak het hele bestand in Console → Firestore → Rules → Publish.

Klaar. Vanaf dan wordt elke bestelling opgeslagen, telt het weeklimiet vanzelf mee over
alle klanten heen, en zie je alles hier binnenkomen.

> De sleutel in `firebase-config.js` hoort openbaar te zijn bij een web-app — dat is geen
> wachtwoord. Wat je gegevens beschermt zijn de regels uit `firestore.rules`: die zorgen
> dat een klant wél een bestelling kan plaatsen, maar die van een ander nooit kan lezen.

---

## Hoe het onder water werkt

Twee laatjes in Firestore, allebei onder `koekenbakker/<ruimte>/`:

| Waar | Wat erin staat | Wie mag wat |
|---|---|---|
| `bestellingen/{id}` | naam, contact, regels, aantal, bedrag, levering, moment of adres, opmerking, status | iedereen mag er één **aanmaken**; alleen jij mag lezen en wijzigen |
| `weken/{2026-W39}` | `besteld`, `limiet`, `open` | iedereen mag **lezen** (alleen aantallen, geen klantgegevens) en de teller ophogen; alleen jij mag de rest zetten |

De webshop hoogt bij een bestelling de weekteller op met het aantal koekjes. De regels
staan toe dat die teller alleen omhoog gaat, met maximaal 40 tegelijk — zo kan niemand hem
leegtrekken of het limiet veranderen.

---

## Wat je moet weten

- **Spam is mogelijk.** Iedereen kan een bestelling aanmaken; dat hoort ook zo, anders kan
  een klant niets bestellen. Komt er onzin binnen, dan gooi je die hier weg en corrigeer je
  de teller. Wordt het een probleem, dan is Firebase App Check de volgende stap.
- **Er is geen melding op je telefoon.** De portal ververst zichzelf live zolang hij
  openstaat, maar hij port je niet. Daarom stuurt de webshop de klant nog steeds langs
  WhatsApp of e-mail — dat berichtje is je seintje. Wil je echte pushberichten, dan kan dat
  later met dezelfde opzet als de app `geheime-dienst` in deze repo.
- **Betalen gaat buiten de site om**, bij het afhalen of bezorgen.
