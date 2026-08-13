/* =====================================================================
   WIJNKELDER — spijs & wijn
   =====================================================================
   Kies wat je eet, eventueel bij welke gelegenheid, en de app doorzoekt
   je eigen kelder. Er komen dus nooit flessen uit die je niet hebt.
   ===================================================================== */

import { state, meld } from "../store.js";
import { esc, getal, normaliseer } from "../util.js";
import {
  GERECHTEN, GERECHT_GROEPEN, GELEGENHEDEN,
  scoreCombinatie, combinatieRedenen, gerechtInfo,
} from "../data/pairings.js";
import { rijping, urgentie } from "../data/aging.js";
import { flesKaart, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

/* Wat er nu gekozen is — blijft staan als je een fles bekijkt. */
const keuze = { gerecht: null, gelegenheid: "alles", zoek: "" };

export const titel = () => "Combineren";
export const ondertitel = () => keuze.gerecht
  ? gerechtInfo(keuze.gerecht)?.naam
  : "Zoek een fles bij je eten";

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  if (!state.flessen.length) {
    return leegBlok({
      icoon: "🍽️",
      titel: "Eerst een kelder",
      tekst: "Zodra er flessen in je kelder staan, zoekt de app hier de beste combinatie bij je eten.",
      knop: { label: "Fles toevoegen", actie: "toevoegen" },
    });
  }

  return keuze.gerecht ? resultaatScherm() : keuzeScherm();
}

/* ---------------------------------------------------------------
   Gerecht kiezen
   --------------------------------------------------------------- */
function keuzeScherm() {
  const zoek = normaliseer(keuze.zoek);
  const treffers = zoek
    ? GERECHTEN.filter(g => normaliseer(g.naam + " " + g.groep).includes(zoek))
    : null;

  return `
    <div class="zoekbalk">
      <span class="zoekbalk__icoon" aria-hidden="true">🔍</span>
      <input type="search" id="gerecht-zoek" placeholder="Wat eet je vanavond?"
             value="${esc(keuze.zoek)}" autocomplete="off">
    </div>

    <button class="kaart" data-verras style="display:flex;gap:12px;align-items:center;width:100%;text-align:left">
      <span style="font-size:1.9rem" aria-hidden="true">🎲</span>
      <span style="flex:1">
        <span style="display:block;font-weight:650">Verras me</span>
        <span class="metaregel">Een fles die nú op zijn best is, willekeurig gekozen.</span>
      </span>
      <span class="dof">›</span>
    </button>

    ${treffers ? `
      <div class="sectiekop"><h2>${treffers.length} ${treffers.length === 1 ? "gerecht" : "gerechten"}</h2></div>
      <div class="gerechten">${treffers.map(gerechtTegel).join("")}</div>
      ${!treffers.length ? `<p class="metaregel midden">Niets gevonden. Kies iets uit de lijst hieronder dat er het dichtst bij komt.</p>` : ""}
    ` : GERECHT_GROEPEN.map(groep => `
      <div class="gerechtgroep">
        <div class="gerechtgroep__naam">${esc(groep)}</div>
        <div class="gerechten">
          ${GERECHTEN.filter(g => g.groep === groep).map(gerechtTegel).join("")}
        </div>
      </div>`).join("")}`;
}

const gerechtTegel = g => `
  <button class="gerecht" data-gerecht="${esc(g.id)}">
    <span class="gerecht__emoji" aria-hidden="true">${g.emoji}</span>
    <span>${esc(g.naam)}</span>
  </button>`;

/* ---------------------------------------------------------------
   Resultaten
   --------------------------------------------------------------- */
function resultaatScherm() {
  const gerecht = gerechtInfo(keuze.gerecht);
  const gelegenheid = GELEGENHEDEN.find(g => g.id === keuze.gelegenheid) || GELEGENHEDEN[0];

  /* Eerst de gelegenheid als zeef, daarna scoren. */
  let kandidaten = state.flessen;
  if (gelegenheid.filter) kandidaten = kandidaten.filter(gelegenheid.filter);
  if (gelegenheid.id === "opdrinken") {
    kandidaten = kandidaten.filter(f => ["rijp", "voorbij"].includes(rijping(f).fase.id));
  }

  const gescoord = kandidaten
    .map(f => ({ fles: f, ...scoreCombinatie(f, gerecht) }))
    .sort((a, b) => b.score - a.score || urgentie(a.fles) - urgentie(b.fles));

  const top = gescoord.slice(0, 8);

  return `
    <button class="knop knop--klein knop--stil" data-terug-keuze style="padding-left:0;margin-bottom:8px">
      ‹ Ander gerecht kiezen</button>

    <div class="kaart" style="display:flex;gap:12px;align-items:center">
      <span style="font-size:2rem" aria-hidden="true">${gerecht.emoji}</span>
      <span style="flex:1">
        <span style="display:block;font-weight:650">${esc(gerecht.naam)}</span>
        <span class="metaregel">${esc(gerecht.groep)}</span>
      </span>
    </div>

    <div class="tipbalk">
      <span class="tipbalk__icoon">💡</span>
      <span>${esc(gerecht.tip)}</span>
    </div>

    <div class="filterrij" role="group" aria-label="Gelegenheid" style="margin-top:12px">
      ${GELEGENHEDEN.map(g => `
        <button class="keuze ${keuze.gelegenheid === g.id ? "is-actief" : ""}" data-gelegenheid="${g.id}">
          ${g.emoji} ${esc(g.naam)}</button>`).join("")}
    </div>
    <p class="metaregel" style="margin:-2px 2px 12px">${esc(gelegenheid.uitleg)}</p>

    ${top.length ? `
      <div class="sectiekop">
        <h2>Beste keuze uit je kelder</h2>
        <span class="metaregel">${getal(gescoord.length)} bekeken</span>
      </div>
      <div class="fleslijst">
        ${top.map((t, i) => voorstelKaart(t, gerecht, i === 0)).join("")}
      </div>
      ${gescoord.length > top.length ? `
        <p class="metaregel midden" style="margin-top:12px">
          De overige ${getal(gescoord.length - top.length)} flessen passen minder goed.</p>` : ""}
    ` : `
      <div class="leeg">
        <div class="leeg__icoon">🤷</div>
        <div class="leeg__titel">Niets gevonden</div>
        <p class="leeg__tekst">Geen enkele fles voldoet aan deze gelegenheid.
          Probeer het filter "Maakt niet uit".</p>
      </div>`}`;
}

function voorstelKaart({ fles, score, klassiek }, gerecht, isBeste) {
  const redenen = combinatieRedenen(fles, gerecht);
  const kleurVanScore = score >= 75 ? "var(--goed)" : score >= 55 ? "var(--goud)" : "var(--let-op)";

  const extra = `
    <span class="match" style="margin-top:5px">
      <span class="match__balk">
        <span class="match__vul" style="width:${score}%;background:${kleurVanScore}"></span>
      </span>
      <span class="match__score">${score}/100</span>
      ${klassiek ? `<span class="fase" style="background:color-mix(in srgb, var(--goud) 20%, transparent);color:var(--goud)">klassiek</span>` : ""}
    </span>`;

  return `
    <div>
      ${isBeste ? `<div class="cijfer__label" style="margin:4px 2px 5px">🏆 Onze eerste keus</div>` : ""}
      ${flesKaart(fles, { toonLocatie: true, extra })}
      ${redenen.length ? `
        <div class="redenen" style="padding:2px 12px 4px">
          <ul>${redenen.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
        </div>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */
export function koppel(wortel) {
  const zoekveld = wortel.querySelector("#gerecht-zoek");
  if (zoekveld) {
    zoekveld.addEventListener("input", e => { keuze.zoek = e.target.value; meld(); });
    if (keuze.zoek) {
      zoekveld.focus();
      zoekveld.setSelectionRange(keuze.zoek.length, keuze.zoek.length);
    }
  }

  wortel.addEventListener("click", e => {
    const gerecht = e.target.closest("[data-gerecht]");
    if (gerecht) { keuze.gerecht = gerecht.dataset.gerecht; keuze.zoek = ""; window.scrollTo(0, 0); return meld(); }

    if (e.target.closest("[data-terug-keuze]")) { keuze.gerecht = null; window.scrollTo(0, 0); return meld(); }

    const gel = e.target.closest("[data-gelegenheid]");
    if (gel) { keuze.gelegenheid = gel.dataset.gelegenheid; return meld(); }

    if (e.target.closest("[data-verras]")) return verrasMij();

    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);

    if (e.target.closest("[data-actie='toevoegen']")) ga("#/toevoegen");
  });
}

/* Een fles die nu op zijn best is, willekeurig gekozen. Staat er niets
   op zijn top, dan pakken we gewoon iets uit de kelder. */
function verrasMij() {
  const klaar = state.flessen.filter(f => ["top", "rijp"].includes(rijping(f).fase.id));
  const bron = klaar.length ? klaar : state.flessen;
  if (!bron.length) return;
  const fles = bron[Math.floor(Math.random() * bron.length)];
  ga(`#/fles/${fles.id}`);
}
