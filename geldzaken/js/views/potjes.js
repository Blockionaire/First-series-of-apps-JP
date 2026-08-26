/* =====================================================================
   GELDZAKEN — potjes
   =====================================================================
   Een potje is een envelop: elke maand gaat er automatisch een bedrag
   in, en als de auto naar de garage moet haal je het er weer uit. Het
   geld staat gewoon op je rekening — het potje is een afspraak met
   jezelf, geen aparte bankrekening.

   Daarom telt een uitgave uit een potje niet mee in de losse uitgaven
   van deze maand: dat geld had je in eerdere maanden al gereserveerd.
   ===================================================================== */

import { esc, geld, maandLabel, maandNu, melding, bevestig, dialoog,
         leesBedrag, voortgang, procent } from "../util.js";
import { state, legPotje, bewaarPotje, wisPotje, zetInstelling } from "../store.js";
import { potjesMetSaldo, potSaldo } from "../bereken.js";
import { transactieLijst, leeg, potKaart } from "./onderdelen.js";
import { POTJE_SUGGESTIES, ICONEN, KLEUREN } from "../data/standaard.js";
import { ga, terug, eisBewerkrecht } from "../app.js";

export const titel = params => params[0]
  ? (state.potjes.find(p => p.id === params[0])?.naam || "Potje")
  : "Potjes";

export const ondertitel = params => params[0] ? "" : "Geld met een bestemming";
export const terugknop = false;

export function kopActies(params) {
  if (params[0]) return `<button class="icoonknop" data-bewerk-potje aria-label="Potje aanpassen">✏️</button>`;
  return `<button class="icoonknop" data-nieuw aria-label="Nieuw potje">＋</button>`;
}

/* ---------------------------------------------------------------
   Overzicht
   --------------------------------------------------------------- */
export function html(params) {
  if (params[0]) return detail(params[0]);

  const potjes = potjesMetSaldo(state);
  const totaal = potjes.reduce((s, p) => s + p.saldo, 0);
  const perMaand = potjes.filter(p => p.actief !== false).reduce((s, p) => s + (Number(p.maandelijks) || 0), 0);

  if (!potjes.length) return startHulp();

  return `
    <div class="hero" style="margin-bottom:14px">
      <div class="hero__label">In je potjes</div>
      <div class="hero__bedrag">${geld(totaal)}</div>
      <div class="hero__bij">${perMaand > 0 ? `Er gaat ${geld(perMaand)} per maand in.` : "Je vult ze met de hand."}</div>
    </div>

    <div class="schakelrij" style="margin-bottom:10px">
      <span class="schakelrij__tekst">
        <span class="schakelrij__titel">Automatisch vullen</span>
        <span class="schakelrij__uitleg">Elke maand gaat het ingestelde bedrag vanzelf in elk potje.</span>
      </span>
      <label class="schakelaar">
        <input type="checkbox" data-automatisch ${state.instellingen.potjesAutomatisch !== false ? "checked" : ""}>
        <span class="schakelaar__spoor"></span>
      </label>
    </div>

    <div class="potraster">${potjes.map(potKaart).join("")}</div>

    <button class="knop knop--primair knop--breed" data-nieuw style="margin-top:16px">Nieuw potje</button>

    <div class="sectiekop"><h2>Spaardoelen</h2></div>
    <a class="kaart kaart--knop" href="#/doelen" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit">
      <span>
        <strong>🎯 Naar je spaardoelen</strong>
        <span class="dof" style="display:block;font-size:.8rem;margin-top:2px">Sparen met een streefbedrag en een datum</span>
      </span>
      <span class="dof">›</span>
    </a>`;
}

function startHulp() {
  return `
    ${leeg({
      icoon: "🫙",
      titel: "Nog geen potjes",
      tekst: "Potjes zijn enveloppen: elke maand gaat er een bedrag in, zodat een grote uitgave later geen verrassing meer is.",
    })}
    <div class="sectiekop"><h2>Zet er een paar klaar</h2></div>
    <div class="lijst">
      ${POTJE_SUGGESTIES.map((s, i) => `
        <button class="rij" data-suggestie="${i}">
          <span class="rij__icoon" style="background:color-mix(in srgb, ${s.kleur} 20%, var(--vlak-diep))">${esc(s.icoon)}</span>
          <span class="rij__midden">
            <span class="rij__titel">${esc(s.naam)}</span>
            <span class="rij__sub">voorstel: ${geld(s.maandelijks)} per maand</span>
          </span>
          <span class="rij__rechts dof">＋</span>
        </button>`).join("")}
    </div>
    <button class="knop knop--rand knop--breed" data-nieuw style="margin-top:14px">Zelf een potje maken</button>`;
}

/* ---------------------------------------------------------------
   Eén potje
   --------------------------------------------------------------- */
function detail(id) {
  const potje = state.potjes.find(p => p.id === id);
  if (!potje) return leeg({ icoon: "🤔", titel: "Dit potje bestaat niet meer" });

  const stand = potSaldo(state, potje);
  const mutaties = state.transacties
    .filter(t => t.potje === id)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  return `
    <div class="hero" style="margin-bottom:14px">
      <div class="hero__label">${esc(potje.icoon)} ${esc(potje.naam)}</div>
      <div class="hero__bedrag" style="color:${stand.saldo < 0 ? "var(--uitgave)" : "var(--tekst)"}">${geld(stand.saldo)}</div>
      <div class="hero__bij">
        ${potje.maandelijks > 0
          ? `${geld(potje.maandelijks)} per maand sinds ${esc(maandLabel(potje.startMaand || maandNu()))}`
          : "Dit potje vul je met de hand."}
      </div>
      ${potje.doelBedrag > 0 ? `
        ${voortgang(stand.saldo, potje.doelBedrag, { kleur: potje.kleur })}
        <div class="hero__bij" style="margin-top:8px">
          ${procent(stand.saldo, potje.doelBedrag)} van ${geld(potje.doelBedrag)}
        </div>` : ""}
    </div>

    <div class="knoprij knoprij--gelijk">
      <a class="knop" href="#/boeken/nieuw/sparen/${esc(id)}">Storten</a>
      <a class="knop" href="#/boeken/nieuw/opname/${esc(id)}">Opnemen</a>
      <a class="knop knop--primair" href="#/boeken/nieuw/uitgave/${esc(id)}">Uitgave</a>
    </div>

    <div class="cijferrij" style="margin-top:14px">
      <div class="cijfer">
        <div class="cijfer__waarde op">${geld(stand.automatisch)}</div>
        <div class="cijfer__label">Automatisch erin</div>
        <div class="cijfer__bij dof">${stand.maandenGevuld} ${stand.maandenGevuld === 1 ? "maand" : "maanden"}</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde op">${geld(stand.gestort)}</div>
        <div class="cijfer__label">Zelf gestort</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde af">${geld(stand.opgenomen)}</div>
        <div class="cijfer__label">Eruit gehaald</div>
      </div>
    </div>

    <div class="sectiekop"><h2>Wat er in en uit ging</h2></div>
    ${mutaties.length
      ? transactieLijst(mutaties, { groepeer: false })
      : leeg({ icoon: "🫙", titel: "Nog niets geboekt", tekst: "Het automatische maandbedrag hoef je niet te boeken; dat rekent de app zelf mee." })}

    <button class="knop knop--rand knop--breed" data-bewerk-potje style="margin-top:16px">Potje aanpassen</button>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel, params) {
  const kop = document.querySelector(".kop");

  kop?.querySelector("[data-nieuw]")?.addEventListener("click", () => bewerkPotje(null));
  kop?.querySelector("[data-bewerk-potje]")?.addEventListener("click", () =>
    bewerkPotje(state.potjes.find(p => p.id === params[0])));

  wortel.addEventListener("change", e => {
    if (e.target.matches("[data-automatisch]")) {
      zetInstelling({ potjesAutomatisch: e.target.checked });
    }
  });

  wortel.addEventListener("click", async e => {
    if (e.target.closest("[data-nieuw]")) return bewerkPotje(null);
    if (e.target.closest("[data-bewerk-potje]")) return bewerkPotje(state.potjes.find(p => p.id === params[0]));

    const pot = e.target.closest("[data-potje]");
    if (pot) return ga(`#/potjes/${pot.dataset.potje}`);

    const boeking = e.target.closest("[data-transactie]");
    if (boeking) return ga(`#/boeken/${boeking.dataset.transactie}`);

    const sug = e.target.closest("[data-suggestie]");
    if (sug) {
      if (!eisBewerkrecht()) return;
      const s = POTJE_SUGGESTIES[Number(sug.dataset.suggestie)];
      await bewaarPotje(legPotje({ ...s }));
      melding(`Potje ${s.naam} aangemaakt.`, "goed");
    }
  });
}

/* ---------------------------------------------------------------
   Potje toevoegen of aanpassen
   --------------------------------------------------------------- */
async function bewerkPotje(bestaand) {
  if (!eisBewerkrecht()) return;
  const p = bestaand ? { ...bestaand } : legPotje();
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Nieuw potje" : p.naam,
    onderaan: true,
    inhoud: `
      <div class="veld">
        <label for="knaam">Naam</label>
        <input type="text" id="knaam" value="${esc(p.naam)}" placeholder="Vakantie, auto, kleding…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="kmaand">Per maand</label>
          <input type="text" id="kmaand" inputmode="decimal" value="${p.maandelijks ? String(p.maandelijks).replace(".", ",") : ""}" placeholder="0,00">
        </div>
        <div class="veld">
          <label for="kdoel">Streefbedrag</label>
          <input type="text" id="kdoel" inputmode="decimal" value="${p.doelBedrag ? String(p.doelBedrag).replace(".", ",") : ""}" placeholder="optioneel">
        </div>
      </div>
      <div class="veld">
        <label for="kstart">Vullen vanaf</label>
        <input type="month" id="kstart" value="${esc(p.startMaand || maandNu())}">
        <div class="veld__hint">Vanaf deze maand telt de app het maandbedrag mee. Had je al iets gespaard? Zet dan een storting op de datum waarop dat begon.</div>
      </div>
      <div class="veld">
        <span class="veld__label">Icoon</span>
        <div class="iconenraster" id="kiconen">
          ${ICONEN.map(i => `<button type="button" data-icoon="${esc(i)}" aria-pressed="${i === p.icoon}">${esc(i)}</button>`).join("")}
        </div>
      </div>
      <div class="veld">
        <span class="veld__label">Kleur</span>
        <div class="kleuren" id="kkleuren">
          ${KLEUREN.map(k => `<button type="button" data-kleur="${esc(k)}" style="background:${esc(k)}" aria-pressed="${k === p.kleur}" aria-label="Kleur"></button>`).join("")}
        </div>
      </div>
      ${nieuw ? "" : `
        <div class="schakelrij">
          <span class="schakelrij__tekst">
            <span class="schakelrij__titel">Actief</span>
            <span class="schakelrij__uitleg">Uit betekent: geen automatische storting meer.</span>
          </span>
          <label class="schakelaar">
            <input type="checkbox" id="kactief" ${p.actief !== false ? "checked" : ""}>
            <span class="schakelaar__spoor"></span>
          </label>
        </div>
        <button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Potje verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#knaam").value.trim();
          if (!naam) { melding("Geef het potje een naam.", "fout"); return undefined; }
          return {
            ...p,
            naam,
            maandelijks: leesBedrag(laag.querySelector("#kmaand").value) || 0,
            doelBedrag: leesBedrag(laag.querySelector("#kdoel").value),
            startMaand: laag.querySelector("#kstart").value || maandNu(),
            icoon: laag.querySelector("[data-icoon][aria-pressed=true]")?.dataset.icoon || p.icoon,
            kleur: laag.querySelector("[data-kleur][aria-pressed=true]")?.dataset.kleur || p.kleur,
            actief: laag.querySelector("#kactief")?.checked ?? true,
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
      kiezer("#kiconen", "data-icoon");
      kiezer("#kkleuren", "data-kleur");

      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const zeker = await bevestig(
          `"${p.naam}" wordt verwijderd. Boekingen die eraan hangen blijven staan, maar zijn dan niet meer aan een potje gekoppeld.`,
          { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisPotje(p.id);
        melding("Potje verwijderd.");
        sluit(null);
        terug("#/potjes");
      });

      if (nieuw) setTimeout(() => laag.querySelector("#knaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarPotje(uitkomst);
  melding(nieuw ? "Potje aangemaakt." : "Opgeslagen.", "goed");
}
