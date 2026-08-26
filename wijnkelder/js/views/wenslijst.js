/* =====================================================================
   WIJNKELDER — wenslijst
   =====================================================================
   Wijnen die je nog niet hebt. Koop je er een, dan verhuist hij met één
   tik naar de kelder — inclusief de prijs die je erbij zette.
   ===================================================================== */

import { state, legeWens, bewaarWens, verwijderWens, wensNaarKelder } from "../store.js";
import { esc, geld, dialoog, melding, bevestig } from "../util.js";
import { KLEUREN, kleurInfo, LANDEN } from "../data/catalog.js";
import { leegBlok } from "./onderdelen.js";
import { ga } from "../app.js";

export const titel = () => "Wenslijst";
export const terugknop = true;
export const ondertitel = () => {
  const n = state.wenslijst.length;
  const budget = state.wenslijst.reduce((s, w) => s + (Number(w.prijs) || 0), 0);
  if (!n) return "Nog niets op je lijstje";
  return `${n} ${n === 1 ? "wijn" : "wijnen"}${budget ? ` · ${geld(budget)}` : ""}`;
};

export const kopActies = () => `
  <button class="icoonknop" data-nieuw aria-label="Wijn toevoegen">＋</button>`;

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  if (!state.wenslijst.length) {
    return leegBlok({
      icoon: "📝",
      titel: "Je wenslijst is leeg",
      tekst: "Zet hier de wijnen op die je nog wilt hebben. Handig als je in een wijnhandel staat en niet meer weet wat het ook alweer was.",
      knop: { label: "Wijn toevoegen", actie: "nieuw" },
    });
  }

  const gesorteerd = [...state.wenslijst].sort((a, b) => (b.aangemaakt || 0) - (a.aangemaakt || 0));

  return `
    <div class="fleslijst">
      ${gesorteerd.map(wensKaart).join("")}
    </div>
    <button class="knop knop--breed knop--rand" data-nieuw style="margin-top:14px">
      ＋ Nog een wijn toevoegen</button>`;
}

function wensKaart(w) {
  const k = kleurInfo(w.kleur);
  const meta = [w.jaargang, w.regio || w.land, w.winkel].filter(Boolean);

  return `
    <div class="fleskaart" style="cursor:default">
      <span class="fleskaart__streep" style="background:${k.kleur}"></span>
      <span class="fleskaart__geenfoto">${k.emoji}</span>
      <span class="fleskaart__midden">
        <span class="fleskaart__naam">${esc(w.naam || "Naamloos")}</span>
        ${w.producent ? `<span class="fleskaart__producent">${esc(w.producent)}</span>` : ""}
        ${meta.length ? `<span class="fleskaart__meta">
          ${meta.map(m => `<span>${esc(m)}</span>`).join("<span aria-hidden=\"true\">·</span>")}</span>` : ""}
        ${w.notitie ? `<span class="fleskaart__meta">${esc(w.notitie)}</span>` : ""}
      </span>
      <span class="fleskaart__rechts">
        ${w.prijs ? `<span class="fleskaart__aantal">${geld(w.prijs)}</span>` : ""}
        <span style="display:flex;gap:4px">
          <button class="icoonknop" data-gekocht="${esc(w.id)}" aria-label="Gekocht — naar de kelder"
                  style="width:30px;height:30px;font-size:.85rem">✓</button>
          <button class="icoonknop" data-bewerk="${esc(w.id)}" aria-label="Bewerken"
                  style="width:30px;height:30px;font-size:.8rem">✏️</button>
          <button class="icoonknop" data-weg="${esc(w.id)}" aria-label="Verwijderen"
                  style="width:30px;height:30px;font-size:.8rem">✕</button>
        </span>
      </span>
    </div>`;
}

/* ---------------------------------------------------------------
   Interactie
   --------------------------------------------------------------- */
export function koppel(wortel) {
  const opKlik = async e => {
    if (e.target.closest("[data-nieuw]") || e.target.closest("[data-actie='nieuw']")) {
      return wensDialoog(null);
    }

    const bewerk = e.target.closest("[data-bewerk]");
    if (bewerk) return wensDialoog(state.wenslijst.find(w => w.id === bewerk.dataset.bewerk));

    const gekocht = e.target.closest("[data-gekocht]");
    if (gekocht) {
      const fles = await wensNaarKelder(gekocht.dataset.gekocht);
      if (fles) {
        melding("Naar de kelder verhuisd", "goed");
        ga(`#/toevoegen/${fles.id}`);
      }
      return;
    }

    const weg = e.target.closest("[data-weg]");
    if (weg) {
      const zeker = await bevestig("Deze wijn verdwijnt van je wenslijst.",
        { titel: "Van de lijst halen?", bevestigLabel: "Verwijderen", gevaar: true });
      if (zeker) await verwijderWens(weg.dataset.weg);
    }
  };

  wortel.addEventListener("click", opKlik);
  document.querySelector("[data-nieuw]")?.addEventListener("click", () => wensDialoog(null));
}

/* ---------------------------------------------------------------
   Het formulier
   --------------------------------------------------------------- */
async function wensDialoog(bestaand) {
  const w = bestaand ? { ...bestaand } : legeWens();

  const uitkomst = await dialoog({
    titel: bestaand ? "Wens bewerken" : "Wijn op de wenslijst",
    inhoud: `
      <div class="veld">
        <label for="w-naam">Naam</label>
        <input type="text" id="w-naam" value="${esc(w.naam)}" placeholder="Bijv. Barolo Cannubi" autocomplete="off">
      </div>
      <div class="veld">
        <label for="w-producent">Producent</label>
        <input type="text" id="w-producent" value="${esc(w.producent)}" autocomplete="off">
      </div>
      <div class="veld">
        <span class="veld__label">Kleur</span>
        <div class="keuzes" data-kleuren>
          ${KLEUREN.map(k => `
            <button type="button" class="keuze keuze--kleur ${w.kleur === k.id ? "is-actief" : ""}"
              data-kleur="${k.id}"
              style="${w.kleur === k.id ? `background:${k.kleur};border-color:${k.kleur};color:${k.tekstOp}` : ""}">
              ${k.emoji} ${esc(k.naam)}</button>`).join("")}
        </div>
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="w-land">Land</label>
          <select id="w-land">
            <option value="">—</option>
            ${LANDEN.map(l => `<option value="${esc(l)}" ${w.land === l ? "selected" : ""}>${esc(l)}</option>`).join("")}
          </select>
        </div>
        <div class="veld">
          <label for="w-jaar">Jaargang</label>
          <input type="number" id="w-jaar" value="${w.jaargang ?? ""}" inputmode="numeric" placeholder="—">
        </div>
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="w-prijs">Richtprijs</label>
          <input type="number" id="w-prijs" value="${w.prijs ?? ""}" step="0.01" inputmode="decimal">
        </div>
        <div class="veld">
          <label for="w-winkel">Waar te koop</label>
          <input type="text" id="w-winkel" value="${esc(w.winkel)}" autocomplete="off">
        </div>
      </div>
      <div class="veld">
        <label for="w-notitie">Notitie</label>
        <textarea id="w-notitie" placeholder="Wie hem aanraadde, waarom je hem wilt…">${esc(w.notitie)}</textarea>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Bewaren", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#w-naam").value.trim();
          if (!naam) { melding("Vul een naam in.", "fout"); return undefined; }
          return {
            naam,
            producent: laag.querySelector("#w-producent").value.trim(),
            kleur: laag.querySelector("[data-kleur].is-actief")?.dataset.kleur || w.kleur,
            land: laag.querySelector("#w-land").value,
            jaargang: laag.querySelector("#w-jaar").value ? Number(laag.querySelector("#w-jaar").value) : null,
            prijs: laag.querySelector("#w-prijs").value ? Number(laag.querySelector("#w-prijs").value) : null,
            winkel: laag.querySelector("#w-winkel").value.trim(),
            notitie: laag.querySelector("#w-notitie").value.trim(),
          };
        },
      },
    ],
    opOpenen: laag => {
      laag.querySelector("[data-kleuren]").addEventListener("click", e => {
        const knop = e.target.closest("[data-kleur]");
        if (!knop) return;
        laag.querySelectorAll("[data-kleur]").forEach(b => { b.classList.remove("is-actief"); b.style.cssText = ""; });
        knop.classList.add("is-actief");
        const k = kleurInfo(knop.dataset.kleur);
        knop.style.cssText = `background:${k.kleur};border-color:${k.kleur};color:${k.tekstOp}`;
      });
    },
  });

  if (!uitkomst) return;
  await bewaarWens({ ...w, ...uitkomst });
  melding(bestaand ? "Bijgewerkt" : "Op je wenslijst gezet", "goed");
}
