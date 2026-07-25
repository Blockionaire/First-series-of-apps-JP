// ============================================================
//  GEHEIME DIENST — INSTELLINGEN
// ============================================================
//
//  STAP 1: Maak een gratis Firebase-project aan (zie README.md)
//  STAP 2: Plak hieronder jouw firebaseConfig (vervang null)
//  STAP 3: Kies zelf een geheime pincode voor de spelleider
//
//  Zolang firebase op null staat, draait de app in DEMO-MODUS:
//  alles werkt, maar alleen op dit apparaat (niet gedeeld).
// ============================================================

window.GD_CONFIG = {

  // Vervang null door jouw config, bijvoorbeeld:
  // firebase: {
  //   apiKey: "AIza....",
  //   authDomain: "geheime-dienst-xxxx.firebaseapp.com",
  //   projectId: "geheime-dienst-xxxx",
  //   storageBucket: "geheime-dienst-xxxx.appspot.com",
  //   messagingSenderId: "123456789",
  //   appId: "1:123456789:web:abcdef"
  // },
  firebase: null,

  // Pincode waarmee de spelleider inlogt (verander deze!)
  spelleiderPin: "1602",

  // Naam van het spel (mag je aanpassen)
  spelNaam: "GEHEIME DIENST",
  spelSubtitel: "Real life edition — Camping Vell Emporda"
};
