/* =====================================================================
   GELDZAKEN — account, toegang en synchronisatie
   =====================================================================
   Dit bestand doet drie dingen:

     1. inloggen en registreren (Firebase Authentication)
     2. bepalen óf je bij de huishoudboekhouding mag — het lidmaatschap
     3. de gegevens live gelijk houden tussen apparaten (Firestore)

   De toegangsregel is expres streng. Wie een account maakt, maakt
   daarmee alleen een *aanvraag* aan:

       geldzaken/{ruimte}/leden/{uid}  →  { status: "wacht" }

   Pas als de beheerder die aanvraag goedkeurt (status "actief") komt
   iemand bij de cijfers. Iedereen met de link kan dus wel een account
   maken, maar ziet daarna alleen een wachtkamer.

   Belangrijk: wat je hieronder ziet is de nette voorkant. De échte
   beveiliging staat in firestore.rules, want die draait bij Google en
   niet in de browser van je bezoeker. Zonder die regels is elke
   controle in dit bestand een suggestie. Zet ze dus altijd aan.
   ===================================================================== */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

/* De collecties die tussen apparaten worden gedeeld. "leden" hoort er
   bewust niet bij: dat is toegangsbeheer en gaat apart. */
export const COLLECTIES = [
  "transacties", "terugkerend", "potjes", "doelen",
  "rekeningen", "categorieen", "regels", "instellingen",
];

export const sync = {
  beschikbaar: false,   // is er een Firebase-configuratie?
  gestart: false,       // is de SDK geladen?
  actief: false,        // luisteren we mee met de cloud?
  bezig: false,         // schrijven we nu iets weg?
  fout: null,

  /* De ingelogde persoon, of null. */
  gebruiker: null,      // { uid, email, emailBevestigd }

  /* Het lidmaatschap in deze huishouding. */
  lid: null,            // { status, rol, naam, ... } of null zolang onbekend
  status: "uit",        // uit | laden | uitgelogd | wacht | actief | geblokkeerd | geweigerd
  beheerder: false,

  /* Alleen gevuld voor een beheerder: iedereen die zich ooit meldde. */
  leden: [],
};

let FB = null;            // { app, auth, db, auth_, db_ }
let luisteraars = [];     // afmeldfuncties van de gegevens-abonnementen
let lidLuisteraar = null;
let ledenLuisteraar = null;

let opRemote = () => {};
let opStatus = () => {};
let opToegang = () => {};

/* ---------------------------------------------------------------
   Configuratie
   --------------------------------------------------------------- */
export function configuratie() {
  const cfg = window.GELDZAKEN_CONFIG?.firebase;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("PLAK")) return null;
  return cfg;
}

export const ruimte = () => window.GELDZAKEN_CONFIG?.ruimte || "thuis";

/* De e-mailadressen die altijd beheerder zijn. Dit is het startpunt:
   zonder zo'n adres zou de eerste beheerder zichzelf nooit kunnen
   goedkeuren. Dezelfde lijst hoort in firestore.rules te staan. */
function beheerderMails() {
  return (window.GELDZAKEN_CONFIG?.beheerders || [])
    .map(m => String(m).trim().toLowerCase())
    .filter(Boolean);
}

const isBeheerderMail = email =>
  !!email && beheerderMails().includes(String(email).toLowerCase());

/* Paden. Alles van één huishouden staat onder één ruimte, zodat je
   desnoods een tweede huishouding naast de eerste kunt zetten. */
const pad = (...delen) => ["geldzaken", ruimte(), ...delen];

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
export async function startFirebase({ onRemote, onStatus, onToegang }) {
  opRemote = onRemote || (() => {});
  opStatus = onStatus || (() => {});
  opToegang = onToegang || (() => {});

  const cfg = configuratie();
  if (!cfg) {
    sync.beschikbaar = false;
    sync.status = "uit";
    opStatus();
    return false;
  }

  sync.beschikbaar = true;
  sync.status = "laden";
  opStatus();

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
    sync.gestart = true;

    /* Blijf ingelogd, ook als de app dagen dicht is geweest. */
    try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); }
    catch { /* privémodus: dan maar per sessie */ }

    authMod.onAuthStateChanged(auth, async gebruiker => {
      stopAlles();

      if (!gebruiker) {
        sync.gebruiker = null;
        sync.lid = null;
        sync.beheerder = false;
        sync.actief = false;
        sync.leden = [];
        sync.status = "uitgelogd";
        opStatus();
        opToegang();
        return;
      }

      sync.gebruiker = {
        uid: gebruiker.uid,
        email: gebruiker.email,
        emailBevestigd: gebruiker.emailVerified,
      };
      sync.status = "laden";
      opStatus();

      await volgLidmaatschap(gebruiker);
    });

    return true;
  } catch (e) {
    sync.beschikbaar = false;
    sync.fout = "Firebase kon niet geladen worden: " + e.message;
    sync.status = "uit";
    opStatus();
    return false;
  }
}

/* ---------------------------------------------------------------
   Lidmaatschap
   ---------------------------------------------------------------
   Zodra je inlogt kijken we naar jouw eigen ledendocument. Bestaat het
   niet, dan zetten we een aanvraag klaar. Verandert de beheerder je
   status, dan merk je dat binnen een seconde — het is een live
   abonnement, geen eenmalige controle.
   --------------------------------------------------------------- */
async function volgLidmaatschap(gebruiker) {
  const { db, db_ } = FB;
  const ref = db_.doc(db, ...pad("leden", gebruiker.uid));

  lidLuisteraar = db_.onSnapshot(ref, async snap => {
    if (!snap.exists()) {
      /* Nog geen aanvraag: er meteen een aanmaken. */
      await meldAan(gebruiker);
      return;
    }

    const lid = { uid: gebruiker.uid, ...snap.data() };
    sync.lid = lid;
    sync.beheerder = lid.rol === "beheerder" || isBeheerderMail(gebruiker.email);

    /* Staat je adres in de beheerderslijst, maar zegt het document iets
       anders? Dan trekken we het document recht. De regels laten dit
       alleen toe voor precies die adressen. */
    if (isBeheerderMail(gebruiker.email) && (lid.rol !== "beheerder" || lid.status !== "actief")) {
      try {
        await db_.setDoc(ref, { rol: "beheerder", status: "actief", bijgewerkt: Date.now() }, { merge: true });
      } catch { /* de regels beslissen; niet erg als het niet mag */ }
    }

    const magErin = lid.status === "actief";
    sync.status = lid.status || "wacht";
    sync.actief = magErin;

    stopGegevens();
    if (magErin) startLuisteren();
    if (sync.beheerder) startLedenLijst();

    /* Laat weten wanneer iemand voor het laatst binnen was. Handig voor
       de beheerder, en het bevestigt meteen of het e-mailadres al
       gecontroleerd is. */
    tikAanwezigheid(ref, lid);

    opStatus();
    opToegang();
  }, fout => {
    sync.fout = fout.message;
    sync.status = "wacht";
    opStatus();
    opToegang();
  });
}

/* Een nieuwe aanvraag. Meer dan dit mag een onbekende ook niet
   wegschrijven — de regels staan alleen status "wacht" toe. */
async function meldAan(gebruiker) {
  const { db, db_ } = FB;
  const ref = db_.doc(db, ...pad("leden", gebruiker.uid));
  try {
    await db_.setDoc(ref, {
      email: gebruiker.email || "",
      naam: gebruiker.displayName || "",
      status: "wacht",
      rol: "kijker",
      emailBevestigd: !!gebruiker.emailVerified,
      aangemeld: Date.now(),
      laatsteLogin: Date.now(),
      bijgewerkt: Date.now(),
    });
  } catch (e) {
    sync.fout = foutTekst(e);
    sync.status = "wacht";
    opStatus();
    opToegang();
  }
}

let aanwezigheidGezet = false;
function tikAanwezigheid(ref, lid) {
  if (aanwezigheidGezet) return;
  aanwezigheidGezet = true;
  const nieuw = {
    laatsteLogin: Date.now(),
    emailBevestigd: !!sync.gebruiker?.emailBevestigd,
  };
  /* Alleen schrijven als er echt iets verandert, anders wordt het een
     schrijfje bij elke start. */
  if (lid.emailBevestigd === nieuw.emailBevestigd &&
      lid.laatsteLogin && Date.now() - lid.laatsteLogin < 6 * 3600 * 1000) return;
  FB.db_.setDoc(ref, nieuw, { merge: true }).catch(() => { /* niet belangrijk */ });
}

/* ---------------------------------------------------------------
   Meeluisteren met de gegevens
   --------------------------------------------------------------- */
function startLuisteren() {
  const { db, db_ } = FB;
  for (const naam of COLLECTIES) {
    const ref = db_.collection(db, ...pad(naam));
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

/* De beheerder ziet iedereen die zich ooit heeft aangemeld. */
function startLedenLijst() {
  const { db, db_ } = FB;
  ledenLuisteraar = db_.onSnapshot(db_.collection(db, ...pad("leden")),
    snap => {
      sync.leden = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      opToegang();
    },
    fout => { sync.fout = fout.message; opStatus(); }
  );
}

function stopGegevens() {
  luisteraars.forEach(stop => { try { stop(); } catch { /* al gestopt */ } });
  luisteraars = [];
  if (ledenLuisteraar) { try { ledenLuisteraar(); } catch { /* al gestopt */ } ledenLuisteraar = null; }
}

function stopAlles() {
  stopGegevens();
  if (lidLuisteraar) { try { lidLuisteraar(); } catch { /* al gestopt */ } lidLuisteraar = null; }
  aanwezigheidGezet = false;
}

/* ---------------------------------------------------------------
   Schrijven
   --------------------------------------------------------------- */
export function magSchrijven() {
  return sync.actief && ["beheerder", "bewerker"].includes(sync.lid?.rol);
}

export async function zetRemote(collectie, record) {
  if (!sync.actief || !FB || !magSchrijven()) return;
  const { db, db_ } = FB;
  try {
    sync.bezig = true; opStatus();
    const { id, ...rest } = record;
    await db_.setDoc(db_.doc(db, ...pad(collectie, id)), rest, { merge: false });
    sync.fout = null;
  } catch (e) {
    sync.fout = foutTekst(e);
  } finally {
    sync.bezig = false; opStatus();
  }
}

export async function wisRemote(collectie, id) {
  if (!sync.actief || !FB || !magSchrijven()) return;
  const { db, db_ } = FB;
  try {
    /* Een grafsteen in plaats van echt weggooien: anders zet het andere
       apparaat de boeking bij de eerstvolgende synchronisatie vrolijk
       weer terug. */
    await db_.setDoc(db_.doc(db, ...pad(collectie, id)), {
      verwijderd: true,
      bijgewerkt: Date.now(),
    });
  } catch (e) {
    sync.fout = foutTekst(e); opStatus();
  }
}

/* Alles in één keer omhoog duwen — na het inloggen op een apparaat waar
   je al maanden lokaal hebt bijgehouden. */
export async function duwAllesOmhoog(alles) {
  if (!sync.actief || !FB || !magSchrijven()) throw new Error("Je hebt hier geen schrijfrechten.");
  const { db, db_ } = FB;
  sync.bezig = true; opStatus();
  try {
    for (const [collectie, records] of Object.entries(alles)) {
      /* Firestore doet maximaal 500 schrijfacties per batch. */
      for (let i = 0; i < records.length; i += 400) {
        const batch = db_.writeBatch(db);
        for (const rec of records.slice(i, i + 400)) {
          const { id, ...rest } = rec;
          batch.set(db_.doc(db, ...pad(collectie, id)), rest);
        }
        await batch.commit();
      }
    }
    sync.fout = null;
  } finally {
    sync.bezig = false; opStatus();
  }
}

/* Staat er al iets in de cloud? Bepaalt of we lokale gegevens uit
   zichzelf omhoog mogen duwen of eerst moeten vragen. */
export async function cloudIsLeeg() {
  if (!sync.actief || !FB) return false;
  const { db, db_ } = FB;
  for (const naam of ["transacties", "terugkerend", "potjes", "doelen", "rekeningen"]) {
    const snap = await db_.getDocs(db_.query(db_.collection(db, ...pad(naam)), db_.limit(1)));
    if (!snap.empty) return false;
  }
  return true;
}

/* ---------------------------------------------------------------
   Account
   --------------------------------------------------------------- */
export async function registreren(email, wachtwoord, naam) {
  if (!FB) throw new Error("Inloggen staat uit; er is geen Firebase ingesteld.");
  const { auth, auth_ } = FB;
  const uitkomst = await auth_.createUserWithEmailAndPassword(auth, email.trim(), wachtwoord);
  if (naam) {
    try { await auth_.updateProfile(uitkomst.user, { displayName: naam }); } catch { /* mag mislukken */ }
  }
  /* Een bevestigingsmail maakt het voor de beheerder makkelijker om te
     zien of een aanmelding echt van die persoon komt. */
  try { await auth_.sendEmailVerification(uitkomst.user); } catch { /* mag mislukken */ }
  return uitkomst.user;
}

export async function inloggen(email, wachtwoord) {
  if (!FB) throw new Error("Inloggen staat uit; er is geen Firebase ingesteld.");
  const { auth, auth_ } = FB;
  await auth_.signInWithEmailAndPassword(auth, email.trim(), wachtwoord);
}

export async function wachtwoordVergeten(email) {
  if (!FB) throw new Error("Inloggen staat uit; er is geen Firebase ingesteld.");
  const { auth, auth_ } = FB;
  await auth_.sendPasswordResetEmail(auth, email.trim());
}

export async function stuurBevestigingsmail() {
  if (!FB?.auth.currentUser) throw new Error("Je bent niet ingelogd.");
  await FB.auth_.sendEmailVerification(FB.auth.currentUser);
}

export async function wijzigWachtwoord(huidig, nieuw) {
  if (!FB?.auth.currentUser) throw new Error("Je bent niet ingelogd.");
  const { auth, auth_ } = FB;
  const inlog = auth_.EmailAuthProvider.credential(auth.currentUser.email, huidig);
  await auth_.reauthenticateWithCredential(auth.currentUser, inlog);
  await auth_.updatePassword(auth.currentUser, nieuw);
}

export async function uitloggen() {
  if (!FB) return;
  stopAlles();
  await FB.auth_.signOut(FB.auth);
}

/* Je eigen naam bijwerken. Status en rol staan hier expres niet bij:
   die mag je van de regels niet zelf veranderen. */
export async function bewerkMijnProfiel({ naam }) {
  if (!FB || !sync.gebruiker) return;
  const { db, db_ } = FB;
  await db_.setDoc(db_.doc(db, ...pad("leden", sync.gebruiker.uid)), {
    naam: naam || "",
    bijgewerkt: Date.now(),
  }, { merge: true });
}

/* ---------------------------------------------------------------
   Beheer — alleen zinvol voor een beheerder
   ---------------------------------------------------------------
   Of het écht mag beslissen de regels bij Google. Lukt het niet, dan
   krijg je hier een nette foutmelding terug.
   --------------------------------------------------------------- */
export async function zetLid(uid, velden) {
  if (!FB) throw new Error("Beheer werkt alleen met Firebase.");
  const { db, db_ } = FB;
  await db_.setDoc(db_.doc(db, ...pad("leden", uid)), {
    ...velden,
    bijgewerkt: Date.now(),
    gewijzigdDoor: sync.gebruiker?.email || "",
  }, { merge: true });
}

export const keurGoed   = (uid, rol = "bewerker") => zetLid(uid, { status: "actief", rol });
export const weiger     = uid => zetLid(uid, { status: "geweigerd", rol: "kijker" });
export const blokkeer   = uid => zetLid(uid, { status: "geblokkeerd" });
export const zetRol     = (uid, rol) => zetLid(uid, { rol });

export async function verwijderLid(uid) {
  if (!FB) throw new Error("Beheer werkt alleen met Firebase.");
  if (uid === sync.gebruiker?.uid) throw new Error("Je kunt jezelf niet verwijderen.");
  const { db, db_ } = FB;
  await db_.deleteDoc(db_.doc(db, ...pad("leden", uid)));
}

/* ---------------------------------------------------------------
   Foutmeldingen in gewoon Nederlands
   --------------------------------------------------------------- */
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
    "auth/requires-recent-login": "Log even opnieuw in en probeer het daarna nog eens.",
    "permission-denied": "Daar heb je geen rechten voor.",
    "unavailable": "Even geen verbinding met de database.",
  };
  return teksten[code] || e?.message || "Er ging iets mis.";
}
