/* =====================================================================
   GELDZAKEN — startscherm
   =====================================================================
   De vraag die dit scherm beantwoordt is steeds dezelfde: hoeveel kan
   ik deze maand nog uitgeven? Daarom staat dat bedrag bovenaan, groot,
   en al het andere eronder als toelichting.
   ===================================================================== */

import { esc, geld, getal, procent, maandLabel, maandNu, maandPlus,
         datumNL, voortgang, ring, melding, dialoog, relatieveDatum } from "../util.js";
import { state, zetInstelling, boekVasteLast, meld, Sync } from "../store.js";
import { maandOverzicht, signalen, aankomend, budgetten, perCategorie,
         potjesMetSaldo, doelenMetStand, vermogen, gemiddelden } from "../bereken.js";
import { maandkiezer, koppelMaandkiezer, signaalHtml, transactieRij,
         leeg, potKaart } from "./onderdelen.js";
import { ga, eisBewerkrecht } from "../app.js";

export const titel = () => state.instellingen.huisNaam || "Geldzaken";
export const ondertitel = () => {
  const o = maandOverzicht(state, state.maand);
  if (!o.isDezeMaand) return maandLabel(state.maand);
  return o.dagenOver > 0 ? `Nog ${o.dagenOver} dagen in ${maandLabel(state.maand, { jaar: false })}` : "Laatste dag van de maand";
};

export function kopActies() {
  const s = Sync.sync;
  const stipSoort = !s.beschikbaar ? "" : s.fout ? "fout" : s.bezig ? "bezig" : s.actief ? "aan" : "";
  return `
    <button class="icoonknop ${state.instellingen.privacy ? "icoonknop--actief" : ""}"
            data-privacy aria-label="Bedragen verbergen">${state.instellingen.privacy ? "🙈" : "👁️"}</button>
    <a class="icoonknop" href="#/instellingen" aria-label="Instellingen">⚙️</a>
    ${s.beschikbaar ? `<span class="syncstip syncstip--${stipSoort}" title="${esc(syncTitel())}"></span>` : ""}`;
}

function syncTitel() {
  const s = Sync.sync;
  if (s.fout) return "Synchroniseren lukt even niet: " + s.fout;
  if (s.bezig) return "Bezig met opslaan…";
  if (s.actief) return "Gesynchroniseerd";
  return "Alleen op dit apparaat";
}

/* ---------------------------------------------------------------
   Het scherm
   --------------------------------------------------------------- */
export function html() {
  const maand = state.maand;
  const o = maandOverzicht(state, maand);
  const lijst = signalen(state, maand);

  return `
    <div style="display:flex;justify-content:center;margin-bottom:14px">
      ${maandkiezer(maand, { maxMaand: maandPlus(maandNu(), 12) })}
    </div>

    ${hero(o)}
    ${snelrij()}
    ${lijst.length ? `<div style="margin-bottom:14px">${lijst.map(signaalHtml).join("")}</div>` : ""}
    ${cijfers(o)}
    ${aankomendeLasten()}
    ${budgetBlok(maand)}
    ${categorieBlok(o, maand)}
    ${potjesBlok()}
    ${doelenBlok()}
    ${laatsteBoekingen(o)}
    ${vermogenBlok()}
  `;
}

/* ------------------------------ Hero -------------------------------- */
function hero(o) {
  const tekort = o.vrijTeBesteden < 0;
  const perDagOver = o.dagenOver > 0 ? o.vrijTeBesteden / o.dagenOver : 0;

  /* De verdeelbalk laat in één oogopslag zien waar het inkomen heen
     gaat: vaste lasten, losse uitgaven, opzij gezet, en wat er over is. */
  const basis = Math.max(o.inkomsten + o.verwachtErin, o.vastTotaal + o.verwachtEruit + o.variabelTotaal + o.apart, 1);
  const deel = w => `${Math.max(0, (w / basis) * 100)}%`;

  return `
    <section class="hero ${tekort ? "hero--tekort" : ""}">
      <div class="hero__label">${o.isDezeMaand ? "Nog te besteden" : "Onder de streep"}</div>
      <div class="hero__bedrag" style="color:${tekort ? "var(--uitgave)" : "var(--tekst)"}">${geld(o.vrijTeBesteden)}</div>
      <div class="hero__bij">
        ${o.isDezeMaand
          ? (o.dagenOver > 0
              ? `Dat is ${geld(perDagOver)} per dag voor de laatste ${o.dagenOver} dagen.`
              : "Laatste dag van de maand.")
          : `${maandLabel(o.maand)} · ${o.transacties.length} boekingen`}
      </div>

      <div class="verdeling" role="img" aria-label="Verdeling van je inkomen">
        <span class="verdeling__deel" style="width:${deel(o.vastTotaal + o.verwachtEruit)};background:var(--sparen)"></span>
        <span class="verdeling__deel" style="width:${deel(o.variabelTotaal)};background:var(--uitgave)"></span>
        <span class="verdeling__deel" style="width:${deel(o.apart)};background:var(--potje)"></span>
        <span class="verdeling__deel" style="width:${deel(Math.max(0, o.vrijTeBesteden))};background:var(--accent)"></span>
      </div>
      <div class="legenda">
        <span class="legenda__item"><span class="legenda__stip" style="background:var(--sparen)"></span>Vast ${geld(o.vastTotaal + o.verwachtEruit)}</span>
        <span class="legenda__item"><span class="legenda__stip" style="background:var(--uitgave)"></span>Los ${geld(o.variabelTotaal)}</span>
        <span class="legenda__item"><span class="legenda__stip" style="background:var(--potje)"></span>Opzij ${geld(o.apart)}</span>
        <span class="legenda__item"><span class="legenda__stip" style="background:var(--accent)"></span>Over ${geld(Math.max(0, o.vrijTeBesteden))}</span>
      </div>

      ${o.isDezeMaand && o.dagenOver > 0 ? `
        <div class="hero__rij">
          <div class="hero__deel">
            <div class="hero__deel-label">Tempo losse uitgaven</div>
            <div class="hero__deel-waarde">${geld(o.perDag)} p/d</div>
          </div>
          <div class="hero__deel">
            <div class="hero__deel-label">Zo eindig je op</div>
            <div class="hero__deel-waarde ${o.prognoseSaldo < 0 ? "af" : "op"}">${geld(o.prognoseSaldo)}</div>
          </div>
        </div>` : ""}
    </section>`;
}

function snelrij() {
  return `
    <div class="snelrij">
      <a class="snel" href="#/boeken/nieuw/uitgave"><span class="snel__icoon">🛒</span>Uitgave</a>
      <a class="snel" href="#/boeken/nieuw/inkomst"><span class="snel__icoon">💰</span>Inkomst</a>
      <a class="snel" href="#/boeken/nieuw/sparen"><span class="snel__icoon">🐖</span>Opzij</a>
      <a class="snel" href="#/vast"><span class="snel__icoon">🔁</span>Vaste lasten</a>
    </div>`;
}

function cijfers(o) {
  const gem = gemiddelden(state, 6);
  const verschil = gem.maanden >= 2 && gem.uit > 0
    ? (o.variabelTotaal + o.vastTotaal) / gem.uit - 1
    : null;

  return `
    <div class="cijferrij cijferrij--twee">
      <div class="cijfer cijfer--in">
        <div class="cijfer__waarde">${geld(o.inkomsten)}</div>
        <div class="cijfer__label">Binnengekomen</div>
        ${o.verwachtErin > 0 ? `<div class="cijfer__bij dof">nog ${geld(o.verwachtErin)} verwacht</div>` : ""}
      </div>
      <div class="cijfer cijfer--uit">
        <div class="cijfer__waarde">${geld(o.vastTotaal + o.variabelTotaal)}</div>
        <div class="cijfer__label">Uitgegeven</div>
        ${verschil != null ? `<div class="cijfer__bij ${verschil > 0.05 ? "af" : verschil < -0.05 ? "op" : "dof"}">
          ${verschil > 0 ? "+" : ""}${getal(verschil * 100, 0)}% t.o.v. gemiddeld</div>` : ""}
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde">${geld(o.vastTotaal)}<span class="dof" style="font-size:.8rem"> / ${geld(o.vastTotaal + o.verwachtEruit)}</span></div>
        <div class="cijfer__label">Vaste lasten betaald</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde" style="color:var(--potje)">${geld(o.apart)}</div>
        <div class="cijfer__label">Opzij gezet</div>
        ${o.inkomsten > 0 ? `<div class="cijfer__bij dof">${procent(o.spaarquote, 1)} van je inkomen</div>` : ""}
      </div>
    </div>`;
}

/* ------------------------- Wat komt eraan --------------------------- */
function aankomendeLasten() {
  const komt = aankomend(state, 12);
  if (!komt.length) return "";

  return `
    <div class="sectiekop">
      <h2>Komt eraan</h2>
      <a class="sectiekop__actie" href="#/vast">Alle vaste lasten</a>
    </div>
    <div class="lijst">
      ${komt.slice(0, 5).map(p => `
        <div class="rij">
          <span class="rij__icoon">${esc(icoonVanCategorie(p.categorie))}</span>
          <span class="rij__midden">
            <span class="rij__titel">${esc(p.naam)}</span>
            <span class="rij__sub">${p.telaat ? "stond gepland op " : ""}${esc(datumNL(p.datum, { kort: true, metJaar: false }))} · ${esc(relatieveDatum(p.datum))}</span>
          </span>
          <span class="rij__rechts">
            <span class="rij__bedrag ${p.soort === "inkomst" ? "op" : ""}">${geld(p.verwacht)}</span>
            ${p.telaat ? `<span class="rij__bij" style="color:var(--fout)">${p.soort === "inkomst" ? "nog niet binnen" : "te laat"}</span>` : ""}
          </span>
          <button class="knop knop--klein" data-boek-vast="${esc(p.id)}" data-datum="${esc(p.datum)}">Afvinken</button>
        </div>`).join("")}
    </div>`;
}

const icoonVanCategorie = id => state.categorieen.find(c => c.id === id)?.icoon || "🔁";

/* ------------------------------ Budget ------------------------------ */
function budgetBlok(maand) {
  const lijst = budgetten(state, maand);
  if (!lijst.length) return "";

  return `
    <div class="sectiekop">
      <h2>Budgetten</h2>
      <a class="sectiekop__actie" href="#/instellingen/categorieen">Aanpassen</a>
    </div>
    <div class="kaart">
      ${lijst.slice(0, 6).map(b => `
        <div style="margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:.86rem">
            <span>${esc(b.icoon)} ${esc(b.naam)}</span>
            <span class="bedrag ${b.over < 0 ? "af" : "dof"}">
              ${geld(b.gebruikt)} <span class="dof">/ ${geld(b.budget)}</span>
            </span>
          </div>
          ${voortgang(b.gebruikt, b.budget, { kleur: b.deel > 1 ? "var(--uitgave)" : b.kleur })}
        </div>`).join("")}
    </div>`;
}

/* --------------------------- Categorieën ---------------------------- */
function categorieBlok(o, maand) {
  const lijst = perCategorie(state, maand).slice(0, 6);
  if (!lijst.length) return "";
  const totaal = lijst.reduce((s, c) => s + c.bedrag, 0);

  return `
    <div class="sectiekop">
      <h2>Waar ging het heen</h2>
      <a class="sectiekop__actie" href="#/cijfers">Alle cijfers</a>
    </div>
    <div class="kaart">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="flex:none">
          ${ring(lijst.map(c => ({ label: c.naam, waarde: c.bedrag, kleur: c.kleur })), {
            grootte: 128, dikte: 17,
            midden: `<div>${geld(totaal, { compact: true })}<small>deze maand</small></div>`,
          })}
        </div>
        <div style="flex:1;min-width:190px">
          ${lijst.map(c => `
            <div style="display:flex;align-items:center;gap:8px;font-size:.84rem;margin-bottom:7px">
              <span class="legenda__stip" style="background:${esc(c.kleur)}"></span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.naam)}</span>
              <span class="bedrag">${geld(c.bedrag)}</span>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

/* ------------------------------ Potjes ------------------------------ */
function potjesBlok() {
  const potjes = potjesMetSaldo(state).slice(0, 4);
  if (!potjes.length) return "";
  const totaal = potjesMetSaldo(state).reduce((s, p) => s + p.saldo, 0);

  return `
    <div class="sectiekop">
      <h2>Potjes <span class="dof" style="font-weight:600;font-size:.84rem">${geld(totaal)}</span></h2>
      <a class="sectiekop__actie" href="#/potjes">Alle potjes</a>
    </div>
    <div class="potraster">${potjes.map(potKaart).join("")}</div>`;
}

function doelenBlok() {
  const doelen = doelenMetStand(state).filter(d => !d.klaar).slice(0, 3);
  if (!doelen.length) return "";

  return `
    <div class="sectiekop">
      <h2>Spaardoelen</h2>
      <a class="sectiekop__actie" href="#/doelen">Alles</a>
    </div>
    <div class="lijst lijst--los">
      ${doelen.map(d => `
        <button class="kaart kaart--knop" data-doel="${esc(d.id)}" style="margin:0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
            <span style="font-weight:640">${esc(d.icoon)} ${esc(d.naam)}</span>
            <span class="bedrag" style="font-weight:660">${geld(d.huidig)} <span class="dof">/ ${geld(d.doelBedrag)}</span></span>
          </div>
          ${voortgang(d.huidig, d.doelBedrag, { kleur: d.kleur })}
          <div class="dof" style="font-size:.76rem;margin-top:7px">
            ${d.perMaandNodig != null && d.maandenTeGaan > 0
              ? `${geld(d.perMaandNodig)} per maand om het in ${d.maandenTeGaan} maanden te halen`
              : d.verwachtKlaar ? `Met dit tempo klaar rond ${maandLabel(d.verwachtKlaar)}` : "Nog geen inleg"}
          </div>
        </button>`).join("")}
    </div>`;
}

/* -------------------------- Laatste boekingen ----------------------- */
function laatsteBoekingen(o) {
  const lijst = [...o.transacties]
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || 0) - (a.aangemaakt || 0))
    .slice(0, 6);

  return `
    <div class="sectiekop">
      <h2>Laatste boekingen</h2>
      <a class="sectiekop__actie" href="#/maand">Alles</a>
    </div>
    ${lijst.length
      ? `<div class="lijst">${lijst.map(t => transactieRij(t, { toonDatum: true })).join("")}</div>`
      : leeg({
          icoon: "🧾", titel: "Nog geen boekingen deze maand",
          tekst: "Voeg je eerste uitgave of inkomst toe met de plusknop.",
          knop: { route: "#/boeken", label: "Boeking toevoegen" },
        })}`;
}

/* ----------------------------- Vermogen ----------------------------- */
function vermogenBlok() {
  if (!state.rekeningen.length) return "";
  const totaal = vermogen(state);
  return `
    <div class="sectiekop">
      <h2>Vermogen</h2>
      <a class="sectiekop__actie" href="#/rekeningen">Rekeningen</a>
    </div>
    <a class="kaart kaart--knop" href="#/rekeningen" style="display:flex;justify-content:space-between;align-items:center;gap:12px;text-decoration:none;color:inherit">
      <span>
        <span class="dof" style="font-size:.78rem;font-weight:600">Alles bij elkaar</span>
        <span style="display:block;font-size:1.5rem;font-weight:700;letter-spacing:-.02em" class="bedrag">${geld(totaal)}</span>
      </span>
      <span class="dof">›</span>
    </a>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  /* De gekozen maand zit niet in het adres — hij hoort bij de app, niet
     bij het scherm — dus na het wisselen zelf om een hertekening vragen. */
  koppelMaandkiezer(wortel, stap => {
    state.maand = maandPlus(state.maand, stap);
    meld();
  });

  const kop = document.querySelector(".kop");
  kop?.querySelector("[data-privacy]")?.addEventListener("click", () => {
    zetInstelling({ privacy: !state.instellingen.privacy });
  });

  wortel.addEventListener("click", async e => {
    const boeking = e.target.closest("[data-transactie]");
    if (boeking) return ga(`#/boeken/${boeking.dataset.transactie}`);

    const doel = e.target.closest("[data-doel]");
    if (doel) return ga(`#/doelen/${doel.dataset.doel}`);

    const pot = e.target.closest("[data-potje]");
    if (pot) return ga(`#/potjes/${pot.dataset.potje}`);

    const vast = e.target.closest("[data-boek-vast]");
    if (vast) {
      if (!eisBewerkrecht()) return;
      const post = state.terugkerend.find(p => p.id === vast.dataset.boekVast);
      if (!post) return;
      const bedrag = await vraagBedrag(post);
      if (bedrag == null) return;
      await boekVasteLast(post, { datum: vast.dataset.datum, bedrag });
      melding(`${post.naam} afgevinkt.`, "goed");
    }
  });
}

/* Vaste lasten kloppen niet altijd tot op de cent — energie schommelt.
   Daarom vragen we het bedrag nog even na bij het afvinken. */
function vraagBedrag(post) {
  return dialoog({
    titel: post.naam,
    inhoud: `
      <div class="veld">
        <label for="afbedrag">Wat is er afgeschreven?</label>
        <input type="number" id="afbedrag" inputmode="decimal" step="0.01" value="${Number(post.bedrag) || 0}">
        <div class="veld__hint">Klopt het bedrag niet precies? Pas het hier aan.</div>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Afvinken", soort: "primair",
        waardeUit: laag => {
          const waarde = Number(laag.querySelector("#afbedrag").value);
          return isFinite(waarde) && waarde > 0 ? waarde : undefined;
        },
      },
    ],
    opOpenen: laag => laag.querySelector("#afbedrag")?.select(),
  });
}
