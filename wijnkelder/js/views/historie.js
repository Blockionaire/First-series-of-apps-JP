/* =====================================================================
   WIJNKELDER — historie
   =====================================================================
   Wat er in en uit de kelder ging, met de proefnotities erbij. Ook als
   een wijn allang op is blijft hij hier staan — dat is precies waarom
   je zoiets bijhoudt.
   ===================================================================== */

import { state, meld, historieGesorteerd, verwijderHistorie, vindFles } from "../store.js";
import { esc, getal, datumNL, bevestig } from "../util.js";
import { kleurInfo } from "../data/catalog.js";
import { sterren, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

const filter = { soort: "gedronken", jaar: null };

const SOORTEN = {
  gedronken:  { label: "Gedronken",  icoon: "🍷" },
  toegevoegd: { label: "Toegevoegd", icoon: "📥" },
  verwijderd: { label: "Verwijderd", icoon: "🗑" },
};

export const titel = () => "Historie";
export const terugknop = true;
export const ondertitel = () => {
  const g = state.historie.filter(h => h.type === "gedronken");
  const totaal = g.reduce((s, h) => s + (h.aantal || 1), 0);
  return `${getal(totaal)} flessen geopend`;
};

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  if (!state.historie.length) {
    return leegBlok({
      icoon: "📖",
      titel: "Nog geen geschiedenis",
      tekst: "Zodra je flessen toevoegt of opentrekt bouwt de app hier je logboek op.",
      knop: { label: "Naar de kelder", actie: "kelder" },
    });
  }

  const alles = historieGesorteerd();
  const jaren = [...new Set(alles.map(h => (h.datum || "").slice(0, 4)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  const lijst = alles.filter(h => {
    if (filter.soort && h.type !== filter.soort) return false;
    if (filter.jaar && !(h.datum || "").startsWith(filter.jaar)) return false;
    return true;
  });

  return `
    ${samenvatting()}

    <div class="filterrij" role="group" aria-label="Soort gebeurtenis">
      <button class="keuze ${!filter.soort ? "is-actief" : ""}" data-soort="">Alles</button>
      ${Object.entries(SOORTEN).map(([id, s]) => {
        const n = alles.filter(h => h.type === id).length;
        if (!n) return "";
        return `<button class="keuze ${filter.soort === id ? "is-actief" : ""}" data-soort="${id}">
          ${s.icoon} ${esc(s.label)} <span class="keuze__telling">${n}</span></button>`;
      }).join("")}
    </div>

    ${jaren.length > 1 ? `
      <div class="filterrij" role="group" aria-label="Jaar">
        <button class="keuze ${!filter.jaar ? "is-actief" : ""}" data-jaar="">Alle jaren</button>
        ${jaren.map(j => `<button class="keuze ${filter.jaar === j ? "is-actief" : ""}" data-jaar="${j}">${j}</button>`).join("")}
      </div>` : ""}

    ${lijst.length ? `
      <div class="kaart" style="padding:2px 14px">
        <ul class="tijdlijn">${lijst.map(regel).join("")}</ul>
      </div>` : `
      <p class="metaregel midden" style="padding:26px 0">Niets gevonden met deze filters.</p>`}`;
}

/* ---------------------------------------------------------------
   Samenvatting bovenaan
   --------------------------------------------------------------- */
function samenvatting() {
  const gedronken = state.historie.filter(h => h.type === "gedronken");
  if (!gedronken.length) return "";

  const ditJaar = new Date().getFullYear();
  const aantalDitJaar = gedronken
    .filter(h => (h.datum || "").startsWith(String(ditJaar)))
    .reduce((s, h) => s + (h.aantal || 1), 0);

  /* Beoordeelde wijnen: de hoogste score bovenaan. */
  const metScore = state.notities.filter(n => n.score != null);
  const beste = [...metScore].sort((a, b) => b.score - a.score)[0];
  const gemiddelde = metScore.length
    ? metScore.reduce((s, n) => s + n.score, 0) / metScore.length : null;

  return `
    <div class="cijferrij" style="margin-bottom:12px">
      <div class="cijfer">
        <div class="cijfer__waarde">${getal(aantalDitJaar)}</div>
        <div class="cijfer__label">Dit jaar geopend</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde">${getal(gedronken.reduce((s, h) => s + (h.aantal || 1), 0))}</div>
        <div class="cijfer__label">Ooit geopend</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde">${gemiddelde != null ? getal(gemiddelde) : "—"}</div>
        <div class="cijfer__label">Gem. score</div>
        ${metScore.length ? `<div class="cijfer__bij">${metScore.length} beoordeeld</div>` : ""}
      </div>
    </div>
    ${beste ? `
      <div class="tipbalk" style="margin-bottom:12px">
        <span class="tipbalk__icoon">🏆</span>
        <span>Je hoogste score tot nu toe: <strong>${esc(beste.momentopname?.naam || "een wijn")}</strong>
          met ${getal(beste.score)}/100.</span>
      </div>` : ""}`;
}

/* ---------------------------------------------------------------
   Eén regel in de tijdlijn
   --------------------------------------------------------------- */
function regel(h) {
  const soort = SOORTEN[h.type] || { label: h.type, icoon: "•" };
  const m = h.momentopname || {};
  const fles = h.flesId ? vindFles(h.flesId) : null;
  const naam = fles?.naam || m.naam || h.tekst || soort.label;
  const kleur = kleurInfo(fles?.kleur || m.kleur);

  const meta = [
    datumNL(h.datum, { kort: true }),
    h.aantal ? `${h.aantal}×` : "",
    h.gelegenheid,
    (fles || m).jaargang || m.jaargang || "",
  ].filter(Boolean).join(" · ");

  const klikbaar = fles || state.notities.some(n => n.flesId === h.flesId);

  return `
    <li class="gebeurtenis">
      <span class="gebeurtenis__icoon" style="background:color-mix(in srgb, ${kleur.kleur} 20%, var(--vlak-hoog))">
        ${soort.icoon}
      </span>
      <span class="gebeurtenis__tekst">
        ${klikbaar
          ? `<button class="gebeurtenis__titel" data-fles="${esc(h.flesId)}"
               style="background:none;border:0;padding:0;text-align:left;color:inherit;font:inherit;font-weight:600">
               ${esc(naam)}</button>`
          : `<span class="gebeurtenis__titel">${esc(naam)}</span>`}
        <span class="gebeurtenis__meta">${esc(meta)}</span>
        ${h.tekst && h.type === "gedronken" ? `
          <span class="notitie__tekst klein" style="display:block;margin-top:4px">${esc(h.tekst)}</span>` : ""}
        ${h.score != null ? `<span style="display:block;margin-top:4px">${sterren(h.score)}</span>` : ""}
      </span>
      <button class="icoonknop icoonknop--kaal" data-weg="${esc(h.id)}"
              aria-label="Uit de historie verwijderen" style="width:26px;height:26px;font-size:.8rem;flex:none">✕</button>
    </li>`;
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", async e => {
    const soort = e.target.closest("[data-soort]");
    if (soort) { filter.soort = soort.dataset.soort || null; return meld(); }

    const jaar = e.target.closest("[data-jaar]");
    if (jaar) { filter.jaar = jaar.dataset.jaar || null; return meld(); }

    const fles = e.target.closest("[data-fles]");
    if (fles) return ga(`#/fles/${fles.dataset.fles}`);

    if (e.target.closest("[data-actie='kelder']")) return ga("#/kelder");

    const weg = e.target.closest("[data-weg]");
    if (weg) {
      const zeker = await bevestig("Deze regel verdwijnt uit je logboek. De fles zelf verandert niet.",
        { titel: "Regel verwijderen?", bevestigLabel: "Verwijderen", gevaar: true });
      if (zeker) await verwijderHistorie(weg.dataset.weg);
    }
  });
}
