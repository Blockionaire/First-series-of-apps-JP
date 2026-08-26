/* =====================================================================
   WIJNKELDER — synchronisatie
   =====================================================================
   Optionele laag bovenop de lokale opslag. Staat er geen Firebase-
   configuratie in firebase-config.js, of ben je niet ingelogd, dan doet
   dit bestand niets en werkt de app gewoon door op dit apparaat.

   De regel bij het samenvoegen is eenvoudig: de versie met de laatste
   `bijgewerkt`-tijd wint. Verwijderen gebeurt met een grafsteen — een
   document dat blijft staan met `verwijderd: true` — anders zou een
   ander apparaat de fles bij de eerstvolgende synchronisatie vrolijk
   weer terugzetten.
   ===================================================================== */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

export const sync = {
  beschikbaar: false,   // is er überhaupt een configuratie?
  actief: false,        // draait de synchronisatie nu?
  gebruiker: null,      // { uid, email }
  fout: null,
  bezig: false,
};

let FB = null;          // { app, auth, db, mod: {...} }
let luisteraars = [];   // afmeldfuncties van de onSnapshot-abonnementen
let opRemote = () => {};
let opStatus = () => {};

const COLLECTIES = ["flessen", "notities", "historie", "wenslijst", "instellingen"];

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
export function configuratie() {
  const cfg = window.WIJNKELDER_CONFIG?.firebase;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("PLAK")) return null;
  return cfg;
}

export async function startFirebase({ onRemote, onStatus }) {
  opRemote = onRemote || (() => {});
  opStatus = onStatus || (() => {});

  const cfg = configuratie();
  if (!cfg) { sync.beschikbaar = false; opStatus(); return false; }

  try {
    const [appMod, authMod, dbMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);

    const app = appMod.initializeApp(cfg);
    const auth = authMod.getAuth(app);
    const db = dbMod.getFirestore(app);
    FB = { app, auth, db, auth_: authMod, db_: dbMod };

    sync.beschikbaar = true;

    authMod.onAuthStateChanged(auth, gebruiker => {
      stopLuisteren();
      if (gebruiker) {
        sync.gebruiker = { uid: gebruiker.uid, email: gebruiker.email };
        sync.actief = true;
        sync.fout = null;
        startLuisteren(gebruiker.uid);
      } else {
        sync.gebruiker = null;
        sync.actief = false;
      }
      opStatus();
    });

    return true;
  } catch (e) {
    sync.beschikbaar = false;
    sync.fout = "Firebase kon niet geladen worden: " + e.message;
    opStatus();
    return false;
  }
}

/* ---------------------------------------------------------------
   Live meeluisteren met de cloud
   --------------------------------------------------------------- */
function startLuisteren(uid) {
  const { db, db_ } = FB;
  for (const naam of COLLECTIES) {
    const ref = db_.collection(db, "gebruikers", uid, naam);
    const stop = db_.onSnapshot(ref,
      snap => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        opRemote(naam, records);
      },
      fout => { sync.fout = fout.message; opStatus(); }
    );
    luisteraars.push(stop);
  }
}

function stopLuisteren() {
  luisteraars.forEach(stop => { try { stop(); } catch { /* al gestopt */ } });
  luisteraars = [];
}

/* ---------------------------------------------------------------
   Schrijven
   --------------------------------------------------------------- */
export async function zetRemote(collectie, record) {
  if (!sync.actief || !FB) return;
  const { db, db_ } = FB;
  try {
    sync.bezig = true; opStatus();
    const { id, ...rest } = record;
    await db_.setDoc(db_.doc(db, "gebruikers", sync.gebruiker.uid, collectie, id), rest, { merge: false });
    sync.fout = null;
  } catch (e) {
    sync.fout = e.message;
  } finally {
    sync.bezig = false; opStatus();
  }
}

export async function wisRemote(collectie, id) {
  if (!sync.actief || !FB) return;
  const { db, db_ } = FB;
  try {
    /* Grafsteen in plaats van echt weggooien, zodat andere apparaten
       de verwijdering ook meekrijgen. */
    await db_.setDoc(db_.doc(db, "gebruikers", sync.gebruiker.uid, collectie, id), {
      verwijderd: true,
      bijgewerkt: Date.now(),
    });
  } catch (e) {
    sync.fout = e.message; opStatus();
  }
}

/* Alles in één keer omhoog duwen — na het inloggen op een apparaat dat
   al een kelder had staan. */
export async function duwAllesOmhoog(alles) {
  if (!sync.actief || !FB) return;
  const { db, db_ } = FB;
  sync.bezig = true; opStatus();
  try {
    for (const [collectie, records] of Object.entries(alles)) {
      /* Firestore doet maximaal 500 schrijfacties per batch. */
      for (let i = 0; i < records.length; i += 400) {
        const batch = db_.writeBatch(db);
        for (const rec of records.slice(i, i + 400)) {
          const { id, ...rest } = rec;
          batch.set(db_.doc(db, "gebruikers", sync.gebruiker.uid, collectie, id), rest);
        }
        await batch.commit();
      }
    }
    sync.fout = null;
  } catch (e) {
    sync.fout = e.message;
  } finally {
    sync.bezig = false; opStatus();
  }
}

/* ---------------------------------------------------------------
   Account
   --------------------------------------------------------------- */
export async function registreren(email, wachtwoord) {
  if (!FB) throw new Error("Synchronisatie staat uit.");
  const { auth, auth_ } = FB;
  await auth_.createUserWithEmailAndPassword(auth, email.trim(), wachtwoord);
}

export async function inloggen(email, wachtwoord) {
  if (!FB) throw new Error("Synchronisatie staat uit.");
  const { auth, auth_ } = FB;
  await auth_.signInWithEmailAndPassword(auth, email.trim(), wachtwoord);
}

export async function wachtwoordVergeten(email) {
  if (!FB) throw new Error("Synchronisatie staat uit.");
  const { auth, auth_ } = FB;
  await auth_.sendPasswordResetEmail(auth, email.trim());
}

export async function uitloggen() {
  if (!FB) return;
  stopLuisteren();
  await FB.auth_.signOut(FB.auth);
}

/* Foutmeldingen van Firebase zijn Engels en technisch. Dit maakt er
   iets van waar je als gebruiker wat aan hebt. */
export function foutTekst(e) {
  const code = e?.code || "";
  const teksten = {
    "auth/invalid-email": "Dat is geen geldig e-mailadres.",
    "auth/user-not-found": "Er hoort geen account bij dit e-mailadres.",
    "auth/wrong-password": "Verkeerd wachtwoord.",
    "auth/invalid-credential": "E-mailadres of wachtwoord klopt niet.",
    "auth/email-already-in-use": "Er bestaat al een account met dit e-mailadres.",
    "auth/weak-password": "Kies een wachtwoord van minstens 6 tekens.",
    "auth/too-many-requests": "Te veel pogingen. Probeer het over een paar minuten opnieuw.",
    "auth/network-request-failed": "Geen verbinding. Controleer je internet.",
    "auth/operation-not-allowed": "E-mail-inloggen staat nog uit in de Firebase-console.",
  };
  return teksten[code] || e?.message || "Er ging iets mis.";
}
