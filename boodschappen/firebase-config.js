// ============================================================
//  HUISJE OVS · BOODSCHAPPEN — INSTELLINGEN
// ============================================================
//
//  De app deelt de lijst via Firebase. Zolang `firebase` op null
//  staat, draait alles in DEMO-MODUS: de app werkt volledig, maar
//  de lijst staat dan alleen op dat ene apparaat.
//
//  Zie README.md als je een eigen Firebase-project wilt gebruiken.
// ============================================================

window.BOODSCHAPPEN_CONFIG = {

  // Hetzelfde Firebase-project als de Geheime Dienst-app.
  // De boodschappen staan in eigen collecties (ovs_*), dus de
  // twee apps zitten elkaar niet in de weg.
  firebase: {
    apiKey: "AIzaSyB_ekiYsV6RG7YsIK8kVXtghZNu7obHC4g",
    authDomain: "geheime-dienst.firebaseapp.com",
    projectId: "geheime-dienst",
    storageBucket: "geheime-dienst.firebasestorage.app",
    messagingSenderId: "996478249104",
    appId: "1:996478249104:web:205651eb2e539b0cdd5015"
  },

  // Naam boven in de app.
  huisNaam: "Huisje OVS",

  // Voorvoegsel van alle collecties in de database.
  // Wil je met een schone lijst beginnen (of een tweede huisje),
  // verander dit dan in bijvoorbeeld "ovs2".
  ruimte: "ovs"
};
