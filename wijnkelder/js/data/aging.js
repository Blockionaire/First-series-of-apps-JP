/* =====================================================================
   WIJNKELDER — rijping
   =====================================================================
   Berekent per fles een drinkvenster en waar de wijn zich daarin
   bevindt. Dat venster is een schatting, geen orakel: hij komt uit de
   regio, de kleur, de druiven en wat je voor de fles betaald hebt.

   Zodra je zelf een drinkvenster invult op de wijnfiche, wint dat
   altijd van de schatting. De app rekent dan verder met jouw getallen.
   ===================================================================== */

import { regioInfo, druifInfo, regioVanAppellatie } from "./catalog.js";

/* ---------------------------------------------------------------
   Basisvensters per regiostijl, in jaren ná het oogstjaar.
   [vanaf, tot]
   --------------------------------------------------------------- */
const STIJLEN = {
  bordeaux:            { rood: [3, 10], wit: [1, 5],  zoet: [4, 25], rose: [0, 2], mousserend: [0, 3] },
  bourgogne:           { rood: [2, 8],  wit: [1, 7],  zoet: [3, 12], rose: [0, 2], mousserend: [1, 5] },
  champagne:           { mousserend: [1, 7], wit: [1, 6], rose: [1, 6], rood: [2, 6] },
  "rhone-noord":       { rood: [3, 12], wit: [1, 6],  rose: [0, 2] },
  "rhone-zuid":        { rood: [2, 9],  wit: [1, 4],  rose: [0, 2] },
  loire:               { rood: [2, 7],  wit: [1, 8],  zoet: [4, 20], mousserend: [1, 4], rose: [0, 2] },
  elzas:               { wit: [2, 8],   rood: [1, 5], zoet: [4, 20], mousserend: [1, 4], rose: [0, 2] },
  beaujolais:          { rood: [1, 5],  wit: [1, 3],  rose: [0, 2] },
  languedoc:           { rood: [2, 7],  wit: [1, 3],  rose: [0, 2], versterkt: [3, 20] },
  provence:            { rose: [0, 3],  rood: [2, 10], wit: [1, 4] },
  zuidwest:            { rood: [2, 10], wit: [1, 5],  zoet: [4, 18] },
  jura:                { wit: [2, 12],  rood: [2, 7], mousserend: [1, 4] },

  piemonte:            { rood: [4, 14], wit: [1, 4],  mousserend: [0, 2], zoet: [0, 3] },
  toscane:             { rood: [2, 11], wit: [1, 3],  rose: [0, 2] },
  veneto:              { rood: [2, 10], wit: [1, 5],  mousserend: [0, 3], zoet: [4, 18], rose: [0, 2] },
  "italie-wit":        { wit: [1, 5],   rood: [2, 7], mousserend: [1, 4], oranje: [2, 8] },
  "italie-zuid":       { rood: [2, 8],  wit: [1, 4],  zoet: [3, 14], rose: [0, 2], versterkt: [3, 20] },

  rioja:               { rood: [2, 11], wit: [2, 8],  rose: [0, 2] },
  ribera:              { rood: [3, 13], wit: [1, 4],  rose: [0, 2] },
  priorat:             { rood: [3, 13], wit: [1, 5] },
  "spanje-wit":        { wit: [1, 5],   rood: [2, 7], rose: [0, 2] },
  "spanje-rood":       { rood: [2, 8],  wit: [1, 4],  rose: [0, 2] },
  cava:                { mousserend: [1, 5], wit: [1, 3], rose: [1, 4] },
  sherry:              { versterkt: [0, 10], wit: [0, 3] },

  porto:               { versterkt: [3, 25], rood: [2, 10], wit: [1, 4] },
  portugal:            { rood: [2, 8],  wit: [1, 4],  versterkt: [4, 30], rose: [0, 2], mousserend: [1, 3] },

  riesling:            { wit: [2, 12],  zoet: [4, 25], rood: [2, 7], mousserend: [1, 4], rose: [0, 2] },
  "duitsland-rood":    { rood: [2, 8],  wit: [1, 6],  mousserend: [1, 4], rose: [0, 2] },
  oostenrijk:          { wit: [2, 8],   rood: [2, 8], zoet: [4, 20], rose: [0, 2], mousserend: [1, 4] },

  griekenland:         { wit: [1, 5],   rood: [2, 10], zoet: [4, 20], rose: [0, 2] },
  tokaji:              { zoet: [4, 25], wit: [2, 8],  rood: [2, 7] },
  zwitserland:         { wit: [1, 4],   rood: [2, 7], rose: [0, 2] },
  "koel-klimaat":      { wit: [1, 4],   rood: [1, 5], mousserend: [1, 4], rose: [0, 2] },
  "engeland-mousserend": { mousserend: [2, 8], wit: [1, 4], rose: [1, 5] },

  californie:          { rood: [2, 11], wit: [1, 6],  mousserend: [1, 5], rose: [0, 2], zoet: [3, 14] },
  argentinie:          { rood: [2, 9],  wit: [1, 4],  rose: [0, 2] },
  chili:               { rood: [2, 9],  wit: [1, 4],  rose: [0, 2] },
  australie:           { rood: [2, 11], wit: [2, 8],  mousserend: [1, 5], zoet: [3, 14], rose: [0, 2] },
  "nieuw-zeeland":     { wit: [1, 5],   rood: [2, 7], mousserend: [1, 4], rose: [0, 2] },
  "zuid-afrika":       { rood: [2, 9],  wit: [1, 7],  mousserend: [1, 5], rose: [0, 2] },

  standaard:           { rood: [2, 8], wit: [1, 4], rose: [0, 2], mousserend: [0, 3], zoet: [3, 14], versterkt: [3, 20], oranje: [1, 6] },
};

/* Vangnet als een kleur niet in een stijl staat. */
const KLEUR_FALLBACK = {
  rood: [2, 8], wit: [1, 4], rose: [0, 2],
  mousserend: [0, 3], zoet: [3, 14], versterkt: [3, 20], oranje: [1, 6],
};

/* ---------------------------------------------------------------
   Woorden in een appellatie of wijnnaam die iets zeggen over de
   ambitie van de fles — en dus over hoe lang hij kan liggen.
   --------------------------------------------------------------- */
const KWALITEITSWOORDEN = [
  { woord: "gran selezione",   factor: 1.45 },
  { woord: "gran reserva",     factor: 1.45 },
  { woord: "grand cru classé", factor: 1.55 },
  { woord: "grand cru",        factor: 1.5 },
  { woord: "premier cru",      factor: 1.3 },
  { woord: "1er cru",          factor: 1.3 },
  { woord: "premier grand",    factor: 1.6 },
  { woord: "gran selección",   factor: 1.4 },
  { woord: "grosses gewächs",  factor: 1.35 },
  { woord: "grand vin",        factor: 1.3 },
  { woord: "riserva",          factor: 1.3 },
  { woord: "reserva",          factor: 1.25 },
  { woord: "réserve",          factor: 1.2 },
  { woord: "vieilles vignes",  factor: 1.2 },
  { woord: "single vineyard",  factor: 1.2 },
  { woord: "vintage",          factor: 1.4 },
  { woord: "crianza",          factor: 0.95 },
  { woord: "primeur",          factor: 0.4 },
  { woord: "nouveau",          factor: 0.35 },
  { woord: "joven",            factor: 0.7 },
];

/* Prijs per fles (0,75 l) zegt iets over de concentratie en dus over
   de houdbaarheid. Grof, maar in de praktijk verrassend bruikbaar. */
function prijsFactor(prijsPerFles) {
  const p = Number(prijsPerFles);
  if (!p || p <= 0) return 1;
  if (p < 7)   return 0.55;
  if (p < 12)  return 0.70;
  if (p < 20)  return 0.85;
  if (p < 35)  return 1.05;
  if (p < 60)  return 1.30;
  if (p < 120) return 1.60;
  if (p < 300) return 2.00;
  return 2.40;
}

/* Het bewaarvermogen van de druiven zelf (1–5), gemiddeld. */
function druifFactor(druiven) {
  const scores = (druiven || []).map(d => druifInfo(d)?.bewaar).filter(Boolean);
  if (!scores.length) return 1;
  const gem = scores.reduce((a, b) => a + b, 0) / scores.length;
  return 0.7 + (gem / 5) * 0.6;   // 1 → 0,82   3 → 1,06   5 → 1,3
}

/* ---------------------------------------------------------------
   Het drinkvenster van een fles, in kalenderjaren.
   --------------------------------------------------------------- */
export function drinkVenster(fles) {
  /* Zelf ingevuld wint altijd. */
  if (fles.drinkVanaf && fles.drinkTot) {
    return { vanaf: Number(fles.drinkVanaf), tot: Number(fles.drinkTot), bron: "eigen" };
  }

  const jaar = Number(fles.jaargang);
  if (!jaar) return null;                       // zonder oogstjaar valt er niets te rekenen

  const regio = regioInfo(fles.land, fles.regio) || regioVanAppellatie(fles.appellatie);
  const stijl = STIJLEN[regio?.stijl] || STIJLEN.standaard;
  const basis = stijl[fles.kleur] || KLEUR_FALLBACK[fles.kleur] || KLEUR_FALLBACK.rood;

  const tekst = `${fles.appellatie || ""} ${fles.naam || ""} ${fles.classificatie || ""}`.toLowerCase();
  let kwaliteit = 1;
  for (const k of KWALITEITSWOORDEN) {
    if (tekst.includes(k.woord)) { kwaliteit = k.factor; break; }
  }

  /* De drie factoren tellen op in plaats van dat ze zich
     vermenigvuldigen. Vermenigvuldigen liep uit de hand: een dure fles
     van een goede druif met "Grand Cru" op het etiket kwam dan op een
     drinkvenster van veertig jaar uit, ook als het om een wijn ging die
     na vijftien jaar echt wel klaar is. De prijs weegt het zwaarst —
     die zegt in de praktijk het meest over de ambitie van een fles. */
  const rauw = 1
    + 0.8 * (kwaliteit - 1)
    + 1.0 * (prijsFactor(fles.aankoopPrijs) - 1)
    + 0.5 * (druifFactor(fles.druiven) - 1);
  const factor = Math.min(2.6, Math.max(0.35, rauw));

  /* De ondergrens beweegt minder hard mee dan de bovengrens: een
     ambitieuze wijn wordt vooral láter oud, niet veel later lekker. */
  const vanaf = Math.round(basis[0] * (1 + (factor - 1) * 0.5));
  const tot   = Math.round(basis[1] * factor);

  return {
    vanaf: jaar + Math.max(0, vanaf),
    tot:   jaar + Math.max(vanaf + 1, tot),
    bron:  "schatting",
  };
}

/* ---------------------------------------------------------------
   De rijpingsfases
   --------------------------------------------------------------- */
export const FASES = {
  jong:      { id: "jong",      naam: "Te jong",          kort: "Jong",    kleur: "#4b8fd6", emoji: "🌱", uitleg: "Deze fles heeft nog tijd nodig. Nu openen kan, maar je laat er iets voor liggen." },
  opdreef:   { id: "opdreef",   naam: "Komt op dreef",    kort: "Op dreef", kleur: "#54a86b", emoji: "🌿", uitleg: "De wijn begint zich te openen. Prima te drinken, en hij wordt nog beter." },
  top:       { id: "top",       naam: "Op zijn top",      kort: "Top",     kleur: "#c9a227", emoji: "⭐", uitleg: "Dit is het venster waar je op wachtte. Nu is het moment." },
  rijp:      { id: "rijp",      naam: "Drink nu",         kort: "Drink nu", kleur: "#d97b2b", emoji: "🍂", uitleg: "Nog helemaal in orde, maar wachten levert niets meer op. Zet hem op de planning." },
  voorbij:   { id: "voorbij",   naam: "Over hoogtepunt",  kort: "Voorbij", kleur: "#a04747", emoji: "⌛", uitleg: "Volgens de schatting voorbij zijn beste tijd. Flessen verrassen soms — open hem snel." },
  onbekend:  { id: "onbekend",  naam: "Onbekend",         kort: "Geen jaar", kleur: "#8a8377", emoji: "❔", uitleg: "Zonder oogstjaar kan de app de rijping niet volgen. Vul de jaargang in of zet zelf een drinkvenster." },
};

/* Waar staat deze fles vandaag? */
export function rijping(fles, nu = new Date()) {
  const venster = drinkVenster(fles);
  if (!venster) return { fase: FASES.onbekend, positie: null, venster: null, jarenTot: null };

  const jaarNu = nu.getFullYear() + (nu.getMonth() / 12);
  const breedte = Math.max(1, venster.tot - venster.vanaf);
  const positie = (jaarNu - venster.vanaf) / breedte;

  let fase;
  if (positie < 0)         fase = FASES.jong;
  else if (positie < 0.25) fase = FASES.opdreef;
  else if (positie < 0.7)  fase = FASES.top;
  else if (positie <= 1)   fase = FASES.rijp;
  else                     fase = FASES.voorbij;

  return {
    fase,
    positie,
    venster,
    /* Positief = zoveel jaar tot het venster opengaat, negatief = al open. */
    jarenTot: Math.round((venster.vanaf - jaarNu) * 10) / 10,
    jarenOver: Math.round((venster.tot - jaarNu) * 10) / 10,
  };
}

/* Sorteersleutel: wat moet als eerste open? Lager = dringender. */
export function urgentie(fles) {
  const r = rijping(fles);
  if (!r.venster) return 999;
  if (r.fase.id === "voorbij") return -1;        // écht opschieten
  if (r.fase.id === "rijp")    return 0 + (1 - r.positie);
  if (r.fase.id === "top")     return 1 + (1 - r.positie);
  if (r.fase.id === "opdreef") return 2;
  return 3 + Math.max(0, r.jarenTot);
}

/* Korte zin voor op een kaartje. */
export function rijpingTekst(fles) {
  const r = rijping(fles);
  if (!r.venster) return "Geen jaargang";
  const { vanaf, tot } = r.venster;
  if (r.fase.id === "jong")    return `Wachten tot ${vanaf}`;
  if (r.fase.id === "voorbij") return `Venster liep tot ${tot}`;
  return `Drinkvenster ${vanaf}–${tot}`;
}
