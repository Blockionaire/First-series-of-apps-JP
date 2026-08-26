/* =====================================================================
   GELDZAKEN — cijfers
   =====================================================================
   Het overzicht over meerdere maanden. Eén maand zegt weinig: de vraag
   is of het beter of slechter gaat dan normaal, en waar het verschil
   dan zit.

   Alle grafieken zijn kale SVG uit util.js — geen bibliotheek, dus ook
   niets dat op een slechte verbinding blijft hangen.
   ===================================================================== */

import { esc, geld, procent, maandLabel, maandPlus, maandNu, maandVan,
         balken, maandStaven, lijn, ring, datumNL } from "../util.js";
import { state, meld, categorieNaam } from "../store.js";
import { maandReeks, maandOverzicht, gemiddelden, vermogenVerloop,
         vasteLastenPerMaand, vermogen } from "../bereken.js";
import { leeg } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => "Cijfers";
export const ondertitel = () => `Laatste ${periode} maanden`;

let periode = 12;

export function html() {
  if (!state.transacties.length) {
    return leeg({
      icoon: "📊",
      titel: "Nog niets te zien",
      tekst: "Zodra je een paar boekingen hebt, staat hier hoe je maanden zich tot elkaar verhouden.",
      knop: { route: "#/boeken", label: "Eerste boeking" },
    });
  }

  const reeks = maandReeks(state, periode);
  const gem = gemiddelden(state, Math.min(periode, 12));

  return `
    <div class="filterrij">
      ${[6, 12, 24].map(n => `
        <button class="keuze" data-periode="${n}" aria-pressed="${periode === n}">${n} maanden</button>`).join("")}
      <button class="keuze" data-jaar aria-pressed="false">Dit jaar</button>
    </div>

    ${staafBlok(reeks)}
    ${kerncijfers(reeks, gem)}
    ${categorieBlok()}
    ${vasteVerhouding()}
    ${grootsteUitgaven()}
    ${vermogenBlok()}
    ${jaarTabel()}
  `;
}

/* ------------------------- Erin en eruit ---------------------------- */
function staafBlok(reeks) {
  const metVlag = reeks.map(m => ({ ...m, actief: m.maand === state.maand }));
  return `
    <div class="kaart">
      <div class="kaart__kop">
        <h2>Erin en eruit</h2>
        <span class="dof" style="font-size:.76rem">
          <span class="legenda__stip" style="background:var(--inkomst);display:inline-block"></span> in
          <span class="legenda__stip" style="background:var(--uitgave);display:inline-block;margin-left:8px"></span> uit
        </span>
      </div>
      ${maandStaven(metVlag, { hoogte: 118 })}
      <div class="veld__hint">Tik op een maand om die maand open te slaan.</div>
    </div>`;
}

/* --------------------------- Kerncijfers ---------------------------- */
function kerncijfers(reeks, gem) {
  const gevuld = reeks.filter(m => m.in > 0 || m.uit > 0);
  const maanden = gevuld.length || 1;
  const totIn = reeks.reduce((s, m) => s + m.in, 0);
  const totUit = reeks.reduce((s, m) => s + m.uit, 0);
  const totApart = reeks.reduce((s, m) => s + m.apart, 0);
  const over = totIn - totUit - totApart;
  const quote = totIn > 0 ? (totApart + Math.max(0, over)) / totIn : 0;

  const beste = [...gevuld].sort((a, b) => b.saldo - a.saldo)[0];
  const slechtste = [...gevuld].sort((a, b) => a.saldo - b.saldo)[0];

  return `
    <div class="cijferrij cijferrij--twee">
      <div class="cijfer cijfer--in">
        <div class="cijfer__waarde">${geld(totIn / maanden)}</div>
        <div class="cijfer__label">Gemiddeld erin</div>
      </div>
      <div class="cijfer cijfer--uit">
        <div class="cijfer__waarde">${geld(totUit / maanden)}</div>
        <div class="cijfer__label">Gemiddeld eruit</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde" style="color:var(--potje)">${geld((totApart + Math.max(0, over)) / maanden)}</div>
        <div class="cijfer__label">Gemiddeld overgehouden</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde">${procent(quote, 1)}</div>
        <div class="cijfer__label">Spaarquote</div>
        <div class="cijfer__bij dof">${quote >= 0.2 ? "netjes" : quote > 0 ? "er blijft iets over" : "er blijft niets over"}</div>
      </div>
    </div>

    ${beste && slechtste && beste.maand !== slechtste.maand ? `
      <div class="kaart">
        <div style="display:flex;justify-content:space-between;font-size:.87rem;margin-bottom:8px">
          <span>Beste maand</span>
          <span><strong style="text-transform:capitalize">${esc(maandLabel(beste.maand, { kort: true }))}</strong>
            <span class="op bedrag">${geld(beste.saldo, { teken: true })}</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.87rem">
          <span>Zwaarste maand</span>
          <span><strong style="text-transform:capitalize">${esc(maandLabel(slechtste.maand, { kort: true }))}</strong>
            <span class="${slechtste.saldo < 0 ? "af" : "dof"} bedrag">${geld(slechtste.saldo, { teken: true })}</span></span>
        </div>
      </div>` : ""}`;
}

/* -------------------------- Categorieën ----------------------------- */
function categorieBlok() {
  const vanaf = maandPlus(maandNu(), -(periode - 1));
  const totalen = new Map();
  for (const t of state.transacties) {
    if (t.soort !== "uitgave") continue;
    const m = maandVan(t.datum);
    if (m < vanaf) continue;
    const sleutel = t.categorie || "cat-overig";
    totalen.set(sleutel, (totalen.get(sleutel) || 0) + (Number(t.bedrag) || 0));
  }
  if (!totalen.size) return "";

  const lijst = [...totalen.entries()]
    .map(([id, bedrag]) => {
      const cat = state.categorieen.find(c => c.id === id);
      return { id, label: cat?.naam || "Zonder categorie", icoon: cat?.icoon || "▫️", kleur: cat?.kleur || "#8b98a9", waarde: bedrag };
    })
    .sort((a, b) => b.waarde - a.waarde);

  const totaal = lijst.reduce((s, c) => s + c.waarde, 0);

  return `
    <div class="sectiekop">
      <h2>Waar het geld heen ging</h2>
      <span class="dof" style="font-size:.8rem">${geld(totaal)}</span>
    </div>
    <div class="kaart">
      ${balken(lijst.slice(0, 12), { toonWaarde: v => geld(v / periode) + " p/m" })}
      <div class="veld__hint">Per maand gemiddeld over ${periode} maanden.</div>
    </div>`;
}

/* ------------------------ Vast versus los --------------------------- */
function vasteVerhouding() {
  const o = maandOverzicht(state, maandNu());
  const vastPerMaand = vasteLastenPerMaand(state);
  if (!vastPerMaand) return "";

  const gem = gemiddelden(state, 6);
  const los = Math.max(0, gem.uit - vastPerMaand);
  const totaal = vastPerMaand + los;

  return `
    <div class="sectiekop"><h2>Vast tegenover los</h2></div>
    <div class="kaart">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        ${ring([
          { label: "Vaste lasten", waarde: vastPerMaand, kleur: "var(--sparen)" },
          { label: "Losse uitgaven", waarde: los, kleur: "var(--uitgave)" },
        ], { grootte: 120, dikte: 16, midden: `<div>${procent(vastPerMaand, totaal)}<small>vast</small></div>` })}
        <div style="flex:1;min-width:170px">
          <div style="display:flex;justify-content:space-between;font-size:.87rem;margin-bottom:7px">
            <span><span class="legenda__stip" style="background:var(--sparen);display:inline-block"></span> Vaste lasten</span>
            <span class="bedrag">${geld(vastPerMaand)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.87rem">
            <span><span class="legenda__stip" style="background:var(--uitgave);display:inline-block"></span> Losse uitgaven</span>
            <span class="bedrag">${geld(los)}</span>
          </div>
          <div class="veld__hint">
            Hoe lager het vaste deel, hoe makkelijker je een tegenvaller opvangt.
          </div>
        </div>
      </div>
    </div>`;
}

/* ------------------------ Grootste uitgaven ------------------------- */
function grootsteUitgaven() {
  const vanaf = maandPlus(maandNu(), -(periode - 1));
  const top = state.transacties
    .filter(t => t.soort === "uitgave" && maandVan(t.datum) >= vanaf)
    .sort((a, b) => (Number(b.bedrag) || 0) - (Number(a.bedrag) || 0))
    .slice(0, 5);
  if (!top.length) return "";

  return `
    <div class="sectiekop"><h2>Grootste uitgaven</h2></div>
    <div class="lijst">
      ${top.map(t => `
        <button class="rij" data-transactie="${esc(t.id)}">
          <span class="rij__icoon">${esc(state.categorieen.find(c => c.id === t.categorie)?.icoon || "▫️")}</span>
          <span class="rij__midden">
            <span class="rij__titel">${esc(t.omschrijving || categorieNaam(t.categorie))}</span>
            <span class="rij__sub">${esc(datumNL(t.datum, { kort: true }))} · ${esc(categorieNaam(t.categorie))}</span>
          </span>
          <span class="rij__rechts"><span class="rij__bedrag">${geld(t.bedrag)}</span></span>
        </button>`).join("")}
    </div>`;
}

/* ---------------------------- Vermogen ------------------------------ */
function vermogenBlok() {
  if (!state.rekeningen.length) return "";
  const verloop = vermogenVerloop(state, Math.min(periode, 24));
  const nu = vermogen(state);
  const toen = verloop[0].waarde;

  return `
    <div class="sectiekop">
      <h2>Vermogen</h2>
      <a class="sectiekop__actie" href="#/rekeningen">Rekeningen</a>
    </div>
    <div class="kaart">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <span class="bedrag" style="font-size:1.35rem;font-weight:700">${geld(nu)}</span>
        <span class="${nu >= toen ? "op" : "af"}" style="font-size:.84rem;font-weight:640">
          ${geld(nu - toen, { teken: true })} in ${verloop.length} maanden
        </span>
      </div>
      ${lijn(verloop, { kleur: nu >= toen ? "var(--accent)" : "var(--uitgave)" })}
    </div>`;
}

/* ---------------------------- Per jaar ------------------------------ */
function jaarTabel() {
  const jaren = new Map();
  for (const t of state.transacties) {
    const jaar = t.datum.slice(0, 4);
    if (!jaren.has(jaar)) jaren.set(jaar, { in: 0, uit: 0, apart: 0 });
    const bedrag = Number(t.bedrag) || 0;
    const rij = jaren.get(jaar);
    if (t.soort === "inkomst") rij.in += bedrag;
    else if (t.soort === "uitgave") rij.uit += bedrag;
    else if (t.soort === "sparen") rij.apart += bedrag;
    else if (t.soort === "opname") rij.apart -= bedrag;
  }
  if (jaren.size < 1) return "";

  return `
    <div class="sectiekop"><h2>Per jaar</h2></div>
    <div class="kaart">
      <div class="tabelrol">
        <table class="tabel">
          <thead>
            <tr><th>Jaar</th><th class="bedrag">Erin</th><th class="bedrag">Eruit</th><th class="bedrag">Over</th></tr>
          </thead>
          <tbody>
            ${[...jaren.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([jaar, r]) => `
              <tr>
                <td>${esc(jaar)}</td>
                <td class="bedrag op">${geld(r.in)}</td>
                <td class="bedrag af">${geld(r.uit)}</td>
                <td class="bedrag ${r.in - r.uit - r.apart >= 0 ? "" : "af"}">${geld(r.in - r.uit - r.apart)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", e => {
    const knop = e.target.closest("[data-periode]");
    if (knop) { periode = Number(knop.dataset.periode); return meld(); }

    if (e.target.closest("[data-jaar]")) {
      periode = Number(maandNu().slice(5, 7));
      return meld();
    }

    const staaf = e.target.closest("[data-maand]");
    if (staaf) {
      state.maand = staaf.dataset.maand;
      return ga("#/maand");
    }

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) ga(`#/boeken/${boeking.dataset.transactie}`);
  });
}
