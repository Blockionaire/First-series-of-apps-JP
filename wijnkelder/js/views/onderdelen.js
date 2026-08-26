/* =====================================================================
   WIJNKELDER — gedeelde onderdelen
   =====================================================================
   Stukjes HTML die op meerdere schermen terugkomen. Ze geven een string
   terug; het scherm dat ze gebruikt plakt ze in zijn eigen opmaak en
   hangt er via delegatie zijn eigen klikafhandeling aan.
   ===================================================================== */

import { esc, geld, getal } from "../util.js";
import { KLEUREN, kleurInfo, formaatInfo } from "../data/catalog.js";
import { rijping } from "../data/aging.js";

/* ---------------------------------------------------------------
   Het etiket van een fles — of een glas in de kleur van de wijn
   --------------------------------------------------------------- */
function flesFoto(fles, klasse = "fleskaart") {
  const k = kleurInfo(fles.kleur);
  if (fles.foto) {
    return `<img class="${klasse}__foto" src="${esc(fles.foto)}" alt="Etiket van ${esc(fles.naam)}" loading="lazy">`;
  }
  return `<div class="${klasse}__geenfoto" aria-hidden="true">${k.emoji}</div>`;
}

/* ---------------------------------------------------------------
   Het rijpingsvlaggetje
   --------------------------------------------------------------- */
export function faseVlag(fles, { kort = false } = {}) {
  const r = rijping(fles);
  const f = r.fase;
  return `<span class="fase" style="background:color-mix(in srgb, ${f.kleur} 22%, transparent);color:${f.kleur}">
    ${f.emoji} ${esc(kort ? f.kort : f.naam)}
  </span>`;
}

/* ---------------------------------------------------------------
   De balk met het drinkvenster en een streepje voor 'vandaag'
   --------------------------------------------------------------- */
export function rijpingsBalk(fles) {
  const r = rijping(fles);
  if (!r.venster) {
    return `<p class="metaregel">Vul een jaargang in om de rijping te volgen.</p>`;
  }
  const positie = Math.max(0, Math.min(1, r.positie));
  return `
    <div class="rijpbalk">
      <div class="rijpbalk__spoor">
        <span class="rijpbalk__nu" style="left:${positie * 100}%"
              title="Vandaag"></span>
      </div>
      <div class="rijpbalk__jaren">
        <span>${r.venster.vanaf}</span>
        <span>${r.venster.bron === "eigen" ? "eigen venster" : "schatting"}</span>
        <span>${r.venster.tot}</span>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Een fles in een lijst
   --------------------------------------------------------------- */
export function flesKaart(fles, { toonLocatie = false, extra = "" } = {}) {
  const k = kleurInfo(fles.kleur);
  const jaar = fles.jaargang || "NV";
  const formaat = formaatInfo(fles.formaat);

  const meta = [
    jaar,
    fles.regio || fles.land,
    formaat.id !== "fles" ? formaat.naam.split(" (")[0] : "",
    toonLocatie && fles.locatie?.rek ? `📍 ${fles.locatie.rek}${fles.locatie.rij ? "-" + fles.locatie.rij : ""}` : "",
  ].filter(Boolean);

  return `
    <button class="fleskaart" data-fles="${esc(fles.id)}">
      <span class="fleskaart__streep" style="background:${k.kleur}"></span>
      ${flesFoto(fles)}
      <span class="fleskaart__midden">
        <span class="fleskaart__naam">${esc(fles.naam || "Naamloze wijn")}</span>
        ${fles.producent ? `<span class="fleskaart__producent">${esc(fles.producent)}</span>` : ""}
        <span class="fleskaart__meta">
          ${meta.map(m => `<span>${esc(m)}</span>`).join("<span aria-hidden=\"true\">·</span>")}
        </span>
        ${extra}
      </span>
      <span class="fleskaart__rechts">
        <span class="fleskaart__aantal">${fles.aantal}×</span>
        ${faseVlag(fles, { kort: true })}
        ${fles.favoriet ? `<span title="Favoriet">⭐</span>` : ""}
      </span>
    </button>`;
}

/* ---------------------------------------------------------------
   Een cijfertegel
   --------------------------------------------------------------- */
export function cijfer({ waarde, label, bij = "", bijSoort = "" }) {
  return `
    <div class="cijfer">
      <div class="cijfer__waarde">${waarde}</div>
      <div class="cijfer__label">${esc(label)}</div>
      ${bij ? `<div class="cijfer__bij ${bijSoort ? "cijfer__bij--" + bijSoort : ""}">${bij}</div>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Leeg scherm
   --------------------------------------------------------------- */
export function leegBlok({ icoon = "🍷", titel, tekst, knop = null }) {
  return `
    <div class="leeg">
      <div class="leeg__icoon" aria-hidden="true">${icoon}</div>
      <div class="leeg__titel">${esc(titel)}</div>
      <p class="leeg__tekst">${esc(tekst)}</p>
      ${knop ? `<button class="knop knop--primair" data-actie="${esc(knop.actie)}">${esc(knop.label)}</button>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Sterren — als weergave of als invoer
   --------------------------------------------------------------- */
export function sterren(score, { invoer = false, naam = "score" } = {}) {
  /* Scores worden intern op 100 bewaard; 5 sterren = 100. */
  const uit5 = score == null ? 0 : Math.round((score / 100) * 5 * 2) / 2;

  if (!invoer) {
    if (score == null) return `<span class="dof klein">Geen score</span>`;
    return `<span class="sterren" title="${getal(score)} / 100" aria-label="${getal(score)} van 100">
      ${[1, 2, 3, 4, 5].map(i =>
        `<span class="${i <= uit5 ? "ster--aan" : "ster--uit"}">${i - 0.5 === uit5 ? "★" : "★"}</span>`).join("")}
      <span class="klein zacht" style="margin-left:5px">${getal(score)}</span>
    </span>`;
  }

  return `<span class="sterren" role="radiogroup" aria-label="Score" data-sterren="${esc(naam)}">
    ${[1, 2, 3, 4, 5].map(i => `
      <button type="button" class="${i <= uit5 ? "ster--aan" : "ster--uit"}"
              data-ster="${i}" role="radio" aria-checked="${i === Math.round(uit5)}"
              aria-label="${i} van 5">★</button>`).join("")}
  </span>`;
}

/* Sterreninvoer aan de praat krijgen. Geeft een functie terug die de
   huidige score op 100 teruggeeft. */
export function koppelSterren(wortel, beginScore = null) {
  let score = beginScore;
  const groep = wortel.querySelector("[data-sterren]");
  if (!groep) return () => score;

  const teken = () => {
    const uit5 = score == null ? 0 : Math.round((score / 100) * 5);
    groep.querySelectorAll("[data-ster]").forEach(b => {
      const i = Number(b.dataset.ster);
      b.className = i <= uit5 ? "ster--aan" : "ster--uit";
      b.setAttribute("aria-checked", String(i === uit5));
    });
  };

  groep.addEventListener("click", e => {
    const knop = e.target.closest("[data-ster]");
    if (!knop) return;
    const i = Number(knop.dataset.ster);
    /* Nogmaals op dezelfde ster tikken haalt de score weer weg. */
    score = (score != null && Math.round(score / 20) === i) ? null : i * 20;
    teken();
  });

  teken();
  return () => score;
}

/* ---------------------------------------------------------------
   Regel met de synchronisatiestatus
   --------------------------------------------------------------- */
export function syncRegel(sync) {
  if (!sync.beschikbaar) {
    return `<div class="syncbalk"><span class="syncstip"></span>
      Alleen op dit apparaat — synchronisatie staat uit</div>`;
  }
  if (sync.fout) {
    return `<div class="syncbalk"><span class="syncstip syncstip--fout"></span>
      ${esc(sync.fout)}</div>`;
  }
  if (sync.actief) {
    return `<div class="syncbalk"><span class="syncstip syncstip--aan"></span>
      ${sync.bezig ? "Bezig met synchroniseren…" : `Gesynchroniseerd — ${esc(sync.gebruiker.email)}`}</div>`;
  }
  return `<div class="syncbalk"><span class="syncstip"></span>
    Niet ingelogd — je kelder staat alleen op dit apparaat</div>`;
}
