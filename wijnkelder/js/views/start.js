/* =====================================================================
   WIJNKELDER — startscherm
   =====================================================================
   Het antwoord op "hoe staat mijn kelder ervoor, en wat kan er open?".
   Bewust kort: vier cijfers, de flessen die aandacht vragen, en de weg
   naar de rest van de app.
   ===================================================================== */

import { state, totalen, gedronkenTotalen } from "../store.js";
import { geld, getal } from "../util.js";
import { rijping, urgentie } from "../data/aging.js";
import { flesKaart, cijfer, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => "Wijnkelder";

export function ondertitel() {
  const uur = new Date().getHours();
  if (uur < 6)  return "Nog wakker?";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

export const kopActies = () => `
  <a class="icoonknop" href="#/profiel" aria-label="Instellingen">⚙️</a>`;

export function html() {
  if (!state.geladen) return "";

  const t = totalen();
  const g = gedronkenTotalen();

  if (!state.flessen.length) {
    return leegBlok({
      icoon: "🍷",
      titel: "Je kelder is nog leeg",
      tekst: "Voeg je eerste fles toe. Een foto van het etiket en de naam is genoeg — de rest vul je later aan.",
      knop: { label: "Eerste fles toevoegen", actie: "toevoegen" },
    });
  }

  return `
    ${cijferblok(t, g)}
    ${nuOpen()}
    ${vanavond()}
    ${binnenkort()}
    ${recent()}
    ${snelheen()}`;
}

/* ---------------------------------------------------------------
   De vier cijfers bovenaan
   --------------------------------------------------------------- */
function cijferblok(t, g) {
  const winstZichtbaar = t.gewaardeerdeFlessen > 0;
  const pct = t.winstBasis ? (t.winst / t.winstBasis) * 100 : 0;

  return `
    <div class="cijferrij cijferrij--twee" style="margin-bottom:6px">
      ${cijfer({ waarde: getal(t.aantalFlessen), label: "Flessen",
                 bij: `${getal(t.aantalWijnen)} verschillende` })}
      ${cijfer({ waarde: geld(t.huidigeWaarde, { compact: true }), label: "Kelderwaarde",
                 bij: winstZichtbaar
                   ? `${t.winst >= 0 ? "+" : ""}${geld(t.winst, { compact: true })}`
                   : "op basis van aankoop",
                 bijSoort: winstZichtbaar ? (t.winst >= 0 ? "op" : "af") : "" })}
      ${cijfer({ waarde: geld(t.gemiddeldePrijs), label: "Gem. per fles" })}
      ${cijfer({ waarde: getal(g.ditJaar), label: "Gedronken", bij: `dit jaar · ${getal(g.totaal)} totaal` })}
    </div>
    ${winstZichtbaar ? `
      <p class="metaregel" style="margin:0 2px 4px">
        Rendement gerekend over ${getal(t.gewaardeerdeFlessen)} ${t.gewaardeerdeFlessen === 1 ? "wijn" : "wijnen"}
        waar je zelf een huidige waarde bij zette
        (${pct >= 0 ? "+" : ""}${getal(pct, 1)}%).
      </p>` : ""}`;
}

/* ---------------------------------------------------------------
   Wat moet nu open?
   --------------------------------------------------------------- */
function nuOpen() {
  const dringend = state.flessen
    .filter(f => {
      const fase = rijping(f).fase.id;
      return fase === "voorbij" || fase === "rijp";
    })
    .sort((a, b) => urgentie(a) - urgentie(b))
    .slice(0, 4);

  if (!dringend.length) return "";

  const voorbij = dringend.filter(f => rijping(f).fase.id === "voorbij").length;

  return `
    <div class="sectiekop">
      <h2>Zet deze op de planning</h2>
      <a class="sectiekop__actie" href="#/kelder/drinkklaar">Alles zien</a>
    </div>
    ${voorbij ? `
      <div class="tipbalk" style="margin-bottom:9px">
        <span class="tipbalk__icoon">⌛</span>
        <span>${voorbij === 1
          ? "Eén fles is volgens de schatting voorbij zijn beste tijd."
          : `${voorbij} flessen zijn volgens de schatting voorbij hun beste tijd.`}
          Flessen verrassen soms — maar wachten heeft weinig zin meer.</span>
      </div>` : ""}
    <div class="fleslijst">
      ${dringend.map(f => flesKaart(f, { toonLocatie: true })).join("")}
    </div>`;
}

/* ---------------------------------------------------------------
   Doorsteek naar de spijs-wijnmodule
   --------------------------------------------------------------- */
function vanavond() {
  return `
    <div class="sectiekop"><h2>Wat drinken we vanavond?</h2></div>
    <button class="kaart" data-actie="combineer"
            style="display:flex;gap:12px;align-items:center;width:100%;text-align:left">
      <span style="font-size:2rem" aria-hidden="true">🍽️</span>
      <span style="flex:1">
        <span style="display:block;font-weight:650">Zoek een fles bij je eten</span>
        <span class="metaregel">Kies een gerecht en de app doorzoekt je eigen kelder.</span>
      </span>
      <span class="dof" aria-hidden="true">›</span>
    </button>`;
}

/* ---------------------------------------------------------------
   Wat komt eraan? Flessen die dit of volgend jaar opengaan.
   --------------------------------------------------------------- */
function binnenkort() {
  const jaarNu = new Date().getFullYear();
  const komend = state.flessen
    .map(f => ({ fles: f, r: rijping(f) }))
    .filter(({ r }) => r.venster && r.fase.id === "jong" && r.venster.vanaf <= jaarNu + 2)
    .sort((a, b) => a.r.venster.vanaf - b.r.venster.vanaf)
    .slice(0, 3);

  if (!komend.length) return "";

  return `
    <div class="sectiekop"><h2>Bijna zover</h2></div>
    <div class="fleslijst">
      ${komend.map(({ fles, r }) => flesKaart(fles, {
        extra: `<span class="fleskaart__meta"><span>Vanaf ${r.venster.vanaf}</span></span>`,
      })).join("")}
    </div>`;
}

/* ---------------------------------------------------------------
   Laatst toegevoegd
   --------------------------------------------------------------- */
function recent() {
  const nieuwste = [...state.flessen]
    .sort((a, b) => (b.aangemaakt || 0) - (a.aangemaakt || 0))
    .slice(0, 3);

  if (!nieuwste.length) return "";

  return `
    <div class="sectiekop">
      <h2>Net binnengekomen</h2>
      <a class="sectiekop__actie" href="#/kelder">Hele kelder</a>
    </div>
    <div class="fleslijst">${nieuwste.map(f => flesKaart(f)).join("")}</div>`;
}

/* ---------------------------------------------------------------
   Snelkoppelingen
   --------------------------------------------------------------- */
function snelheen() {
  const wensen = state.wenslijst.length;
  const kelders = new Set(state.flessen.map(f => f.locatie?.kelder).filter(Boolean)).size;

  return `
    <div class="sectiekop"><h2>Verder</h2></div>
    <div class="kaart" style="padding:2px 14px">
      <a class="schakelrij" href="#/kelder3d" style="text-decoration:none;color:inherit">
        <span style="font-size:1.2rem">🗄️</span>
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Kelderplattegrond</span>
          <span class="schakelrij__uitleg">${kelders || 1} ${kelders === 1 ? "kelder" : "kelders"} in beeld</span>
        </span>
        <span class="dof">›</span>
      </a>
      <a class="schakelrij" href="#/wenslijst" style="text-decoration:none;color:inherit">
        <span style="font-size:1.2rem">📝</span>
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Wenslijst</span>
          <span class="schakelrij__uitleg">${wensen ? `${wensen} ${wensen === 1 ? "wijn" : "wijnen"} op je lijstje` : "Nog leeg"}</span>
        </span>
        <span class="dof">›</span>
      </a>
      <a class="schakelrij" href="#/historie" style="text-decoration:none;color:inherit">
        <span style="font-size:1.2rem">📖</span>
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Wat je dronk</span>
          <span class="schakelrij__uitleg">Alle geopende flessen en je proefnotities</span>
        </span>
        <span class="dof">›</span>
      </a>
    </div>`;
}

/* ---------------------------------------------------------------
   Klikken
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", e => {
    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);

    const actie = e.target.closest("[data-actie]")?.dataset.actie;
    if (actie === "toevoegen") ga("#/toevoegen");
    if (actie === "combineer") ga("#/combineer");
  });
}
