/* =====================================================================
   WIJNKELDER — fles toevoegen of bewerken
   =====================================================================
   Hetzelfde scherm doet allebei: zonder id maak je een nieuwe fles, met
   id (#/toevoegen/abc) bewerk je een bestaande.

   Het concept staat in een variabele op moduleniveau. Dat is nodig
   omdat de app zichzelf opnieuw tekent zodra er gegevens binnenkomen —
   zonder concept zou een synchronisatie midden in het invullen je
   halve formulier wissen.
   ===================================================================== */

import { state, meld, legeFles, bewaarFles, vindFles, verwijderFles } from "../store.js";
import { esc, geld, melding, verkleinFoto, bevestig, normaliseer, vandaagISO } from "../util.js";
import {
  KLEUREN, kleurInfo, FORMATEN, LANDEN, REGIOS, ALLE_DRUIVEN,
  regiosVanLand, regioInfo, regioVanAppellatie, druifInfo,
} from "../data/catalog.js";
import { drinkVenster, rijping } from "../data/aging.js";
import { rijpingsBalk } from "./onderdelen.js";
import { ga, terug } from "../app.js";

/* ---------------------------------------------------------------
   Het concept
   --------------------------------------------------------------- */
let concept = null;
let conceptVoor = null;     // id van de fles die bewerkt wordt, of "nieuw"
let toonMeer = false;       // de uitklapbare velden

function zorgVoorConcept(id) {
  const sleutel = id || "nieuw";
  if (conceptVoor === sleutel && concept) return;

  conceptVoor = sleutel;
  toonMeer = !!id;          // bij bewerken meteen alles tonen

  if (id) {
    const bestaand = vindFles(id);
    concept = bestaand ? JSON.parse(JSON.stringify(bestaand)) : legeFles();
  } else {
    concept = legeFles();
    /* De laatst gebruikte kelder onthouden scheelt bij het invoeren
       van een hele doos. */
    const laatste = [...state.flessen].sort((a, b) => (b.aangemaakt || 0) - (a.aangemaakt || 0))[0];
    if (laatste?.locatie?.kelder) concept.locatie.kelder = laatste.locatie.kelder;
  }
}

export function reset() { concept = null; conceptVoor = null; }

export const titel = params => (params[0] ? "Fles bewerken" : "Fles toevoegen");
export const terugknop = true;

export function ondertitel(params) {
  return params[0] ? "Wijzigingen worden meteen bewaard" : "Naam en jaargang zijn genoeg om te beginnen";
}

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html(params) {
  zorgVoorConcept(params[0]);
  const c = concept;
  const bewerken = !!params[0];

  return `
    ${fotoBlok(c)}

    <div class="veld">
      <label for="v-naam">Naam van de wijn</label>
      <input type="text" id="v-naam" data-veld="naam" value="${esc(c.naam)}"
             placeholder="Bijv. Château Fonroque" autocomplete="off" enterkeyhint="next">
    </div>

    <div class="veld suggestieveld">
      <label for="v-producent">Producent</label>
      <input type="text" id="v-producent" data-veld="producent" data-suggestie="producent"
             value="${esc(c.producent)}" placeholder="Domein, château of huis" autocomplete="off">
    </div>

    <div class="veld">
      <span class="veld__label">Kleur</span>
      <div class="keuzes" data-kleurkeuze>
        ${KLEUREN.map(k => {
          const aan = c.kleur === k.id;
          return `<button type="button" class="keuze keuze--kleur ${aan ? "is-actief" : ""}"
            data-kleur="${k.id}" aria-pressed="${aan}"
            style="${aan ? `background:${k.kleur};border-color:${k.kleur};color:${k.tekstOp}` : ""}">
            ${k.emoji} ${esc(k.naam)}</button>`;
        }).join("")}
      </div>
    </div>

    <div class="veldrij">
      <div class="veld">
        <label for="v-jaargang">Jaargang</label>
        <input type="number" id="v-jaargang" data-veld="jaargang" inputmode="numeric"
               value="${c.jaargang ?? ""}" placeholder="${new Date().getFullYear() - 3}"
               min="1800" max="${new Date().getFullYear() + 2}">
        <p class="veld__hint">Leeg laten bij een wijn zonder jaartal.</p>
      </div>
      <div class="veld">
        <label for="v-aantal">Aantal flessen</label>
        <div style="display:flex;gap:6px;align-items:center">
          <button type="button" class="icoonknop" data-aantal="-1" aria-label="Eén minder">−</button>
          <input type="number" id="v-aantal" data-veld="aantal" inputmode="numeric"
                 value="${c.aantal}" min="1" style="text-align:center">
          <button type="button" class="icoonknop" data-aantal="1" aria-label="Eén meer">＋</button>
        </div>
      </div>
    </div>

    ${herkomstBlok(c)}
    ${druivenBlok(c)}

    <div class="veldrij">
      <div class="veld">
        <label for="v-aankoop">Aankoopprijs per fles</label>
        <input type="number" id="v-aankoop" data-veld="aankoopPrijs" inputmode="decimal" step="0.01"
               value="${c.aankoopPrijs ?? ""}" placeholder="0,00">
      </div>
      <div class="veld">
        <label for="v-waarde">Huidige waarde per fles</label>
        <input type="number" id="v-waarde" data-veld="huidigeWaarde" inputmode="decimal" step="0.01"
               value="${c.huidigeWaarde ?? ""}" placeholder="${c.aankoopPrijs ?? "0,00"}">
      </div>
    </div>

    <!-- Wordt bij het typen bijgewerkt zonder het hele formulier te
         hertekenen, anders springt de cursor uit het veld. -->
    <div id="afgeleid">${winstRegel(c)}${voorspelling(c)}</div>

    <button type="button" class="knop knop--breed knop--rand" data-meer
            aria-expanded="${toonMeer}" style="margin:14px 0 12px">
      ${toonMeer ? "▲ Minder velden" : "▼ Meer invullen (locatie, formaat, drinkvenster)"}
    </button>

    <div class="${toonMeer ? "" : "verborgen"}" id="meer-velden">
      ${locatieBlok(c)}
      ${detailBlok(c)}
      ${drinkvensterBlok(c)}

      <div class="veld">
        <label for="v-notitie">Eigen notitie</label>
        <textarea id="v-notitie" data-veld="notitie"
                  placeholder="Waar je hem kocht, van wie je hem kreeg, waar je hem voor bewaart…">${esc(c.notitie)}</textarea>
      </div>
    </div>

    <div class="knoprij knoprij--gelijk" style="margin-top:18px">
      <button type="button" class="knop" data-annuleer>Annuleren</button>
      <button type="button" class="knop knop--primair" data-bewaar>
        ${bewerken ? "Opslaan" : "Toevoegen aan kelder"}
      </button>
    </div>

    ${!bewerken ? `
      <button type="button" class="knop knop--breed knop--stil" data-bewaar-nog
              style="margin-top:9px">Opslaan en nog een fles invoeren</button>` : ""}

    ${bewerken ? `
      <button type="button" class="knop knop--breed knop--stil" data-verwijder
              style="margin-top:18px;color:var(--fout)">Deze wijn uit de kelder verwijderen</button>` : ""}`;
}

/* ---------------------------------------------------------------
   Etiketfoto
   --------------------------------------------------------------- */
function fotoBlok(c) {
  return `
    <div class="veld">
      <span class="veld__label">Etiket</span>
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${c.foto
          ? `<img src="${esc(c.foto)}" alt="Etiket" class="fiche__foto" style="width:92px;height:124px">`
          : `<div class="fiche__geenfoto" style="width:92px;height:124px">${kleurInfo(c.kleur).emoji}</div>`}
        <div style="flex:1;display:flex;flex-direction:column;gap:7px">
          <button type="button" class="knop knop--klein" data-foto="camera">📷 Foto maken</button>
          <button type="button" class="knop knop--klein" data-foto="bestand">🖼️ Uit bibliotheek</button>
          ${c.foto ? `<button type="button" class="knop knop--klein knop--stil" data-foto="weg">Foto verwijderen</button>` : ""}
          <p class="veld__hint" style="margin:0">De foto wordt verkleind opgeslagen — hij hoeft alleen leesbaar te zijn.</p>
        </div>
      </div>
      <input type="file" accept="image/*" capture="environment" id="foto-camera" class="verborgen">
      <input type="file" accept="image/*" id="foto-bestand" class="verborgen">
    </div>`;
}

/* ---------------------------------------------------------------
   Land, regio en appellatie
   --------------------------------------------------------------- */
function herkomstBlok(c) {
  const regios = c.land ? regiosVanLand(c.land) : [];
  const regio = regioInfo(c.land, c.regio);
  const appellaties = regio?.appellaties || [];

  return `
    <div class="veldrij">
      <div class="veld">
        <label for="v-land">Land</label>
        <select id="v-land" data-veld="land">
          <option value="">Kies een land…</option>
          ${LANDEN.map(l => `<option value="${esc(l)}" ${c.land === l ? "selected" : ""}>${esc(l)}</option>`).join("")}
        </select>
      </div>
      <div class="veld">
        <label for="v-regio">Regio</label>
        <select id="v-regio" data-veld="regio" ${!regios.length ? "disabled" : ""}>
          <option value="">${regios.length ? "Kies een regio…" : "Kies eerst een land"}</option>
          ${regios.map(r => `<option value="${esc(r.regio)}" ${c.regio === r.regio ? "selected" : ""}>${esc(r.regio)}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="veld suggestieveld">
      <label for="v-appellatie">Appellatie of classificatie</label>
      <input type="text" id="v-appellatie" data-veld="appellatie" data-suggestie="appellatie"
             value="${esc(c.appellatie)}" autocomplete="off"
             placeholder="${appellaties.length ? esc(appellaties[0]) : "Bijv. Chianti Classico DOCG"}">
      ${appellaties.length ? `
        <p class="veld__hint">Typ om te zoeken binnen ${esc(c.regio)}, of vul iets eigens in.</p>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Druiven
   --------------------------------------------------------------- */
function druivenBlok(c) {
  return `
    <div class="veld suggestieveld">
      <label for="v-druif">Druivenrassen</label>
      <input type="text" id="v-druif" data-suggestie="druif" autocomplete="off"
             placeholder="Typ een druif en kies uit de lijst">
      ${c.druiven.length ? `
        <div class="chips">
          ${c.druiven.map((d, i) => `
            <span class="chip">${esc(d)}
              <button type="button" data-druif-weg="${i}" aria-label="${esc(d)} verwijderen">✕</button>
            </span>`).join("")}
        </div>` : `<p class="veld__hint">Bepaalt mee hoe lang de wijn kan liggen en waar hij bij past.</p>`}
    </div>`;
}

/* ---------------------------------------------------------------
   Locatie in de kelder
   --------------------------------------------------------------- */
function locatieBlok(c) {
  const kelders = [...new Set([
    ...state.flessen.map(f => f.locatie?.kelder).filter(Boolean),
    ...(state.instellingen.kelders || []).map(k => k.naam),
    "Kelder",
  ])];
  const rekken = [...new Set(state.flessen
    .filter(f => f.locatie?.kelder === c.locatie.kelder)
    .map(f => f.locatie?.rek).filter(Boolean))].sort();

  return `
    <div class="sectiekop"><h2>Waar ligt hij?</h2></div>
    <div class="veldrij">
      <div class="veld">
        <label for="v-kelder">Kelder of kast</label>
        <input type="text" id="v-kelder" data-veld="locatie.kelder" list="kelderlijst"
               value="${esc(c.locatie.kelder)}" placeholder="Kelder" autocomplete="off">
        <datalist id="kelderlijst">
          ${kelders.map(k => `<option value="${esc(k)}">`).join("")}
        </datalist>
      </div>
      <div class="veld">
        <label for="v-rek">Rek</label>
        <input type="text" id="v-rek" data-veld="locatie.rek" list="reklijst"
               value="${esc(c.locatie.rek)}" placeholder="A" autocomplete="off">
        <datalist id="reklijst">
          ${rekken.map(r => `<option value="${esc(r)}">`).join("")}
        </datalist>
      </div>
    </div>
    <div class="veldrij">
      <div class="veld">
        <label for="v-rij">Rij</label>
        <input type="number" id="v-rij" data-veld="locatie.rij" inputmode="numeric" min="1"
               value="${c.locatie.rij ?? ""}" placeholder="1">
      </div>
      <div class="veld">
        <label for="v-vak">Vak</label>
        <input type="number" id="v-vak" data-veld="locatie.vak" inputmode="numeric" min="1"
               value="${c.locatie.vak ?? ""}" placeholder="1">
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Formaat, alcohol, aankoop
   --------------------------------------------------------------- */
function detailBlok(c) {
  return `
    <div class="sectiekop"><h2>Details</h2></div>
    <div class="veldrij">
      <div class="veld">
        <label for="v-formaat">Flesformaat</label>
        <select id="v-formaat" data-veld="formaat">
          ${FORMATEN.map(f => `<option value="${f.id}" ${c.formaat === f.id ? "selected" : ""}>${esc(f.naam)}</option>`).join("")}
        </select>
      </div>
      <div class="veld">
        <label for="v-alcohol">Alcohol (%)</label>
        <input type="number" id="v-alcohol" data-veld="alcohol" inputmode="decimal" step="0.1"
               value="${c.alcohol ?? ""}" placeholder="13,5">
      </div>
    </div>
    <div class="veldrij">
      <div class="veld">
        <label for="v-datum">Aankoopdatum</label>
        <input type="date" id="v-datum" data-veld="aankoopDatum" value="${esc(c.aankoopDatum)}"
               max="${vandaagISO()}">
      </div>
      <div class="veld">
        <label for="v-leverancier">Gekocht bij</label>
        <input type="text" id="v-leverancier" data-veld="leverancier" value="${esc(c.leverancier)}"
               placeholder="Wijnhandel, domein, veiling…" autocomplete="off">
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Eigen drinkvenster
   --------------------------------------------------------------- */
function drinkvensterBlok(c) {
  const geschat = c.jaargang ? drinkVenster({ ...c, drinkVanaf: null, drinkTot: null }) : null;

  return `
    <div class="sectiekop"><h2>Drinkvenster</h2></div>
    <p class="metaregel" style="margin:-4px 2px 9px">
      ${geschat
        ? `De app schat <strong>${geschat.vanaf}–${geschat.tot}</strong> op basis van regio, druiven en prijs. Vul hieronder iets in als je het beter weet.`
        : "Vul een jaargang in, dan schat de app zelf een venster."}
    </p>
    <div class="veldrij">
      <div class="veld">
        <label for="v-vanaf">Drinken vanaf</label>
        <input type="number" id="v-vanaf" data-veld="drinkVanaf" inputmode="numeric"
               value="${c.drinkVanaf ?? ""}" placeholder="${geschat?.vanaf ?? ""}" min="1900" max="2200">
      </div>
      <div class="veld">
        <label for="v-tot">Drinken tot</label>
        <input type="number" id="v-tot" data-veld="drinkTot" inputmode="numeric"
               value="${c.drinkTot ?? ""}" placeholder="${geschat?.tot ?? ""}" min="1900" max="2200">
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Terugkoppeling terwijl je typt
   --------------------------------------------------------------- */
function winstRegel(c) {
  const a = Number(c.aankoopPrijs) || 0;
  const n = Number(c.huidigeWaarde) || 0;
  if (!a || !n) return "";
  const verschil = (n - a) * (c.aantal || 1);
  const pct = ((n - a) / a) * 100;
  return `<p class="metaregel" style="margin:-6px 2px 12px">
    Over ${c.aantal} ${c.aantal === 1 ? "fles" : "flessen"}:
    <span class="${verschil >= 0 ? "op" : "af"}">${verschil >= 0 ? "+" : ""}${geld(verschil)}
    (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%)</span></p>`;
}

function voorspelling(c) {
  if (!c.jaargang) return "";
  const r = rijping(c);
  if (!r.venster) return "";
  return `
    <div class="kaart" data-voorspelling style="padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <strong style="font-size:.9rem">${r.fase.emoji} ${esc(r.fase.naam)}</strong>
        <span class="metaregel">${r.venster.vanaf}–${r.venster.tot}</span>
      </div>
      ${rijpingsBalk(c)}
      <p class="metaregel" style="margin:6px 0 0">${esc(r.fase.uitleg)}</p>
    </div>`;
}

/* =====================================================================
   Interactie
   ===================================================================== */
export function koppel(wortel, params) {
  const c = concept;

  /* --- gewone velden ------------------------------------------------ */
  wortel.addEventListener("input", e => {
    const veld = e.target.dataset.veld;
    if (!veld) return;
    zetWaarde(c, veld, e.target);

    /* Sommige velden veranderen de rest van het formulier. */
    if (["aankoopPrijs", "jaargang", "aantal", "huidigeWaarde"].includes(veld)) {
      werkAfgeleidBij(wortel, c);
    }
  });

  wortel.addEventListener("change", e => {
    const veld = e.target.dataset.veld;
    if (!veld) return;
    zetWaarde(c, veld, e.target);

    /* Land wisselen wist de regio, regio wisselen wist de appellatie
       niet — die mag je vaak laten staan. */
    if (veld === "land") { c.regio = ""; c.appellatie = ""; return herteken(); }
    if (veld === "regio") {
      return herteken();
    }
    if (veld === "formaat") herteken();
  });

  /* --- kleur -------------------------------------------------------- */
  wortel.querySelector("[data-kleurkeuze]")?.addEventListener("click", e => {
    const knop = e.target.closest("[data-kleur]");
    if (!knop) return;
    c.kleur = knop.dataset.kleur;
    herteken();
  });

  /* --- aantal ------------------------------------------------------- */
  wortel.addEventListener("click", e => {
    const stap = e.target.closest("[data-aantal]");
    if (!stap) return;
    c.aantal = Math.max(1, (Number(c.aantal) || 1) + Number(stap.dataset.aantal));
    herteken();
  });

  /* --- foto --------------------------------------------------------- */
  const camera = wortel.querySelector("#foto-camera");
  const bestand = wortel.querySelector("#foto-bestand");

  wortel.addEventListener("click", e => {
    const knop = e.target.closest("[data-foto]");
    if (!knop) return;
    if (knop.dataset.foto === "camera") camera.click();
    if (knop.dataset.foto === "bestand") bestand.click();
    if (knop.dataset.foto === "weg") { c.foto = ""; herteken(); }
  });

  const laadFoto = async invoer => {
    const f = invoer.files?.[0];
    if (!f) return;
    try {
      melding("Foto wordt verwerkt…");
      c.foto = await verkleinFoto(f);
      herteken();
    } catch (err) {
      melding(err.message, "fout");
    } finally {
      invoer.value = "";
    }
  };
  camera?.addEventListener("change", () => laadFoto(camera));
  bestand?.addEventListener("change", () => laadFoto(bestand));

  /* --- suggesties --------------------------------------------------- */
  koppelSuggesties(wortel, c, herteken);

  /* --- druif verwijderen -------------------------------------------- */
  wortel.addEventListener("click", e => {
    const weg = e.target.closest("[data-druif-weg]");
    if (!weg) return;
    c.druiven.splice(Number(weg.dataset.druifWeg), 1);
    herteken();
  });

  /* --- meer velden -------------------------------------------------- */
  wortel.querySelector("[data-meer]")?.addEventListener("click", () => {
    toonMeer = !toonMeer;
    herteken();
  });

  /* --- opslaan ------------------------------------------------------ */
  wortel.querySelector("[data-bewaar]")?.addEventListener("click", () => opslaan({ nogEen: false }));
  wortel.querySelector("[data-bewaar-nog]")?.addEventListener("click", () => opslaan({ nogEen: true }));
  wortel.querySelector("[data-annuleer]")?.addEventListener("click", () => { reset(); terug("#/kelder"); });

  wortel.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
    const zeker = await bevestig(
      `"${c.naam || "Deze wijn"}" verdwijnt uit je kelder. Je proefnotities en de historie blijven bewaard.`,
      { titel: "Wijn verwijderen?", bevestigLabel: "Verwijderen", gevaar: true });
    if (!zeker) return;
    await verwijderFles(c.id);
    reset();
    melding("Uit de kelder gehaald");
    ga("#/kelder");
  });

  async function opslaan({ nogEen }) {
    if (!c.naam.trim() && !c.producent.trim()) {
      melding("Vul minstens een naam of een producent in.", "fout");
      wortel.querySelector("#v-naam")?.focus();
      return;
    }
    if (!c.naam.trim()) c.naam = c.producent;

    await bewaarFles(c);
    melding(params[0] ? "Opgeslagen" : `${c.aantal}× ${c.naam} toegevoegd`, "goed");

    if (nogEen) {
      /* Handig bij een doos: land, regio en locatie blijven staan. */
      const vorige = c;
      reset();
      zorgVoorConcept(null);
      Object.assign(concept, {
        land: vorige.land, regio: vorige.regio, kleur: vorige.kleur,
        locatie: { ...vorige.locatie, rij: null, vak: null },
        leverancier: vorige.leverancier, aankoopDatum: vorige.aankoopDatum,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      herteken();
    } else {
      const id = c.id;
      reset();
      ga(`#/fles/${id}`);
    }
  }

  /* Het scherm opnieuw tekenen zonder de gegevens aan te raken. */
  function herteken() { meld(); }

  return () => { /* niets op te ruimen */ };
}

/* ---------------------------------------------------------------
   Waarde uit een veld in het concept zetten
   --------------------------------------------------------------- */
function zetWaarde(c, pad, invoer) {
  let waarde = invoer.value;

  if (invoer.type === "number") {
    waarde = waarde === "" ? null : Number(waarde);
    if (waarde !== null && !isFinite(waarde)) waarde = null;
  }
  if (pad === "aantal") waarde = Math.max(1, Number(waarde) || 1);

  if (pad.includes(".")) {
    const [buiten, binnen] = pad.split(".");
    c[buiten] = { ...c[buiten], [binnen]: waarde };
  } else {
    c[pad] = waarde;
  }
}

/* De rijpingsvoorspelling en de winstregel bijwerken zonder het hele
   formulier te hertekenen — anders verlies je de cursor. Het blok kan
   ook van leeg naar gevuld gaan: zodra je een jaargang invult verschijnt
   de voorspelling, en die moet er dan ook echt bij komen te staan. */
function werkAfgeleidBij(wortel, c) {
  const bak = wortel.querySelector("#afgeleid");
  if (bak) bak.innerHTML = winstRegel(c) + voorspelling(c);
}

/* ---------------------------------------------------------------
   Suggestievelden
   --------------------------------------------------------------- */
function koppelSuggesties(wortel, c, herteken) {
  wortel.querySelectorAll("[data-suggestie]").forEach(invoer => {
    const soort = invoer.dataset.suggestie;
    let lijstEl = null;

    const sluit = () => { lijstEl?.remove(); lijstEl = null; };

    const toon = () => {
      sluit();
      const treffers = zoekSuggesties(soort, invoer.value, c);
      if (!treffers.length) return;

      lijstEl = document.createElement("div");
      lijstEl.className = "suggesties";
      lijstEl.innerHTML = treffers.map(t => `
        <button type="button" class="suggestie" data-kies="${esc(t.waarde)}">
          ${esc(t.waarde)}
          ${t.bij ? `<span class="suggestie__bij">${esc(t.bij)}</span>` : ""}
        </button>`).join("");

      lijstEl.addEventListener("mousedown", e => e.preventDefault());  /* blur voorkomen */
      lijstEl.addEventListener("click", e => {
        const knop = e.target.closest("[data-kies]");
        if (!knop) return;
        kiesSuggestie(soort, knop.dataset.kies, c, invoer);
        sluit();
        herteken();
      });

      invoer.closest(".suggestieveld").appendChild(lijstEl);
    };

    invoer.addEventListener("input", toon);
    invoer.addEventListener("focus", toon);
    invoer.addEventListener("blur", () => setTimeout(sluit, 120));
    invoer.addEventListener("keydown", e => {
      if (e.key === "Escape") sluit();
      if (e.key === "Enter" && lijstEl) {
        e.preventDefault();
        lijstEl.querySelector("[data-kies]")?.click();
      }
    });
  });
}

function zoekSuggesties(soort, tekst, c) {
  const q = normaliseer(tekst);

  if (soort === "druif") {
    const regio = regioInfo(c.land, c.regio);
    /* Druiven uit de gekozen regio eerst — dat is bijna altijd raak. */
    const voorkeur = regio?.druiven || [];
    const rest = ALLE_DRUIVEN.filter(d => !voorkeur.includes(d));
    const alles = [...voorkeur, ...rest].filter(d => !c.druiven.includes(d));
    return alles
      .filter(d => !q || normaliseer(d).includes(q))
      .slice(0, 8)
      .map(d => {
        const i = druifInfo(d);
        return { waarde: d, bij: voorkeur.includes(d) ? `typisch voor ${c.regio}` : (i ? `${i.kleur}e druif` : "") };
      });
  }

  if (soort === "appellatie") {
    const regio = regioInfo(c.land, c.regio);
    const eigen = regio?.appellaties || [];
    const bron = eigen.length ? eigen : REGIOS.flatMap(r => r.appellaties);
    return bron
      .filter(a => !q || normaliseer(a).includes(q))
      .slice(0, 8)
      .map(a => {
        const r = eigen.length ? null : regioVanAppellatie(a);
        return { waarde: a, bij: r ? `${r.regio}, ${r.land}` : "" };
      });
  }

  if (soort === "producent") {
    if (!q) return [];
    /* Producenten komen uit je eigen kelder — die kent de app het best. */
    const bekend = [...new Set(state.flessen.map(f => f.producent).filter(Boolean))];
    return bekend
      .filter(p => normaliseer(p).includes(q))
      .slice(0, 6)
      .map(p => {
        const voorbeeld = state.flessen.find(f => f.producent === p);
        return { waarde: p, bij: voorbeeld?.regio || voorbeeld?.land || "" };
      });
  }
  return [];
}

function kiesSuggestie(soort, waarde, c, invoer) {
  if (soort === "druif") {
    if (!c.druiven.includes(waarde)) c.druiven.push(waarde);
    invoer.value = "";
    return;
  }
  if (soort === "appellatie") {
    c.appellatie = waarde;
    /* Een appellatie verraadt vaak de regio — die vullen we dan gratis in. */
    if (!c.regio) {
      const r = regioVanAppellatie(waarde);
      if (r) { c.land = r.land; c.regio = r.regio; }
    }
    return;
  }
  if (soort === "producent") {
    c.producent = waarde;
    /* Ken je deze producent al? Neem herkomst over als die nog leeg is. */
    const eerder = state.flessen.find(f => f.producent === waarde);
    if (eerder) {
      if (!c.land)  c.land = eerder.land;
      if (!c.regio) c.regio = eerder.regio;
      if (!c.appellatie) c.appellatie = eerder.appellatie;
    }
  }
}
