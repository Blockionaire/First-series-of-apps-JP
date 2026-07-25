# 🕵️ Geheime Dienst — Camping App

De officiële app voor **Geheime Dienst: Real life edition** (Camping Vell Emporda).

**🔗 De app staat live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/geheime-dienst-final/

**Pincode spelleider: `1602`** (aan te passen in `firebase-config.js`)

> Tip voor iedereen: open de link op je telefoon en kies *"Zet op beginscherm"* — dan staat Geheime Dienst als echte app tussen je andere apps.

---

## Wat kan de app?

**Voor iedereen**
- Aanmelden met je naam; de app onthoudt je op je telefoon (je naam is gekoppeld aan je apparaat, dus niemand kan jouw account kapen)
- **Eigen pincode van 4 cijfers** (ook voor de spelleider): die kies en bevestig je bij je eerste aanmelding en voer je daarna bij elke keer openen in. Handig als je een telefoon deelt — je partner ziet jouw rol en chats niet. Wijzigen kan via ⚙️ → *Pincode wijzigen*
- Je geheime rolkaart met de officiële kaartafbeelding en de volledige rolbeschrijving
- Chats: de groepschat met iedereen, automatische groepschats (infiltranten, gevangenen) en een privéchat met de spelleider
- Recap op de tab *Spelers*: welke speeldag het is (1, 2 of de finaledag) plus het aantal spelers, gevangenen en verbannen spelers — het aantal infiltranten blijft geheim en ziet alleen de spelleider
- Deadlines met afteltimer
- Alle spelregels, rollen, dagplanning en de avondbijeenkomst-volgorde uit de flyer
- Donker of licht thema via ⚙️ rechtsboven

**Rol-specifiek**
- 🕵️ **Infiltranten** — stemmen samen op de missie van de dag, leveren foto's als bewijs en dienen de opdracht in
- 💻 **Hacker** — stelt maximaal 2 ja/nee-vragen per dag; de spelleider antwoordt met één tik
- ⛓️ **Gevangenen** — krijgen een foto van het geheime voorwerp; wie als eerste een goedgekeurde selfie mét het voorwerp instuurt, ontsnapt en keert terug als gewone gelovige
- 🛡️ **Iedereen** — raadsels om het schild: de eerste met het goede antwoord wint (1 poging per 5 minuten)
- 🙋 Liever een andere rol? Dien een verzoek in bij de spelleider

**Voor de spelleider**
- Recap bovenaan de tab *Spelers*: de speeldag (tik op 1, 2 of 3 — dag 3 is de finaledag) met daaronder het aantal spelers, infiltranten en gevangenen
- Deelnemers beheren: rollen uitdelen (met de adviesverdeling uit de flyer) en status wijzigen (actief, gevangen, ontmaskerd, uit het spel)
- Rollen in één keer onthullen — de infiltranten-groepschat wordt dan automatisch aangemaakt
- Rolverzoeken goedkeuren (met nieuwe rol), afwijzen, of andere spelers vragen de rol over te nemen
- Vergeten pincodes: wie zijn code kwijt is vraagt toestemming, jij keurt goed of wijst af
- Opdrachten versturen en ingediende bewijzen goedkeuren of afwijzen
- Missiestemmingen als checklist versturen; de meerderheid wordt automatisch de opdracht van de dag
- Raadsels en dagrapporten versturen of inplannen (worden automatisch gepusht)
- Zoekopdracht met foto van het geheime voorwerp in de gevangenen-chat
- Spel beëindigen met winnaarsscherm en onthulling van alle rollen
- Spel resetten na een testronde (⚙️ → Instellingen)

---

## Spelverloop in de app (spiekbriefje spelleider)

1. **Vooraf** — deel de link, iedereen meldt zich aan met zijn/haar naam
2. **Rollen** — tab *Spelers* → wijs per speler een rol toe → zet de schakelaar **"Rollen zichtbaar voor spelers"** aan. De infiltranten-chat ontstaat automatisch
3. **Dagelijks** — stuur 's ochtends de missielijst (🗳️) in de infiltranten-chat; de meerderheid bepaalt de missie en die wordt meteen een opdracht met foto-bewijs
4. **Gevangenen** — zet spelers op *Gevangen*; de gevangenen-chat ontstaat automatisch. Stuur daar met 🔎 de foto van het geheime voorwerp
5. **Het schild** — stuur met 🛡️ in de Iedereen-chat een raadsel met geheim antwoord (direct of ingepland)
6. **Einde van de dag** — stel het dagrapport op (tab *Spelers*): wie eruit ligt, hoofdverdachte, missie gehaald. Plan het in op 23:00 en het wordt automatisch gepusht
7. **Afsluiten** — ⚙️ → *Spel beëindigen* → kies de winnaar; iedereen ziet de uitslag en alle rollen

---

## Technisch

- De app is één losse webpagina (`index.html`) zonder installatie of build-stap
- **Hosting:** GitHub Pages, direct vanuit deze repository — elke wijziging die naar de branch wordt gepusht staat binnen een minuut live
- **Database:** Firebase Firestore (gratis Spark-plan), geconfigureerd in `firebase-config.js`
- Foto's worden in de browser verkleind (max ~1280px) en in de database opgeslagen, dus aparte foto-opslag is niet nodig
- Zonder Firebase-configuratie draait de app automatisch in **demo-modus**: alles werkt, maar alleen op één apparaat

### Instellingen aanpassen

Alles wat je zou willen wijzigen staat bovenin `firebase-config.js`: de pincode van de spelleider, de spelnaam en de ondertitel.

### Beveiliging

De Firestore-regels staan open tot en met 31 december 2026 — prima voor een besloten campingspel, maar deel de link alleen binnen je spelersgroep. De Firebase-sleutel in `firebase-config.js` hoort openbaar te zijn bij een web-app en is geen wachtwoord.

Pincodes worden nooit als leesbare cijfers opgeslagen: van de code + je naam wordt een SHA-256-hash gemaakt en alleen die hash gaat de database in. De pincode is bedoeld tegen meekijkende medespelers op een gedeelde telefoon, niet tegen iemand die de database zelf openbreekt.

De spelleider heeft twee losse codes: de **spelleiderscode** (`1602`) om het spelleidersaccount te claimen op het aanmeldscherm, en een **eigen pincode** die net als bij spelers bij het openen van de app gevraagd wordt.

**Pincode vergeten?** Die knop staat op ieders slotscherm, maar werkt per rol anders:
- **Spelers** sturen een verzoek naar de spelleider. Die krijgt een melding (teller op de tab *Spelers*) en keurt goed of wijst af. Pas na goedkeuring mag de speler een nieuwe pincode kiezen — bij afwijzing blijft de oude gelden.
- **De spelleider** stelt zelf een nieuwe in met de spelleiderscode, want die kan het aan niemand vragen.

Veel plezier op de camping! 🏕️
