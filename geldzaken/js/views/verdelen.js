/* =====================================================================
   GELDZAKEN — je inkomen verdelen
   =====================================================================
   Het scherm waar je maand begint: er komt een bedrag binnen, en dat
   deel je op in potjes. Bovenaan staat altijd wat er nog te verdelen
   is, en dat telt live mee terwijl je typt — je hoeft dus nooit zelf
   te rekenen of het uitkomt.

   Alles wat je hier invult is een maandbedrag. Verder niets: geen
   datums, geen boekingen. Dat is precies de bedoeling.
   ===================================================================== */

import { esc, geld, procent, maandLabel, melding, dialoog, leesBedrag } from "../util.js";
import { state, legPotje, bewaarPotje, meld } from "../store.js";
import { verdeling, POTSOORTEN, potSoort, heeftSubpotjes, subpotjesVan } from "../bereken.js";
import { leeg } from "./onderdelen.js";
import { raadIcoon } from "../data/standaard.js";
import { ga, eisBewerkrecht } from "../app.js";

export const titel = () => "Verdelen";
export const ondertitel = () => maandLabel(state.maand);
export const terugknop = true;
export const terugNaar = "#/start";

const GROEPEN = ["vast", "vrij", "sparen"];

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const v = verdeling(state, state.maand);

  return `
    <div class="verdeelkop" id="verdeelkop">
      <div class="verdeelkop__deel">
        <span class="verdeelkop__label">Inkomen</span>
        <span class="verdeelkop__waarde">${geld(v.inkomen)}</span>
      </div>
      <div class="verdeelkop__deel">
        <span class="verdeelkop__label">Verdeeld</span>
        <span class="verdeelkop__waarde" id="verdeeld">${geld(v.verdeeld)}</span>
      </div>
      <div class="verdeelkop__deel">
        <span class="verdeelkop__label">Over</span>
        <span class="verdeelkop__waarde ${v.over < 0 ? "af" : v.over > 0 ? "op" : "dof"}" id="over">${geld(v.over)}</span>
      </div>
    </div>

    ${!v.inkomen ? `
      <div class="signaal signaal--let-op">
        <span class="signaal__icoon">💼</span>
        <span>
          <span class="signaal__titel">Er staat nog geen inkomen</span>
          <span class="signaal__tekst">Zet eerst je salaris erin, dan kan de app meerekenen.</span>
        </span>
      </div>
      <a class="knop knop--breed" href="#/inkomen" style="margin-bottom:14px">Inkomen instellen</a>` : ""}

    ${GROEPEN.map(groep).join("")}

    ${state.potjes.length && v.over > 0.5 ? `
      <button class="knop knop--rand knop--breed" data-restant style="margin-top:6px">
        Zet de laatste ${geld(v.over)} in een potje
      </button>` : ""}

    <p class="veld__hint" style="margin-top:16px">
      Een potje voor de hypotheek hoef je nooit meer aan te raken: dat bedrag gaat er elke
      maand af en telt gewoon mee in de taart. Alleen bij spaarpotjes houdt de app een
      saldo bij.
    </p>`;
}

function groep(soort) {
  const info = POTSOORTEN[soort];
  const potjes = state.potjes
    .filter(p => p.actief !== false && potSoort(p) === soort)
    .sort((a, b) => (Number(b.maandelijks) || 0) - (Number(a.maandelijks) || 0) || a.naam.localeCompare(b.naam));

  return `
    <div class="sectiekop">
      <h2><span style="color:${info.kleur}">●</span> ${esc(info.meervoud)}</h2>
      <button class="sectiekop__actie" data-nieuw="${soort}">＋ Potje</button>
    </div>
    <div class="veld__hint" style="margin:-4px 2px 8px">${esc(info.uitleg)}</div>

    ${potjes.length ? `
      <div class="lijst">
        ${potjes.map(p => `
          <div class="verdeelrij">
            <button class="verdeelrij__icoon" data-open="${esc(p.id)}"
                    style="background:color-mix(in srgb, ${esc(p.kleur || info.kleur)} 20%, var(--vlak-diep))"
                    aria-label="${esc(p.naam)} openen">${esc(p.icoon || info.icoon)}</button>
            <label class="verdeelrij__naam" for="pot-${esc(p.id)}">
              ${esc(p.naam)}
              <span class="verdeelrij__deel dof" data-deel="${esc(p.id)}"></span>
            </label>
            ${heeftSubpotjes(p) ? `
              <button class="verdeelrij__vast" data-open="${esc(p.id)}"
                      title="Opgebouwd uit ${subpotjesVan(p).length} onderdelen">
                ${geld(p.maandelijks)} <span class="dof">▦</span>
              </button>` : `
              <span class="verdeelrij__invoer">
                <span class="dof">€</span>
                <input type="text" inputmode="decimal" id="pot-${esc(p.id)}" data-bedrag="${esc(p.id)}"
                       value="${p.maandelijks ? String(p.maandelijks).replace(".", ",") : ""}" placeholder="0">
              </span>`}
          </div>`).join("")}
      </div>` : `
      <div class="kaart" style="padding:14px">
        <p style="margin:0;font-size:.86rem;color:var(--tekst-dof)">
          Nog geen potjes hier. ${soort === "vast"
            ? "Denk aan hypotheek of huur, energie, verzekeringen."
            : soort === "vrij"
              ? "Denk aan boodschappen, uitgaan, kleding."
              : "Denk aan vakantie, een buffer, groot onderhoud."}
        </p>
      </div>`}`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  /* Terwijl je typt tellen we live mee. Het scherm hertekenen we niet:
     dan zou je halverwege een bedrag je invoerveld kwijt zijn. */
  const hertel = () => {
    const v = verdeling(state, state.maand);
    const bedragen = new Map();

    wortel.querySelectorAll("[data-bedrag]").forEach(veld => {
      bedragen.set(veld.dataset.bedrag, leesBedrag(veld.value) || 0);
    });
    /* Potjes die uit onderdelen bestaan hebben hier geen invoerveld;
       hun bedrag staat vast en komt uit de opgeslagen som. */
    state.potjes.filter(p => p.actief !== false && heeftSubpotjes(p))
      .forEach(p => bedragen.set(p.id, Number(p.maandelijks) || 0));

    let verdeeld = [...bedragen.values()].reduce((s, b) => s + b, 0);
    /* Los ingevoerde vaste lasten tellen ook mee in de taart. */
    verdeeld += v.posten.filter(p => !p.potje).reduce((s, p) => s + p.bedrag, 0);

    const over = v.inkomen - verdeeld;
    wortel.querySelector("#verdeeld").textContent = geld(verdeeld);
    const overVeld = wortel.querySelector("#over");
    overVeld.textContent = geld(over);
    overVeld.className = `verdeelkop__waarde ${over < 0 ? "af" : over > 0 ? "op" : "dof"}`;

    for (const [id, bedrag] of bedragen) {
      const deel = wortel.querySelector(`[data-deel="${id}"]`);
      if (deel) deel.textContent = v.inkomen > 0 && bedrag > 0 ? procent(bedrag, v.inkomen) : "";
    }
  };

  hertel();
  wortel.addEventListener("input", e => {
    if (e.target.matches("[data-bedrag]")) hertel();
  });

  /* Pas als je het veld verlaat slaan we het op. */
  wortel.addEventListener("change", async e => {
    const veld = e.target.closest("[data-bedrag]");
    if (!veld) return;
    if (!eisBewerkrecht()) return;
    const potje = state.potjes.find(p => p.id === veld.dataset.bedrag);
    if (!potje) return;
    const bedrag = leesBedrag(veld.value) || 0;
    if (bedrag === (Number(potje.maandelijks) || 0)) return;
    await bewaarPotje({ ...potje, maandelijks: bedrag });
  });

  wortel.addEventListener("click", async e => {
    const open = e.target.closest("[data-open]");
    if (open) return ga(`#/potjes/${open.dataset.open}`);

    const nieuw = e.target.closest("[data-nieuw]");
    if (nieuw) return nieuwPotje(nieuw.dataset.nieuw);

    if (e.target.closest("[data-restant]")) return restantToewijzen();
  });
}

/* ---------------------------------------------------------------
   Snel een potje erbij
   --------------------------------------------------------------- */
async function nieuwPotje(soort) {
  if (!eisBewerkrecht()) return;
  const info = POTSOORTEN[soort];

  const uitkomst = await dialoog({
    titel: `Nieuw potje · ${info.label.toLowerCase()}`,
    onderaan: true,
    inhoud: `
      <p class="veld__hint" style="margin-bottom:12px">${esc(info.uitleg)}</p>
      <div class="veld">
        <label for="nnaam">Waarvoor is het?</label>
        <input type="text" id="nnaam" placeholder="${soort === "vast" ? "Hypotheek, energie…" : soort === "vrij" ? "Boodschappen, uitgaan…" : "Vakantie, buffer…"}">
      </div>
      <div class="veld">
        <label for="nbedrag">Hoeveel per maand</label>
        <input type="text" id="nbedrag" inputmode="decimal" placeholder="0,00">
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Toevoegen", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#nnaam").value.trim();
          if (!naam) { melding("Geef het potje een naam.", "fout"); return undefined; }
          return { naam, bedrag: leesBedrag(laag.querySelector("#nbedrag").value) || 0 };
        },
      },
    ],
    opOpenen: laag => setTimeout(() => laag.querySelector("#nnaam")?.focus(), 60),
  });

  if (!uitkomst) return;
  await bewaarPotje(legPotje({
    naam: uitkomst.naam,
    soort,
    maandelijks: uitkomst.bedrag,
    icoon: raadIcoon(uitkomst.naam, info.icoon),
    kleur: soort === "vast" ? "#5b8dff" : soort === "vrij" ? "#f5a524" : "#3ddc97",
  }));
  melding("Potje toegevoegd.", "goed");
}

/* Het laatste restant in één keer ergens in zetten. */
async function restantToewijzen() {
  if (!eisBewerkrecht()) return;
  const v = verdeling(state, state.maand);
  if (v.over <= 0) return;

  /* Potjes die uit onderdelen bestaan slaan we over: hun maandbedrag is
     de som van die onderdelen, dus daar hoort dit bedrag bij één van de
     onderdelen thuis — dat doe je bij het potje zelf. */
  const kandidaten = state.potjes.filter(p => p.actief !== false && !heeftSubpotjes(p));
  if (!kandidaten.length) {
    return melding("Al je potjes bestaan uit onderdelen. Zet het restant bij één van die onderdelen.", "fout");
  }

  const keuze = await dialoog({
    titel: `${geld(v.over)} toewijzen`,
    inhoud: `
      <p class="dialoog__vraag">In welk potje gaat het restant?</p>
      <div class="lijst">
        ${kandidaten.map(p => `
          <button class="rij" data-kies="${esc(p.id)}">
            <span class="rij__icoon">${esc(p.icoon || "🫙")}</span>
            <span class="rij__midden">
              <span class="rij__titel">${esc(p.naam)}</span>
              <span class="rij__sub">nu ${geld(p.maandelijks || 0)} · wordt ${geld((Number(p.maandelijks) || 0) + v.over)}</span>
            </span>
          </button>`).join("")}
      </div>`,
    knoppen: [{ label: "Annuleren", waarde: null }],
    opOpenen: (laag, sluit) => {
      laag.addEventListener("click", e => {
        const kies = e.target.closest("[data-kies]");
        if (kies) sluit(kies.dataset.kies);
      });
    },
  });

  if (!keuze) return;
  const potje = state.potjes.find(p => p.id === keuze);
  await bewaarPotje({ ...potje, maandelijks: (Number(potje.maandelijks) || 0) + v.over });
  melding("Restant verdeeld.", "goed");
}
