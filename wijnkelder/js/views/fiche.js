/* =====================================================================
   WIJNKELDER — de wijnfiche
   =====================================================================
   Alles over één wijn: waar hij vandaan komt, hoe ver hij is, wat hij
   waard is, waar hij bij past en wat je er de vorige keer van vond.
   ===================================================================== */

import {
  state, vindFles, bewaarFles, drinkFles, pasAantalAan, zetFavoriet,
  notitiesVan, bewaarNotitie, verwijderNotitie, nieuweId,
} from "../store.js";
import {
  esc, geld, getal, datumNL, vandaagISO, melding, dialoog, bevestig,
} from "../util.js";
import { kleurInfo, formaatInfo, BEWAARADVIES } from "../data/catalog.js";
import { rijping } from "../data/aging.js";
import { GERECHTEN, scoreCombinatie, wijnProfiel } from "../data/pairings.js";
import { rijpingsBalk, faseVlag, sterren, koppelSterren, leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

export const terugknop = true;

export function titel(params) {
  const f = vindFles(params[0]);
  return f ? (f.naam || "Wijn") : "Wijn";
}

export function ondertitel(params) {
  const f = vindFles(params[0]);
  if (!f) return "";
  return [f.producent, f.jaargang].filter(Boolean).join(" · ");
}

export function kopActies(params) {
  const f = vindFles(params[0]);
  if (!f) return "";
  return `
    <button class="icoonknop" data-favoriet aria-label="Favoriet" aria-pressed="${!!f.favoriet}">
      ${f.favoriet ? "⭐" : "☆"}
    </button>
    <a class="icoonknop" href="#/toevoegen/${esc(f.id)}" aria-label="Bewerken">✏️</a>`;
}

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html(params) {
  const f = vindFles(params[0]);

  if (!f) {
    /* Kan gebeuren na het drinken van de laatste fles: dan bestaat de
       wijn niet meer, maar de proefnotities wel. */
    const notities = state.notities.filter(n => n.flesId === params[0]);
    if (notities.length) return gedronkenFiche(params[0], notities);
    return leegBlok({
      icoon: "🔍", titel: "Deze wijn bestaat niet meer",
      tekst: "Hij is verwijderd of de laatste fles is opgedronken.",
      knop: { label: "Naar de kelder", actie: "kelder" },
    });
  }

  return `
    ${hero(f)}
    ${acties(f)}
    ${rijpingsKaart(f)}
    ${gegevensKaart(f)}
    ${waardeKaart(f)}
    ${bewaarKaart(f)}
    ${combinatieKaart(f)}
    ${notitiesKaart(f)}
    ${eigenNotitie(f)}`;
}

/* ---------------------------------------------------------------
   Kop
   --------------------------------------------------------------- */
function hero(f) {
  const k = kleurInfo(f.kleur);
  /* Appellatie en regio heten soms hetzelfde (Beaujolais, Rioja…).
     Twee keer hetzelfde woord op een rij leest als een fout. */
  const herkomst = [...new Set([f.appellatie, f.regio, f.land].filter(Boolean))].join(" · ");

  return `
    <div class="fiche__hero">
      ${f.foto
        ? `<img class="fiche__foto" src="${esc(f.foto)}" alt="Etiket van ${esc(f.naam)}">`
        : `<div class="fiche__geenfoto">${k.emoji}</div>`}
      <div class="fiche__kop">
        <div class="fiche__naam">${esc(f.naam || "Naamloze wijn")}</div>
        ${f.producent ? `<div class="fiche__producent">${esc(f.producent)}</div>` : ""}
        ${herkomst ? `<div class="fiche__herkomst">${esc(herkomst)}</div>` : ""}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="fase" style="background:color-mix(in srgb, ${k.kleur} 22%, transparent);color:${k.kleur}">
            ${k.emoji} ${esc(k.naam)}
          </span>
          ${faseVlag(f)}
        </div>
        ${(f.druiven || []).length ? `
          <div class="metaregel" style="margin-top:7px">${f.druiven.map(esc).join(" · ")}</div>` : ""}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Knoppen
   --------------------------------------------------------------- */
function acties(f) {
  return `
    <div class="kaart">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:11px">
        <div style="flex:1">
          <div class="cijfer__label">In de kelder</div>
          <div style="font-size:1.4rem;font-weight:700">${f.aantal} ${f.aantal === 1 ? "fles" : "flessen"}</div>
        </div>
        <button class="icoonknop" data-min aria-label="Eén minder">−</button>
        <button class="icoonknop" data-plus aria-label="Eén meer">＋</button>
      </div>
      <button class="knop knop--primair knop--breed" data-drink>🍷 Fles openen</button>
    </div>`;
}

/* ---------------------------------------------------------------
   Rijping
   --------------------------------------------------------------- */
function rijpingsKaart(f) {
  const r = rijping(f);
  return `
    <div class="sectiekop"><h2>Rijping</h2></div>
    <div class="kaart">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <strong>${r.fase.emoji} ${esc(r.fase.naam)}</strong>
        ${r.venster ? `<span class="metaregel">${r.venster.vanaf}–${r.venster.tot}</span>` : ""}
      </div>
      ${rijpingsBalk(f)}
      <p class="metaregel" style="margin:9px 0 0">${esc(r.fase.uitleg)}</p>
      ${r.venster && r.fase.id === "jong" ? `
        <p class="metaregel" style="margin:5px 0 0">
          Nog ongeveer ${getal(Math.max(0, r.jarenTot), 1)} jaar geduld.</p>` : ""}
      ${r.venster && r.jarenOver > 0 && r.fase.id !== "jong" ? `
        <p class="metaregel" style="margin:5px 0 0">
          Volgens de schatting nog zo'n ${getal(r.jarenOver, 1)} jaar te gaan.</p>` : ""}
      ${r.venster?.bron === "schatting" ? `
        <button class="knop knop--klein knop--stil" data-eigen-venster style="margin-top:9px;padding-left:0">
          Zelf een drinkvenster invullen</button>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Gegevens
   --------------------------------------------------------------- */
function gegevensKaart(f) {
  const formaat = formaatInfo(f.formaat);
  const locatie = [f.locatie?.kelder, f.locatie?.rek, f.locatie?.rij && `rij ${f.locatie.rij}`,
                   f.locatie?.vak && `vak ${f.locatie.vak}`].filter(Boolean).join(" · ");

  const rijen = [
    ["Jaargang", f.jaargang || "Zonder jaartal"],
    ["Formaat", formaat.naam.split(" (")[0]],
    ["Alcohol", f.alcohol ? `${getal(f.alcohol, 1)}%` : "—"],
    ["Locatie", locatie || "Niet vastgelegd"],
    ["Gekocht op", f.aankoopDatum ? datumNL(f.aankoopDatum, { kort: true }) : "—"],
    ["Gekocht bij", f.leverancier || "—"],
  ];

  return `
    <div class="sectiekop"><h2>Gegevens</h2></div>
    <div class="gegevens">
      ${rijen.map(([label, waarde]) => `
        <div class="gegeven">
          <div class="gegeven__label">${esc(label)}</div>
          <div class="gegeven__waarde">${esc(waarde)}</div>
        </div>`).join("")}
    </div>`;
}

/* ---------------------------------------------------------------
   Waarde
   --------------------------------------------------------------- */
function waardeKaart(f) {
  const aankoop = Number(f.aankoopPrijs) || 0;
  const nu = Number(f.huidigeWaarde) || 0;

  if (!aankoop && !nu) {
    return `
      <div class="sectiekop"><h2>Waarde</h2></div>
      <div class="kaart">
        <p class="metaregel" style="margin:0 0 9px">Je hebt nog geen prijs bij deze wijn gezet.</p>
        <a class="knop knop--klein" href="#/toevoegen/${esc(f.id)}">Prijs invullen</a>
      </div>`;
  }

  const verschilPerFles = nu && aankoop ? nu - aankoop : 0;
  const totaalNu = (nu || aankoop) * f.aantal;
  const totaalAankoop = aankoop * f.aantal;

  return `
    <div class="sectiekop"><h2>Waarde</h2></div>
    <div class="kaart">
      <div class="cijferrij">
        <div class="cijfer" style="background:none;border:0;padding:0">
          <div class="cijfer__waarde">${aankoop ? geld(aankoop) : "—"}</div>
          <div class="cijfer__label">Aankoop / fles</div>
        </div>
        <div class="cijfer" style="background:none;border:0;padding:0">
          <div class="cijfer__waarde">${nu ? geld(nu) : "—"}</div>
          <div class="cijfer__label">Nu / fles</div>
        </div>
        <div class="cijfer" style="background:none;border:0;padding:0">
          <div class="cijfer__waarde ${verschilPerFles > 0 ? "op" : verschilPerFles < 0 ? "af" : ""}">
            ${verschilPerFles ? (verschilPerFles > 0 ? "+" : "") + geld(verschilPerFles) : "—"}
          </div>
          <div class="cijfer__label">Verschil / fles</div>
        </div>
      </div>
      <hr class="dunlijn">
      <div style="display:flex;justify-content:space-between;font-size:.92rem">
        <span class="zacht">Totaal in de kelder (${f.aantal}×)</span>
        <strong>${geld(totaalNu)}</strong>
      </div>
      ${totaalAankoop && nu ? `
        <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-top:4px">
          <span class="dof">Betaald</span>
          <span class="dof">${geld(totaalAankoop)}</span>
        </div>` : ""}
      <button class="knop knop--klein knop--stil" data-waarde-bijwerken style="margin-top:10px;padding-left:0">
        Huidige waarde bijwerken</button>
    </div>`;
}

/* ---------------------------------------------------------------
   Bewaaradvies
   --------------------------------------------------------------- */
function bewaarKaart(f) {
  const a = BEWAARADVIES[f.kleur] || BEWAARADVIES.rood;
  return `
    <div class="sectiekop"><h2>Bewaren en schenken</h2></div>
    <div class="gegevens">
      <div class="gegeven"><div class="gegeven__label">Bewaartemperatuur</div>
        <div class="gegeven__waarde">${esc(a.temp)}</div></div>
      <div class="gegeven"><div class="gegeven__label">Ligging</div>
        <div class="gegeven__waarde">${esc(a.ligging)}</div></div>
      <div class="gegeven"><div class="gegeven__label">Schenken op</div>
        <div class="gegeven__waarde">${esc(a.schenk)}</div></div>
      <div class="gegeven"><div class="gegeven__label">Glas</div>
        <div class="gegeven__waarde">${esc(a.glas)}</div></div>
    </div>`;
}

/* ---------------------------------------------------------------
   Waar past deze wijn bij?
   --------------------------------------------------------------- */
function combinatieKaart(f) {
  const beste = GERECHTEN
    .map(g => ({ gerecht: g, ...scoreCombinatie(f, g) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (beste[0].score < 30) return "";

  const p = wijnProfiel(f);
  const assen = [
    ["Body", p.body], ["Tannine", p.tannine], ["Zuur", p.zuur], ["Zoet", p.zoet],
  ];

  return `
    <div class="sectiekop">
      <h2>Past goed bij</h2>
      <a class="sectiekop__actie" href="#/combineer">Andersom zoeken</a>
    </div>
    <div class="kaart">
      <div class="gerechten">
        ${beste.map(b => `
          <div class="gerecht" style="border-color:${b.score >= 70 ? "var(--goud)" : "var(--rand-zacht)"}">
            <span class="gerecht__emoji">${b.gerecht.emoji}</span>
            <span>${esc(b.gerecht.naam)}</span>
            <span class="match__score">${b.score}</span>
          </div>`).join("")}
      </div>
      <hr class="dunlijn">
      <div class="cijfer__label" style="margin-bottom:7px">Smaakprofiel</div>
      ${assen.map(([label, waarde]) => `
        <div class="balk" style="margin-bottom:6px">
          <span class="balk__label">${label}</span>
          <span class="balk__spoor"><span class="balk__vulling" style="width:${(waarde / 5) * 100}%"></span></span>
          <span class="balk__waarde">${waarde.toFixed(1)}</span>
        </div>`).join("")}
      <p class="metaregel" style="margin:8px 0 0">
        Geschat op basis van kleur, druiven en regio — niet op basis van proeven.</p>
    </div>`;
}

/* ---------------------------------------------------------------
   Proefnotities
   --------------------------------------------------------------- */
function notitiesKaart(f) {
  const notities = notitiesVan(f.id);

  return `
    <div class="sectiekop">
      <h2>Proefnotities</h2>
      <button class="sectiekop__actie" data-notitie-nieuw>+ Toevoegen</button>
    </div>
    ${notities.length ? notities.map(n => `
      <div class="notitie">
        <div class="notitie__kop">
          <span class="notitie__datum">${datumNL(n.datum, { kort: true })}</span>
          <span style="display:flex;align-items:center;gap:8px">
            ${sterren(n.score)}
            <button class="icoonknop icoonknop--kaal" data-notitie-weg="${esc(n.id)}"
                    aria-label="Notitie verwijderen" style="width:24px;height:24px;font-size:.85rem">🗑</button>
          </span>
        </div>
        ${n.geur ? `<div class="klein zacht"><strong>Geur:</strong> ${esc(n.geur)}</div>` : ""}
        ${n.smaak ? `<div class="klein zacht"><strong>Smaak:</strong> ${esc(n.smaak)}</div>` : ""}
        ${n.tekst ? `<div class="notitie__tekst" style="margin-top:5px">${esc(n.tekst)}</div>` : ""}
        ${n.opnieuw != null ? `
          <div class="klein" style="margin-top:6px">
            ${n.opnieuw ? "👍 Zou ik opnieuw kopen" : "👎 Hoeft voor mij niet nog eens"}</div>` : ""}
      </div>`).join("") : `
      <div class="kaart">
        <p class="metaregel" style="margin:0">
          Nog geen notities. Voeg er een toe zodra je een fles opentrekt — over een paar jaar
          ben je blij dat je het opschreef.</p>
      </div>`}`;
}

function eigenNotitie(f) {
  if (!f.notitie) return "";
  return `
    <div class="sectiekop"><h2>Jouw aantekening</h2></div>
    <div class="kaart"><div class="notitie__tekst">${esc(f.notitie)}</div></div>`;
}

/* ---------------------------------------------------------------
   De fiche van een wijn die al op is
   --------------------------------------------------------------- */
function gedronkenFiche(id, notities) {
  const m = notities[0].momentopname || {};
  return `
    <div class="tipbalk" style="margin-bottom:14px">
      <span class="tipbalk__icoon">📖</span>
      <span>Deze wijn staat niet meer in je kelder. Je proefnotities bewaren we wel.</span>
    </div>
    <div class="fiche__hero">
      ${m.foto ? `<img class="fiche__foto" src="${esc(m.foto)}" alt="">`
               : `<div class="fiche__geenfoto">${kleurInfo(m.kleur).emoji}</div>`}
      <div class="fiche__kop">
        <div class="fiche__naam">${esc(m.naam || "Onbekende wijn")}</div>
        ${m.producent ? `<div class="fiche__producent">${esc(m.producent)}</div>` : ""}
        <div class="fiche__herkomst">${esc([m.jaargang, m.regio, m.land].filter(Boolean).join(" · "))}</div>
      </div>
    </div>
    ${notities.map(n => `
      <div class="notitie">
        <div class="notitie__kop">
          <span class="notitie__datum">${datumNL(n.datum, { kort: true })}</span>
          ${sterren(n.score)}
        </div>
        ${n.tekst ? `<div class="notitie__tekst">${esc(n.tekst)}</div>` : ""}
      </div>`).join("")}`;
}

/* =====================================================================
   Interactie
   ===================================================================== */
export function koppel(wortel, params) {
  const id = params[0];

  wortel.addEventListener("click", async e => {
    const f = vindFles(id);

    if (e.target.closest("[data-actie='kelder']")) return ga("#/kelder");
    if (!f) return;

    if (e.target.closest("[data-plus]")) return pasAantalAan(id, 1);
    if (e.target.closest("[data-min]"))  return minEen(f);
    if (e.target.closest("[data-drink]")) return openFlesDialoog(f);
    if (e.target.closest("[data-notitie-nieuw]")) return notitieDialoog(f);
    if (e.target.closest("[data-eigen-venster]")) return vensterDialoog(f);
    if (e.target.closest("[data-waarde-bijwerken]")) return waardeDialoog(f);

    const weg = e.target.closest("[data-notitie-weg]");
    if (weg) {
      const zeker = await bevestig("Deze proefnotitie wordt verwijderd.",
        { titel: "Notitie verwijderen?", bevestigLabel: "Verwijderen", gevaar: true });
      if (zeker) await verwijderNotitie(weg.dataset.notitieWeg);
    }
  });

  /* De favorietknop zit in de kop, buiten dit scherm. */
  document.querySelector("[data-favoriet]")?.addEventListener("click", () => {
    const f = vindFles(id);
    if (f) zetFavoriet(id, !f.favoriet);
  });
}

async function minEen(f) {
  if (f.aantal > 1) return pasAantalAan(f.id, -1);
  const zeker = await bevestig(
    "Dit is je laatste fles. Wil je hem als gedronken opslaan of uit de kelder halen?",
    { titel: "Laatste fles", bevestigLabel: "Uit de kelder halen", gevaar: true });
  if (zeker) await pasAantalAan(f.id, -1);
}

/* ---------------------------------------------------------------
   Fles openen
   --------------------------------------------------------------- */
async function openFlesDialoog(f) {
  let leesScore = () => null;

  const uitkomst = await dialoog({
    titel: `${f.naam} openen`,
    inhoud: `
      <div class="veld">
        <label for="d-datum">Wanneer?</label>
        <input type="date" id="d-datum" value="${vandaagISO()}" max="${vandaagISO()}">
      </div>
      ${f.aantal > 1 ? `
        <div class="veld">
          <label for="d-aantal">Hoeveel flessen?</label>
          <input type="number" id="d-aantal" value="1" min="1" max="${f.aantal}" inputmode="numeric">
        </div>` : ""}
      <div class="veld">
        <label for="d-gelegenheid">Gelegenheid</label>
        <input type="text" id="d-gelegenheid" placeholder="Zomaar, verjaardag, bij het eten…" autocomplete="off">
      </div>
      <div class="veld">
        <span class="veld__label">Wat vond je ervan?</span>
        ${sterren(null, { invoer: true })}
      </div>
      <div class="veld">
        <label for="d-notitie">Proefnotitie</label>
        <textarea id="d-notitie" placeholder="Geur, smaak, of gewoon: lekker."></textarea>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Openen", soort: "primair",
        waardeUit: laag => ({
          datum: laag.querySelector("#d-datum").value || vandaagISO(),
          aantal: Number(laag.querySelector("#d-aantal")?.value || 1),
          gelegenheid: laag.querySelector("#d-gelegenheid").value.trim(),
          notitie: laag.querySelector("#d-notitie").value.trim(),
          score: leesScore(),
        }),
      },
    ],
    opOpenen: laag => { leesScore = koppelSterren(laag, null); },
  });

  if (!uitkomst) return;
  await drinkFles(f.id, uitkomst);
  melding(uitkomst.aantal > 1 ? `${uitkomst.aantal} flessen genoteerd` : "Proost! 🍷", "goed");

  /* Was dit de laatste fles, dan bestaat de wijn niet meer. */
  if (!vindFles(f.id)) ga("#/kelder");
}

/* ---------------------------------------------------------------
   Losse proefnotitie
   --------------------------------------------------------------- */
async function notitieDialoog(f) {
  let leesScore = () => null;

  const uitkomst = await dialoog({
    titel: "Proefnotitie",
    inhoud: `
      <div class="veld">
        <label for="n-datum">Datum</label>
        <input type="date" id="n-datum" value="${vandaagISO()}">
      </div>
      <div class="veld">
        <span class="veld__label">Score</span>
        ${sterren(null, { invoer: true })}
      </div>
      <div class="veld">
        <label for="n-geur">Geur</label>
        <input type="text" id="n-geur" placeholder="Rood fruit, cederhout, viooltjes…" autocomplete="off">
      </div>
      <div class="veld">
        <label for="n-smaak">Smaak</label>
        <input type="text" id="n-smaak" placeholder="Stevige tannine, lange afdronk…" autocomplete="off">
      </div>
      <div class="veld">
        <label for="n-tekst">Vrije notitie</label>
        <textarea id="n-tekst" placeholder="Wat je verder wilt onthouden."></textarea>
      </div>
      <div class="veld">
        <span class="veld__label">Opnieuw kopen?</span>
        <div class="keuzes">
          <button type="button" class="keuze" data-opnieuw="ja">👍 Ja</button>
          <button type="button" class="keuze" data-opnieuw="nee">👎 Nee</button>
        </div>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Bewaren", soort: "primair",
        waardeUit: laag => ({
          datum: laag.querySelector("#n-datum").value || vandaagISO(),
          geur: laag.querySelector("#n-geur").value.trim(),
          smaak: laag.querySelector("#n-smaak").value.trim(),
          tekst: laag.querySelector("#n-tekst").value.trim(),
          score: leesScore(),
          opnieuw: laag.querySelector("[data-opnieuw].is-actief")
            ? laag.querySelector("[data-opnieuw].is-actief").dataset.opnieuw === "ja" : null,
        }),
      },
    ],
    opOpenen: laag => {
      leesScore = koppelSterren(laag, null);
      laag.addEventListener("click", e => {
        const knop = e.target.closest("[data-opnieuw]");
        if (!knop) return;
        const alAan = knop.classList.contains("is-actief");
        laag.querySelectorAll("[data-opnieuw]").forEach(b => b.classList.remove("is-actief"));
        if (!alAan) knop.classList.add("is-actief");
      });
    },
  });

  if (!uitkomst) return;
  await bewaarNotitie({ id: nieuweId(), flesId: f.id, ...uitkomst });
  melding("Notitie bewaard", "goed");
}

/* ---------------------------------------------------------------
   Eigen drinkvenster
   --------------------------------------------------------------- */
async function vensterDialoog(f) {
  const r = rijping(f);
  const uitkomst = await dialoog({
    titel: "Eigen drinkvenster",
    inhoud: `
      <p class="metaregel">De app schat nu ${r.venster.vanaf}–${r.venster.tot}. Vul hieronder je eigen
      jaartallen in; die winnen daarna altijd van de schatting.</p>
      <div class="veldrij">
        <div class="veld"><label for="w-vanaf">Vanaf</label>
          <input type="number" id="w-vanaf" value="${r.venster.vanaf}" min="1900" max="2200"></div>
        <div class="veld"><label for="w-tot">Tot</label>
          <input type="number" id="w-tot" value="${r.venster.tot}" min="1900" max="2200"></div>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Bewaren", soort: "primair",
        waardeUit: laag => ({
          vanaf: Number(laag.querySelector("#w-vanaf").value),
          tot: Number(laag.querySelector("#w-tot").value),
        }),
      },
    ],
  });

  if (!uitkomst) return;
  if (!(uitkomst.tot > uitkomst.vanaf)) return melding("Het eindjaar moet na het beginjaar liggen.", "fout");

  await bewaarFles({ ...f, drinkVanaf: uitkomst.vanaf, drinkTot: uitkomst.tot });
  melding("Drinkvenster bijgewerkt", "goed");
}

/* ---------------------------------------------------------------
   Waarde bijwerken
   --------------------------------------------------------------- */
async function waardeDialoog(f) {
  const uitkomst = await dialoog({
    titel: "Huidige waarde",
    inhoud: `
      <p class="metaregel">Wat is deze fles vandaag waard? Kijk bijvoorbeeld bij je wijnhandel
      of op een veilingsite en vul het bedrag per fles in.</p>
      <div class="veld">
        <label for="p-waarde">Huidige waarde per fles</label>
        <input type="number" id="p-waarde" step="0.01" inputmode="decimal"
               value="${f.huidigeWaarde ?? f.aankoopPrijs ?? ""}">
      </div>
      ${f.aankoopPrijs ? `<p class="metaregel">Je betaalde ${geld(f.aankoopPrijs)} per fles.</p>` : ""}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Bewaren", soort: "primair",
        waardeUit: laag => {
          const v = laag.querySelector("#p-waarde").value;
          return v === "" ? null : Number(v);
        },
      },
    ],
  });

  if (uitkomst == null) return;
  await bewaarFles({ ...f, huidigeWaarde: uitkomst });
  melding("Waarde bijgewerkt", "goed");
}
