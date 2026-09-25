/* =====================================================================
   BESTELLINGEN — instellingen voor de portal
   =====================================================================
   Vul hier hetzelfde Firebase-project in als in de webshop
   (../koekenbakker/firebase-config.js). Zonder deze gegevens laat de
   portal alleen een uitleg zien.

   Let op: `ruimte` moet in beide bestanden hetzelfde woord zijn, anders
   kijken de webshop en de portal in verschillende laatjes.
   ===================================================================== */

window.KOEKENBAKKER_PORTAL_CONFIG = {

  firebase: null,

  /* Voorbeeld:

  firebase: {
    apiKey: "AIza…",
    authDomain: "de-koekenbakker.firebaseapp.com",
    projectId: "de-koekenbakker",
    storageBucket: "de-koekenbakker.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  */

  ruimte: "zara",

  /* Het baklimiet dat een nieuwe week meekrijgt zolang je er zelf nog
     niets voor hebt ingesteld. */
  weekLimiet: 100,
};
