# Private toegang tot de verbouwingsapp

Deze wijziging voegt aanmelden toe aan beide Supabase-versies van de verbouwingsapp. Andere apps en lokale/offline HTML-versies veranderen niet. Alle goedgekeurde gebruikers blijven dezelfde verbouwing delen; nieuwe accounts in het gedeelde Supabase-project krijgen geen toegang.

## Voorbereiden voordat je dit live zet

1. Kies de personen die toegang mogen hebben. Gebruik hun bestaande **Supabase Auth**-accounts, of maak ze zelf aan via Authentication → Users → Add user. Dit aanmelden gebruikt e-mail en wachtwoord; er is geen registratiescherm. Vul geen wachtwoorden of sleutels in GitHub of chat in.
2. Kopieer `renovation-access.sql` naar de Supabase SQL Editor. Vul alleen `approved_user_ids` in met de UUIDs van deze goedgekeurde accounts. Gebruik niet automatisch alle accounts in het gedeelde project. De lege lijst in de repository stopt bewust met een fout voordat er iets verandert.
3. Zet de gewijzigde HTML-pagina's en beide `renovation-access.*`-bestanden samen live. Het nieuwe aanmeldscherm blijft gesloten totdat de SQL-functie en het beleid zijn geïnstalleerd. Plan deze overstap samen met de volgende stap: de app is gedurende die korte overgang niet beschikbaar.
4. Voer de ingevulde SQL uit. Deze bewaart alle gegevens en bestaande rechten, maar voegt een verplichte ledencontrole toe. De functie `ovs_can_access` controleert toegang onder de normale gebruikersrechten. De bestaande `main`-rij moet aanwezig zijn; een mislukte controle valt nooit terug op automatisch publiceren van voorbeeldgegevens.
5. Meld aan als elke goedgekeurde gebruiker en controleer laden, wijzigen en synchroniseren. Controleer ook dat een ander account, een gast en een gebruiker zonder sessie niets kunnen lezen of wijzigen. Schakel pas daarna anonieme BrickMade-sessies in.

## Gedrag

- De app blijft verborgen totdat de server de gebruiker en diens toegang heeft gecontroleerd. Gegevens laden, lokaal opslaan, synchroniseren en Realtime starten pas na toestemming.
- De sessie heeft een eigen opslagnaam, zodat afmelden geen sessies van andere apps op dezelfde website verwijdert.
- Afmelden verbergt de app, stopt Realtime en verwijdert de lokale verbouwingscache en deze app-sessie. Andere apparaten blijven aangemeld. Toegang wordt opnieuw gecontroleerd wanneer je terugkeert naar de pagina.
- Nieuwe gebruikers mogen in andere apps accounts maken, maar kunnen zichzelf niet toevoegen aan deze verbouwing. Het toegangsbeleid gebruikt UUIDs die alleen een databasebeheerder kan wijzigen.
- Voer de installatie niet blind opnieuw uit: een bestaand beleid of bestaande functie veroorzaakt een fout en de transactie wordt teruggedraaid.

Dit beschermt de actuele Supabase-gegevens. De repository en HTML blijven publiek waar ze dat al waren. Gegevens die letterlijk in de HTML/JavaScript-voorbeeldinhoud of Git-geschiedenis staan, worden hierdoor niet privé; vertrouwelijke inhoud vereist ook passende broncode- en hostingtoegang. De wijziging verwijdert of herschrijft geen bestaande projectgegevens of Git-geschiedenis.

## Controle

`tests/renovation-database.py` controleert het daadwerkelijke SQL-bestand op PostgreSQL: gedeelde toegang voor goedgekeurde accounts; geen toegang voor andere accounts, gasten of anonieme API-aanroepen; foutieve configuratie verandert niets.

`tests/renovation-browser.cjs` controleert beide echte HTML-pagina's met expliciet gesimuleerde Auth/database-antwoorden. Het controleert aanmelden, weigeren, ontbrekende installatie, intrekking van toegang, afmelden en mobiel gedrag zonder het gebruikersproject te benaderen. Een echte aanmelding moet na installatie nog worden getest met de gekozen accounts.
