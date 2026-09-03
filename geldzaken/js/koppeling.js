/* =====================================================================
   GELDZAKEN — koppeling met de boodschappenapp
   =====================================================================
   De boodschappenapp van het huisje houdt zijn bonnen bij in Firestore.
   Deze module leest die mee, zodat je in Geldzaken ziet wat er deze
   maand aan boodschappen is uitgegeven zonder dat je het overtikt.

   Drie keuzes die het hier eenvoudig houden:

   - We lezen rechtstreeks via de REST-kant van Firestore, met een
     gewone fetch. Geen Firebase-SDK dus: dat scheelt een paar honderd
     kilobyte laden bij het opstarten, en het werkt ook op netwerken
     waar het adres van die SDK geblokkeerd is. Voor het ophalen van een
     lijstje bonnen heb je die machinerie niet nodig.

   - Het is een spiegel, geen kopie. We schrijven niets terug en maken
     geen boekingen aan. Wat je in de boodschappenapp aanpast klopt hier
     bij de volgende verversing ook, en omdat er niets wordt overgenomen
     kan er niets dubbel tellen naast een ingelezen bankafschrift.

   - Verversen doen we bij het opstarten, zodra je de app weer opent, en
     verder elke vijf minuten. Boodschappen zijn geen beurskoersen.
   ===================================================================== */

const BASIS = "https://firestore.googleapis.com/v1/projects";
const HERHAAL = 5 * 60 * 1000;

export const koppeling = {
  beschikbaar: false,   // staat er een configuratie klaar?
  actief: false,        // hebben we gegevens binnen?
  bezig: false,
  fout: null,
  bonnen: [],           // { id, datum (ISO), bedrag, omschrijving, winkel, door }
  winkels: new Map(),   // id → naam
  aantalTotaal: 0,
  laatst: 0,            // wanneer kwam er voor het laatst iets binnen
};

let opData = () => {};
let klok = null;
let luistertOpTerugkeer = false;
let aan = false;        // staat de koppeling aan? bepaalt of we mogen ophalen
let bezigMet = null;    // de lopende ophaalronde, zodat er nooit twee tegelijk zijn

/* ---------------------------------------------------------------
   Configuratie
   --------------------------------------------------------------- */
export function configuratie() {
  const cfg = window.GELDZAKEN_CONFIG?.koppelingen?.boodschappen;
  const fb = cfg?.firebase;
  if (!fb?.apiKey || !fb?.projectId || String(fb.apiKey).startsWith("PLAK")) return null;
  return cfg;
}

export const appNaam = () => configuratie()?.naam || "Boodschappenapp";
export const appLink = () => configuratie()?.link || "../boodschappen/";

/* ---------------------------------------------------------------
   Een collectie ophalen
   ---------------------------------------------------------------
   Firestore geeft elk veld met zijn type terug ("stringValue",
   "integerValue"…). `waarde()` haalt daar weer een gewone waarde uit.
   Grote collecties komen in stukken; de nextPageToken haalt de rest op.
   --------------------------------------------------------------- */
function waarde(veld) {
  if (!veld || typeof veld !== "object") return null;
  if ("stringValue" in veld) return veld.stringValue;
  if ("integerValue" in veld) return Number(veld.integerValue);
  if ("doubleValue" in veld) return Number(veld.doubleValue);
  if ("booleanValue" in veld) return veld.booleanValue;
  if ("nullValue" in veld) return null;
  return null;
}

export function velden(doc) {
  const uit = { id: String(doc.name || "").split("/").pop() };
  for (const [naam, veld] of Object.entries(doc.fields || {})) uit[naam] = waarde(veld);
  return uit;
}

async function haalCollectie(cfg, naam) {
  const { projectId, apiKey } = cfg.firebase;
  const documenten = [];
  let token = "";

  do {
    const url = `${BASIS}/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(naam)}` +
                `?pageSize=300&key=${encodeURIComponent(apiKey)}${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
    const antwoord = await fetch(url);

    if (!antwoord.ok) {
      const fout = new Error("Ophalen mislukte (" + antwoord.status + ")");
      fout.status = antwoord.status;
      throw fout;
    }

    const data = await antwoord.json();
    documenten.push(...(data.documents || []));
    token = data.nextPageToken || "";
  } while (token);

  return documenten.map(velden);
}

/* Een bon uit de andere app omzetten naar iets waar deze app mee rekent. */
export function leesBon(rij) {
  const stempel = Number(rij.datum || rij.gemaakt) || Date.now();
  const dag = new Date(stempel);
  return {
    id: rij.id,
    datum: `${dag.getFullYear()}-${String(dag.getMonth() + 1).padStart(2, "0")}-${String(dag.getDate()).padStart(2, "0")}`,
    bedrag: Number(rij.bedrag) || 0,
    omschrijving: String(rij.omschrijving || "").trim(),
    winkel: rij.winkel || "",
    door: rij.door || "",
  };
}

/* ---------------------------------------------------------------
   Ophalen en bijhouden
   --------------------------------------------------------------- */
export async function ververs() {
  const cfg = configuratie();
  koppeling.beschikbaar = !!cfg;
  if (!cfg) return false;

  /* Loopt er al een ronde, sluit dan daarbij aan. Anders zouden een
     tikje op "Nu ophalen", de klok en het terugkeren in de app elkaar
     kunnen overlappen en om de beurt een ouder antwoord neerzetten. */
  if (bezigMet) return bezigMet;

  bezigMet = haalOp(cfg).finally(() => { bezigMet = null; });
  return bezigMet;
}

async function haalOp(cfg) {
  koppeling.bezig = true;
  opData();

  try {
    const ruimte = cfg.ruimte || "ovs";
    const [bonnen, winkels] = await Promise.all([
      haalCollectie(cfg, `${ruimte}_bonnen`),
      haalCollectie(cfg, `${ruimte}_winkels`).catch(() => []),   // namen zijn mooi meegenomen
    ]);

    koppeling.bonnen = bonnen.map(leesBon).sort((a, b) => b.datum.localeCompare(a.datum));
    koppeling.winkels = new Map(winkels.map(w => [w.id, w.naam || ""]));
    koppeling.aantalTotaal = koppeling.bonnen.length;
    koppeling.laatst = Date.now();
    koppeling.actief = true;
    koppeling.fout = null;
    return true;
  } catch (e) {
    /* Geen bereik is geen ramp — een waarschuwing volstaat, met de
       oorzaak erbij voor als er wél iets aan de hand is. */
    console.warn("koppeling: ophalen lukte niet —", e.status || e.message);
    koppeling.fout = e.status === 403 || e.status === 401
      ? "De boodschappenapp laat niet toe dat er wordt meegelezen."
      : e.status === 404
        ? "Die collectie bestaat niet in het ingestelde project."
        : "Even geen verbinding met de boodschappenapp.";
    return false;
  } finally {
    koppeling.bezig = false;
    opData();
  }
}

export async function start({ onData } = {}) {
  if (onData) opData = onData;

  const cfg = configuratie();
  koppeling.beschikbaar = !!cfg;
  if (!cfg) return false;

  const wasAl = aan;
  aan = true;

  if (!klok) klok = setInterval(() => { if (aan) ververs(); }, HERHAAL);

  /* Kom je terug in de app, dan wil je meteen de laatste stand zien —
     en niet tot de volgende ronde wachten. */
  if (!luistertOpTerugkeer) {
    luistertOpTerugkeer = true;
    document.addEventListener("visibilitychange", () => {
      if (aan && document.visibilityState === "visible" &&
          Date.now() - koppeling.laatst > 60000) ververs();
    });
  }

  /* Stond hij al aan en zijn de bonnen nog vers, dan hoeft er niets:
     start() wordt ook aangeroepen als er alleen een andere instelling
     verandert, en dan is opnieuw ophalen zonde. */
  if (wasAl && koppeling.actief && Date.now() - koppeling.laatst < 60000) return true;

  return ververs();
}

export function stop() {
  aan = false;
  if (klok) { clearInterval(klok); klok = null; }
  koppeling.actief = false;
  koppeling.bezig = false;
  koppeling.fout = null;
  koppeling.bonnen = [];
  koppeling.winkels = new Map();
  koppeling.aantalTotaal = 0;
  koppeling.laatst = 0;
  opData();
}

/* Voor de knop "Nu ophalen" in de instellingen: haalt op en vertelt
   hoeveel er staat, of waarom het niet lukte. */
export async function haalNu() {
  if (!configuratie()) throw new Error("Er is geen boodschappenapp ingesteld.");
  const gelukt = await ververs();
  if (!gelukt) throw new Error(koppeling.fout || "Ophalen lukte niet.");
  return koppeling.aantalTotaal;
}

/* De naam van de winkel, of anders de omschrijving. */
export function bonNaam(bon) {
  return koppeling.winkels.get(bon.winkel) || bon.omschrijving || "Boodschappen";
}
