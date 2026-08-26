/* =====================================================================
   GELDZAKEN — instellingen
   =====================================================================
   Zolang `firebase` op null staat werkt de app volledig, maar staat je
   boekhouding alleen op dít apparaat en is er geen inlogscherm.

   Wil je hem op je telefoon én je laptop, en wil je zelf bepalen wie
   erbij mag, vul dan hieronder je eigen Firebase-project in.

   In vijf stappen (uitgebreider in README.md):

     1. Ga naar console.firebase.google.com en maak een gratis project.
     2. Voeg een web-app toe (het </> icoontje) en kopieer het
        firebaseConfig-blok dat je krijgt.
     3. Plak dat hieronder in plaats van `null`.
     4. Zet in de console Authentication → Sign-in method → E-mail/
        wachtwoord aan.
     5. Maak een Firestore-database en plak de regels uit
        firestore.rules — daar staat óók je eigen e-mailadres in.

   De sleutel hieronder hoort openbaar te zijn bij een web-app; hij is
   geen wachtwoord. Wat je gegevens beschermt zijn de regels in
   firestore.rules, die alleen goedgekeurde leden binnenlaten.
   ===================================================================== */

window.GELDZAKEN_CONFIG = {

  firebase: null,

  /* Voorbeeld van hoe het eruitziet als je het invult:

  firebase: {
    apiKey: "AIza…",
    authDomain: "mijn-geldzaken.firebaseapp.com",
    projectId: "mijn-geldzaken",
    storageBucket: "mijn-geldzaken.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  */

  /* Wie is de baas over deze boekhouding?
     ---------------------------------------------------------------
     De adressen hieronder zijn altijd beheerder. Dat is het startpunt:
     zonder zo'n adres zou de eerste beheerder zichzelf nooit kunnen
     goedkeuren. Vul hier jouw eigen e-mailadres in, precies zoals je
     ermee inlogt.

     Belangrijk: dezelfde lijst moet ook in firestore.rules staan.
     Alleen daar telt hij echt — deze lijst regelt wat je in de app te
     zien krijgt, die lijst regelt wat de database toestaat. */
  beheerders: [
    // "jij@voorbeeld.nl",
  ],

  /* Naam boven het inlogscherm. */
  huisNaam: "Geldzaken",

  /* De ruimte waarin alles wordt opgeslagen. Wil je een tweede,
     losstaande boekhouding (bijvoorbeeld voor een vereniging), zet dit
     dan op iets anders — dan delen de twee niets met elkaar. */
  ruimte: "thuis",
};
