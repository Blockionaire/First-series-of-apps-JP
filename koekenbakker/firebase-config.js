/* =====================================================================
   DE KOEKENBAKKER — instellingen voor de verbinding
   =====================================================================
   Zolang `firebase` op null staat werkt de webshop gewoon: bestellingen
   komen als berichtje binnen via WhatsApp of e-mail, en het weeklimiet
   is het getal dat in index.html staat.

   Vul je hieronder je Firebase-project in, dan gebeurt er drie dingen:

     1. elke bestelling wordt opgeslagen, dus je raakt er nooit meer een
        kwijt in je berichten;
     2. het weeklimiet telt automatisch mee over álle klanten heen;
     3. de bestellingenportal (../koekenbakker-bestellingen/) laat alles
        live binnenkomen.

   In vijf stappen (uitgebreider in README.md):

     1. Ga naar console.firebase.google.com en maak een gratis project —
        of gebruik er een die je al hebt.
     2. Voeg een web-app toe (het </> icoontje) en kopieer het
        firebaseConfig-blok dat je krijgt.
     3. Plak dat hieronder in plaats van `null`.
     4. Maak een Firestore-database aan.
     5. Plak de regels uit ../koekenbakker-bestellingen/firestore.rules
        onder Firestore → Rules → Publish. Zet daar eerst je eigen
        e-mailadres in.

   De sleutel hieronder hoort openbaar te zijn bij een web-app; hij is
   geen wachtwoord. Wat je bestellingen beschermt zijn de regels in
   firestore.rules: die zorgen dat een klant wel een bestelling kan
   plaatsen, maar die van een ander nooit kan lezen.
   ===================================================================== */

window.KOEKENBAKKER_CONFIG = {

  firebase: null,

  /* Voorbeeld van hoe het eruitziet als je het invult:

  firebase: {
    apiKey: "AIza…",
    authDomain: "de-koekenbakker.firebaseapp.com",
    projectId: "de-koekenbakker",
    storageBucket: "de-koekenbakker.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  */

  /* De ruimte waarin alles wordt opgeslagen. Laat dit staan, tenzij je
     één project met iemand anders deelt — dan kiezen jullie allebei een
     eigen woord en zien jullie elkaars bestellingen niet.
     Let op: in de portal moet hetzelfde woord staan. */
  ruimte: "zara",
};
