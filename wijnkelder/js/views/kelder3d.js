/* =====================================================================
   WIJNKELDER — de plattegrond
   =====================================================================
   Je kelder als rekken met vakjes, in een lichte 3D-kanteling. Elk vakje
   krijgt de kleur van de wijn die erin ligt; tik erop en je springt naar
   die fles.

   De afmetingen van een rek komen uit de flessen zelf: het hoogste
   rijnummer en het hoogste vaknummer dat je gebruikt hebt bepalen hoe
   groot het rek getekend wordt. Je hoeft dus niets in te stellen.
   ===================================================================== */

import { state, meld } from "../store.js";
import { esc, getal, dialoog } from "../util.js";
import { KLEUREN, kleurInfo } from "../data/catalog.js";
import { rijping } from "../data/aging.js";
import { flesKaart, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

const weergave = { recht: false, markeer: null };   // markeer = kleur-id of "drinkklaar"

export const titel = () => "Plattegrond";
export const terugknop = true;
export const ondertitel = () => {
  const kelders = new Set(state.flessen.map(f => f.locatie?.kelder || "Kelder"));
  return `${kelders.size} ${kelders.size === 1 ? "kelder" : "kelders"}`;
};

/* ---------------------------------------------------------------
   De indeling uitrekenen
   --------------------------------------------------------------- */
function indeling() {
  const kelders = new Map();

  for (const fles of state.flessen) {
    const kelderNaam = fles.locatie?.kelder || "Kelder";
    const rekNaam = fles.locatie?.rek || "";
    const rij = Number(fles.locatie?.rij) || 0;
    const vak = Number(fles.locatie?.vak) || 0;

    if (!kelders.has(kelderNaam)) kelders.set(kelderNaam, { naam: kelderNaam, rekken: new Map(), los: [] });
    const kelder = kelders.get(kelderNaam);

    /* Zonder rek of zonder positie kan hij niet in het raster. */
    if (!rekNaam || !rij || !vak) { kelder.los.push(fles); continue; }

    if (!kelder.rekken.has(rekNaam)) {
      kelder.rekken.set(rekNaam, { naam: rekNaam, maxRij: 0, maxVak: 0, vakken: new Map() });
    }
    const rek = kelder.rekken.get(rekNaam);
    rek.maxRij = Math.max(rek.maxRij, rij);
    rek.maxVak = Math.max(rek.maxVak, vak);

    const sleutel = `${rij}:${vak}`;
    if (!rek.vakken.has(sleutel)) rek.vakken.set(sleutel, []);
    rek.vakken.get(sleutel).push(fles);
  }

  return [...kelders.values()];
}

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  if (!state.flessen.length) {
    return leegBlok({
      icoon: "🗄️",
      titel: "Nog geen kelder om te tekenen",
      tekst: "Voeg flessen toe en geef ze een rek, rij en vak. Dan verschijnt hier je plattegrond.",
      knop: { label: "Fles toevoegen", actie: "toevoegen" },
    });
  }

  const kelders = indeling();
  const zonderPlek = kelders.reduce((s, k) => s + k.los.length, 0);
  const heeftRekken = kelders.some(k => k.rekken.size);

  return `
    <div class="filterrij" role="group" aria-label="Uitlichten">
      <button class="keuze ${!weergave.markeer ? "is-actief" : ""}" data-markeer="">Alles</button>
      <button class="keuze ${weergave.markeer === "drinkklaar" ? "is-actief" : ""}"
              data-markeer="drinkklaar">⭐ Drinkklaar</button>
      ${KLEUREN.filter(k => state.flessen.some(f => f.kleur === k.id)).map(k => `
        <button class="keuze ${weergave.markeer === k.id ? "is-actief" : ""}" data-markeer="${k.id}">
          ${k.emoji} ${esc(k.naam)}</button>`).join("")}
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:4px">
      <button class="knop knop--klein" data-kantel>
        ${weergave.recht ? "🧊 Kantelen" : "▭ Recht van voren"}
      </button>
    </div>

    ${heeftRekken ? `
      <div class="kelder3d ${weergave.recht ? "is-recht" : ""}">
        <div class="kelder3d__scene">
          ${kelders.map(kelderBlok).join("")}
        </div>
      </div>
      <div class="kelder3d__legenda">
        ${KLEUREN.filter(k => state.flessen.some(f => f.kleur === k.id)).map(k => `
          <span><span class="kelder3d__stip" style="background:${k.kleur}"></span>${esc(k.naam)}</span>`).join("")}
        <span><span class="kelder3d__stip" style="background:var(--rand)"></span>Leeg vak</span>
      </div>
    ` : `
      <div class="tipbalk" style="margin-bottom:14px">
        <span class="tipbalk__icoon">📐</span>
        <span>Geef je flessen een <strong>rek</strong>, <strong>rij</strong> en <strong>vak</strong>
          (bij Meer invullen op de fles), dan tekent de app hier vanzelf je rekken.</span>
      </div>`}

    ${zonderPlek ? losseFlessen(kelders) : ""}`;
}

function kelderBlok(kelder) {
  if (!kelder.rekken.size) return "";
  return `
    <div style="margin-bottom:18px">
      <div class="sectiekop" style="margin-top:4px"><h2>${esc(kelder.naam)}</h2></div>
      ${[...kelder.rekken.values()]
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl", { numeric: true }))
        .map(rekBlok).join("")}
    </div>`;
}

function rekBlok(rek) {
  const gevuld = [...rek.vakken.values()].reduce((s, v) => s + v.reduce((x, f) => x + f.aantal, 0), 0);
  const plekken = rek.maxRij * rek.maxVak;

  const rijen = [];
  for (let rij = 1; rij <= rek.maxRij; rij++) {
    const vakken = [];
    for (let vak = 1; vak <= rek.maxVak; vak++) {
      vakken.push(vakje(rek.vakken.get(`${rij}:${vak}`), rij, vak, rek.naam));
    }
    rijen.push(`<div class="rek__rij">${vakken.join("")}</div>`);
  }

  return `
    <div class="rek">
      <div class="rek__naam">Rek ${esc(rek.naam)} · ${getal(gevuld)} ${gevuld === 1 ? "fles" : "flessen"}
        <span class="dof">in ${getal(plekken)} ${plekken === 1 ? "vak" : "vakken"}</span></div>
      ${rijen.join("")}
    </div>`;
}

function vakje(flessen, rij, vak, rekNaam) {
  if (!flessen?.length) {
    return `<span class="vak" role="presentation" title="Rij ${rij}, vak ${vak} — leeg"></span>`;
  }

  const eerste = flessen[0];
  const k = kleurInfo(eerste.kleur);
  const aantal = flessen.reduce((s, f) => s + f.aantal, 0);

  const uitgelicht = markeerRaak(flessen);
  const stijl = uitgelicht === false
    ? `background:${k.kleur};opacity:.22`
    : `background:${k.kleur}`;

  const namen = flessen.map(f => `${f.naam} (${f.aantal}×)`).join(", ");

  return `<button class="vak vak--vol ${uitgelicht === true ? "vak--gemarkeerd" : ""}"
    style="${stijl}" data-vak="${esc(rekNaam)}|${rij}|${vak}"
    title="Rij ${rij}, vak ${vak} — ${esc(namen)}"
    aria-label="Rij ${rij}, vak ${vak}: ${esc(namen)}">
    ${aantal > 1 ? `<span class="vak__aantal">${aantal}</span>` : ""}
  </button>`;
}

/* null = er wordt niets uitgelicht, true = raak, false = gedimd */
function markeerRaak(flessen) {
  if (!weergave.markeer) return null;
  if (weergave.markeer === "drinkklaar") {
    return flessen.some(f => ["top", "rijp", "voorbij"].includes(rijping(f).fase.id));
  }
  return flessen.some(f => f.kleur === weergave.markeer);
}

function losseFlessen(kelders) {
  const los = kelders.flatMap(k => k.los);
  return `
    <div class="sectiekop">
      <h2>Zonder vaste plek</h2>
      <span class="metaregel">${getal(los.length)}</span>
    </div>
    <p class="metaregel" style="margin:-4px 2px 9px">
      Deze wijnen hebben nog geen rek, rij en vak. Vul die in en ze verschijnen hierboven.</p>
    <div class="fleslijst">${los.map(f => flesKaart(f)).join("")}</div>`;
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", async e => {
    const markeer = e.target.closest("[data-markeer]");
    if (markeer) { weergave.markeer = markeer.dataset.markeer || null; return meld(); }

    if (e.target.closest("[data-kantel]")) { weergave.recht = !weergave.recht; return meld(); }

    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);

    if (e.target.closest("[data-actie='toevoegen']")) return ga("#/toevoegen");

    const vak = e.target.closest("[data-vak]");
    if (vak) return toonVak(vak.dataset.vak);
  });
}

async function toonVak(sleutel) {
  const [rek, rij, vak] = sleutel.split("|");
  const flessen = state.flessen.filter(f =>
    (f.locatie?.rek || "") === rek &&
    String(f.locatie?.rij) === rij &&
    String(f.locatie?.vak) === vak);

  if (!flessen.length) return;
  if (flessen.length === 1) return ga(`#/fles/${flessen[0].id}`);

  const gekozen = await dialoog({
    titel: `Rek ${rek}, rij ${rij}, vak ${vak}`,
    inhoud: `<div class="fleslijst">${flessen.map(f => flesKaart(f)).join("")}</div>`,
    knoppen: [{ label: "Sluiten", waarde: null }],
    opOpenen: (laag, sluit) => {
      laag.addEventListener("click", e => {
        const knop = e.target.closest("[data-fles]");
        if (knop) sluit(knop.dataset.fles);
      });
    },
  });

  if (gekozen) ga(`#/fles/${gekozen}`);
}
