/* =====================================================================
   WIJNKELDER — de kelder
   =====================================================================
   De volledige voorraad, met zoeken, filteren en sorteren. De ingestelde
   filters blijven staan als je een fles bekijkt en terugkomt — ze zitten
   in een variabele op moduleniveau, niet in de HTML.
   ===================================================================== */

import { state, meld } from "../store.js";
import { esc, geld, getal, normaliseer, debounce } from "../util.js";
import { KLEUREN } from "../data/catalog.js";
import { rijping, urgentie, FASES } from "../data/aging.js";
import { flesKaart, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

/* ---------------------------------------------------------------
   Wat er nu gefilterd staat
   --------------------------------------------------------------- */
const filter = {
  zoek: "",
  kleur: null,
  land: null,
  fase: null,
  favoriet: false,
  sortering: "urgentie",
};

const SORTERINGEN = [
  { id: "urgentie", label: "Drinkvenster" },
  { id: "naam",     label: "Naam" },
  { id: "jaargang", label: "Jaargang" },
  { id: "nieuw",    label: "Nieuwste" },
  { id: "waarde",   label: "Waarde" },
  { id: "aantal",   label: "Aantal" },
];

/* Kwam het rijpingsfilter uit een route (#/kelder/drinkklaar) of zette
   je het zelf? Dat verschil bepaalt of hij vanzelf weer weggaat. */
let presetActief = false;

export function opBinnenkomst(params, vanaf) {
  if (params[0] === "drinkklaar") {
    filter.fase = "rijp";
    filter.sortering = "urgentie";
    presetActief = true;
    return;
  }
  /* Een preset overleeft een uitstapje naar een wijnfiche — dan wil je
     terugkomen in dezelfde lijst. Bij elke andere binnenkomst op de
     kelder is de preset uitgewerkt en zie je weer alles. */
  if (presetActief && vanaf !== "fles") {
    filter.fase = null;
    presetActief = false;
  }
}

export const titel = () => "Kelder";

export function ondertitel() {
  const zichtbaar = gefilterd();
  const flessen = zichtbaar.reduce((s, f) => s + f.aantal, 0);
  const totaalFlessen = state.flessen.reduce((s, f) => s + f.aantal, 0);
  if (zichtbaar.length === state.flessen.length) {
    return `${getal(totaalFlessen)} flessen · ${getal(state.flessen.length)} wijnen`;
  }
  return `${getal(flessen)} van ${getal(totaalFlessen)} flessen`;
}

export const kopActies = () => `
  <a class="icoonknop" href="#/kelder3d" aria-label="Kelderplattegrond">🗄️</a>
  <a class="icoonknop" href="#/wenslijst" aria-label="Wenslijst">📝</a>`;

/* ---------------------------------------------------------------
   Filteren en sorteren
   --------------------------------------------------------------- */
function gefilterd() {
  const zoek = normaliseer(filter.zoek);

  let lijst = state.flessen.filter(f => {
    if (filter.kleur && f.kleur !== filter.kleur) return false;
    if (filter.land && f.land !== filter.land) return false;
    if (filter.favoriet && !f.favoriet) return false;
    if (filter.fase && rijping(f).fase.id !== filter.fase) return false;

    if (zoek) {
      const hooiberg = normaliseer([
        f.naam, f.producent, f.land, f.regio, f.appellatie,
        f.jaargang, (f.druiven || []).join(" "), f.locatie?.rek, f.notitie,
      ].join(" "));
      if (!zoek.split(/\s+/).every(woord => hooiberg.includes(woord))) return false;
    }
    return true;
  });

  const opNaam = (a, b) => (a.naam || "").localeCompare(b.naam || "", "nl");

  switch (filter.sortering) {
    case "naam":     lijst.sort(opNaam); break;
    case "jaargang": lijst.sort((a, b) => (b.jaargang || 0) - (a.jaargang || 0) || opNaam(a, b)); break;
    case "nieuw":    lijst.sort((a, b) => (b.aangemaakt || 0) - (a.aangemaakt || 0)); break;
    case "aantal":   lijst.sort((a, b) => b.aantal - a.aantal || opNaam(a, b)); break;
    case "waarde":   lijst.sort((a, b) =>
      ((Number(b.huidigeWaarde) || Number(b.aankoopPrijs) || 0) * b.aantal) -
      ((Number(a.huidigeWaarde) || Number(a.aankoopPrijs) || 0) * a.aantal)); break;
    default:         lijst.sort((a, b) => urgentie(a) - urgentie(b) || opNaam(a, b));
  }
  return lijst;
}

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  if (!state.flessen.length) {
    return leegBlok({
      icoon: "🗄️",
      titel: "Nog geen flessen",
      tekst: "Zodra je flessen toevoegt vind je ze hier terug, met zoeken en filters.",
      knop: { label: "Fles toevoegen", actie: "toevoegen" },
    });
  }

  const lijst = gefilterd();
  const landen = tellingen("land");

  return `
    <div class="zoekbalk">
      <span class="zoekbalk__icoon" aria-hidden="true">🔍</span>
      <input type="search" id="zoek" placeholder="Zoek op naam, producent, regio, druif…"
             value="${esc(filter.zoek)}" autocomplete="off" enterkeyhint="search">
      ${filter.zoek ? `<button class="zoekbalk__wis" data-wis-zoek aria-label="Zoekopdracht wissen">✕</button>` : ""}
    </div>

    <div class="filterrij" role="group" aria-label="Filter op kleur">
      <button class="keuze ${!filter.kleur ? "is-actief" : ""}" data-kleur="">Alle kleuren</button>
      ${KLEUREN.filter(k => state.flessen.some(f => f.kleur === k.id)).map(k => {
        const n = state.flessen.filter(f => f.kleur === k.id).length;
        const aan = filter.kleur === k.id;
        return `<button class="keuze ${aan ? "is-actief" : ""}" data-kleur="${k.id}"
          style="${aan ? `background:${k.kleur};border-color:${k.kleur};color:${k.tekstOp}` : ""}">
          ${k.emoji} ${esc(k.naam)} <span class="keuze__telling">${n}</span></button>`;
      }).join("")}
    </div>

    <div class="filterrij" role="group" aria-label="Filter op rijping">
      <button class="keuze ${!filter.fase ? "is-actief" : ""}" data-fase="">Alle rijping</button>
      ${["voorbij", "rijp", "top", "opdreef", "jong"].map(id => {
        const f = FASES[id];
        const n = state.flessen.filter(x => rijping(x).fase.id === id).length;
        if (!n) return "";
        const aan = filter.fase === id;
        return `<button class="keuze ${aan ? "is-actief" : ""}" data-fase="${id}"
          style="${aan ? `background:${f.kleur};border-color:${f.kleur};color:#fff` : ""}">
          ${f.emoji} ${esc(f.kort)} <span class="keuze__telling">${n}</span></button>`;
      }).join("")}
      <button class="keuze ${filter.favoriet ? "is-actief" : ""}" data-favoriet>⭐ Favoriet</button>
    </div>

    ${landen.length > 1 ? `
      <div class="filterrij" role="group" aria-label="Filter op land">
        <button class="keuze ${!filter.land ? "is-actief" : ""}" data-land="">Alle landen</button>
        ${landen.map(([land, n]) => `
          <button class="keuze ${filter.land === land ? "is-actief" : ""}" data-land="${esc(land)}">
            ${esc(land)} <span class="keuze__telling">${n}</span></button>`).join("")}
      </div>` : ""}

    <div class="sectiekop">
      <h2>${lijst.length ? `${getal(lijst.reduce((s, f) => s + f.aantal, 0))} flessen` : "Niets gevonden"}</h2>
      <select id="sortering" style="width:auto;padding:5px 26px 5px 9px;font-size:.82rem"
              aria-label="Sorteren">
        ${SORTERINGEN.map(s => `<option value="${s.id}" ${filter.sortering === s.id ? "selected" : ""}>
          ${esc(s.label)}</option>`).join("")}
      </select>
    </div>

    ${lijst.length ? `
      <div class="fleslijst">${lijst.map(f => flesKaart(f, { toonLocatie: true })).join("")}</div>
      ${samenvatting(lijst)}
    ` : `
      <div class="leeg">
        <div class="leeg__icoon">🔍</div>
        <div class="leeg__titel">Geen wijn gevonden</div>
        <p class="leeg__tekst">Pas je zoekopdracht of je filters aan.</p>
        <button class="knop" data-alles-wissen>Filters wissen</button>
      </div>`}`;
}

function tellingen(veld) {
  const kaart = new Map();
  for (const f of state.flessen) {
    const waarde = f[veld];
    if (!waarde) continue;
    kaart.set(waarde, (kaart.get(waarde) || 0) + 1);
  }
  return [...kaart.entries()].sort((a, b) => b[1] - a[1]);
}

function samenvatting(lijst) {
  const waarde = lijst.reduce((s, f) =>
    s + (Number(f.huidigeWaarde) || Number(f.aankoopPrijs) || 0) * f.aantal, 0);
  if (!waarde) return "";
  return `<p class="metaregel midden" style="margin-top:14px">
    Waarde van deze selectie: <strong>${geld(waarde)}</strong></p>`;
}

/* ---------------------------------------------------------------
   Klikken en typen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  const zoekveld = wortel.querySelector("#zoek");
  if (zoekveld) {
    /* Wachten tot iemand even ophoudt met typen, anders hertekent de
       hele lijst zich bij elke aanslag. */
    const zoeken = debounce(waarde => {
      filter.zoek = waarde;
      hertekenen();
    }, 220);
    zoekveld.addEventListener("input", e => zoeken(e.target.value));

    /* De cursor terugzetten waar hij stond na het hertekenen. */
    if (filter.zoek) {
      zoekveld.focus();
      zoekveld.setSelectionRange(filter.zoek.length, filter.zoek.length);
    }
  }

  wortel.querySelector("#sortering")?.addEventListener("change", e => {
    filter.sortering = e.target.value;
    hertekenen();
  });

  wortel.addEventListener("click", e => {
    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);

    const kleur = e.target.closest("[data-kleur]");
    if (kleur) { filter.kleur = kleur.dataset.kleur || null; return hertekenen(); }

    const fase = e.target.closest("[data-fase]");
    if (fase) {
      filter.fase = fase.dataset.fase || null;
      presetActief = false;          // vanaf nu is het jouw keuze
      return hertekenen();
    }

    const land = e.target.closest("[data-land]");
    if (land) { filter.land = land.dataset.land || null; return hertekenen(); }

    if (e.target.closest("[data-favoriet]")) { filter.favoriet = !filter.favoriet; return hertekenen(); }
    if (e.target.closest("[data-wis-zoek]")) { filter.zoek = ""; return hertekenen(); }

    if (e.target.closest("[data-alles-wissen]")) {
      Object.assign(filter, { zoek: "", kleur: null, land: null, fase: null, favoriet: false });
      presetActief = false;
      return hertekenen();
    }

    if (e.target.closest("[data-actie='toevoegen']")) ga("#/toevoegen");
  });
}

/* De app hertekent zichzelf zodra de gegevens veranderen. Een filter is
   geen gegevenswijziging, dus die duwen we er hier zelf doorheen. */
const hertekenen = () => meld();
