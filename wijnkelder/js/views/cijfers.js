/* =====================================================================
   WIJNKELDER — cijfers
   =====================================================================
   Wat zit er eigenlijk in die kelder? Verdelingen over kleur, land,
   jaargang en prijs, plus wat je uitgaf en wat je dronk.

   Alle grafieken zijn inline SVG of gewoon balkjes — geen bibliotheek,
   dus de app blijft licht en werkt offline.
   ===================================================================== */

import { state, totalen, gedronkenTotalen } from "../store.js";
import { esc, geld, getal, procent, balken, ring, lijn } from "../util.js";
import { KLEUREN, formaatInfo } from "../data/catalog.js";
import { rijping, FASES } from "../data/aging.js";
import { cijfer, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => "Cijfers";
export const ondertitel = () => "Je kelder in getallen";
export const kopActies = () => `
  <a class="icoonknop" href="#/historie" aria-label="Historie">📖</a>`;

export function html() {
  if (!state.flessen.length && !state.historie.length) {
    return leegBlok({
      icoon: "📊",
      titel: "Nog niets te tellen",
      tekst: "Zodra je flessen toevoegt verschijnen hier de verdelingen over kleur, land, jaargang en waarde.",
      knop: { label: "Fles toevoegen", actie: "toevoegen" },
    });
  }

  return `
    ${overzicht()}
    ${kleurVerdeling()}
    ${rijpingVerdeling()}
    ${landVerdeling()}
    ${regioVerdeling()}
    ${jaargangVerdeling()}
    ${prijsVerdeling()}
    ${producenten()}
    ${uitgaven()}
    ${drinktempo()}
    ${formaten()}`;
}

/* ---------------------------------------------------------------
   Bovenaan
   --------------------------------------------------------------- */
function overzicht() {
  const t = totalen();
  const g = gedronkenTotalen();
  const liters = state.flessen.reduce((s, f) => s + formaatInfo(f.formaat).liter * f.aantal, 0);

  return `
    <div class="cijferrij">
      ${cijfer({ waarde: getal(t.aantalFlessen), label: "Flessen" })}
      ${cijfer({ waarde: getal(t.aantalWijnen), label: "Verschillende wijnen" })}
      ${cijfer({ waarde: getal(liters, 1) + " l", label: "Totale inhoud" })}
      ${cijfer({ waarde: geld(t.huidigeWaarde, { compact: true }), label: "Kelderwaarde" })}
      ${cijfer({ waarde: geld(t.aankoopwaarde, { compact: true }), label: "Aankoopwaarde" })}
      ${cijfer({ waarde: geld(t.gemiddeldePrijs), label: "Gemiddeld per fles" })}
      ${cijfer({ waarde: getal(g.totaal), label: "Ooit gedronken", bij: `${getal(g.ditJaar)} dit jaar` })}
      ${cijfer({
        waarde: t.gewaardeerdeFlessen
          ? `${t.winst >= 0 ? "+" : ""}${geld(t.winst, { compact: true })}` : "—",
        label: "Waardeverschil",
        bij: t.gewaardeerdeFlessen ? `over ${getal(t.gewaardeerdeFlessen)} wijnen` : "geen waardes ingevuld",
        bijSoort: t.gewaardeerdeFlessen ? (t.winst >= 0 ? "op" : "af") : "",
      })}
    </div>`;
}

/* ---------------------------------------------------------------
   Kleur
   --------------------------------------------------------------- */
function kleurVerdeling() {
  const items = KLEUREN
    .map(k => ({
      label: k.naam,
      kleur: k.kleur,
      waarde: state.flessen.filter(f => f.kleur === k.id).reduce((s, f) => s + f.aantal, 0),
    }))
    .filter(i => i.waarde > 0)
    .sort((a, b) => b.waarde - a.waarde);

  if (!items.length) return "";
  const totaal = items.reduce((s, i) => s + i.waarde, 0);

  return `
    <div class="sectiekop"><h2>Naar kleur</h2></div>
    <div class="kaart">
      <div class="ringblok">
        ${ring(items)}
        <ul class="ringlegenda">
          ${items.map(i => `
            <li>
              <span class="ringlegenda__stip" style="background:${i.kleur}"></span>
              <span>${esc(i.label)}</span>
              <span class="ringlegenda__waarde">${i.waarde} · ${procent(i.waarde, totaal)}</span>
            </li>`).join("")}
        </ul>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Rijping
   --------------------------------------------------------------- */
function rijpingVerdeling() {
  const volgorde = ["jong", "opdreef", "top", "rijp", "voorbij", "onbekend"];
  const items = volgorde.map(id => ({
    label: FASES[id].kort,
    kleur: FASES[id].kleur,
    waarde: state.flessen.filter(f => rijping(f).fase.id === id).reduce((s, f) => s + f.aantal, 0),
  })).filter(i => i.waarde > 0);

  if (!items.length) return "";
  const dringend = items.filter(i => ["Drink nu", "Voorbij"].includes(i.label))
    .reduce((s, i) => s + i.waarde, 0);

  return `
    <div class="sectiekop">
      <h2>Naar rijping</h2>
      <a class="sectiekop__actie" href="#/kelder/drinkklaar">Bekijk</a>
    </div>
    <div class="kaart">
      ${balken(items)}
      ${dringend ? `
        <p class="metaregel" style="margin:11px 0 0">
          ${dringend} ${dringend === 1 ? "fles vraagt" : "flessen vragen"} op korte termijn aandacht.</p>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Herkomst
   --------------------------------------------------------------- */
function landVerdeling() {
  const items = tel("land").slice(0, 8);
  if (items.length < 2) return "";
  return `
    <div class="sectiekop"><h2>Naar land</h2></div>
    <div class="kaart">${balken(items)}</div>`;
}

function regioVerdeling() {
  const items = tel("regio").slice(0, 8);
  if (items.length < 2) return "";
  return `
    <div class="sectiekop"><h2>Meest vertegenwoordigde regio's</h2></div>
    <div class="kaart">${balken(items)}</div>`;
}

function tel(veld) {
  const kaart = new Map();
  for (const f of state.flessen) {
    const sleutel = f[veld] || "Onbekend";
    kaart.set(sleutel, (kaart.get(sleutel) || 0) + f.aantal);
  }
  return [...kaart.entries()]
    .map(([label, waarde]) => ({ label, waarde }))
    .sort((a, b) => b.waarde - a.waarde);
}

/* ---------------------------------------------------------------
   Jaargangen
   --------------------------------------------------------------- */
function jaargangVerdeling() {
  const metJaar = state.flessen.filter(f => f.jaargang);
  if (metJaar.length < 2) return "";

  const kaart = new Map();
  for (const f of metJaar) kaart.set(f.jaargang, (kaart.get(f.jaargang) || 0) + f.aantal);

  const jaren = [...kaart.entries()].sort((a, b) => a[0] - b[0]);
  const oudste = jaren[0][0];
  const jongste = jaren[jaren.length - 1][0];

  /* Bij veel verschillende jaren wordt een staaf per jaar onleesbaar;
     dan groeperen we per vijf jaar. */
  const perJaar = jaren.length <= 14;
  const items = perJaar
    ? jaren.map(([j, n]) => ({ label: String(j), waarde: n }))
    : groepeerPerLustrum(jaren);

  return `
    <div class="sectiekop"><h2>Naar jaargang</h2></div>
    <div class="kaart">
      ${balken(items)}
      <p class="metaregel" style="margin:11px 0 0">
        Oudste ${oudste}, jongste ${jongste}${
          metJaar.length < state.flessen.length
            ? ` · ${state.flessen.length - metJaar.length} zonder jaartal` : ""}.</p>
    </div>`;
}

function groepeerPerLustrum(jaren) {
  const kaart = new Map();
  for (const [jaar, n] of jaren) {
    const begin = Math.floor(jaar / 5) * 5;
    kaart.set(begin, (kaart.get(begin) || 0) + n);
  }
  return [...kaart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([begin, n]) => ({ label: `${begin}–${begin + 4}`, waarde: n }));
}

/* ---------------------------------------------------------------
   Prijsklassen
   --------------------------------------------------------------- */
const PRIJSKLASSEN = [
  { label: "tot € 10",   test: p => p < 10 },
  { label: "€ 10 – 20",  test: p => p >= 10 && p < 20 },
  { label: "€ 20 – 35",  test: p => p >= 20 && p < 35 },
  { label: "€ 35 – 60",  test: p => p >= 35 && p < 60 },
  { label: "€ 60 – 120", test: p => p >= 60 && p < 120 },
  { label: "€ 120+",     test: p => p >= 120 },
];

function prijsVerdeling() {
  const metPrijs = state.flessen.filter(f => Number(f.aankoopPrijs) > 0);
  if (metPrijs.length < 2) return "";

  const items = PRIJSKLASSEN.map(k => ({
    label: k.label,
    waarde: metPrijs.filter(f => k.test(Number(f.aankoopPrijs))).reduce((s, f) => s + f.aantal, 0),
  })).filter(i => i.waarde > 0);

  const duurste = [...metPrijs].sort((a, b) =>
    (Number(b.huidigeWaarde) || Number(b.aankoopPrijs)) - (Number(a.huidigeWaarde) || Number(a.aankoopPrijs)))[0];

  return `
    <div class="sectiekop"><h2>Naar prijsklasse</h2></div>
    <div class="kaart">
      ${balken(items)}
      ${duurste ? `
        <hr class="dunlijn">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span class="klein zacht">Duurste fles</span>
          <button class="knop knop--klein" data-fles="${esc(duurste.id)}">
            ${esc(duurste.naam)} · ${geld(Number(duurste.huidigeWaarde) || Number(duurste.aankoopPrijs))}
          </button>
        </div>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Producenten
   --------------------------------------------------------------- */
function producenten() {
  const items = tel("producent").filter(i => i.label !== "Onbekend").slice(0, 6);
  if (items.length < 2) return "";
  return `
    <div class="sectiekop"><h2>Je vaste huizen</h2></div>
    <div class="kaart">${balken(items)}</div>`;
}

/* ---------------------------------------------------------------
   Uitgaven per jaar
   --------------------------------------------------------------- */
function uitgaven() {
  const metDatum = state.flessen.filter(f => f.aankoopDatum && Number(f.aankoopPrijs) > 0);
  if (metDatum.length < 3) return "";

  const kaart = new Map();
  for (const f of metDatum) {
    const jaar = f.aankoopDatum.slice(0, 4);
    kaart.set(jaar, (kaart.get(jaar) || 0) + Number(f.aankoopPrijs) * f.aantal);
  }
  const jaren = [...kaart.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return `
    <div class="sectiekop"><h2>Wat je uitgaf</h2></div>
    <div class="kaart">
      ${balken(jaren.map(([j, bedrag]) => ({ label: j, waarde: Math.round(bedrag) })),
               { toonWaarde: v => geld(v, { compact: true }) })}
      <p class="metaregel" style="margin:11px 0 0">
        Alleen flessen waar een aankoopdatum én een prijs bij staat.</p>
    </div>`;
}

/* ---------------------------------------------------------------
   Drinktempo
   --------------------------------------------------------------- */
function drinktempo() {
  const gedronken = state.historie.filter(h => h.type === "gedronken" && h.datum);
  if (gedronken.length < 3) return "";

  /* De laatste twaalf maanden, ook de maanden waarin niets openging. */
  const nu = new Date();
  const maanden = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    maanden.push({
      sleutel: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("nl-NL", { month: "short" }),
      waarde: 0,
    });
  }
  for (const h of gedronken) {
    const m = maanden.find(x => h.datum.startsWith(x.sleutel));
    if (m) m.waarde += h.aantal || 1;
  }

  const totaal = maanden.reduce((s, m) => s + m.waarde, 0);
  const perMaand = totaal / 12;

  return `
    <div class="sectiekop">
      <h2>Drinktempo</h2>
      <a class="sectiekop__actie" href="#/historie">Historie</a>
    </div>
    <div class="kaart">
      ${lijn(maanden, { kleur: "var(--wijn-licht)" })}
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--tekst-dof);margin-top:4px">
        <span>${esc(maanden[0].label)}</span>
        <span>${esc(maanden[maanden.length - 1].label)}</span>
      </div>
      <hr class="dunlijn">
      <div style="display:flex;justify-content:space-between">
        <span class="klein zacht">Gemiddeld per maand</span>
        <strong>${getal(perMaand, 1)} ${perMaand === 1 ? "fles" : "flessen"}</strong>
      </div>
      ${voorraadJaren(perMaand)}
    </div>`;
}

function voorraadJaren(perMaand) {
  if (perMaand < 0.2) return "";
  const flessen = state.flessen.reduce((s, f) => s + f.aantal, 0);
  const jaren = flessen / (perMaand * 12);
  return `
    <div style="display:flex;justify-content:space-between;margin-top:5px">
      <span class="klein zacht">Voorraad in dit tempo</span>
      <strong>${jaren >= 20 ? "20+ jaar" : `${getal(jaren, 1)} jaar`}</strong>
    </div>`;
}

/* ---------------------------------------------------------------
   Formaten
   --------------------------------------------------------------- */
function formaten() {
  const kaart = new Map();
  for (const f of state.flessen) {
    const naam = formaatInfo(f.formaat).naam.split(" (")[0];
    kaart.set(naam, (kaart.get(naam) || 0) + f.aantal);
  }
  const items = [...kaart.entries()].map(([label, waarde]) => ({ label, waarde }))
    .sort((a, b) => b.waarde - a.waarde);

  if (items.length < 2) return "";
  return `
    <div class="sectiekop"><h2>Naar flesformaat</h2></div>
    <div class="kaart">${balken(items)}</div>`;
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", e => {
    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);
    if (e.target.closest("[data-actie='toevoegen']")) ga("#/toevoegen");
  });
}
