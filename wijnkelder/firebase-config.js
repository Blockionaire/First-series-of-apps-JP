/* =====================================================================
   WIJNKELDER — instellingen
   =====================================================================
   Zolang `firebase` op null staat werkt de app volledig, maar staat je
   kelder alleen op dít apparaat. Wil je hem op je telefoon én je laptop,
   plak dan hieronder de configuratie van je eigen Firebase-project.

   In vijf stappen (staat uitgebreider in README.md):

     1. Ga naar console.firebase.google.com en maak een gratis project.
     2. Voeg een web-app toe (het </> icoontje) en kopieer het
        firebaseConfig-blok dat je krijgt.
     3. Plak dat hieronder in plaats van `null`.
     4. Zet in de console Authentication → Sign-in method → E-mail/
        wachtwoord aan.
     5. Maak een Firestore-database aan en plak de beveiligingsregels
        uit de README.

   De sleutel hieronder hoort openbaar te zijn bij een web-app; hij is
   geen wachtwoord. Wat je gegevens beschermt zijn de Firestore-regels,
   die alleen jouw eigen account bij jouw eigen kelder laten.
   ===================================================================== */

window.WIJNKELDER_CONFIG = {

  firebase: null,

  /* Voorbeeld van hoe het eruitziet als je het invult:

  firebase: {
    apiKey: "AIza…",
    authDomain: "mijn-wijnkelder.firebaseapp.com",
    projectId: "mijn-wijnkelder",
    storageBucket: "mijn-wijnkelder.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  */
};
