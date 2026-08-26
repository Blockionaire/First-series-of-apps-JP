/* =====================================================================
   GELDZAKEN — spaardoelen
   =====================================================================
   Een doel is sparen mét een bestemming en meestal een datum: een
   nieuwe auto in 2028, een verbouwing volgend jaar. De app rekent twee
   dingen uit die je zelf niet zo snel doet:

     - wat moet er per maand bij om het op tijd te halen?
     - haal je het met het tempo van de afgelopen maanden?
   ===================================================================== */

import { esc, geld, datumNL, maandLabel, melding, bevestig, dialoog,
         leesBedrag, voortgang, procent } from "../util.js";
import { state, legDoel, bewaarDoel, wisDoel } from "../store.js";
import { doelenMetStand, doelStand } from "../bereken.js";
import { transactieLijst, leeg, rekeningOpties } from "./onderdelen.js";
import { ICONEN, KLEUREN } from "../data/standaard.js";
import { ga, terug, eisBewerkrecht } from "../app.js";

export const titel = params => params[0]
  ? (state.doelen.find(d => d.id === params[0])?.naam || "Doel")
  : "Spaardoelen";
export const terugknop = true;
export const terugNaar = "#/potjes";

export const kopActies = params => params[0]
  ? `<button class="icoonknop" data-bewerk-doel aria-label="Doel aanpassen">✏️</button>`
  : `<button class="icoonknop" data-nieuw aria-label="Nieuw doel">＋</button>`;

/* ---------------------------------------------------------------
   Overzicht
   --------------------------------------------------------------- */
export function html(params) {
  if (params[0]) return detail(params[0]);

  const doelen = doelenMetStand(state);
  if (!doelen.length) {
    return `
      ${leeg({
        icoon: "🎯",
        titel: "Nog geen spaardoelen",
        tekst: "Zet neer waar je voor spaart en tegen wanneer. De app rekent uit wat dat per maand betekent.",
      })}
      <button class="knop knop--primair knop--breed" data-nieuw>Eerste doel maken</button>`;
  }

  const totaal = doelen.reduce((s, d) => s + d.huidig, 0);
  const samen = doelen.reduce((s, d) => s + (Number(d.doelBedrag) || 0), 0);

  return `
    <div class="hero" style="margin-bottom:14px">
      <div class="hero__label">Gespaard voor je doelen</div>
      <div class="hero__bedrag">${geld(totaal)}</div>
      <div class="hero__bij">${samen > 0 ? `${procent(totaal, samen)} van ${geld(samen)}` : ""}</div>
    </div>

    <div class="lijst lijst--los">
      ${doelen.map(d => `
        <button class="kaart kaart--knop" data-doel="${esc(d.id)}" style="margin:0">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
            <span style="font-weight:650">${esc(d.icoon)} ${esc(d.naam)} ${d.klaar ? `<span class="label label--goed">gehaald</span>` : ""}</span>
            <span class="bedrag" style="font-weight:660">${geld(d.huidig)} <span class="dof">/ ${geld(d.doelBedrag)}</span></span>
          </div>
          ${voortgang(d.huidig, d.doelBedrag, { kleur: d.kleur, waarschuwVanaf: 2 })}
          <div class="dof" style="font-size:.77rem;margin-top:8px">${esc(doelRegel(d))}</div>
        </button>`).join("")}
    </div>

    <button class="knop knop--primair knop--breed" data-nieuw style="margin-top:16px">Nieuw doel</button>`;
}

function doelRegel(d) {
  if (d.klaar) return "Doel gehaald — mooi zo.";
  if (d.streefDatum && d.maandenTeGaan > 0) {
    return `Nog ${geld(d.teGaan)} te gaan · ${geld(d.perMaandNodig)} per maand tot ${maandLabel(d.streefDatum.slice(0, 7))}`;
  }
  if (d.streefDatum) return `Streefdatum ${datumNL(d.streefDatum, { kort: true })} · nog ${geld(d.teGaan)}`;
  if (d.verwachtKlaar) return `Met dit tempo klaar rond ${maandLabel(d.verwachtKlaar)}`;
  return `Nog ${geld(d.teGaan)} te gaan`;
}

/* ---------------------------------------------------------------
   Eén doel
   --------------------------------------------------------------- */
function detail(id) {
  const doel = state.doelen.find(d => d.id === id);
  if (!doel) return leeg({ icoon: "🤔", titel: "Dit doel bestaat niet meer" });

  const stand = doelStand(state, doel);
  const inleg = state.transacties
    .filter(t => t.doel === id)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  return `
    <div class="hero" style="margin-bottom:14px">
      <div class="hero__label">${esc(doel.icoon)} ${esc(doel.naam)}</div>
      <div class="hero__bedrag">${geld(stand.huidig)}</div>
      <div class="hero__bij">van ${geld(stand.doelBedrag)} · ${procent(stand.huidig, stand.doelBedrag)}</div>
      ${voortgang(stand.huidig, stand.doelBedrag, { kleur: doel.kleur, waarschuwVanaf: 2 })}
    </div>

    <div class="knoprij knoprij--gelijk">
      <a class="knop knop--primair" href="#/boeken/nieuw/sparen/${esc(id)}">Inleggen</a>
      <a class="knop" href="#/boeken/nieuw/opname/${esc(id)}">Opnemen</a>
    </div>

    <div class="cijferrij" style="margin-top:14px">
      <div class="cijfer">
        <div class="cijfer__waarde">${geld(stand.teGaan)}</div>
        <div class="cijfer__label">Nog te gaan</div>
      </div>
      ${stand.perMaandNodig != null ? `
        <div class="cijfer">
          <div class="cijfer__waarde">${geld(stand.perMaandNodig)}</div>
          <div class="cijfer__label">Per maand nodig</div>
          <div class="cijfer__bij dof">${stand.maandenTeGaan} maanden</div>
        </div>` : ""}
      <div class="cijfer">
        <div class="cijfer__waarde">${geld(stand.tempo)}</div>
        <div class="cijfer__label">Tempo per maand</div>
        ${stand.verwachtKlaar ? `<div class="cijfer__bij dof">klaar rond ${esc(maandLabel(stand.verwachtKlaar))}</div>` : ""}
      </div>
    </div>

    ${stand.perMaandNodig != null && stand.tempo > 0 && !stand.klaar ? `
      <div class="signaal signaal--${stand.tempo >= stand.perMaandNodig ? "info" : "let-op"}">
        <span class="signaal__icoon">${stand.tempo >= stand.perMaandNodig ? "✅" : "🐢"}</span>
        <span>
          <span class="signaal__titel">${stand.tempo >= stand.perMaandNodig ? "Je ligt op schema" : "Dit tempo is te langzaam"}</span>
          <span class="signaal__tekst">
            ${stand.tempo >= stand.perMaandNodig
              ? `Je legt gemiddeld ${geld(stand.tempo)} per maand in, en ${geld(stand.perMaandNodig)} is genoeg.`
              : `Je legt ${geld(stand.tempo)} per maand in, maar er is ${geld(stand.perMaandNodig)} nodig.`}
          </span>
        </span>
      </div>` : ""}

    <div class="sectiekop"><h2>Inleg</h2></div>
    ${inleg.length
      ? transactieLijst(inleg, { groepeer: false })
      : leeg({ icoon: "🎯", titel: "Nog niets ingelegd", tekst: "Zet je eerste bedrag opzij met de knop hierboven." })}

    <button class="knop knop--rand knop--breed" data-bewerk-doel style="margin-top:16px">Doel aanpassen</button>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel, params) {
  const kop = document.querySelector(".kop");
  kop?.querySelector("[data-nieuw]")?.addEventListener("click", () => bewerkDoel(null));
  kop?.querySelector("[data-bewerk-doel]")?.addEventListener("click", () =>
    bewerkDoel(state.doelen.find(d => d.id === params[0])));

  wortel.addEventListener("click", e => {
    if (e.target.closest("[data-nieuw]")) return bewerkDoel(null);
    if (e.target.closest("[data-bewerk-doel]")) return bewerkDoel(state.doelen.find(d => d.id === params[0]));

    const doel = e.target.closest("[data-doel]");
    if (doel) return ga(`#/doelen/${doel.dataset.doel}`);

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) return ga(`#/boeken/${boeking.dataset.transactie}`);
  });
}

/* ---------------------------------------------------------------
   Doel toevoegen of aanpassen
   --------------------------------------------------------------- */
async function bewerkDoel(bestaand) {
  if (!eisBewerkrecht()) return;
  const d = bestaand ? { ...bestaand } : legDoel();
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Nieuw spaardoel" : d.naam,
    onderaan: true,
    inhoud: `
      <div class="veld">
        <label for="dnaam">Waar spaar je voor?</label>
        <input type="text" id="dnaam" value="${esc(d.naam)}" placeholder="Nieuwe keuken, wereldreis…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="dbedrag">Streefbedrag</label>
          <input type="text" id="dbedrag" inputmode="decimal" value="${d.doelBedrag ? String(d.doelBedrag).replace(".", ",") : ""}" placeholder="0,00">
        </div>
        <div class="veld">
          <label for="ddatum">Wanneer klaar</label>
          <input type="date" id="ddatum" value="${esc(d.streefDatum || "")}">
        </div>
      </div>
      <div class="veld">
        <label for="dstart">Al gespaard</label>
        <input type="text" id="dstart" inputmode="decimal" value="${d.startBedrag ? String(d.startBedrag).replace(".", ",") : ""}" placeholder="0,00">
        <div class="veld__hint">Stond er al iets op de spaarrekening voor dit doel? Zet dat bedrag hier, dan begint de balk niet op nul.</div>
      </div>
      <div class="veld">
        <label for="drekening">Staat op</label>
        <select id="drekening">${rekeningOpties(d.rekening)}</select>
      </div>
      <div class="veld">
        <span class="veld__label">Icoon</span>
        <div class="iconenraster" id="diconen">
          ${ICONEN.map(i => `<button type="button" data-icoon="${esc(i)}" aria-pressed="${i === d.icoon}">${esc(i)}</button>`).join("")}
        </div>
      </div>
      <div class="veld">
        <span class="veld__label">Kleur</span>
        <div class="kleuren" id="dkleuren">
          ${KLEUREN.map(k => `<button type="button" data-kleur="${esc(k)}" style="background:${esc(k)}" aria-pressed="${k === d.kleur}" aria-label="Kleur"></button>`).join("")}
        </div>
      </div>
      ${nieuw ? "" : `<button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Doel verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#dnaam").value.trim();
          const bedrag = leesBedrag(laag.querySelector("#dbedrag").value);
          if (!naam) { melding("Geef je doel een naam.", "fout"); return undefined; }
          if (!bedrag) { melding("Vul een streefbedrag in.", "fout"); return undefined; }
          return {
            ...d,
            naam,
            doelBedrag: bedrag,
            startBedrag: leesBedrag(laag.querySelector("#dstart").value) || 0,
            streefDatum: laag.querySelector("#ddatum").value || "",
            rekening: laag.querySelector("#drekening").value,
            icoon: laag.querySelector("[data-icoon][aria-pressed=true]")?.dataset.icoon || d.icoon,
            kleur: laag.querySelector("[data-kleur][aria-pressed=true]")?.dataset.kleur || d.kleur,
          };
        },
      },
    ],
    opOpenen: (laag, sluit) => {
      const kiezer = (houder, attribuut) => {
        laag.querySelector(houder)?.addEventListener("click", e => {
          const knop = e.target.closest(`[${attribuut}]`);
          if (!knop) return;
          laag.querySelectorAll(`[${attribuut}]`).forEach(k => k.setAttribute("aria-pressed", String(k === knop)));
        });
      };
      kiezer("#diconen", "data-icoon");
      kiezer("#dkleuren", "data-kleur");

      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const zeker = await bevestig(`"${d.naam}" wordt verwijderd. De inleg blijft als boeking staan.`,
          { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisDoel(d.id);
        melding("Doel verwijderd.");
        sluit(null);
        terug("#/doelen");
      });

      if (nieuw) setTimeout(() => laag.querySelector("#dnaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarDoel(uitkomst);
  melding(nieuw ? "Doel aangemaakt." : "Opgeslagen.", "goed");
}
