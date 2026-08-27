/* =====================================================================
   GELDZAKEN — inkomen
   =====================================================================
   Wat komt er binnen, en hoe vaak. Meestal is dat één salaris, soms
   twee plus wat toeslagen. Je zet het hier één keer neer en de app
   rekent er daarna elke maand mee.

   Valt er iets buiten het vaste patroon — een bonus, een teruggave —
   dan boek je dat los. Dat telt automatisch mee in de maand waarin het
   binnenkwam.
   ===================================================================== */

import { esc, geld, maandLabel, maandNu, maandPlus, datumNL, melding,
         bevestig, dialoog, leesBedrag } from "../util.js";
import { state, legePost, bewaarPost, wisPost, meld } from "../store.js";
import { vasteLastenVanMaand, perMaand, RITMES, maandOverzicht } from "../bereken.js";
import { maandkiezer, koppelMaandkiezer, leeg } from "./onderdelen.js";
import { ga, eisBewerkrecht } from "../app.js";

export const titel = () => "Inkomen";
export const ondertitel = () => maandLabel(state.maand);
export const terugknop = true;
export const terugNaar = "#/start";

export const kopActies = () => `<button class="icoonknop" data-nieuw aria-label="Inkomstenbron toevoegen">＋</button>`;

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const bronnen = state.terugkerend.filter(p => p.soort === "inkomst");
  const o = maandOverzicht(state, state.maand);
  const dezeMaand = vasteLastenVanMaand(state, state.maand).filter(p => p.soort === "inkomst");
  const extra = o.transacties.filter(t => t.soort === "inkomst" && !t.terugkerendId);
  const totaal = o.inkomsten + o.verwachtErin;

  return `
    <div style="display:flex;justify-content:center;margin-bottom:14px">
      ${maandkiezer(state.maand, { maxMaand: maandPlus(maandNu(), 12) })}
    </div>

    <section class="hero" style="margin-bottom:14px">
      <div class="hero__label">Inkomen deze maand</div>
      <div class="hero__bedrag">${geld(totaal)}</div>
      <div class="hero__bij">
        ${bronnen.length
          ? `${bronnen.length} vaste ${bronnen.length === 1 ? "bron" : "bronnen"}${extra.length ? ` · ${extra.length} keer extra` : ""}`
          : "Nog geen vaste inkomsten ingesteld."}
      </div>
    </section>

    ${bronnen.length ? `
      <div class="sectiekop"><h2>Vast inkomen</h2></div>
      <div class="lijst">
        ${dezeMaand.map(p => rij(p.post, p)).join("")}
        ${bronnen.filter(b => !dezeMaand.some(d => d.id === b.id)).map(b => rij(b, null)).join("")}
      </div>` : leeg({
        icoon: "💼",
        titel: "Nog geen inkomen",
        tekst: "Zet je salaris erin — en eventueel toeslagen of het inkomen van je partner. Daarna kun je verdelen.",
      })}

    <button class="knop knop--primair knop--breed" data-nieuw style="margin-top:14px">
      ${bronnen.length ? "Nog een inkomstenbron" : "Inkomen toevoegen"}
    </button>

    <div class="sectiekop">
      <h2>Extra binnengekomen</h2>
      <a class="sectiekop__actie" href="#/boeken/nieuw/inkomst">＋ Boeken</a>
    </div>
    ${extra.length ? `
      <div class="lijst">
        ${extra.map(t => `
          <button class="rij" data-transactie="${esc(t.id)}">
            <span class="rij__icoon">💶</span>
            <span class="rij__midden">
              <span class="rij__titel">${esc(t.omschrijving || "Inkomst")}</span>
              <span class="rij__sub">${esc(datumNL(t.datum, { kort: true, metJaar: false }))}</span>
            </span>
            <span class="rij__rechts"><span class="rij__bedrag op">+${geld(t.bedrag)}</span></span>
          </button>`).join("")}
      </div>` : `
      <div class="kaart" style="padding:14px">
        <p style="margin:0;font-size:.86rem;color:var(--tekst-dof)">
          Een bonus, een teruggave of een cadeau boek je hier los. Het telt dan mee in deze maand.
        </p>
      </div>`}`;
}

function rij(bron, stand) {
  const ritme = RITMES[bron.ritme]?.label || "per maand";
  return `
    <button class="rij" data-bewerk="${esc(bron.id)}">
      <span class="rij__icoon" style="background:color-mix(in srgb, var(--inkomst) 18%, var(--vlak-diep))">💼</span>
      <span class="rij__midden">
        <span class="rij__titel">${esc(bron.naam)} ${bron.actief === false ? `<span class="label">uit</span>` : ""}</span>
        <span class="rij__sub">
          ${esc(ritme)}${bron.ritme !== "maand" ? ` · ${geld(perMaand(bron))} per maand` : ""}
          ${stand ? (stand.betaald ? " · binnen" : ` · rond de ${esc(String(bron.dag || 1))}e`) : " · niet in deze maand"}
        </span>
      </span>
      <span class="rij__rechts">
        <span class="rij__bedrag op">${geld(bron.bedrag)}</span>
        ${stand && stand.betaald ? `<span class="rij__bij">✓</span>` : ""}
      </span>
    </button>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  koppelMaandkiezer(wortel, stap => { state.maand = maandPlus(state.maand, stap); meld(); });
  document.querySelector(".kop [data-nieuw]")?.addEventListener("click", () => bewerkBron(null));

  wortel.addEventListener("click", e => {
    if (e.target.closest("[data-nieuw]")) return bewerkBron(null);

    const bewerk = e.target.closest("[data-bewerk]");
    if (bewerk) return bewerkBron(state.terugkerend.find(p => p.id === bewerk.dataset.bewerk));

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) return ga(`#/boeken/${boeking.dataset.transactie}`);
  });
}

/* ---------------------------------------------------------------
   Bron toevoegen of aanpassen
   --------------------------------------------------------------- */
async function bewerkBron(bestaand) {
  if (!eisBewerkrecht()) return;
  const p = bestaand ? { ...bestaand } : legePost({ soort: "inkomst", categorie: "cat-salaris", dag: 24 });
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Inkomen toevoegen" : p.naam,
    onderaan: true,
    inhoud: `
      <div class="veld">
        <label for="inaam">Waar komt het vandaan?</label>
        <input type="text" id="inaam" value="${esc(p.naam)}" placeholder="Salaris, toeslagen, partner…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="ibedrag">Bedrag</label>
          <input type="text" id="ibedrag" inputmode="decimal" value="${p.bedrag ? String(p.bedrag).replace(".", ",") : ""}" placeholder="0,00">
        </div>
        <div class="veld">
          <label for="iritme">Hoe vaak</label>
          <select id="iritme">
            ${Object.entries(RITMES).map(([id, r]) =>
              `<option value="${id}" ${p.ritme === id ? "selected" : ""}>${esc(r.label)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="veld">
        <label for="idag">Rond welke dag komt het binnen</label>
        <input type="number" id="idag" min="1" max="31" value="${Number(p.dag) || 24}">
        <div class="veld__hint">Alleen om te weten wanneer je het kunt verwachten.</div>
      </div>
      ${nieuw ? "" : `
        <div class="schakelrij">
          <span class="schakelrij__tekst">
            <span class="schakelrij__titel">Actief</span>
            <span class="schakelrij__uitleg">Zet uit als deze inkomsten gestopt zijn.</span>
          </span>
          <label class="schakelaar">
            <input type="checkbox" id="iactief" ${p.actief !== false ? "checked" : ""}>
            <span class="schakelaar__spoor"></span>
          </label>
        </div>
        <button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#inaam").value.trim();
          const bedrag = leesBedrag(laag.querySelector("#ibedrag").value);
          if (!naam) { melding("Geef de bron een naam.", "fout"); return undefined; }
          if (!bedrag) { melding("Vul een bedrag in.", "fout"); return undefined; }
          return {
            ...p,
            naam, bedrag,
            soort: "inkomst",
            categorie: p.categorie || "cat-salaris",
            ritme: laag.querySelector("#iritme").value,
            dag: Math.min(31, Math.max(1, Number(laag.querySelector("#idag").value) || 1)),
            actief: laag.querySelector("#iactief")?.checked ?? true,
          };
        },
      },
    ],
    opOpenen: (laag, sluit) => {
      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const zeker = await bevestig(`"${p.naam}" verdwijnt uit je inkomsten.`, { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisPost(p.id);
        melding("Verwijderd.");
        sluit(null);
      });
      if (nieuw) setTimeout(() => laag.querySelector("#inaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarPost(uitkomst);
  melding(nieuw ? "Inkomen toegevoegd." : "Opgeslagen.", "goed");
}
