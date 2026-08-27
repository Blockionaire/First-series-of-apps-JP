/* =====================================================================
   GELDZAKEN — gedeelde onderdelen
   =====================================================================
   Stukjes scherm die op meerdere plekken terugkomen: een boeking in een
   lijst, de maandkiezer, een lege lijst met uitleg. Eén plek, zodat een
   boeking er overal hetzelfde uitziet.
   ===================================================================== */

import { esc, geld, datumNL, maandLabel, maandNu, maandPlus, maandVan,
         kleurVoor, initialen, voortgang } from "../util.js";
import { state, categorie } from "../store.js";

/* Kleur en teken per soort boeking. */
export const SOORTEN = {
  inkomst:     { label: "Inkomst",     icoon: "＋", kleur: "var(--inkomst)", teken: "+" },
  uitgave:     { label: "Uitgave",     icoon: "－", kleur: "var(--uitgave)", teken: "−" },
  sparen:      { label: "Opzij zetten",icoon: "🐖", kleur: "var(--sparen)",  teken: "→" },
  opname:      { label: "Terughalen",  icoon: "↩︎", kleur: "var(--potje)",   teken: "←" },
  overboeking: { label: "Overboeking", icoon: "⇄",  kleur: "var(--tekst-zacht)", teken: "⇄" },
};

/* ---------------------------------------------------------------
   Eén boeking in een lijst
   --------------------------------------------------------------- */
export function transactieRij(t, { toonDatum = false } = {}) {
  const cat = categorie(t.categorie);
  const soort = SOORTEN[t.soort] || SOORTEN.uitgave;
  const pot = state.potjes.find(p => p.id === t.potje);
  const doel = state.doelen.find(d => d.id === t.doel);
  const rek = state.rekeningen.find(r => r.id === t.rekening);

  const icoon = cat?.icoon || (t.soort === "sparen" ? "🐖" : t.soort === "opname" ? "↩︎" : soort.icoon);
  const kleur = t.soort === "inkomst" ? "var(--inkomst)"
              : t.soort === "uitgave" ? (t.potje ? "var(--potje)" : "var(--tekst)")
              : soort.kleur;

  const bij = [
    toonDatum ? datumNL(t.datum, { kort: true, metJaar: false }) : "",
    cat?.naam || "",
    pot ? `uit ${pot.naam}` : "",
    doel ? doel.naam : "",
    !cat && rek ? rek.naam : "",
    t.persoon || "",
  ].filter(Boolean).join(" · ");

  return `
    <button class="rij" data-transactie="${esc(t.id)}">
      <span class="rij__icoon" style="background:${cat ? `color-mix(in srgb, ${cat.kleur} 18%, var(--vlak-diep))` : "var(--vlak-diep)"}">${esc(icoon)}</span>
      <span class="rij__midden">
        <span class="rij__titel">${esc(t.omschrijving || cat?.naam || soort.label)}</span>
        <span class="rij__sub">${esc(bij)}</span>
      </span>
      <span class="rij__rechts">
        <span class="rij__bedrag" style="color:${kleur}">${t.soort === "inkomst" ? "+" : t.soort === "uitgave" ? "−" : ""}${geld(t.bedrag)}</span>
        ${t.terugkerendId ? `<span class="rij__bij">vast</span>` : ""}
      </span>
    </button>`;
}

/* Een lijst boekingen, gegroepeerd per dag. */
export function transactieLijst(transacties, { groepeer = true, leegTekst = "Nog geen boekingen." } = {}) {
  if (!transacties.length) {
    return leeg({ icoon: "📭", titel: "Niets te zien", tekst: leegTekst });
  }
  if (!groepeer) {
    return `<div class="lijst">${transacties.map(t => transactieRij(t, { toonDatum: true })).join("")}</div>`;
  }

  const perDag = new Map();
  for (const t of transacties) {
    const dag = t.datum.slice(0, 10);
    if (!perDag.has(dag)) perDag.set(dag, []);
    perDag.get(dag).push(t);
  }

  return [...perDag.entries()].map(([dag, lijst]) => {
    const dagtotaal = lijst.reduce((s, t) =>
      s + (t.soort === "inkomst" ? Number(t.bedrag) || 0 : t.soort === "uitgave" ? -(Number(t.bedrag) || 0) : 0), 0);
    return `
      <div class="datumkop">
        <span>${esc(datumNL(dag, { metDag: true, metJaar: false }))}</span>
        <span class="${dagtotaal >= 0 ? "op" : "af"}">${geld(dagtotaal, { teken: true })}</span>
      </div>
      <div class="lijst">${lijst.map(t => transactieRij(t)).join("")}</div>`;
  }).join("");
}

/* ---------------------------------------------------------------
   Maandkiezer
   --------------------------------------------------------------- */
export function maandkiezer(maand, { maxMaand = null } = {}) {
  const vooruitMag = !maxMaand || maand < maxMaand;
  return `
    <div class="maandkiezer">
      <button data-maand-stap="-1" aria-label="Vorige maand">‹</button>
      <span class="maandkiezer__nu">${esc(maandLabel(maand))}</span>
      <button data-maand-stap="1" aria-label="Volgende maand" ${vooruitMag ? "" : "disabled"}>›</button>
    </div>`;
}

export function koppelMaandkiezer(wortel, opWissel) {
  wortel.querySelectorAll("[data-maand-stap]").forEach(knop => {
    knop.addEventListener("click", () => opWissel(Number(knop.dataset.maandStap)));
  });
}

/* ---------------------------------------------------------------
   Lege lijst
   --------------------------------------------------------------- */
export function leeg({ icoon = "✨", titel = "Nog niets", tekst = "", knop = null }) {
  return `
    <div class="leeg">
      <div class="leeg__icoon" aria-hidden="true">${esc(icoon)}</div>
      <div class="leeg__titel">${esc(titel)}</div>
      ${tekst ? `<p>${esc(tekst)}</p>` : ""}
      ${knop ? `<a class="knop knop--primair" href="${esc(knop.route)}">${esc(knop.label)}</a>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Keuzelijsten
   --------------------------------------------------------------- */
export function categorieOpties(gekozen, soort = "uitgave") {
  const lijst = state.categorieen
    .filter(c => (c.soort || "uitgave") === soort)
    .sort((a, b) => a.naam.localeCompare(b.naam));
  return `<option value="">— kies een categorie —</option>` +
    lijst.map(c => `<option value="${esc(c.id)}" ${c.id === gekozen ? "selected" : ""}>${esc(c.icoon)} ${esc(c.naam)}</option>`).join("");
}

export function rekeningOpties(gekozen, { leegLabel = "— geen rekening —" } = {}) {
  return `<option value="">${esc(leegLabel)}</option>` +
    state.rekeningen.map(r => `<option value="${esc(r.id)}" ${r.id === gekozen ? "selected" : ""}>${esc(r.naam)}</option>`).join("");
}

export function potjeOpties(gekozen, { leegLabel = "— geen potje —" } = {}) {
  return `<option value="">${esc(leegLabel)}</option>` +
    state.potjes.filter(p => p.actief !== false)
      .map(p => `<option value="${esc(p.id)}" ${p.id === gekozen ? "selected" : ""}>${esc(p.icoon)} ${esc(p.naam)}</option>`).join("");
}

export function doelOpties(gekozen, { leegLabel = "— geen doel —" } = {}) {
  return `<option value="">${esc(leegLabel)}</option>` +
    state.doelen.map(d => `<option value="${esc(d.id)}" ${d.id === gekozen ? "selected" : ""}>${esc(d.icoon)} ${esc(d.naam)}</option>`).join("");
}

export function persoonOpties(gekozen) {
  const personen = state.instellingen.personen || [];
  if (!personen.length) return "";
  return `<option value="">— iedereen —</option>` +
    personen.map(p => `<option value="${esc(p)}" ${p === gekozen ? "selected" : ""}>${esc(p)}</option>`).join("");
}

/* ---------------------------------------------------------------
   Kleine dingen
   --------------------------------------------------------------- */
export const bol = naam => `
  <span class="lid__bol" style="background:${kleurVoor(naam)}">${esc(initialen(naam))}</span>`;

export function potKaart(pot) {
  /* Wat er groot op de kaart staat verschilt per soort potje: bij
     sparen het opgebouwde saldo, bij een vrij potje wat er deze maand
     nog over is, en bij een vaste last simpelweg het maandbedrag —
     daar valt immers niets op te bouwen. */
  const soort = pot.soort || "sparen";
  const maand = Number(pot.maandelijks) || 0;

  const hoofd = soort === "vast" ? maand : soort === "vrij" ? pot.ditOver : pot.saldo;
  const bij = soort === "vast" ? "per maand"
            : soort === "vrij" ? `van ${geld(maand)} over`
            : maand > 0 ? `${geld(maand)} per maand` : "handmatig";

  const doelBedrag = Number(pot.doelBedrag) || 0;
  const balk = soort === "sparen" && doelBedrag > 0
    ? voortgang(pot.saldo, doelBedrag, { kleur: pot.kleur, waarschuwVanaf: 2 })
    : soort === "vrij" && maand > 0
      ? voortgang(pot.ditUit || 0, maand)
      : "";

  return `
    <button class="pot" data-potje="${esc(pot.id)}">
      <span class="pot__streep" style="background:${esc(pot.kleur || "var(--accent)")}"></span>
      <span class="pot__icoon">${esc(pot.icoon || "🫙")}</span>
      <span class="pot__naam">${esc(pot.naam)}</span>
      <span class="pot__saldo" style="${hoofd < 0 ? "color:var(--uitgave)" : ""}">${geld(hoofd)}</span>
      <span class="pot__bij">${esc(bij)}</span>
      ${balk}
    </button>`;
}

export function signaalHtml(s) {
  return `
    <div class="signaal signaal--${esc(s.soort)}">
      <span class="signaal__icoon" aria-hidden="true">${esc(s.icoon)}</span>
      <span>
        <span class="signaal__titel">${esc(s.titel)}</span>
        <span class="signaal__tekst">${esc(s.tekst)}</span>
      </span>
    </div>`;
}

/* Maanden waarin iets geboekt is, nieuwste eerst — voor keuzelijsten. */
export function maandenMetGegevens() {
  const set = new Set(state.transacties.map(t => maandVan(t.datum)));
  set.add(maandNu());
  set.add(maandPlus(maandNu(), -1));
  return [...set].sort().reverse();
}
