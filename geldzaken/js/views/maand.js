/* =====================================================================
   GELDZAKEN — alle boekingen
   =====================================================================
   Het kasboek. Standaard zie je de maand die je op het startscherm hebt
   gekozen, maar met de zoekbalk kijk je door alles heen — dan laat de
   app het jaar erbij zetten zodat je niet in de war raakt.
   ===================================================================== */

import { esc, geld, maandLabel, maandPlus, maandNu, debounce, melding,
         downloadTekst } from "../util.js";
import { state, zoek, alsCSV, meld } from "../store.js";
import { maandOverzicht } from "../bereken.js";
import { transactieLijst, maandkiezer, koppelMaandkiezer, leeg,
         persoonOpties } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => "Boekingen";
export const ondertitel = () => filters.tekst ? "Zoeken in alles" : maandLabel(state.maand);

const filters = { tekst: "", soort: "", categorie: "", persoon: "" };

/* Kom je hier vanaf een ander scherm, dan begin je met een schone lei.
   Alleen als je even een boeking hebt geopend of een bestand hebt
   ingelezen blijft je zoekopdracht staan — dan wil je terug naar waar
   je was. */
export function opBinnenkomst(params, vorigScherm) {
  if (vorigScherm && !["boeken", "importeren"].includes(vorigScherm)) {
    filters.tekst = "";
    filters.soort = "";
    filters.categorie = "";
    filters.persoon = "";
  }
}

export function kopActies() {
  return `
    <a class="icoonknop" href="#/importeren" aria-label="Bankbestand inlezen">📥</a>
    <button class="icoonknop" data-export aria-label="Downloaden als CSV">⤓</button>`;
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const inZoekmodus = !!filters.tekst;
  const lijst = zoek(filters.tekst, {
    soort: filters.soort,
    categorie: filters.categorie,
    persoon: filters.persoon,
    maand: inZoekmodus ? "" : state.maand,
  });

  const o = maandOverzicht(state, state.maand);
  const totaal = lijst.reduce((s, t) =>
    s + (t.soort === "inkomst" ? Number(t.bedrag) || 0 : t.soort === "uitgave" ? -(Number(t.bedrag) || 0) : 0), 0);

  return `
    ${!inZoekmodus ? `
      <div style="display:flex;justify-content:center;margin-bottom:12px">
        ${maandkiezer(state.maand, { maxMaand: maandPlus(maandNu(), 12) })}
      </div>
      <div class="cijferrij cijferrij--twee" style="margin-bottom:10px">
        <div class="cijfer cijfer--in">
          <div class="cijfer__waarde">${geld(o.inkomsten)}</div>
          <div class="cijfer__label">Erin</div>
        </div>
        <div class="cijfer cijfer--uit">
          <div class="cijfer__waarde">${geld(o.vastTotaal + o.variabelTotaal + o.potjeTotaal)}</div>
          <div class="cijfer__label">Eruit</div>
        </div>
      </div>` : ""}

    <div class="zoekbalk">
      <span class="zoekbalk__icoon" aria-hidden="true">🔍</span>
      <input type="search" id="zoek" placeholder="Zoek in alle boekingen…" value="${esc(filters.tekst)}" autocomplete="off">
      ${filters.tekst ? `<button class="zoekbalk__wis" data-wis aria-label="Zoekopdracht wissen">✕</button>` : ""}
    </div>

    <div class="filterrij">
      ${[["", "Alles"], ["uitgave", "Uitgaven"], ["inkomst", "Inkomsten"], ["sparen", "Opzij"], ["opname", "Terug"], ["overboeking", "Overboekingen"]]
        .map(([waarde, label]) => `
          <button class="keuze" data-soort="${waarde}" aria-pressed="${filters.soort === waarde}">${label}</button>`).join("")}
    </div>

    <details class="uitklap" ${filters.categorie || filters.persoon ? "open" : ""}>
      <summary>Verder filteren${filters.categorie || filters.persoon ? " · actief" : ""}</summary>
      <div>
        <div class="veld">
          <label for="fcategorie">Categorie</label>
          <select id="fcategorie">
            <option value="">— alle categorieën —</option>
            ${state.categorieen
              .slice()
              .sort((a, b) => a.naam.localeCompare(b.naam))
              .map(c => `<option value="${esc(c.id)}" ${filters.categorie === c.id ? "selected" : ""}>${esc(c.icoon)} ${esc(c.naam)}</option>`).join("")}
          </select>
        </div>
        ${(state.instellingen.personen || []).length ? `
          <div class="veld">
            <label for="fpersoon">Van wie</label>
            <select id="fpersoon">${persoonOpties(filters.persoon)}</select>
          </div>` : ""}
      </div>
    </details>

    <div class="sectiekop">
      <h2>${lijst.length} ${lijst.length === 1 ? "boeking" : "boekingen"}</h2>
      <span class="dof bedrag" style="font-size:.85rem">${geld(totaal, { teken: true })}</span>
    </div>

    ${lijst.length
      ? transactieLijst(lijst, { groepeer: !inZoekmodus })
      : leeg({
          icoon: filters.tekst ? "🔍" : "📒",
          titel: filters.tekst ? "Niets gevonden" : "Nog geen boekingen",
          tekst: filters.tekst
            ? "Probeer een ander woord, of zet de filters uit."
            : "Voeg je eerste boeking toe, of lees een bankbestand in.",
          knop: filters.tekst ? null : { route: "#/boeken", label: "Boeking toevoegen" },
        })}`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  koppelMaandkiezer(wortel, stap => {
    state.maand = maandPlus(state.maand, stap);
    meld();
  });

  const zoekveld = wortel.querySelector("#zoek");
  const zoeken = debounce(waarde => {
    filters.tekst = waarde;
    meld();
    /* Na het hertekenen weer in het zoekveld staan, met de cursor
       achteraan — anders typ je in het niets verder. */
    const nieuw = document.querySelector("#zoek");
    if (nieuw) { nieuw.focus(); nieuw.setSelectionRange(nieuw.value.length, nieuw.value.length); }
  }, 260);
  zoekveld?.addEventListener("input", () => zoeken(zoekveld.value));

  wortel.addEventListener("change", e => {
    if (e.target.id === "fcategorie") { filters.categorie = e.target.value; meld(); }
    if (e.target.id === "fpersoon") { filters.persoon = e.target.value; meld(); }
  });

  wortel.addEventListener("click", e => {
    const soort = e.target.closest("[data-soort]");
    if (soort) { filters.soort = soort.dataset.soort; return meld(); }

    if (e.target.closest("[data-wis]")) { filters.tekst = ""; return meld(); }

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) ga(`#/boeken/${boeking.dataset.transactie}`);
  });

  document.querySelector(".kop [data-export]")?.addEventListener("click", () => {
    const lijst = zoek(filters.tekst, {
      soort: filters.soort, categorie: filters.categorie, persoon: filters.persoon,
      maand: filters.tekst ? "" : state.maand,
    });
    if (!lijst.length) return melding("Er is niets om te downloaden.", "fout");
    const naam = filters.tekst ? "geldzaken-selectie" : `geldzaken-${state.maand}`;
    downloadTekst(`${naam}.csv`, alsCSV(lijst), "text/csv");
    melding("Bestand gedownload.", "goed");
  });
}
