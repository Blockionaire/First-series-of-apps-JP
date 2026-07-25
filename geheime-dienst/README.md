# 🕵️ Geheime Dienst — Camping App

De officiële app voor **Geheime Dienst: Real life edition** (Camping Vell Emporda).

**Wat kan de app?**

- 📝 Spelers melden zich aan met hun naam
- 🎩 De spelleider ziet alle deelnemers en deelt de rollen uit (met advies-verdeling per aantal spelers)
- 🎭 Spelers zien hun geheime rolkaart zodra de spelleider de rollen "onthult"
- 💬 Chat: privéchat spelleider ↔ speler, zelf groepschats aanmaken (bijv. Infiltranten, Gevangenen) én een groepschat met iedereen
- 📋 Opdrachten: de spelleider stuurt een opdracht in een groepschat, spelers uploaden foto's als bewijs en dienen de opdracht in, de spelleider keurt goed of af
- ⏰ Deadlines met afteltimer (met snelknoppen voor 11:00 missie-deadline en 22:30 avondbijeenkomst)
- 📖 Alle spelregels, rollen en de dagplanning uit de flyer zitten in de app

---

## 1. Direct uitproberen (demo-modus)

Open `index.html` in je browser. Zolang Firebase nog niet gekoppeld is, draait de app in **demo-modus**: alles werkt, maar alleen op jouw apparaat. Handig om even te klikken en te kijken.

> Tip: in demo-modus kun je via **Info → Uitloggen** wisselen tussen spelers en de spelleider.

**Standaard pincode spelleider: `1107`** (verander deze in `firebase-config.js`!)

---

## 2. Samen spelen: Firebase koppelen (±10 minuten, gratis)

Om met de hele camping te spelen heeft de app een gedeelde database nodig. Dat regelen we met Firebase (gratis dienst van Google, geen creditcard nodig):

1. Ga naar **https://console.firebase.google.com** en log in met een Google-account
2. Klik **Project toevoegen** → naam bijv. `geheime-dienst` → Google Analytics mag uit → **Project maken**
3. In het linkermenu: **Build → Firestore Database** → **Database maken**
   - Locatie: `eur3 (europe-west)`
   - Kies **Testmodus** (open regels) → **Inschakelen**
4. Ga naar **Firestore → Regels** en plak dit (30 dagen-limiet van testmodus omzeilen — zet de datum ruim ná jullie vakantie):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.time < timestamp.date(2026, 12, 31);
       }
     }
   }
   ```
   Klik **Publiceren**.
5. Klik op het ⚙️ tandwiel → **Projectinstellingen** → scroll naar **Jouw apps** → klik het web-icoon **`</>`** → app-naam bijv. `geheime-dienst` → **App registreren**
6. Je ziet nu een blok `const firebaseConfig = { ... }`. Kopieer alleen het gedeelte tussen de accolades
7. Open **`firebase-config.js`** in deze map en vervang `firebase: null` door jouw config:
   ```js
   firebase: {
     apiKey: "AIza....",
     authDomain: "geheime-dienst-xxxx.firebaseapp.com",
     projectId: "geheime-dienst-xxxx",
     storageBucket: "geheime-dienst-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   },
   ```
8. Verander in hetzelfde bestand ook de **spelleiderPin** in een eigen geheime code

Klaar! De gele demo-balk verdwijnt en iedereen die de app opent, speelt nu in hetzelfde spel.

> **Let op:** de spelregels van Firestore staan hiermee open — prima voor een besloten campingspel, maar deel de link alleen met je spelersgroep. Foto's worden automatisch verkleind en in de database opgeslagen, dus een aparte (betaalde) foto-opslag is niet nodig.

---

## 3. Live zetten voor iedereen

De app is een statische website, dus hosten is gratis. Twee opties:

### Optie A — GitHub Pages (aanrader, automatische updates)

1. Zorg dat deze map (met jouw ingevulde `firebase-config.js`) op de **main**-branch staat
2. Ga op GitHub naar je repository → **Settings → Pages**
3. Bij *Source*: kies **Deploy from a branch** → branch `main` → map `/ (root)` → **Save**
4. Na een minuut is de app live op:
   `https://<jouw-gebruikersnaam>.github.io/<repo-naam>/geheime-dienst/`

> GitHub Pages is gratis voor openbare repositories. Is je repository privé, gebruik dan optie B.

### Optie B — Netlify Drop (simpelst, 1 minuut)

1. Ga naar **https://app.netlify.com/drop**
2. Sleep de map `geheime-dienst` in het venster
3. Je krijgt direct een link zoals `https://xyz.netlify.app` — deel die met de groep

**Tip:** laat iedereen de link openen op hun telefoon en via *"Zet op beginscherm"* toevoegen — dan voelt het als een echte app.

---

## 4. Spelverloop in de app (spiekbriefje spelleider)

1. **Vooraf:** deel de link, iedereen meldt zich aan met zijn/haar naam
2. **Rollen:** tab *Spelers* → wijs per speler een rol toe (de app toont het advies uit de flyer) → zet daarna de schakelaar **"Rollen zichtbaar voor spelers"** aan
3. **Groepen:** tab *Chats* → *Nieuwe groepschat* → knop **"Alle infiltranten"** selecteert automatisch iedereen met de rol infiltrant. Maak later op dezelfde manier een groep *Gevangenen*
4. **Opdrachten:** open de infiltranten-chat → 📋-knop → titel + omschrijving + deadline → infiltranten uploaden foto's en dienen in → jij keurt goed of af (alles zichtbaar in de chat)
5. **Deadlines:** tab *Deadlines* → snelknoppen voor *Missie doorgeven 11:00* en *Avondbijeenkomst 22:30* — elke nieuwe deadline wordt automatisch in de groepschat "Iedereen" aangekondigd
6. **Status:** wordt iemand gevangengenomen of weggestemd? Pas de status aan in het tabblad *Spelers* (gevangenen zien dan automatisch de ontsnappings-uitleg bij hun rolkaart)

Veel plezier op de camping! 🏕️
