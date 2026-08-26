/* =====================================================================
   GELDZAKEN — boeking toevoegen of aanpassen
   =====================================================================
   Eén scherm voor alles wat er met geld gebeurt: een uitgave, een
   inkomst, geld opzij zetten of overboeken tussen rekeningen.

   Het bedrag staat bewust groot bovenaan en krijgt meteen de aandacht:
   dat is het enige veld dat je écht moet invullen. De rest vult de app
   zoveel mogelijk zelf in — de categorie raadt hij uit de omschrijving.

   Wat je typt bewaren we in `concept`, niet alleen in het scherm. Komt
   er ondertussen een wijziging van je telefoon binnen, dan wordt het
   scherm opnieuw getekend zonder dat je invoer verdwijnt.
   ===================================================================== */

import { esc, geld, melding, bevestig, vandaagISO, leesBedrag } from "../util.js";
import { state, legeTransactie, bewaarTransactie, wisTransactie,
         raadCategorie, vaakGebruikt, meld } from "../store.js";
import { categorieOpties, rekeningOpties, potjeOpties, doelOpties,
         persoonOpties, SOORTEN } from "./onderdelen.js";
import { terug, eisBewerkrecht } from "../app.js";

export const terugknop = true;
export const terugNaar = "#/start";

let concept = null;
let bewerken = false;

export const titel = () => bewerken ? "Boeking aanpassen" : "Nieuwe boeking";
export const ondertitel = () => concept ? (SOORTEN[concept.soort]?.label || "") : "";

/* ---------------------------------------------------------------
   Binnenkomen
   ---------------------------------------------------------------
   #/boeken                    → nieuwe uitgave
   #/boeken/nieuw/inkomst      → nieuwe inkomst
   #/boeken/nieuw/sparen/pot-3 → meteen naar een potje
   #/boeken/<id>               → bestaande boeking aanpassen
   --------------------------------------------------------------- */
export function opBinnenkomst(params) {
  const [eerste, soort, doelId] = params;

  if (eerste && eerste !== "nieuw") {
    const bestaand = state.transacties.find(t => t.id === eerste);
    if (bestaand) {
      concept = { ...bestaand };
      bewerken = true;
      return;
    }
  }

  bewerken = false;
  concept = legeTransactie({ soort: soort && SOORTEN[soort] ? soort : "uitgave" });

  if (doelId) {
    if (state.potjes.some(p => p.id === doelId)) concept.potje = doelId;
    else if (state.doelen.some(d => d.id === doelId)) concept.doel = doelId;
  }
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  if (!concept) opBinnenkomst([]);
  const s = concept.soort;

  return `
    <div class="segment segment--${esc(s)}">
      ${["uitgave", "inkomst", "sparen", "overboeking"].map(soort => `
        <button type="button" data-soort="${soort}" aria-pressed="${s === soort}">
          ${esc(soort === "uitgave" ? "Uitgave" : soort === "inkomst" ? "Inkomst" : soort === "sparen" ? "Opzij" : "Overboeken")}
        </button>`).join("")}
    </div>

    <div class="bedragveld bedragveld--${esc(s)}">
      <span class="bedragveld__euro">€</span>
      <input type="text" id="bedrag" inputmode="decimal" placeholder="0,00"
             value="${concept.bedrag ? String(concept.bedrag).replace(".", ",") : ""}"
             aria-label="Bedrag">
    </div>

    ${s === "sparen" ? richtingKiezer() : ""}

    <div class="veld">
      <label for="omschrijving">Omschrijving</label>
      <input type="text" id="omschrijving" placeholder="${esc(placeholderVoor(s))}"
             value="${esc(concept.omschrijving)}" autocomplete="off">
    </div>

    ${suggesties(s)}

    ${["uitgave", "inkomst"].includes(s) ? `
      <div class="veld">
        <label for="categorie">Categorie</label>
        <select id="categorie">${categorieOpties(concept.categorie, s === "inkomst" ? "inkomst" : "uitgave")}</select>
      </div>` : ""}

    <div class="veldrij">
      <div class="veld">
        <label for="datum">Datum</label>
        <input type="date" id="datum" value="${esc(concept.datum)}" max="2099-12-31">
      </div>
      <div class="veld">
        <label for="rekening">${s === "inkomst" ? "Op rekening" : "Van rekening"}</label>
        <select id="rekening">${rekeningOpties(concept.rekening)}</select>
      </div>
    </div>

    ${["overboeking", "sparen", "opname"].includes(s) ? `
      <div class="veld">
        <label for="naarRekening">Naar rekening</label>
        <select id="naarRekening">${rekeningOpties(concept.naarRekening, { leegLabel: "— blijft op dezelfde rekening —" })}</select>
        <div class="veld__hint">Zet je het geld echt over naar je spaarrekening, kies die dan hier. Blijft het op je betaalrekening staan, laat dit dan leeg.</div>
      </div>` : ""}

    ${s === "sparen" || s === "opname" ? `
      <div class="veldrij">
        <div class="veld">
          <label for="potje">Potje</label>
          <select id="potje">${potjeOpties(concept.potje)}</select>
        </div>
        <div class="veld">
          <label for="doel">Spaardoel</label>
          <select id="doel">${doelOpties(concept.doel)}</select>
        </div>
      </div>` : ""}

    ${s === "uitgave" && state.potjes.length ? `
      <div class="veld">
        <label for="potje">Betaald uit een potje?</label>
        <select id="potje">${potjeOpties(concept.potje, { leegLabel: "— gewoon van de rekening —" })}</select>
        <div class="veld__hint">Dan gaat het bedrag van dat potje af en drukt het niet op deze maand.</div>
      </div>` : ""}

    ${(state.instellingen.personen || []).length ? `
      <div class="veld">
        <label for="persoon">Van wie</label>
        <select id="persoon">${persoonOpties(concept.persoon)}</select>
      </div>` : ""}

    <details class="uitklap">
      <summary>Notitie</summary>
      <div>
        <textarea id="notitie" placeholder="Bijvoorbeeld: verrekenen met Sam">${esc(concept.notitie || "")}</textarea>
      </div>
    </details>

    <div class="knoprij knoprij--gelijk" style="margin-top:18px">
      ${bewerken ? `<button class="knop knop--rand" data-verwijder>Verwijderen</button>` : ""}
      <button class="knop knop--primair" data-bewaar>${bewerken ? "Opslaan" : "Toevoegen"}</button>
    </div>

    ${bewerken ? `
      <button class="knop knop--stil knop--breed" data-kopie style="margin-top:10px">
        Nog een keer boeken
      </button>` : ""}
  `;
}

function richtingKiezer() {
  return `
    <div class="keuzes" style="margin-bottom:14px;justify-content:center">
      <button type="button" class="keuze" data-richting="sparen" aria-pressed="${concept.soort === "sparen"}">🐖 Opzij zetten</button>
      <button type="button" class="keuze" data-richting="opname" aria-pressed="${concept.soort === "opname"}">↩︎ Terughalen</button>
    </div>`;
}

const placeholderVoor = soort => ({
  uitgave: "Albert Heijn, tanken, kapper…",
  inkomst: "Salaris, teruggave, cadeau…",
  sparen: "Sparen voor de vakantie",
  opname: "Nieuwe wasmachine uit het potje",
  overboeking: "Naar spaarrekening",
}[soort] || "");

/* Wat je vaker boekt staat als knopje klaar; één tik vult naam en
   categorie in. */
function suggesties(soort) {
  if (bewerken) return "";
  const lijst = vaakGebruikt(soort === "inkomst" ? "inkomst" : "uitgave", 6);
  if (!lijst.length) return "";
  return `
    <div class="filterrij" style="margin-top:-6px">
      ${lijst.map(s => `
        <button type="button" class="keuze" data-suggestie="${esc(s.naam)}"
                data-categorie="${esc(s.transactie.categorie || "")}"
                data-bedrag="${esc(String(s.transactie.bedrag || ""))}">${esc(s.naam)}</button>`).join("")}
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  const lees = () => {
    const v = id => wortel.querySelector("#" + id);
    concept.bedrag = leesBedrag(v("bedrag")?.value);
    concept.omschrijving = v("omschrijving")?.value ?? concept.omschrijving;
    concept.datum = v("datum")?.value || concept.datum;
    concept.categorie = v("categorie")?.value ?? concept.categorie;
    concept.rekening = v("rekening")?.value ?? concept.rekening;
    concept.naarRekening = v("naarRekening")?.value ?? "";
    concept.potje = v("potje")?.value ?? "";
    concept.doel = v("doel")?.value ?? "";
    concept.persoon = v("persoon")?.value ?? "";
    concept.notitie = v("notitie")?.value ?? "";
  };

  /* Alles wat je typt of kiest belandt meteen in het concept. */
  wortel.addEventListener("input", lees);
  wortel.addEventListener("change", lees);

  /* Uit de omschrijving een categorie raden zodra je klaar bent met
     typen — maar nooit een keuze overschrijven die je zelf maakte. */
  const omschrijving = wortel.querySelector("#omschrijving");
  omschrijving?.addEventListener("blur", () => {
    lees();
    if (concept.categorie || !concept.omschrijving) return;
    const geraden = raadCategorie(concept.omschrijving, concept.soort === "inkomst" ? "inkomst" : "uitgave");
    if (geraden) { concept.categorie = geraden; meld(); }
  });

  wortel.addEventListener("click", async e => {
    const soortKnop = e.target.closest("[data-soort]");
    if (soortKnop) {
      lees();
      concept.soort = soortKnop.dataset.soort;
      if (concept.soort !== "uitgave") concept.potje = concept.soort === "sparen" ? concept.potje : "";
      if (!["uitgave", "inkomst"].includes(concept.soort)) concept.categorie = "";
      return meld();
    }

    const richting = e.target.closest("[data-richting]");
    if (richting) {
      lees();
      concept.soort = richting.dataset.richting;
      return meld();
    }

    const sug = e.target.closest("[data-suggestie]");
    if (sug) {
      lees();
      concept.omschrijving = sug.dataset.suggestie;
      if (sug.dataset.categorie) concept.categorie = sug.dataset.categorie;
      if (!concept.bedrag && sug.dataset.bedrag) concept.bedrag = Number(sug.dataset.bedrag);
      meld();
      setTimeout(() => wortel.querySelector("#bedrag")?.focus(), 40);
      return;
    }

    if (e.target.closest("[data-bewaar]")) { lees(); return opslaan(); }
    if (e.target.closest("[data-kopie]")) { lees(); return nogEenKeer(); }

    if (e.target.closest("[data-verwijder]")) {
      if (!eisBewerkrecht()) return;
      const zeker = await bevestig("Deze boeking wordt verwijderd.", { bevestigLabel: "Verwijderen", gevaar: true });
      if (!zeker) return;
      await wisTransactie(concept.id);
      melding("Boeking verwijderd.");
      terug("#/maand");
    }
  });

  /* Het bedragveld groeit mee met wat je typt, zodat het euroteken en
     het bedrag bij elkaar blijven staan in plaats van uit elkaar te
     drijven op een breed scherm. */
  const bedragveld = wortel.querySelector("#bedrag");
  const meetBedrag = () => {
    if (!bedragveld) return;
    bedragveld.style.width = Math.max(4, bedragveld.value.length + 1) + "ch";
  };
  bedragveld?.addEventListener("input", meetBedrag);
  meetBedrag();

  /* Meteen kunnen typen bij een nieuwe boeking. */
  if (!bewerken) setTimeout(() => bedragveld?.focus(), 60);
}

async function opslaan() {
  if (!eisBewerkrecht()) return;

  if (!concept.bedrag || concept.bedrag <= 0) {
    melding("Vul eerst een bedrag in.", "fout");
    return;
  }
  if (concept.soort === "sparen" && !concept.potje && !concept.doel) {
    melding("Kies een potje of een spaardoel om het geld in te zetten.", "fout");
    return;
  }
  if (concept.soort === "opname" && !concept.potje && !concept.doel) {
    melding("Kies waar het geld uit gehaald wordt.", "fout");
    return;
  }
  if (!concept.omschrijving) {
    concept.omschrijving = state.categorieen.find(c => c.id === concept.categorie)?.naam
      || SOORTEN[concept.soort]?.label || "Boeking";
  }

  await bewaarTransactie(concept);
  melding(`${geld(concept.bedrag)} geboekt.`, "goed");

  /* Het formulier alvast leegmaken, zodat de plusknop straks weer een
     schone boeking opent — met dezelfde rekening en dezelfde persoon,
     want dat is meestal wat je wilt. */
  const vorige = concept;
  concept = legeTransactie({
    soort: vorige.soort,
    datum: vorige.datum,
    rekening: vorige.rekening,
    persoon: vorige.persoon,
  });
  bewerken = false;
  terug("#/start");
}

/* Dezelfde boeking nog eens, met de datum van vandaag. Handig voor iets
   wat je elke week doet maar geen vaste last is. */
async function nogEenKeer() {
  if (!eisBewerkrecht()) return;
  const { id, aangemaakt, bijgewerkt, terugkerendId, ...rest } = concept;
  const nieuw = legeTransactie({ ...rest, datum: vandaagISO() });
  await bewaarTransactie(nieuw);
  melding("Nog een keer geboekt op vandaag.", "goed");
  terug("#/maand");
}
