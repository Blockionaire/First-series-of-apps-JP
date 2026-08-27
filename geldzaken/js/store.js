/* =====================================================================
   GELDZAKEN — de gegevens
   =====================================================================
   Alles wat de app weet staat in `state`, en alle wijzigingen gaan hier
   doorheen. Schermen lezen uit `state` en roepen deze functies aan; ze
   praten nooit rechtstreeks met de database of met Firestore.

   Volgorde bij elke wijziging: eerst het scherm, dan de lokale
   database, dan pas de cloud. Zo voelt de app nooit traag en werkt hij
   ook in de trein gewoon door.
   ===================================================================== */

import { dbAlles, dbZet, dbWis, dbZetVeel, dbWisVeel, dbLeeg,
         beschikbaar, STORES } from "./db.js";
import * as Sync from "./sync.js";
import { CATEGORIEEN, TREFWOORDEN } from "./data/standaard.js";
import { maandNu, normaliseer, vandaagISO, maandVan } from "./util.js";

export { Sync };

/* ---------------------------------------------------------------
   De toestand
   --------------------------------------------------------------- */
export const state = {
  geladen: false,

  transacties: [],
  terugkerend: [],
  potjes: [],
  doelen: [],
  rekeningen: [],
  categorieen: [],
  regels: [],

  instellingen: {
    id: "app",
    huisNaam: "Mijn huishouden",
    valuta: "EUR",
    thema: "auto",
    /* eenvoudig = inkomen verdelen over potjes, geen uitgaven boeken.
       volledig  = alles bijhouden, tot de laatste boodschap aan toe. */
    modus: "eenvoudig",
    privacy: false,              // bedragen verbergen
    potjesAutomatisch: true,     // maandelijks automatisch in de potjes storten
    personen: [],                // wie er meedoen, voor het verdelen van uitgaven
    ingericht: false,            // is de eerste keer instellen gedaan?
    bijgewerkt: 0,
  },

  /* Wordt door de schermen gebruikt om te weten wat er te zien is. */
  maand: maandNu(),
};

const COLLECTIES = ["transacties", "terugkerend", "potjes", "doelen", "rekeningen", "categorieen", "regels"];

/* ---------------------------------------------------------------
   Abonnementen
   --------------------------------------------------------------- */
const luisteraars = new Set();

export function abonneer(fn) {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}

let meldGepland = false;
export function meld() {
  /* Meerdere wijzigingen vlak na elkaar leveren één hertekening op. */
  if (meldGepland) return;
  meldGepland = true;
  queueMicrotask(() => {
    meldGepland = false;
    luisteraars.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  });
}

/* ---------------------------------------------------------------
   Hulpjes
   --------------------------------------------------------------- */
export function nieuweId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

const nu = () => Date.now();

/* Mag ik hier iets wijzigen? Zonder cloud altijd; met cloud alleen als
   de beheerder je bewerkrechten heeft gegeven. */
export function magBewerken() {
  if (!Sync.sync.beschikbaar) return true;
  if (!Sync.sync.actief) return false;
  return ["beheerder", "bewerker"].includes(Sync.sync.lid?.rol);
}

export const isBeheerder = () => !Sync.sync.beschikbaar || Sync.sync.beheerder;

/* Draait de app op hoofdlijnen of houd je alles bij? */
export const eenvoudig = () => (state.instellingen.modus || "eenvoudig") === "eenvoudig";

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
let opslagWerkt = true;

export async function start() {
  opslagWerkt = await beschikbaar();

  if (opslagWerkt) {
    const delen = await Promise.all(STORES.map(s => dbAlles(s)));
    STORES.forEach((naam, i) => {
      const records = delen[i].filter(r => !r.verwijderd);
      if (naam === "instellingen") {
        const opgeslagen = records.find(r => r.id === "app");
        if (opgeslagen) state.instellingen = { ...state.instellingen, ...opgeslagen };
      } else {
        state[naam] = records;
      }
    });
  }

  if (!state.categorieen.length) await zetStandaardCategorieen();

  state.geladen = true;
  meld();

  Sync.startFirebase({
    onRemote: verwerkRemote,
    onStatus: meld,
    onToegang: opToegangVeranderd,
  });
}

async function zetStandaardCategorieen() {
  const nieuw = CATEGORIEEN.map(c => ({ ...c, budget: c.budget ?? null, bijgewerkt: nu() }));
  state.categorieen = nieuw;
  if (opslagWerkt) await dbZetVeel("categorieen", nieuw);
}

/* ---------------------------------------------------------------
   Wat er uit de cloud komt
   --------------------------------------------------------------- */
async function verwerkRemote(collectie, records) {
  if (collectie === "instellingen") {
    const remote = records.find(r => r.id === "app");
    if (remote && (remote.bijgewerkt || 0) > (state.instellingen.bijgewerkt || 0)) {
      state.instellingen = { ...state.instellingen, ...remote };
      if (opslagWerkt) await dbZet("instellingen", state.instellingen);
      meld();
    }
    return;
  }
  if (!COLLECTIES.includes(collectie)) return;

  const lokaal = new Map(state[collectie].map(r => [r.id, r]));
  const teBewaren = [];
  const teWissen = [];
  let veranderd = false;

  for (const remote of records) {
    const hier = lokaal.get(remote.id);

    if (remote.verwijderd) {
      if (hier) { lokaal.delete(remote.id); teWissen.push(remote.id); veranderd = true; }
      continue;
    }
    if (!hier || (remote.bijgewerkt || 0) > (hier.bijgewerkt || 0)) {
      lokaal.set(remote.id, remote);
      teBewaren.push(remote);
      veranderd = true;
    }
  }

  if (!veranderd) return;

  state[collectie] = [...lokaal.values()];
  if (opslagWerkt) {
    await dbZetVeel(collectie, teBewaren);
    await dbWisVeel(collectie, teWissen);
  }
  meld();
}

/* Zodra je toegang krijgt: staat de cloud nog leeg en heb jij hier al
   maanden bijgehouden, dan mag alles in één keer omhoog. Staat er al
   iets, dan blijven we ervan af — dan vraagt het instellingenscherm
   erom. Zo overschrijft een nieuw lid nooit de boekhouding. */
let duwGeprobeerd = false;

async function opToegangVeranderd() {
  meld();
  if (!Sync.sync.actief || duwGeprobeerd || !magBewerken()) return;
  duwGeprobeerd = true;

  const heeftLokaal = state.transacties.length || state.terugkerend.length || state.potjes.length;
  if (!heeftLokaal) return;

  try {
    if (await Sync.cloudIsLeeg()) await duwAllesOmhoog();
  } catch { /* dan blijft het bij de knop in de instellingen */ }
}

export async function duwAllesOmhoog() {
  const alles = {};
  for (const naam of COLLECTIES) alles[naam] = state[naam];
  alles.instellingen = [state.instellingen];
  await Sync.duwAllesOmhoog(alles);
}

/* ---------------------------------------------------------------
   Schrijven
   --------------------------------------------------------------- */
async function bewaar(collectie, record) {
  record.bijgewerkt = nu();
  const lijst = state[collectie];
  const i = lijst.findIndex(r => r.id === record.id);
  if (i >= 0) lijst[i] = record; else lijst.push(record);

  meld();
  if (opslagWerkt) await dbZet(collectie, record);
  Sync.zetRemote(collectie, record);
  return record;
}

async function wis(collectie, id) {
  state[collectie] = state[collectie].filter(r => r.id !== id);
  meld();
  if (opslagWerkt) await dbWis(collectie, id);
  Sync.wisRemote(collectie, id);
}

/* ---------------------------------------------------------------
   Instellingen
   --------------------------------------------------------------- */
export async function zetInstelling(velden) {
  state.instellingen = { ...state.instellingen, ...velden, bijgewerkt: nu() };
  meld();
  if (opslagWerkt) await dbZet("instellingen", state.instellingen);
  Sync.zetRemote("instellingen", state.instellingen);
}

/* =====================================================================
   TRANSACTIES
   ===================================================================== */
export function legeTransactie(velden = {}) {
  return {
    id: nieuweId(),
    datum: vandaagISO(),
    bedrag: null,
    soort: "uitgave",        // inkomst | uitgave | sparen | opname | overboeking
    categorie: "",
    omschrijving: "",
    rekening: standaardRekening()?.id || "",
    naarRekening: "",
    potje: "",
    doel: "",
    persoon: "",
    terugkerendId: "",
    notitie: "",
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export const standaardRekening = () =>
  state.rekeningen.find(r => r.standaard) ||
  state.rekeningen.find(r => r.soort === "betaal") ||
  state.rekeningen[0];

export async function bewaarTransactie(t) {
  const schoon = {
    ...t,
    bedrag: Math.abs(Number(t.bedrag) || 0),
    omschrijving: String(t.omschrijving || "").trim(),
  };
  /* Van een omschrijving die je zelf indeelt leert de app een regel, zodat
     de volgende keer de categorie al klaarstaat. */
  if (schoon.omschrijving && schoon.categorie) leerRegel(schoon.omschrijving, schoon.categorie);
  return bewaar("transacties", schoon);
}

export const wisTransactie = id => wis("transacties", id);

export async function bewaarVeelTransacties(lijst) {
  const klaar = lijst.map(t => ({
    ...legeTransactie(),
    ...t,
    bedrag: Math.abs(Number(t.bedrag) || 0),
    bijgewerkt: nu(),
  }));
  state.transacties = [...state.transacties, ...klaar];
  meld();
  if (opslagWerkt) await dbZetVeel("transacties", klaar);
  for (const t of klaar) Sync.zetRemote("transacties", t);
  return klaar;
}

/* Een vaste last afvinken maakt gewoon een boeking aan die eraan hangt. */
export async function boekVasteLast(post, { datum, bedrag } = {}) {
  return bewaarTransactie(legeTransactie({
    datum: datum || vandaagISO(),
    bedrag: bedrag ?? post.bedrag,
    soort: post.soort === "inkomst" ? "inkomst" : "uitgave",
    categorie: post.categorie,
    omschrijving: post.naam,
    rekening: post.rekening || standaardRekening()?.id || "",
    persoon: post.persoon || "",
    terugkerendId: post.id,
  }));
}

/* =====================================================================
   VASTE LASTEN EN VAST INKOMEN
   ===================================================================== */
export function legePost(velden = {}) {
  return {
    id: nieuweId(),
    naam: "",
    bedrag: null,
    soort: "uitgave",
    categorie: "",
    ritme: "maand",
    dag: 1,
    startMaand: maandNu(),
    eindMaand: "",
    rekening: standaardRekening()?.id || "",
    persoon: "",
    incasso: true,
    actief: true,
    notitie: "",
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export const bewaarPost = p => bewaar("terugkerend", { ...p, bedrag: Math.abs(Number(p.bedrag) || 0) });
export const wisPost = id => wis("terugkerend", id);

/* =====================================================================
   POTJES
   ===================================================================== */
export function legPotje(velden = {}) {
  return {
    id: nieuweId(),
    naam: "",
    icoon: "🫙",
    kleur: "#3ddc97",
    soort: "sparen",     // vast | sparen | vrij — zie bereken.js
    maandelijks: 0,
    doelBedrag: null,
    startMaand: maandNu(),
    volgorde: state.potjes.length,
    actief: true,
    notitie: "",
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export const bewaarPotje = p => bewaar("potjes", p);
export const wisPotje = id => wis("potjes", id);

/* =====================================================================
   SPAARDOELEN
   ===================================================================== */
export function legDoel(velden = {}) {
  return {
    id: nieuweId(),
    naam: "",
    icoon: "🎯",
    kleur: "#5b8dff",
    doelBedrag: null,
    startBedrag: 0,
    streefDatum: "",
    rekening: state.rekeningen.find(r => r.soort === "spaar")?.id || "",
    notitie: "",
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export const bewaarDoel = d => bewaar("doelen", d);
export const wisDoel = id => wis("doelen", id);

/* =====================================================================
   REKENINGEN
   ===================================================================== */
export function legeRekening(velden = {}) {
  return {
    id: nieuweId(),
    naam: "",
    soort: "betaal",      // betaal | spaar | beleggen | contant | schuld
    beginsaldo: 0,
    iban: "",
    kleur: "#5b8dff",
    telMee: true,
    standaard: false,
    volgorde: state.rekeningen.length,
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export async function bewaarRekening(r) {
  /* Er kan er maar één de standaardrekening zijn. */
  if (r.standaard) {
    for (const ander of state.rekeningen) {
      if (ander.id !== r.id && ander.standaard) await bewaar("rekeningen", { ...ander, standaard: false });
    }
  }
  return bewaar("rekeningen", r);
}
export const wisRekening = id => wis("rekeningen", id);

/* =====================================================================
   CATEGORIEËN
   ===================================================================== */
export function legeCategorie(velden = {}) {
  return {
    id: nieuweId(),
    naam: "",
    icoon: "▫️",
    kleur: "#8b98a9",
    soort: "uitgave",
    budget: null,
    vast: false,
    aangemaakt: nu(),
    bijgewerkt: nu(),
    ...velden,
  };
}

export const bewaarCategorie = c => bewaar("categorieen", c);
export const wisCategorie = id => wis("categorieen", id);

export const categorie = id => state.categorieen.find(c => c.id === id) || null;
export const categorieNaam = id => categorie(id)?.naam || "Zonder categorie";

/* =====================================================================
   REGELS — omschrijving herkennen en indelen
   ===================================================================== */
export function raadCategorie(omschrijving, soort = "uitgave") {
  const tekst = normaliseer(omschrijving);
  if (!tekst) return "";

  /* Eerst je eigen regels: die winnen altijd van de ingebouwde lijst. */
  const eigen = state.regels
    .filter(r => r.trefwoord && tekst.includes(normaliseer(r.trefwoord)))
    .sort((a, b) => b.trefwoord.length - a.trefwoord.length)[0];
  if (eigen && state.categorieen.some(c => c.id === eigen.categorie)) return eigen.categorie;

  for (const [catId, woorden] of TREFWOORDEN) {
    if (!state.categorieen.some(c => c.id === catId)) continue;
    const cat = categorie(catId);
    if (cat && soort && cat.soort !== soort) continue;
    if (woorden.some(w => tekst.includes(w))) return catId;
  }
  return "";
}

/* Onthoudt de eerste twee woorden van een omschrijving als trefwoord.
   "Albert Heijn 1234 Amsterdam" wordt dus "albert heijn". */
function leerRegel(omschrijving, categorieId) {
  const kern = normaliseer(omschrijving).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2).slice(0, 2).join(" ");
  if (kern.length < 4) return;
  const bestaand = state.regels.find(r => normaliseer(r.trefwoord) === kern);
  if (bestaand) {
    if (bestaand.categorie !== categorieId) bewaar("regels", { ...bestaand, categorie: categorieId });
    return;
  }
  bewaar("regels", { id: nieuweId(), trefwoord: kern, categorie: categorieId, aangemaakt: nu(), bijgewerkt: nu() });
}

export const bewaarRegel = r => bewaar("regels", r);
export const wisRegel = id => wis("regels", id);

/* =====================================================================
   PERSONEN — wie doen er mee in dit huishouden
   ===================================================================== */
export async function zetPersonen(personen) {
  await zetInstelling({ personen });
}

/* =====================================================================
   IN- EN UITVOER
   ===================================================================== */
export function alsBackup() {
  return JSON.stringify({
    app: "geldzaken",
    versie: 1,
    gemaakt: new Date().toISOString(),
    instellingen: state.instellingen,
    transacties: state.transacties,
    terugkerend: state.terugkerend,
    potjes: state.potjes,
    doelen: state.doelen,
    rekeningen: state.rekeningen,
    categorieen: state.categorieen,
    regels: state.regels,
  }, null, 2);
}

export async function herstelBackup(tekst, { vervang = false } = {}) {
  const data = JSON.parse(tekst);
  if (data.app !== "geldzaken") throw new Error("Dit is geen back-up van Geldzaken.");

  if (vervang) {
    for (const naam of COLLECTIES) {
      state[naam] = [];
      if (opslagWerkt) await dbLeeg(naam);
    }
  }

  let aantal = 0;
  for (const naam of COLLECTIES) {
    const records = (data[naam] || []).filter(r => r && r.id);
    if (!records.length) continue;
    const lokaal = new Map(state[naam].map(r => [r.id, r]));
    for (const r of records) { lokaal.set(r.id, r); aantal++; }
    state[naam] = [...lokaal.values()];
    if (opslagWerkt) await dbZetVeel(naam, records);
    for (const r of records) Sync.zetRemote(naam, r);
  }

  if (data.instellingen) await zetInstelling({ ...data.instellingen, id: "app" });
  meld();
  return aantal;
}

/* Transacties als CSV, met puntkomma's zodat Excel in Nederland er
   meteen kolommen van maakt. */
export function alsCSV(transacties = state.transacties) {
  const veilig = w => {
    const s = String(w ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kop = ["datum", "omschrijving", "bedrag", "soort", "categorie", "rekening", "potje", "doel", "persoon", "notitie"];
  const regels = [...transacties]
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map(t => [
      t.datum,
      t.omschrijving,
      String(Number(t.bedrag) || 0).replace(".", ","),
      t.soort,
      categorieNaam(t.categorie),
      state.rekeningen.find(r => r.id === t.rekening)?.naam || "",
      state.potjes.find(p => p.id === t.potje)?.naam || "",
      state.doelen.find(d => d.id === t.doel)?.naam || "",
      t.persoon || "",
      t.notitie || "",
    ].map(veilig).join(";"));
  return [kop.join(";"), ...regels].join("\n");
}

/* Alles wissen — alleen vanuit de instellingen, met bevestiging. */
export async function wisAlles() {
  for (const naam of COLLECTIES) {
    const ids = state[naam].map(r => r.id);
    state[naam] = [];
    if (opslagWerkt) await dbLeeg(naam);
    for (const id of ids) Sync.wisRemote(naam, id);
  }
  await zetStandaardCategorieen();
  meld();
}

/* =====================================================================
   ZOEKEN
   ===================================================================== */
export function zoek(tekst, { soort = "", categorie: cat = "", maand = "", persoon = "", rekening = "" } = {}) {
  const naald = normaliseer(tekst);
  return state.transacties
    .filter(t => {
      if (soort && t.soort !== soort) return false;
      if (cat && t.categorie !== cat) return false;
      if (maand && maandVan(t.datum) !== maand) return false;
      if (persoon && t.persoon !== persoon) return false;
      if (rekening && t.rekening !== rekening && t.naarRekening !== rekening) return false;
      if (!naald) return true;
      return normaliseer(t.omschrijving).includes(naald) ||
             normaliseer(t.notitie).includes(naald) ||
             normaliseer(categorieNaam(t.categorie)).includes(naald) ||
             String(t.bedrag).includes(naald);
    })
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || 0) - (a.aangemaakt || 0));
}

/* Omschrijvingen die je vaker gebruikt, voor de suggesties bij het
   toevoegen. */
export function vaakGebruikt(soort = "uitgave", aantal = 8) {
  const tellingen = new Map();
  for (const t of state.transacties) {
    if (t.soort !== soort || !t.omschrijving) continue;
    const sleutel = t.omschrijving.trim();
    const vorig = tellingen.get(sleutel) || { aantal: 0, transactie: t };
    vorig.aantal++;
    if (t.datum > vorig.transactie.datum) vorig.transactie = t;
    tellingen.set(sleutel, vorig);
  }
  return [...tellingen.entries()]
    .sort((a, b) => b[1].aantal - a[1].aantal)
    .slice(0, aantal)
    .map(([naam, info]) => ({ naam, ...info }));
}
