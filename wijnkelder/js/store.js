/* =====================================================================
   WIJNKELDER — de kelder zelf
   =====================================================================
   Alle gegevens van de app staan hier, en alle wijzigingen gaan hier
   doorheen. Schermen lezen uit `state` en roepen de functies aan; ze
   praten nooit rechtstreeks met de database of met Firestore.

   Volgorde bij elke wijziging: eerst lokaal wegschrijven, dan het scherm
   bijwerken, dan pas de cloud. Zo voelt de app nooit traag en werkt hij
   ook met een slechte verbinding gewoon door.
   ===================================================================== */

import { dbAlles, dbZet, dbWis, dbZetVeel, dbLeeg, beschikbaar } from "./db.js";
import * as Sync from "./sync.js";

export { Sync };

/* ---------------------------------------------------------------
   De toestand
   --------------------------------------------------------------- */
export const state = {
  geladen: false,
  flessen: [],
  notities: [],
  historie: [],
  wenslijst: [],
  instellingen: {
    id: "app",
    valuta: "EUR",
    thema: "auto",
    kelders: [{ naam: "Kelder", rekken: 4, rijen: 6, vakken: 8 }],
    bijgewerkt: 0,
  },
};

const COLLECTIES = ["flessen", "notities", "historie", "wenslijst"];

/* ---------------------------------------------------------------
   Abonnementen — schermen tekenen zichzelf opnieuw bij een wijziging
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

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
let opslagWerkt = true;

export async function start() {
  opslagWerkt = await beschikbaar();

  if (opslagWerkt) {
    const [flessen, notities, historie, wenslijst, instellingen] = await Promise.all([
      dbAlles("flessen"), dbAlles("notities"), dbAlles("historie"),
      dbAlles("wenslijst"), dbAlles("instellingen"),
    ]);
    state.flessen = flessen.filter(f => !f.verwijderd);
    state.notities = notities.filter(n => !n.verwijderd);
    state.historie = historie.filter(h => !h.verwijderd);
    state.wenslijst = wenslijst.filter(w => !w.verwijderd);
    const opgeslagen = instellingen.find(i => i.id === "app");
    if (opgeslagen) state.instellingen = { ...state.instellingen, ...opgeslagen };
  }

  state.geladen = true;
  meld();

  /* De cloud mag rustig een seconde later binnenkomen. */
  Sync.startFirebase({ onRemote: verwerkRemote, onStatus: meld });
}

/* ---------------------------------------------------------------
   Samenvoegen van wat uit de cloud komt
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
    await Promise.all(teWissen.map(id => dbWis(collectie, id)));
  }
  meld();
}

/* ---------------------------------------------------------------
   Algemene schrijfacties
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

/* =====================================================================
   FLESSEN
   ===================================================================== */

export function legeFles() {
  return {
    id: nieuweId(),
    naam: "",
    producent: "",
    land: "",
    regio: "",
    appellatie: "",
    classificatie: "",
    kleur: "rood",
    druiven: [],
    jaargang: null,
    alcohol: null,
    aantal: 1,
    formaat: "fles",
    aankoopPrijs: null,
    huidigeWaarde: null,
    aankoopDatum: "",
    leverancier: "",
    locatie: { kelder: "Kelder", rek: "", rij: null, vak: null },
    drinkVanaf: null,
    drinkTot: null,
    foto: "",
    notitie: "",
    score: null,
    favoriet: false,
    aangemaakt: nu(),
    bijgewerkt: nu(),
  };
}

export async function bewaarFles(fles) {
  const nieuw = !state.flessen.some(f => f.id === fles.id);
  const opgeslagen = await bewaar("flessen", { ...fles });
  if (nieuw) {
    await voegHistorieToe({
      type: "toegevoegd",
      flesId: opgeslagen.id,
      aantal: opgeslagen.aantal,
      tekst: `${opgeslagen.aantal}× toegevoegd aan de kelder`,
    });
  }
  return opgeslagen;
}

export async function verwijderFles(id) {
  const fles = vindFles(id);
  if (fles) {
    await voegHistorieToe({
      type: "verwijderd",
      flesId: id,
      aantal: fles.aantal,
      tekst: "Uit de kelder gehaald",
    });
  }
  await wis("flessen", id);
}

export const vindFles = id => state.flessen.find(f => f.id === id);

/* Een fles openen. Gaat de laatste eruit, dan verdwijnt hij uit de
   kelder maar blijft hij in de historie en houden de proefnotities
   hun plek — je wilt later kunnen opzoeken wat je ervan vond. */
export async function drinkFles(id, { aantal = 1, gelegenheid = "", notitie = "", score = null, datum = null } = {}) {
  const fles = vindFles(id);
  if (!fles) return;

  const aantalOpen = Math.min(aantal, fles.aantal);
  const rest = fles.aantal - aantalOpen;

  await voegHistorieToe({
    type: "gedronken",
    flesId: id,
    aantal: aantalOpen,
    datum: datum || new Date().toISOString().slice(0, 10),
    gelegenheid,
    tekst: notitie,
    score,
    momentopname: momentopname(fles),
  });

  if (score != null || notitie) {
    await bewaarNotitie({
      id: nieuweId(),
      flesId: id,
      datum: datum || new Date().toISOString().slice(0, 10),
      score,
      tekst: notitie,
      geur: "",
      smaak: "",
      opnieuw: null,
      momentopname: momentopname(fles),
    });
  }

  if (rest > 0) {
    await bewaarFles({ ...fles, aantal: rest });
  } else {
    await wis("flessen", id);
  }
}

/* Wat we van een fles onthouden nadat hij weg is. */
function momentopname(f) {
  return {
    naam: f.naam, producent: f.producent, jaargang: f.jaargang,
    kleur: f.kleur, land: f.land, regio: f.regio, appellatie: f.appellatie,
    druiven: f.druiven, foto: f.foto, aankoopPrijs: f.aankoopPrijs,
  };
}

export async function pasAantalAan(id, delta) {
  const fles = vindFles(id);
  if (!fles) return;
  const nieuwAantal = Math.max(0, fles.aantal + delta);
  if (nieuwAantal === 0) return verwijderFles(id);
  await bewaarFles({ ...fles, aantal: nieuwAantal });
}

export async function zetFavoriet(id, waarde) {
  const fles = vindFles(id);
  if (fles) await bewaar("flessen", { ...fles, favoriet: !!waarde });
}

/* =====================================================================
   PROEFNOTITIES
   ===================================================================== */

export const bewaarNotitie = n => bewaar("notities", { ...n });
export const verwijderNotitie = id => wis("notities", id);
export const notitiesVan = flesId =>
  state.notities.filter(n => n.flesId === flesId).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

/* =====================================================================
   HISTORIE
   ===================================================================== */

export async function voegHistorieToe(gebeurtenis) {
  return bewaar("historie", {
    id: nieuweId(),
    datum: new Date().toISOString().slice(0, 10),
    moment: nu(),
    ...gebeurtenis,
  });
}

export const verwijderHistorie = id => wis("historie", id);

export const historieGesorteerd = () =>
  [...state.historie].sort((a, b) => (b.moment || 0) - (a.moment || 0));

/* =====================================================================
   WENSLIJST
   ===================================================================== */

export function legeWens() {
  return {
    id: nieuweId(), naam: "", producent: "", land: "", regio: "",
    kleur: "rood", jaargang: null, prijs: null, winkel: "", notitie: "",
    aangemaakt: nu(), bijgewerkt: nu(),
  };
}

export const bewaarWens = w => bewaar("wenslijst", { ...w });
export const verwijderWens = id => wis("wenslijst", id);

/* Een wens die je gekocht hebt verhuist naar de kelder. */
export async function wensNaarKelder(wensId) {
  const w = state.wenslijst.find(x => x.id === wensId);
  if (!w) return null;
  const fles = {
    ...legeFles(),
    naam: w.naam, producent: w.producent, land: w.land, regio: w.regio,
    kleur: w.kleur, jaargang: w.jaargang, aankoopPrijs: w.prijs,
    leverancier: w.winkel, notitie: w.notitie,
  };
  await bewaarFles(fles);
  await verwijderWens(wensId);
  return fles;
}

/* =====================================================================
   INSTELLINGEN
   ===================================================================== */

export async function bewaarInstellingen(wijziging) {
  state.instellingen = { ...state.instellingen, ...wijziging, id: "app", bijgewerkt: nu() };
  meld();
  if (opslagWerkt) await dbZet("instellingen", state.instellingen);
  Sync.zetRemote("instellingen", state.instellingen);
}

/* =====================================================================
   BACK-UP
   ===================================================================== */

export function exporteer() {
  return JSON.stringify({
    app: "wijnkelder",
    versie: 1,
    gemaakt: new Date().toISOString(),
    flessen: state.flessen,
    notities: state.notities,
    historie: state.historie,
    wenslijst: state.wenslijst,
    instellingen: state.instellingen,
  }, null, 2);
}

export async function importeer(json, { vervang = false } = {}) {
  const data = JSON.parse(json);
  if (data.app !== "wijnkelder") throw new Error("Dit is geen back-up van Wijnkelder.");

  if (vervang) {
    for (const c of COLLECTIES) { state[c] = []; if (opslagWerkt) await dbLeeg(c); }
  }

  let toegevoegd = 0;
  for (const collectie of COLLECTIES) {
    const records = data[collectie] || [];
    for (const rec of records) {
      const bestaat = state[collectie].some(r => r.id === rec.id);
      if (bestaat && !vervang) continue;
      state[collectie].push(rec);
      toegevoegd++;
    }
    if (opslagWerkt) await dbZetVeel(collectie, records);
  }

  if (data.instellingen) {
    state.instellingen = { ...state.instellingen, ...data.instellingen, id: "app" };
    if (opslagWerkt) await dbZet("instellingen", state.instellingen);
  }

  meld();

  /* Wat je importeert hoort ook in de cloud terecht te komen. */
  if (Sync.sync.actief) {
    await Sync.duwAllesOmhoog({
      flessen: state.flessen, notities: state.notities,
      historie: state.historie, wenslijst: state.wenslijst,
    });
  }
  return toegevoegd;
}

export async function wisAlles() {
  for (const c of COLLECTIES) {
    for (const rec of [...state[c]]) Sync.wisRemote(c, rec.id);
    state[c] = [];
    if (opslagWerkt) await dbLeeg(c);
  }
  meld();
}

/* Na het inloggen: zet wat hier al stond in de cloud. */
export async function duwLokaalOmhoog() {
  await Sync.duwAllesOmhoog({
    flessen: state.flessen, notities: state.notities,
    historie: state.historie, wenslijst: state.wenslijst,
    instellingen: [state.instellingen],
  });
}

/* =====================================================================
   AFGELEIDE CIJFERS
   ===================================================================== */

export function totalen() {
  const flessen = state.flessen;
  const aantal = flessen.reduce((s, f) => s + (f.aantal || 0), 0);
  const aankoop = flessen.reduce((s, f) => s + (Number(f.aankoopPrijs) || 0) * (f.aantal || 0), 0);
  const waarde = flessen.reduce((s, f) =>
    s + ((Number(f.huidigeWaarde) || Number(f.aankoopPrijs) || 0) * (f.aantal || 0)), 0);

  /* Alleen flessen waar je zelf een huidige waarde bij zette tellen mee
     in het rendement — anders reken je jezelf rijk met je eigen bonnen. */
  const gewaardeerd = flessen.filter(f => Number(f.huidigeWaarde) > 0 && Number(f.aankoopPrijs) > 0);
  const gewaardeerdAankoop = gewaardeerd.reduce((s, f) => s + Number(f.aankoopPrijs) * f.aantal, 0);
  const gewaardeerdNu = gewaardeerd.reduce((s, f) => s + Number(f.huidigeWaarde) * f.aantal, 0);

  return {
    aantalFlessen: aantal,
    aantalWijnen: flessen.length,
    aankoopwaarde: aankoop,
    huidigeWaarde: waarde,
    winst: gewaardeerdNu - gewaardeerdAankoop,
    winstBasis: gewaardeerdAankoop,
    gewaardeerdeFlessen: gewaardeerd.length,
    gemiddeldePrijs: aantal ? aankoop / aantal : 0,
  };
}

export function gedronkenTotalen() {
  const g = state.historie.filter(h => h.type === "gedronken");
  const dit = new Date().getFullYear();
  return {
    totaal: g.reduce((s, h) => s + (h.aantal || 1), 0),
    ditJaar: g.filter(h => (h.datum || "").startsWith(String(dit))).reduce((s, h) => s + (h.aantal || 1), 0),
  };
}
