/* =====================================================================
   GELDZAKEN — bankbestand inlezen
   =====================================================================
   Een maand handmatig overtikken doet niemand vol. Daarom kun je hier
   het CSV-bestand uit je internetbankieren inlezen.

   Wat er gebeurt:
     1. het bestand wordt uitgelezen (puntkomma, komma of tab)
     2. de app herkent de bank aan de kolomnamen — lukt dat niet, dan
        wijs je de kolommen zelf aan
     3. elke regel krijgt alvast een categorie op basis van de
        omschrijving en van wat jij eerder hebt ingedeeld
     4. regels die je al hebt staan worden herkend en uitgevinkt, zodat
        je niet per ongeluk alles dubbel boekt

   Pas als je op "Toevoegen" drukt gaat er iets de boekhouding in.
   ===================================================================== */

import { esc, geld, datumNL, melding, kiesBestand, leesTekst,
         normaliseer } from "../util.js";
import { state, bewaarVeelTransacties, raadCategorie, standaardRekening,
         meld } from "../store.js";
import { BANKPROFIELEN } from "../data/standaard.js";
import { leeg, rekeningOpties, categorieOpties } from "./onderdelen.js";
import { ga, eisBewerkrecht } from "../app.js";

export const titel = () => "Bankbestand inlezen";
export const ondertitel = () => "CSV uit je internetbankieren";
export const terugknop = true;
export const terugNaar = "#/maand";

/* De stand van het inleesproces. Blijft staan zolang je op dit scherm
   bent, ook als het scherm tussendoor hertekend wordt. */
let stap = "kies";        // kies | koppelen | controleren
let tabel = null;         // { kop: [], rijen: [[]] }
let profiel = null;
let kolommen = { datum: "", omschrijving: "", bedrag: "", richting: "" };
let voorstellen = [];     // { transactie, dubbel, kies }
let rekeningKeuze = "";

export function opBinnenkomst() {
  if (stap === "kies") rekeningKeuze = standaardRekening()?.id || "";
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  if (stap === "controleren") return controleren();
  if (stap === "koppelen") return koppelen();
  return kiesScherm();
}

function kiesScherm() {
  return `
    <div class="kaart">
      <div class="kaart__kop"><h2>Zo werkt het</h2></div>
      <ol style="margin:0;padding-left:20px;font-size:.88rem;color:var(--tekst-zacht);line-height:1.6">
        <li>Download bij je bank een CSV van de periode die je wilt.</li>
        <li>Kies dat bestand hieronder.</li>
        <li>Controleer wat de app ervan maakt en vink af wat je niet wilt.</li>
      </ol>
      <div class="veld__hint">
        Herkend zonder instellen: ${BANKPROFIELEN.filter(p => p.id !== "geldzaken").map(p => p.naam).join(", ")}.
        Een andere bank kan ook — dan wijs je zelf even aan welke kolom wat is.
      </div>
    </div>

    <div class="veld">
      <label for="ibank">Op welke rekening</label>
      <select id="ibank">${rekeningOpties(rekeningKeuze, { leegLabel: "— geen rekening —" })}</select>
    </div>

    <button class="knop knop--primair knop--breed" data-kies-bestand>Kies een bestand</button>`;
}

function koppelen() {
  const opties = gekozen => `<option value="">— kies —</option>` +
    tabel.kop.map(k => `<option value="${esc(k)}" ${k === gekozen ? "selected" : ""}>${esc(k)}</option>`).join("");

  return `
    <div class="signaal signaal--let-op">
      <span class="signaal__icoon">🧭</span>
      <span>
        <span class="signaal__titel">Deze bank ken ik nog niet</span>
        <span class="signaal__tekst">Wijs even aan welke kolom wat betekent, dan gaat de rest vanzelf.</span>
      </span>
    </div>

    <div class="veld">
      <label for="kdatum">Kolom met de datum</label>
      <select id="kdatum">${opties(kolommen.datum)}</select>
    </div>
    <div class="veld">
      <label for="komschrijving">Kolom met de omschrijving</label>
      <select id="komschrijving">${opties(kolommen.omschrijving)}</select>
    </div>
    <div class="veld">
      <label for="kbedrag">Kolom met het bedrag</label>
      <select id="kbedrag">${opties(kolommen.bedrag)}</select>
    </div>
    <div class="veld">
      <label for="krichting">Kolom met af/bij (optioneel)</label>
      <select id="krichting">${opties(kolommen.richting)}</select>
      <div class="veld__hint">Staat het minteken al in het bedrag zelf? Laat dit dan leeg.</div>
    </div>

    <div class="kaart">
      <div class="kaart__kop"><h2>Eerste regel uit je bestand</h2></div>
      <div class="tabelrol">
        <table class="tabel">
          <tbody>
            ${tabel.kop.map((k, i) => `
              <tr><td class="dof">${esc(k)}</td><td>${esc(tabel.rijen[0]?.[i] || "")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="knoprij knoprij--gelijk">
      <button class="knop" data-opnieuw>Ander bestand</button>
      <button class="knop knop--primair" data-verder>Verder</button>
    </div>`;
}

function controleren() {
  const teDoen = voorstellen.filter(v => v.kies);
  const dubbel = voorstellen.filter(v => v.dubbel).length;
  const zonderCategorie = teDoen.filter(v => !v.transactie.categorie).length;

  return `
    <div class="cijferrij cijferrij--twee">
      <div class="cijfer">
        <div class="cijfer__waarde">${teDoen.length}</div>
        <div class="cijfer__label">Worden toegevoegd</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde">${dubbel}</div>
        <div class="cijfer__label">Stonden er al in</div>
      </div>
    </div>

    ${zonderCategorie ? `
      <div class="signaal signaal--info">
        <span class="signaal__icoon">🏷️</span>
        <span>
          <span class="signaal__titel">${zonderCategorie} zonder categorie</span>
          <span class="signaal__tekst">Je kunt ze hier indelen, of het later per boeking doen. De app onthoudt je keuze voor de volgende keer.</span>
        </span>
      </div>` : ""}

    <div class="knoprij" style="margin-bottom:12px">
      <button class="knop knop--klein" data-alles>Alles aan</button>
      <button class="knop knop--klein" data-niets>Alles uit</button>
      <button class="knop knop--klein" data-alleen-nieuw>Alleen nieuwe</button>
    </div>

    <div class="lijst">
      ${voorstellen.map((v, i) => {
        const t = v.transactie;
        return `
          <div class="rij" style="${v.kies ? "" : "opacity:.5"}">
            <label class="schakelaar" style="width:26px;height:26px;flex:none">
              <input type="checkbox" data-kies="${i}" ${v.kies ? "checked" : ""} style="width:26px;height:26px;accent-color:var(--accent);opacity:1;position:static">
            </label>
            <span class="rij__midden">
              <span class="rij__titel">${esc(t.omschrijving || "Zonder omschrijving")}</span>
              <span class="rij__sub">
                ${esc(datumNL(t.datum, { kort: true }))}
                ${v.dubbel ? ` · <span style="color:var(--let-op)">stond er al in</span>` : ""}
              </span>
              <select data-cat="${i}" style="margin-top:6px;padding:6px 8px;font-size:.8rem">
                ${categorieOpties(t.categorie, t.soort === "inkomst" ? "inkomst" : "uitgave")}
              </select>
            </span>
            <span class="rij__rechts">
              <span class="rij__bedrag ${t.soort === "inkomst" ? "op" : ""}">${t.soort === "inkomst" ? "+" : "−"}${geld(t.bedrag)}</span>
            </span>
          </div>`;
      }).join("")}
    </div>

    <div class="knoprij knoprij--gelijk" style="margin-top:16px">
      <button class="knop" data-opnieuw>Annuleren</button>
      <button class="knop knop--primair" data-toevoegen ${teDoen.length ? "" : "disabled"}>
        ${teDoen.length} toevoegen
      </button>
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen van het scherm
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("change", e => {
    if (e.target.id === "ibank") {
      rekeningKeuze = e.target.value;
      return;
    }
    if (e.target.matches("[data-kies]")) {
      voorstellen[Number(e.target.dataset.kies)].kies = e.target.checked;
      return meld();
    }
    if (e.target.matches("[data-cat]")) {
      voorstellen[Number(e.target.dataset.cat)].transactie.categorie = e.target.value;
      return;
    }
    if (["kdatum", "komschrijving", "kbedrag", "krichting"].includes(e.target.id)) {
      kolommen[e.target.id.slice(1)] = e.target.value;
    }
  });

  wortel.addEventListener("click", e => {
    if (e.target.closest("[data-kies-bestand]")) return leesBestand();
    if (e.target.closest("[data-opnieuw]")) { herstart(); return meld(); }
    if (e.target.closest("[data-verder]")) return maakVoorstellen();
    if (e.target.closest("[data-alles]")) { voorstellen.forEach(v => v.kies = true); return meld(); }
    if (e.target.closest("[data-niets]")) { voorstellen.forEach(v => v.kies = false); return meld(); }
    if (e.target.closest("[data-alleen-nieuw]")) { voorstellen.forEach(v => v.kies = !v.dubbel); return meld(); }
    if (e.target.closest("[data-toevoegen]")) return toevoegen();
  });
}

function herstart() {
  stap = "kies";
  tabel = null;
  profiel = null;
  voorstellen = [];
  kolommen = { datum: "", omschrijving: "", bedrag: "", richting: "" };
}

async function leesBestand() {
  const bestand = await kiesBestand(".csv,text/csv,text/plain");
  if (!bestand) return;

  try {
    const tekst = await leesTekst(bestand);
    tabel = leesCSV(tekst);
    if (!tabel || tabel.rijen.length === 0) throw new Error("Er staan geen regels in dit bestand.");

    profiel = herkenProfiel(tabel.kop);
    if (profiel) {
      kolommen = {
        datum: profiel.datum,
        omschrijving: profiel.omschrijving[0],
        bedrag: profiel.bedrag,
        richting: profiel.richting?.kolom || "",
      };
      maakVoorstellen();
    } else {
      raadKolommen();
      stap = "koppelen";
      meld();
    }
  } catch (e) {
    melding("Inlezen lukte niet: " + e.message, "fout");
  }
}

/* ---------------------------------------------------------------
   CSV uitlezen
   ---------------------------------------------------------------
   Kleine parser die aanhalingstekens begrijpt. Het scheidingsteken
   raden we uit de eerste regel: puntkomma is in Nederland het meest
   voorkomend, maar komma en tab komen ook voor.
   --------------------------------------------------------------- */
function leesCSV(tekst) {
  const schoon = tekst.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!schoon) return null;

  const eerste = schoon.split("\n")[0];
  const scheiding = [";", "\t", ","]
    .map(teken => ({ teken, aantal: eerste.split(teken).length }))
    .sort((a, b) => b.aantal - a.aantal)[0].teken;

  const rijen = [];
  let rij = [], veld = "", inAanhaling = false;

  for (let i = 0; i < schoon.length; i++) {
    const teken = schoon[i];

    if (inAanhaling) {
      if (teken === '"') {
        if (schoon[i + 1] === '"') { veld += '"'; i++; }
        else inAanhaling = false;
      } else veld += teken;
      continue;
    }

    if (teken === '"') { inAanhaling = true; continue; }
    if (teken === scheiding) { rij.push(veld.trim()); veld = ""; continue; }
    if (teken === "\n") { rij.push(veld.trim()); rijen.push(rij); rij = []; veld = ""; continue; }
    veld += teken;
  }
  rij.push(veld.trim());
  rijen.push(rij);

  const kop = rijen.shift().map(k => k.trim());
  return { kop, rijen: rijen.filter(r => r.some(v => v !== "")) };
}

function herkenProfiel(kop) {
  const namen = kop.map(k => normaliseer(k));
  return BANKPROFIELEN.find(p => p.herken.every(h => namen.includes(normaliseer(h)))) || null;
}

/* Zonder profiel: een gok op basis van de kolomnamen. */
function raadKolommen() {
  const vind = woorden => tabel.kop.find(k => woorden.some(w => normaliseer(k).includes(w))) || "";
  kolommen = {
    datum: vind(["datum", "date", "boekdatum"]),
    omschrijving: vind(["omschrijving", "naam", "description", "counterparty", "mededeling"]),
    bedrag: vind(["bedrag", "amount"]),
    richting: vind(["af bij", "af/bij", "debit", "credit", "bij/af"]),
  };
}

/* ---------------------------------------------------------------
   Van tabel naar boekingen
   --------------------------------------------------------------- */
function maakVoorstellen() {
  const index = naam => tabel.kop.findIndex(k => normaliseer(k) === normaliseer(naam));

  const iDatum = index(kolommen.datum);
  const iBedrag = index(kolommen.bedrag);
  const iRichting = kolommen.richting ? index(kolommen.richting) : -1;
  const omschrijvingKolommen = (profiel?.omschrijving || [kolommen.omschrijving])
    .map(index).filter(i => i >= 0);

  if (iDatum < 0 || iBedrag < 0) {
    melding("Kies in elk geval een datum- en een bedragkolom.", "fout");
    return;
  }

  const afWoorden = profiel?.richting?.af || ["af", "debit", "d"];

  voorstellen = tabel.rijen.map(rij => {
    const datum = leesDatum(rij[iDatum]);
    const ruw = rij[iBedrag] || "";
    const bedrag = leesBankBedrag(ruw);
    if (!datum || bedrag == null) return null;

    let soort;
    if (iRichting >= 0) {
      soort = afWoorden.includes(normaliseer(rij[iRichting])) ? "uitgave" : "inkomst";
    } else {
      soort = bedrag < 0 ? "uitgave" : "inkomst";
    }

    const omschrijving = omschrijvingKolommen
      .map(i => rij[i]).filter(Boolean).join(" — ").slice(0, 140);

    return {
      transactie: {
        datum,
        bedrag: Math.abs(bedrag),
        soort,
        omschrijving,
        categorie: raadCategorie(omschrijving, soort === "inkomst" ? "inkomst" : "uitgave"),
        rekening: rekeningKeuze,
      },
      dubbel: false,
      kies: true,
    };
  }).filter(Boolean);

  /* Wat er al in staat herkennen: zelfde dag, zelfde bedrag, en een
     omschrijving die op hetzelfde begint. Die laatste voorwaarde is er
     omdat je op één dag twee keer hetzelfde bedrag kunt uitgeven — maar
     zelden bij dezelfde winkel. De bank schrijft er meestal een
     pasnummer of plaats achter, dus we vergelijken alleen het begin. */
  for (const v of voorstellen) {
    const t = v.transactie;
    v.dubbel = state.transacties.some(bestaand => {
      if (bestaand.datum !== t.datum) return false;
      if (Math.abs((Number(bestaand.bedrag) || 0) - t.bedrag) >= 0.005) return false;
      if ((bestaand.soort === "inkomst") !== (t.soort === "inkomst")) return false;

      const a = normaliseer(bestaand.omschrijving);
      const b = normaliseer(t.omschrijving);
      if (!a || !b) return true;                       // geen naam: dan telt dag en bedrag
      const lengte = Math.min(12, a.length, b.length);
      return lengte >= 4 && a.slice(0, lengte) === b.slice(0, lengte);
    });
    if (v.dubbel) v.kies = false;
  }

  if (!voorstellen.length) {
    melding("Er kwamen geen bruikbare regels uit dit bestand.", "fout");
    stap = "koppelen";
    return meld();
  }

  voorstellen.sort((a, b) => b.transactie.datum.localeCompare(a.transactie.datum));
  stap = "controleren";
  meld();
}

/* Datums komen in alle smaken binnen. */
function leesDatum(waarde) {
  const s = String(waarde || "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  const stukken = s.split(/[-/.]/).map(d => d.trim());
  if (stukken.length === 3) {
    let [a, b, c] = stukken;
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    if (c.length === 2) c = "20" + c;
    return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  return null;
}

/* Bankbedragen: "1.234,56", "-12.34", "+ 12,50", "12,50 EUR". */
function leesBankBedrag(waarde) {
  let s = String(waarde || "").replace(/[^\d,.\-+]/g, "").trim();
  if (!s) return null;

  const negatief = s.startsWith("-");
  s = s.replace(/^[+-]/, "");

  const komma = s.lastIndexOf(",");
  const punt = s.lastIndexOf(".");
  if (komma > -1 && punt > -1) {
    if (komma > punt) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (komma > -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(s);
  if (!isFinite(n)) return null;
  return negatief ? -n : n;
}

/* ---------------------------------------------------------------
   Toevoegen
   --------------------------------------------------------------- */
async function toevoegen() {
  if (!eisBewerkrecht()) return;
  const lijst = voorstellen.filter(v => v.kies).map(v => v.transactie);
  if (!lijst.length) return;

  await bewaarVeelTransacties(lijst);
  melding(`${lijst.length} boekingen toegevoegd.`, "goed");
  herstart();
  ga("#/maand");
}
