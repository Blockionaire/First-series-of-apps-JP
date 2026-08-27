/* =====================================================================
   GELDZAKEN — overzicht op hoofdlijnen
   =====================================================================
   Het startscherm van de eenvoudige modus. Eén vraag staat centraal:
   er komt geld binnen, waar gaat het heen?

   Bovenaan het inkomen van de maand, daaronder de taart: elk potje een
   stuk, en wat je niet hebt verdeeld blijft grijs. Geen enkele uitgave
   hoeft geboekt te zijn — de hypotheek is gewoon een stuk van de taart,
   want die gaat er toch elke maand af.
   ===================================================================== */

import { esc, geld, procent, maandLabel, maandNu, maandPlus, ring, voortgang } from "../util.js";
import { state, zetInstelling, meld, Sync } from "../store.js";
import { verdeling, POTSOORTEN, maandOverzicht } from "../bereken.js";
import { maandkiezer, koppelMaandkiezer, leeg } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => state.instellingen.huisNaam || "Geldzaken";
export const ondertitel = () => maandLabel(state.maand);

export function kopActies() {
  const s = Sync.sync;
  const stip = !s.beschikbaar ? "" : s.fout ? "fout" : s.bezig ? "bezig" : s.actief ? "aan" : "";
  return `
    <button class="icoonknop ${state.instellingen.privacy ? "icoonknop--actief" : ""}"
            data-privacy aria-label="Bedragen verbergen">${state.instellingen.privacy ? "🙈" : "👁️"}</button>
    <a class="icoonknop" href="#/instellingen" aria-label="Instellingen">⚙️</a>
    ${s.beschikbaar ? `<span class="syncstip syncstip--${stip}"></span>` : ""}`;
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const v = verdeling(state, state.maand);

  if (!v.inkomen && !v.posten.length) return welkom();

  return `
    <div style="display:flex;justify-content:center;margin-bottom:14px">
      ${maandkiezer(state.maand, { maxMaand: maandPlus(maandNu(), 12) })}
    </div>

    ${inkomenBlok(v)}
    ${taart(v)}
    ${samenvatting(v)}
    ${potjesBlok(v)}
    ${spaarBlok(v)}
    ${losseInkomsten()}
    ${meerBlok()}
  `;
}

/* ------------------------------ Welkom ------------------------------ */
function welkom() {
  return `
    ${leeg({
      icoon: "🥧",
      titel: "Zo werkt het",
      tekst: "Zet eerst je inkomen erin. Daarna verdeel je dat over potjes: hypotheek, boodschappen, vakantie. De taart laat dan zien waar je geld heen gaat.",
    })}
    <div class="knoprij knoprij--gelijk">
      <a class="knop knop--primair" href="#/inkomen">Inkomen instellen</a>
      <a class="knop" href="#/verdelen">Potjes maken</a>
    </div>`;
}

/* ----------------------------- Inkomen ------------------------------ */
function inkomenBlok(v) {
  const tekort = v.teveel;
  return `
    <section class="hero ${tekort ? "hero--tekort" : ""}">
      <div class="hero__label">Inkomen deze maand</div>
      <div class="hero__bedrag">${geld(v.inkomen)}</div>
      <div class="hero__bij">
        ${!v.inkomen
          ? `Nog geen inkomen ingesteld.`
          : tekort
            ? `Je verdeelt ${geld(-v.over)} méér dan er binnenkomt.`
            : v.volledigVerdeeld
              ? `Helemaal verdeeld. ✓`
              : `${geld(v.over)} nog niet verdeeld.`}
      </div>

      ${v.inkomen > 0 ? `
        <div class="verdeling" role="img" aria-label="Verdeling van je inkomen">
          <span class="verdeling__deel" style="width:${breedte(v.vast, v)};background:var(--sparen)"></span>
          <span class="verdeling__deel" style="width:${breedte(v.vrij, v)};background:var(--potje)"></span>
          <span class="verdeling__deel" style="width:${breedte(v.sparen, v)};background:var(--accent)"></span>
        </div>` : ""}

      <div class="knoprij" style="margin-top:16px">
        <a class="knop knop--klein" href="#/inkomen">Inkomen aanpassen</a>
        <a class="knop knop--klein knop--primair" href="#/verdelen">Verdeling aanpassen</a>
      </div>
    </section>`;
}

const breedte = (deel, v) => `${Math.max(0, Math.min(100, (deel / Math.max(v.inkomen, v.verdeeld, 1)) * 100))}%`;

/* ------------------------------- Taart ------------------------------ */
function taart(v) {
  if (!v.posten.length) {
    return `
      <div class="kaart">
        ${leeg({
          icoon: "🫙",
          titel: "Nog geen potjes",
          tekst: "Verdeel je inkomen over potjes, dan zie je hier waar het heen gaat.",
          knop: { route: "#/verdelen", label: "Potjes maken" },
        })}
      </div>`;
  }

  const stukken = v.posten.filter(p => p.bedrag > 0).map(p => ({
    label: `${p.naam}: ${geld(p.bedrag)}`,
    waarde: p.bedrag,
    kleur: p.kleur,
  }));
  if (v.over > 0.5) stukken.push({ label: "Nog te verdelen", waarde: v.over, kleur: "var(--rand)" });

  const middenBedrag = v.over > 0.5 && v.inkomen > 0 ? v.over : v.verdeeld;
  const middenLabel = v.over > 0.5 && v.inkomen > 0 ? "te verdelen" : "verdeeld";

  return `
    <div class="kaart">
      <div class="taart">
        ${ring(stukken, {
          grootte: 210, dikte: 30,
          midden: `<div>${geld(middenBedrag, { compact: true })}<small>${middenLabel}</small></div>`,
        })}
      </div>

      <ul class="taartlijst">
        ${v.posten.filter(p => p.bedrag > 0).map(p => `
          <li class="taartlijst__rij" ${p.potje ? `data-potje="${esc(p.id)}"` : p.route ? `data-route="${esc(p.route)}"` : ""}>
            <span class="legenda__stip" style="background:${esc(p.kleur)}"></span>
            <span class="taartlijst__naam">${esc(p.icoon)} ${esc(p.naam)}</span>
            <span class="taartlijst__deel dof">${v.inkomen > 0 ? procent(p.bedrag, v.inkomen) : ""}</span>
            <span class="taartlijst__bedrag bedrag">${geld(p.bedrag)}</span>
          </li>`).join("")}
        ${v.over > 0.5 ? `
          <li class="taartlijst__rij" data-route="#/verdelen">
            <span class="legenda__stip" style="background:var(--rand)"></span>
            <span class="taartlijst__naam dof">Nog te verdelen</span>
            <span class="taartlijst__deel dof">${procent(v.over, v.inkomen)}</span>
            <span class="taartlijst__bedrag bedrag dof">${geld(v.over)}</span>
          </li>` : ""}
      </ul>
    </div>`;
}

/* ---------------------------- Samenvatting -------------------------- */
function samenvatting(v) {
  const tegel = (soort, bedrag) => `
    <div class="cijfer">
      <div class="cijfer__waarde" style="color:${POTSOORTEN[soort].kleur}">${geld(bedrag)}</div>
      <div class="cijfer__label">${esc(POTSOORTEN[soort].meervoud)}</div>
      ${v.inkomen > 0 ? `<div class="cijfer__bij dof">${procent(bedrag, v.inkomen)} van je inkomen</div>` : ""}
    </div>`;

  return `
    <div class="cijferrij cijferrij--twee">
      ${tegel("vast", v.vast)}
      ${tegel("vrij", v.vrij)}
      ${tegel("sparen", v.sparen)}
      <div class="cijfer">
        <div class="cijfer__waarde" style="color:${v.over < 0 ? "var(--uitgave)" : "var(--tekst)"}">${geld(v.over)}</div>
        <div class="cijfer__label">${v.over < 0 ? "Te veel verdeeld" : "Nog te verdelen"}</div>
      </div>
    </div>`;
}

/* ------------------------------ Potjes ------------------------------ */
function potjesBlok(v) {
  if (!v.potjes.length) return "";

  const groepen = [
    ["vrij", "Vrij te besteden"],
    ["vast", "Vaste lasten"],
    ["sparen", "Sparen"],
  ];

  return groepen.map(([soort, kop]) => {
    const lijst = v.potjes.filter(p => p.soort === soort);
    if (!lijst.length) return "";
    return `
      <div class="sectiekop">
        <h2>${esc(kop)}</h2>
        <a class="sectiekop__actie" href="#/potjes">Alles</a>
      </div>
      <div class="lijst">
        ${lijst.map(p => potRij(p)).join("")}
      </div>`;
  }).join("");
}

function potRij(p) {
  const s = p.stand;
  const rechts = s.soort === "sparen"
    ? `<span class="rij__bedrag">${geld(s.saldo)}</span><span class="rij__bij">gespaard</span>`
    : s.soort === "vrij"
      ? `<span class="rij__bedrag" style="color:${s.ditOver < 0 ? "var(--uitgave)" : "var(--tekst)"}">${geld(s.ditOver)}</span><span class="rij__bij">nog over</span>`
      : `<span class="rij__bedrag">${geld(p.bedrag)}</span><span class="rij__bij">per maand</span>`;

  return `
    <button class="rij" data-potje="${esc(p.id)}">
      <span class="rij__icoon" style="background:color-mix(in srgb, ${esc(p.kleur)} 20%, var(--vlak-diep))">${esc(p.icoon)}</span>
      <span class="rij__midden">
        <span class="rij__titel">${esc(p.naam)}</span>
        <span class="rij__sub">
          ${geld(p.bedrag)} per maand
          ${s.soort === "vrij" && s.ditUit > 0 ? ` · ${geld(s.ditUit)} uitgegeven` : ""}
          ${s.soort === "sparen" && p.potje.doelBedrag > 0 ? ` · doel ${geld(p.potje.doelBedrag)}` : ""}
        </span>
        ${s.soort === "vrij" && p.bedrag > 0 ? voortgang(s.ditUit, p.bedrag) : ""}
        ${s.soort === "sparen" && p.potje.doelBedrag > 0 ? voortgang(s.saldo, p.potje.doelBedrag, { kleur: p.kleur, waarschuwVanaf: 2 }) : ""}
      </span>
      <span class="rij__rechts">${rechts}</span>
    </button>`;
}

/* ----------------------------- Gespaard ----------------------------- */
function spaarBlok(v) {
  if (v.gespaard <= 0) return "";
  return `
    <a class="kaart kaart--knop" href="#/potjes"
       style="display:flex;justify-content:space-between;align-items:center;gap:12px;text-decoration:none;color:inherit;margin-top:14px">
      <span>
        <span class="dof" style="font-size:.78rem;font-weight:600">Totaal in je spaarpotjes</span>
        <span style="display:block;font-size:1.5rem;font-weight:700;letter-spacing:-.02em" class="bedrag">${geld(v.gespaard)}</span>
      </span>
      <span class="dof">›</span>
    </a>`;
}

/* ------------------------- Losse inkomsten -------------------------- */
function losseInkomsten() {
  const o = maandOverzicht(state, state.maand);
  const extra = o.transacties.filter(t => t.soort === "inkomst" && !t.terugkerendId);
  if (!extra.length) return "";

  return `
    <div class="sectiekop"><h2>Extra binnengekomen</h2></div>
    <div class="lijst">
      ${extra.slice(0, 5).map(t => `
        <button class="rij" data-transactie="${esc(t.id)}">
          <span class="rij__icoon">💶</span>
          <span class="rij__midden">
            <span class="rij__titel">${esc(t.omschrijving || "Inkomst")}</span>
            <span class="rij__sub">${esc(t.datum.slice(8, 10))}-${esc(t.datum.slice(5, 7))}</span>
          </span>
          <span class="rij__rechts"><span class="rij__bedrag op">+${geld(t.bedrag)}</span></span>
        </button>`).join("")}
    </div>`;
}

/* ------------------------------- Meer ------------------------------- */
/* Wat er nog meer in de app zit, maar niet op je startscherm hoort.
   Het inlezen van een bankbestand staat er expres bij: je hoeft geen
   uitgaven te boeken, maar het kan wél. */
function meerBlok() {
  const boekingen = state.transacties.length;
  const doelen = state.doelen.length;

  return `
    <div class="sectiekop"><h2>Meer</h2></div>
    <div class="lijst">
      <a class="rij" href="#/importeren">
        <span class="rij__icoon">📥</span>
        <span class="rij__midden">
          <span class="rij__titel">Bankbestand inlezen</span>
          <span class="rij__sub">CSV of CAMT · uitgaven meteen aan een potje hangen</span>
        </span>
        <span class="rij__rechts dof">›</span>
      </a>
      ${boekingen ? `
        <a class="rij" href="#/maand">
          <span class="rij__icoon">📒</span>
          <span class="rij__midden">
            <span class="rij__titel">Alle boekingen</span>
            <span class="rij__sub">${boekingen} ${boekingen === 1 ? "boeking" : "boekingen"} · zoeken en filteren</span>
          </span>
          <span class="rij__rechts dof">›</span>
        </a>` : ""}
      <a class="rij" href="#/doelen">
        <span class="rij__icoon">🎯</span>
        <span class="rij__midden">
          <span class="rij__titel">Spaardoelen</span>
          <span class="rij__sub">${doelen ? `${doelen} ${doelen === 1 ? "doel" : "doelen"}` : "Sparen met een streefbedrag en een datum"}</span>
        </span>
        <span class="rij__rechts dof">›</span>
      </a>
      <a class="rij" href="#/rekeningen">
        <span class="rij__icoon">🏦</span>
        <span class="rij__midden">
          <span class="rij__titel">Rekeningen en vermogen</span>
          <span class="rij__sub">${state.rekeningen.length ? `${state.rekeningen.length} rekeningen` : "Wat staat er waar"}</span>
        </span>
        <span class="rij__rechts dof">›</span>
      </a>
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  koppelMaandkiezer(wortel, stap => {
    state.maand = maandPlus(state.maand, stap);
    meld();
  });

  document.querySelector(".kop [data-privacy]")?.addEventListener("click", () => {
    zetInstelling({ privacy: !state.instellingen.privacy });
  });

  wortel.addEventListener("click", e => {
    const pot = e.target.closest("[data-potje]");
    if (pot) return ga(`#/potjes/${pot.dataset.potje}`);

    const route = e.target.closest("[data-route]");
    if (route) return ga(route.dataset.route);

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) return ga(`#/boeken/${boeking.dataset.transactie}`);
  });
}
