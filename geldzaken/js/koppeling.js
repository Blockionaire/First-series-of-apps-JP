/* =====================================================================
   GELDZAKEN — koppeling met de boodschappenapp
   =====================================================================
   De boodschappenapp van het huisje houdt zijn bonnen bij in Firestore,
   in de collectie `ovs_bonnen`. Deze module leest die mee, zodat je in
   Geldzaken ziet wat er deze maand aan boodschappen is uitgegeven
   zonder dat je het overtikt.

   Twee dingen zijn hier bewust zo:

   - Het is een spiegel, geen kopie. We lezen alleen; we schrijven niets
     terug en we maken geen boekingen aan. Wat je in de boodschappenapp
     aanpast, klopt hier een seconde later ook. En omdat er niets wordt
     overgenomen, kan er ook niets dubbel gaan tellen als je daarnaast
     je bankafschrift inleest.

   - Het staat los van je eigen Firebase. Deze koppeling praat met het
     project van de boodschappenapp, in een eigen verbinding naast die
     van Geldzaken. Je hoeft dus niets in te stellen om hem aan te
     zetten, en je financiën blijven staan waar ze stonden.
   ===================================================================== */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

export const koppeling = {
  beschikbaar: false,   // staat er een configuratie klaar?
  actief: false,        // luisteren we mee?
  bezig: false,
  fout: null,
  bonnen: [],           // { id, datum (ISO), bedrag, omschrijving, winkel, door }
  winkels: new Map(),   // id → naam
  aantalTotaal: 0,      // alle bonnen, ook die van vorige maanden
  laatst: 0,            // wanneer kwam er voor het laatst iets binnen
};

let FB = null;
let stoppers = [];
let opData = () => {};

/* ---------------------------------------------------------------
   Configuratie
   --------------------------------------------------------------- */
export function configuratie() {
  const cfg = window.GELDZAKEN_CONFIG?.koppelingen?.boodschappen;
  if (!cfg?.firebase?.apiKey || String(cfg.firebase.apiKey).startsWith("PLAK")) return null;
  return cfg;
}

export const appNaam = () => configuratie()?.naam || "Boodschappenapp";
export const appLink = () => configuratie()?.link || "../boodschappen/";

/* ---------------------------------------------------------------
   Aanzetten
   ---------------------------------------------------------------
   Idempotent: nog een keer aanroepen terwijl hij al luistert doet
   niets. Zo kan de store hem gerust bij elke instellingswijziging
   aanroepen.
   --------------------------------------------------------------- */
export async function start({ onData } = {}) {
  if (onData) opData = onData;

  const cfg = configuratie();
  koppeling.beschikbaar = !!cfg;
  if (!cfg) return false;
  if (koppeling.actief) return true;

  koppeling.bezig = true;
  koppeling.fout = null;

  try {
    if (!FB) {
      const [appMod, dbMod] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-firestore.js`),
      ]);
      /* Een eigen, genoemde app-instantie: die botst niet met de
         verbinding die Geldzaken zelf voor je gegevens gebruikt, ook
         niet als het toevallig hetzelfde project is. */
      const app = appMod.initializeApp(cfg.firebase, "boodschappen");
      FB = { app, db: dbMod.getFirestore(app), db_: dbMod };
    }

    const ruimte = cfg.ruimte || "ovs";
    const { db, db_ } = FB;

    stoppers.push(db_.onSnapshot(db_.collection(db, `${ruimte}_bonnen`),
      snap => {
        koppeling.bonnen = snap.docs.map(d => {
          const b = d.data() || {};
          const stempel = Number(b.datum || b.gemaakt) || Date.now();
          const dag = new Date(stempel);
          return {
            id: d.id,
            datum: `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, "0")}-${String(dag.getDate()).padStart(2, "0")}`,
            bedrag: Number(b.bedrag) || 0,
            omschrijving: String(b.omschrijving || "").trim(),
            winkel: b.winkel || "",
            door: b.door || "",
          };
        }).sort((a, b) => b.datum.localeCompare(a.datum));
        koppeling.aantalTotaal = koppeling.bonnen.length;
        koppeling.laatst = Date.now();
        koppeling.actief = true;
        koppeling.bezig = false;
        koppeling.fout = null;
        opData();
      },
      fout => {
        console.error("koppeling", fout);
        koppeling.fout = fout.code === "permission-denied"
          ? "De boodschappenapp laat niet toe dat er wordt meegelezen."
          : "Even geen verbinding met de boodschappenapp.";
        koppeling.bezig = false;
        opData();
      }));

    /* De winkelnamen erbij, zodat er "Jumbo" staat en niet een id. */
    stoppers.push(db_.onSnapshot(db_.collection(db, `${ruimte}_winkels`),
      snap => {
        koppeling.winkels = new Map(snap.docs.map(d => [d.id, (d.data() || {}).naam || ""]));
        opData();
      },
      () => { /* zonder namen werkt het ook */ }));

    koppeling.actief = true;
    return true;
  } catch (e) {
    /* Meestal is dit gewoon "geen internet". De technische tekst
       ("Failed to fetch dynamically imported module…") zegt niemand
       iets, dus die houden we voor de console. */
    console.error("koppeling", e);
    koppeling.fout = /fetch|network|import/i.test(e.message || "")
      ? "Even geen verbinding. Meelezen werkt alleen online."
      : e.message;
    koppeling.bezig = false;
    koppeling.actief = false;
    opData();
    return false;
  }
}

export function stop() {
  stoppers.forEach(f => { try { f(); } catch { /* al gestopt */ } });
  stoppers = [];
  koppeling.actief = false;
  koppeling.bezig = false;
  koppeling.bonnen = [];
  koppeling.winkels = new Map();
  koppeling.aantalTotaal = 0;
  opData();
}

/* ---------------------------------------------------------------
   Eén keer kijken of het werkt
   ---------------------------------------------------------------
   Voor de knop "Nu ophalen" in de instellingen. Het live meeluisteren
   zegt niets als er toevallig deze maand niets is afgerekend; dit
   haalt alles op en vertelt precies wat het aantreft.
   --------------------------------------------------------------- */
export async function haalNu() {
  const cfg = configuratie();
  if (!cfg) throw new Error("Er is geen boodschappenapp ingesteld.");

  await start();
  if (!FB) throw new Error(koppeling.fout || "Verbinden lukte niet.");

  const snap = await FB.db_.getDocs(FB.db_.collection(FB.db, `${cfg.ruimte || "ovs"}_bonnen`));
  return snap.size;
}

/* De naam van de winkel, of anders de omschrijving. */
export function bonNaam(bon) {
  return koppeling.winkels.get(bon.winkel) || bon.omschrijving || "Boodschappen";
}
