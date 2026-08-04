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
- Chats: de groepschat met iedereen, automatische groepschats (infiltranten, gevangenen) en een privéchat met de spelleider — het laatst gebruikte gesprek staat bovenaan, met de groepen altijd boven de privéchats
- Recap op de tab *Spelers*: welke speeldag het is (1, 2 of de finaledag) plus het aantal spelers, gevangenen en verbannen spelers — het aantal infiltranten blijft geheim en ziet alleen de spelleider. **Tik op een tegel** en de lijst eronder toont alleen die groep: alle spelers die nog meedoen (met de gevangenen erbij, gemarkeerd), alleen de gevangenen, of alleen wie eruit ligt. Nog eens tikken of *Toon alles* brengt je terug
- Deadlines met afteltimer — je ziet alleen de deadlines van de chats waar je in zit
- Alle spelregels, rollen, dagplanning en de avondbijeenkomst-volgorde uit de flyer
- Foto's uit de chat bewaren: tik de foto aan en kies 💾 Bewaren
- Reageren met een emoji: houd een bericht ingedrukt en kies er een. Tik op een reactie om die van jezelf weer weg te halen
- 🔍 Zoeken in een chat: tik het vergrootglas bovenin aan, typ waar je naar zoekt en spring met één tik naar dat bericht
- 🌙 Nachtstand: zet de spelleider die aan, dan krijg je in elke chat een groot nachtscherm — *De nacht is van de infiltranten, slaap lekker!* Alleen de infiltranten kunnen dan nog overleggen
- 🔔 **Meldingen** (⚙️ → *Meldingen aanzetten*): een seintje bij een nieuw bericht, een verzoek of een antwoord van de spelleider. De melding is **altijd anoniem** — geen naam, geen inhoud, niet eens in welke chat het staat, dus meekijkers worden er niets wijzer van. Word je met `@` genoemd, dan krijg je *Iemand heeft je genoemd*: wél dringender, nog steeds zonder namen
- 🎬 **Filmpjes** kunnen overal waar een foto kan: in de chat, als bewijs bij een opdracht en als inzending bij een zoekopdracht. Een filmpje tot ongeveer 6 MB gaat er ongewijzigd in — meteen klaar, met geluid en in de originele kwaliteit. Is het groter, dan wordt het eerst verkleind (max 30 seconden); dat duurt ongeveer zo lang als het filmpje zelf en gaat zonder geluid. In een lijst zie je alleen een miniatuur met een afspeelknop — het filmpje zelf wordt pas opgehaald als je erop tikt
- 📣 **Iemand noemen met @**: typ `@` in een chat en je krijgt een lijstje met de mensen in dat gesprek; kies er een en zijn naam komt in je bericht te staan, opgelicht. Word je zelf genoemd, dan zie je dat op drie plekken: een balk bovenaan je chatlijst (*Sanne noemde je in Iedereen* — tik erop en je springt naar het bericht), een blauw `@` bij die chat in de lijst, en een aparte melding op je telefoon. Zodra je de chat opent verdwijnt het vanzelf. Namen die op elkaar lijken gaan goed: `@Tim` raakt Timo niet
- ✍️ **"… is aan het typen"** in de chatkop, net als in WhatsApp. Bij twee mensen staat er "Sanne en Tim zijn aan het typen", vanaf drie wordt het geteld. De melding verdwijnt vanzelf zodra iemand stopt of zijn app wegklikt. In een privéchat blijft de spelleider "de spelleider". Let op: in een spel als dit is dit een echte tell — je ziet iemand beginnen te typen en weer stoppen
- Loopt er een opdracht in een chat? Dan staat de **opdracht van vandaag** met status (en afteller) vast bovenaan die chat — hoe ver je ook terugscrolt. Eén tik erop opent de opdracht. Zodra de spelleider hem goedkeurt verdwijnt de balk
- Bij elke stemming (missiestemming, peiling, verleiden) staat onder de kaart **“wie stemde wat?”** — je ziet per keuze wie erop gestemd heeft en wie er nog moet. Alleen bij een anonieme peiling blijft dat verborgen
- Peilingen van de spelleider: tik je antwoord aan (soms mag je er meer kiezen), wijzig je stem zolang de peiling open staat en zie bij een niet-anonieme peiling wie wat stemde
- 🔎 **Mijn verdenkingen** (eigen tabblad, alleen voor spelers): zet bij elke medespeler een oordeel — 🟢 vertrouw ik, 🟡 twijfel, 🟠 verdacht, 🔴 zeker weten — en schrijf erbij wat je opviel. De lijst zet je zwaarste verdenkingen bovenaan, zodat je met een scherp verhaal de avondbijeenkomst in gaat. **Alleen jij ziet dit**: de app haalt uitsluitend jouw eigen aantekeningen op en toont ze nergens anders, ook niet aan de spelleider
- 🏁 **Eindkaart** na afloop: een poster met alle statistieken en alle rollen, om te bewaren of als opgemaakte tekst in WhatsApp te plakken
- Donker of licht thema via ⚙️ rechtsboven. Beide thema's zijn nagemeten: alle tekst haalt minstens 3:1 contrast, de meeste ruim 4,5:1. Gekleurde tekst (goud, groen, rood) wordt in het lichte thema automatisch donkerder gezet, en de kaarten die bewust donker blijven — rolkaart, dagrapport, nachtscherm — houden daar juist lichte letters

**Rol-specifiek**
- 🕵️ **Infiltranten** — stemmen samen op de missie van de dag, leveren foto's of filmpjes als bewijs en dienen de opdracht in. Stuurt de spelleider de nachtkeuze, dan stemmen ze ook over 🙈 verleiden of ⛓️ gevangennemen
- 💻 **Hacker** — stelt maximaal 2 ja/nee-vragen per dag, alleen tussen 11:00 en 22:00; buiten dat tijdvak is het formulier op slot. De spelleider antwoordt met één tik, of wijst de vraag af met een korte uitleg waarom — een afgewezen vraag telt niet mee, dus je krijgt hem terug
- ⛓️ **Gevangenen** — krijgen een foto van het geheime voorwerp; wie als eerste een goedgekeurde selfie mét het voorwerp instuurt, ontsnapt en keert terug als gewone gelovige
- 🛡️ **Iedereen** — raadsels om het schild: de eerste met het goede antwoord wint (1 poging per 5 minuten)
- 🙋 Alleen infiltranten reageren op de voorvraag: de rol aannemen of om een andere vragen. Dat kan alleen vóór de onthulling — daarna liggen de rollen vast
- 👥 In een groepschat tik je op de naam bovenin om te zien wie er nog meer in zit

**Voor de spelleider**
- Recap bovenaan de tab *Spelers*: de speeldag (tik op 1, 2 of 3 — dag 3 is de finaledag) met daaronder het aantal spelers, infiltranten en gevangenen
- Deelnemers beheren: rollen uitdelen (met de adviesverdeling uit de flyer) en status wijzigen (actief, gevangen, ontmaskerd, uit het spel)
- Rollen in één keer onthullen — de infiltranten-groepschat wordt dan automatisch aangemaakt
- Rolverzoeken goedkeuren (met nieuwe rol), afwijzen, of andere spelers vragen de rol over te nemen
- Vergeten pincodes: wie zijn code kwijt is vraagt toestemming, jij keurt goed of wijst af
- Deadlines instellen per chat: kies of de melding naar iedereen gaat of alleen naar bijvoorbeeld de infiltranten
- 👁️ **Wie heeft het gezien?** Onder elke kaart die je verstuurt — opdracht, missiestemming, peiling, raadsel, dagrapport, zoekopdracht, nachtkeuze — staat een tellertje (*✓ 1/3 gelezen*, dubbel vinkje zodra iedereen hem heeft). Tik erop en je ziet per persoon wie hem wel en niet geopend heeft, met tijdstip. Alleen jij ziet die tellers; spelers merken er niets van. Let op wat het betekent: iemand heeft de chat geopend nadat je het verstuurde — niet dat hij er ook iets mee gedaan heeft
- Opdrachten versturen en ingediende bewijzen goedkeuren of afwijzen
- Opdrachtenlijst infiltranten (tab *Spelers*): zet je opdrachten één keer klaar en kies ze daarna met één tik
- Missiestemmingen als checklist versturen; de meerderheid wordt automatisch de opdracht van de dag
- 📊 Peiling in élke chat (＋, ook in een privéchat): een gewone poll met 2 tot 12 antwoorden, eventueel met meerdere antwoorden per persoon of anoniem. Iedereen ziet de balkjes live meelopen, kan zijn stem nog wijzigen en (als hij niet anoniem is) zien wie wat stemde. Jij sluit de peiling wanneer je wilt
- Drie missies naar de veldwerker (＋ in zijn privéchat): de echte missie van de dag plus twee afleiders, in willekeurige volgorde
- 🛡️ **Raadsel van de dag**: zolang het spel loopt staat er elke dag bovenaan de tab *Spelers* de vraag of er vandaag een raadsel komt, en in welk uur. Kies je een uur, dan zet de app zelf een aankondiging in de groepschat (*"Het raadsel om het schild wordt vandaag tussen 13:00 en 14:00 gedeeld"*); kies je *geen raadsel*, dan staat dat er ook. Daarna kun je met één tik het raadsel klaarzetten op een willekeurig moment binnen dat uur, zodat spelers het precieze tijdstip niet weten. Zodra dat gebeurd is toont de kaart **hoe laat het staat ingepland** (met het raadsel erbij), en na afloop *Verstuurd om …* — dus je hoeft nooit te raden of je het al gedaan hebt. Valt het ingeplande moment buiten het uur dat je hebt aangekondigd, dan zegt de kaart dat erbij. De vraag verdwijnt zodra je hem beantwoord hebt en komt de volgende ochtend vanzelf terug. Van gedachten veranderen kan: alleen als de keuze echt verandert komt er een correctie in de chat
- Raadsels en dagrapporten versturen of inplannen (worden automatisch gepusht)
- Nachtkeuze naar de infiltranten (＋ in hun groepschat): verleiden of gevangennemen — de nog actieve infiltranten stemmen, bij gelijkspel hak jij de knoop door
- 💘 Verleidingsverzoek (＋ in de infiltrantenchat): *wie* halen ze over? De infiltranten stemmen op een naam; zijn ze het unaniem eens dan gaat het verzoek meteen de deur uit, anders bevestig jij het doelwit met 👑. Pas daarna krijgt die speler zelf de vraag — neemt hij aan, dan wordt hij infiltrant en komt hij in de groepschat mét de hele voorgeschiedenis; weigert hij, dan verandert er niets en zien de infiltranten dat hij geweigerd heeft
- Zoekopdracht met foto van het geheime voorwerp in de gevangenen-chat
- Spel beëindigen met winnaarsscherm en onthulling van alle rollen
- 🌙 **Draaiboek avondbijeenkomst** (tab *Spelers*): de acht stappen uit de flyer als afvinklijst, zodat je met de hele groep om je heen niets overslaat. Elke speeldag begint hij weer leeg
- 🌙 **Nachtstand**: één schakelaar zet alle chats op slot behalve die van de infiltranten, met automatisch een bericht in de groepschat als de nacht begint en eindigt
- Spel resetten na een testronde (⚙️ → Instellingen)

---

## Spelverloop in de app (spiekbriefje spelleider)

1. **Vooraf** — deel de link, iedereen meldt zich aan met zijn/haar naam
2. **Rollen** — tab *Spelers* → wijs per speler een rol toe → druk op **🤫 Vraag de infiltranten om akkoord**. Alleen zij zien dan stilletjes dat ze infiltrant zijn en kiezen: de rol aannemen of om een andere vragen. Hun rolkaart blijft verborgen en de rest merkt niets. In diezelfde kaart zie je per infiltrant of hij akkoord is, wil ruilen of nog niet gereageerd heeft
3. **Vastleggen** — zet daarna de schakelaar **"Rollen zichtbaar voor spelers"** aan. Dat sluit de voorvraag, iedereen ziet zijn rol en de infiltranten-chat ontstaat automatisch
4. **Dagelijks** — stuur 's ochtends de missielijst (🗳️) in de infiltranten-chat; de meerderheid bepaalt de missie en die wordt meteen een opdracht met foto-bewijs
5. **Gevangenen** — zet spelers op *Gevangen*; de gevangenen-chat ontstaat automatisch. Stuur daar met 🔎 de foto van het geheime voorwerp
6. **Het schild** — stuur met 🛡️ in de Iedereen-chat een raadsel met geheim antwoord (direct of ingepland)
7. **Avond** — druk op 🌙 *Nachtstand* zodra iedereen gaat slapen; loop daarna het draaiboek af, stap voor stap
8. **Einde van de dag** — stel het dagrapport op (tab *Spelers*): wie eruit ligt, hoofdverdachte, missie gehaald. Plan het in op 23:00 en het wordt automatisch gepusht
9. **Afsluiten** — ⚙️ → *Spel beëindigen* → kies de winnaar; iedereen ziet de uitslag en alle rollen
10. **Souvenir** — druk op 🏁 *Eindkaart*, vul eventueel het hoogtepunt van het spel in en zet de kaart in de groepschat. Iedereen kan hem daarna zelf bewaren of als tekst in WhatsApp delen

---

## Technisch

- De app is één losse webpagina (`index.html`) zonder installatie of build-stap
- `sw.js` is een bewust minimale service worker: hij bewaart de app **niet** in een cache, zodat iedereen bij het openen altijd de nieuwste versie krijgt. Hij bestaat alleen om meldingen te kunnen tonen
- **Hosting:** GitHub Pages, direct vanuit deze repository — elke wijziging die naar de branch wordt gepusht staat binnen een minuut live
- **Database:** Firebase Firestore (gratis Spark-plan), geconfigureerd in `firebase-config.js`
- Foto's worden in de browser verkleind (max ~1280px) en in de database opgeslagen, dus aparte foto-opslag is niet nodig
- **Filmpjes** gaan dezelfde weg, maar een document mag maar 1 MB zijn. Daarom wordt elk filmpje in stukken over meerdere documenten verdeeld, die bij het afspelen weer aan elkaar worden geplakt. Pas als het laatste stuk binnen is wordt het filmpje op *klaar* gezet, dus een halve upload levert nooit een kapot filmpje op
- Tot ongeveer 6 MB gaat het bestand er ongewijzigd in. Alleen wat daarboven zit wordt verkleind naar 640px en maximaal 30 seconden, door het op een canvas af te spelen en opnieuw op te nemen — dat duurt zo lang als het filmpje zelf en levert beeld zonder geluid op. Er zit een waakhond op: gaat de speelkop 8 seconden niet vooruit, dan stopt het met een melding in plaats van te blijven hangen
- Van een beeldje uit het begin wordt een gewone foto gemaakt: die miniatuur laadt in de chat, het filmpje zelf pas als iemand erop tikt
- De gegevens gaan rechtstreeks vanuit de bytes de database in, niet via een data-URL. Dat laatste gaat namelijk mis zodra het mediatype zelf een komma bevat — en precies dat doet de codec die een iPhone kiest: `video/mp4;codecs="avc1.42E01E,mp4a.40.2"`
- Wil je langere filmpjes in hogere kwaliteit, dan is **Cloud Storage** in Firebase de nette oplossing (en daarvoor is het Blaze-abonnement nodig). Nu staat dat uit; de app werkt volledig zonder
- Zonder Firebase-configuratie draait de app automatisch in **demo-modus**: alles werkt, maar alleen op één apparaat

### Instellingen aanpassen

Alles wat je zou willen wijzigen staat bovenin `firebase-config.js`: de pincode van de spelleider, de spelnaam en de ondertitel.

### Pushmeldingen aanzetten

Meldingen werken in twee stappen. De eerste laag werkt meteen: zet ze aan via ⚙️ → *Meldingen aanzetten* en je krijgt een seintje zolang de app nog draait (open of net weggeklikt). Op een iPhone moet de app daarvoor wel via de deelknop op je **beginscherm** staan en daarvandaan geopend worden — Apple staat meldingen anders niet toe.

Wil je ook meldingen als de app helemaal dicht is, dan is er eenmalig wat werk nodig:

1. **Firebase Console → Project settings → Cloud Messaging → Web Push certificates** → *Generate key pair*. Plak die sleutel in `firebase-config.js` bij `vapidKey`.
2. Zet het project op het **Blaze-abonnement**. Cloud Functions draaien niet op het gratis Spark-plan; bij een groep van deze omvang blijf je ruim binnen de gratis limieten, maar een creditcard koppelen is verplicht.
3. Rol de functies uit:
   ```bash
   cd geheime-dienst-final/functions && npm install
   firebase deploy --only functions
   ```

Daarna sturen de functies in `functions/index.js` automatisch een melding bij een nieuw bericht, een verzoek, een antwoord op een hackervraag of een nieuwe deadline. Er gaat nooit inhoud mee over de lijn: de functie stuurt alleen wélk soort melding het is, en de app maakt daar zelf een anonieme zin van.

Zonder die stappen blijft alles gewoon werken — je mist alleen de meldingen terwijl de app dicht is.

### Opnieuw beginnen

Onder ⚙️ staan twee knoppen. **Reset spel (spelers blijven)** wist alle chats, opdrachten, stemmingen, deadlines, raadsels, rapporten, verdenkingen, foto's en filmpjes, en zet alle rollen en statussen terug — maar iedereen blijft ingelogd met dezelfde pincode, en je opdrachtenlijst blijft bewaard. **Alles wissen** doet hetzelfde én verwijdert alle spelers en de opdrachtenlijst; daarna moet iedereen zich opnieuw aanmelden.

Elke reset verhoogt een rondenummer dat meetelt in de "dit heb ik al gelezen"-tellers. Die staan namelijk per toestel in de telefoon zelf en zijn van buitenaf niet te wissen; door dat nummer begint iedereen na een reset vanzelf met een schone lei en blijft het bolletje bij nieuwe berichten kloppen. Loopt er onderweg iets mis, dan gaat de reset gewoon door met de rest en meldt hij achteraf hoeveel onderdelen zijn blijven staan — een half gewist spel is erger dan een melding.

### Beveiliging

De Firestore-regels staan open tot en met 31 december 2026 — prima voor een besloten campingspel, maar deel de link alleen binnen je spelersgroep. De Firebase-sleutel in `firebase-config.js` hoort openbaar te zijn bij een web-app en is geen wachtwoord.

Pincodes worden nooit als leesbare cijfers opgeslagen: van de code + je naam wordt een SHA-256-hash gemaakt en alleen die hash gaat de database in. De pincode is bedoeld tegen meekijkende medespelers op een gedeelde telefoon, niet tegen iemand die de database zelf openbreekt.

De spelleider heeft twee losse codes: de **spelleiderscode** (`1602`) om het spelleidersaccount te claimen op het aanmeldscherm, en een **eigen pincode** die net als bij spelers bij het openen van de app gevraagd wordt.

**Pincode vergeten?** Die knop staat op ieders slotscherm, maar werkt per rol anders:
- **Spelers** sturen een verzoek naar de spelleider. Die krijgt een melding (teller op de tab *Spelers*) en keurt goed of wijst af. Pas na goedkeuring mag de speler een nieuwe pincode kiezen — bij afwijzing blijft de oude gelden.
- **De spelleider** stelt zelf een nieuwe in met de spelleiderscode, want die kan het aan niemand vragen.

Veel plezier op de camping! 🏕️
