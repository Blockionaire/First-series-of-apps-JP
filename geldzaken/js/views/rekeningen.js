/* =====================================================================
   GELDZAKEN — rekeningen en vermogen
   =====================================================================
   Wat staat er waar, en hoe ontwikkelt dat zich? Het saldo van een
   rekening rekent de app uit: beginsaldo plus alles wat erop en eraf
   ging. Klopt dat niet meer met je bank, dan zet je het hier met één
   knop weer gelijk — dat verschil wordt een correctieboeking, zodat je
   later kunt terugzien wanneer dat gebeurde.
   ===================================================================== */

import { esc, geld, lijn, melding, bevestig, dialoog, leesBedrag,
         maandLabel, vandaagISO } from "../util.js";
import { state, legeRekening, bewaarRekening, wisRekening,
         legeTransactie, bewaarTransactie } from "../store.js";
import { rekeningenMetSaldo, vermogen, vermogenVerloop, rekeningSaldo } from "../bereken.js";
import { leeg } from "./onderdelen.js";
import { KLEUREN } from "../data/standaard.js";
import { eisBewerkrecht } from "../app.js";

export const titel = () => "Rekeningen";
export const ondertitel = () => "Wat staat er waar";
export const terugknop = true;

export const kopActies = () => `<button class="icoonknop" data-nieuw aria-label="Nieuwe rekening">＋</button>`;

const SOORTEN_REKENING = {
  betaal:   { label: "Betaalrekening", icoon: "💳" },
  spaar:    { label: "Spaarrekening",  icoon: "🏦" },
  beleggen: { label: "Beleggen",       icoon: "📈" },
  contant:  { label: "Contant",        icoon: "💵" },
  schuld:   { label: "Schuld of krediet", icoon: "📉" },
};

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const rekeningen = rekeningenMetSaldo(state);
  if (!rekeningen.length) {
    return `
      ${leeg({
        icoon: "🏦",
        titel: "Nog geen rekeningen",
        tekst: "Zet je betaalrekening en spaarrekening erin, dan houdt de app je vermogen vanzelf bij.",
      })}
      <button class="knop knop--primair knop--breed" data-nieuw>Rekening toevoegen</button>`;
  }

  const totaal = vermogen(state);
  const verloop = vermogenVerloop(state, 12);
  const eersteMaand = verloop[0];
  const groei = totaal - eersteMaand.waarde;

  return `
    <div class="hero" style="margin-bottom:14px">
      <div class="hero__label">Vermogen</div>
      <div class="hero__bedrag">${geld(totaal)}</div>
      <div class="hero__bij">
        ${groei >= 0 ? "▲" : "▼"} ${geld(Math.abs(groei))} sinds ${esc(maandLabel(eersteMaand.maand, { kort: true }))}
      </div>
      <div style="margin-top:14px">${lijn(verloop, { kleur: groei >= 0 ? "var(--accent)" : "var(--uitgave)" })}</div>
    </div>

    <div class="lijst">
      ${rekeningen.map(r => `
        <div class="rij">
          <span class="rij__icoon" style="background:color-mix(in srgb, ${esc(r.kleur || "#5b8dff")} 20%, var(--vlak-diep))">
            ${esc(SOORTEN_REKENING[r.soort]?.icoon || "💳")}
          </span>
          <span class="rij__midden" data-bewerk="${esc(r.id)}" style="cursor:pointer">
            <span class="rij__titel">${esc(r.naam)} ${r.standaard ? `<span class="label">standaard</span>` : ""}</span>
            <span class="rij__sub">
              ${esc(SOORTEN_REKENING[r.soort]?.label || "")}
              ${r.iban ? ` · ${esc(r.iban)}` : ""}
              ${r.telMee === false ? " · telt niet mee" : ""}
            </span>
          </span>
          <span class="rij__rechts">
            <span class="rij__bedrag ${r.saldo < 0 ? "af" : ""}">${geld(r.saldo)}</span>
          </span>
          <button class="icoonknop" data-bijwerken="${esc(r.id)}" aria-label="Saldo bijwerken">🔄</button>
        </div>`).join("")}
    </div>

    <button class="knop knop--primair knop--breed" data-nieuw style="margin-top:16px">Rekening toevoegen</button>

    <p class="veld__hint" style="margin-top:14px">
      Met 🔄 zet je het saldo gelijk met je bank. Het verschil wordt een correctieboeking,
      zodat je later ziet wanneer en hoeveel er is bijgesteld.
    </p>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  document.querySelector(".kop [data-nieuw]")?.addEventListener("click", () => bewerkRekening(null));

  wortel.addEventListener("click", async e => {
    if (e.target.closest("[data-nieuw]")) return bewerkRekening(null);

    const bewerk = e.target.closest("[data-bewerk]");
    if (bewerk) return bewerkRekening(state.rekeningen.find(r => r.id === bewerk.dataset.bewerk));

    const bij = e.target.closest("[data-bijwerken]");
    if (bij) return werkSaldoBij(state.rekeningen.find(r => r.id === bij.dataset.bijwerken));
  });
}

/* ---------------------------------------------------------------
   Saldo gelijkzetten met de bank
   --------------------------------------------------------------- */
async function werkSaldoBij(rekening) {
  if (!rekening || !eisBewerkrecht()) return;
  const berekend = rekeningSaldo(state, rekening.id);

  const nieuw = await dialoog({
    titel: `Saldo van ${rekening.naam}`,
    inhoud: `
      <p class="dialoog__vraag">Volgens de app staat er <strong>${geld(berekend)}</strong>. Wat zegt je bank?</p>
      <div class="veld">
        <label for="wsaldo">Werkelijk saldo</label>
        <input type="text" id="wsaldo" inputmode="decimal" value="${String(berekend).replace(".", ",")}">
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Gelijkzetten", soort: "primair",
        waardeUit: laag => {
          const waarde = leesBedrag(laag.querySelector("#wsaldo").value);
          return waarde == null ? undefined : waarde;
        },
      },
    ],
    opOpenen: laag => laag.querySelector("#wsaldo")?.select(),
  });

  if (nieuw == null) return;
  const verschil = nieuw - berekend;
  if (Math.abs(verschil) < 0.005) return melding("Het klopt al.", "goed");

  await bewaarTransactie(legeTransactie({
    datum: vandaagISO(),
    bedrag: Math.abs(verschil),
    soort: verschil > 0 ? "inkomst" : "uitgave",
    omschrijving: "Correctie saldo",
    categorie: verschil > 0 ? "cat-extra" : "cat-overig",
    rekening: rekening.id,
    notitie: `Bijgesteld van ${geld(berekend)} naar ${geld(nieuw)}.`,
  }));
  melding(`Saldo gelijkgezet (${geld(verschil, { teken: true })}).`, "goed");
}

/* ---------------------------------------------------------------
   Rekening toevoegen of aanpassen
   --------------------------------------------------------------- */
async function bewerkRekening(bestaand) {
  if (!eisBewerkrecht()) return;
  const r = bestaand ? { ...bestaand } : legeRekening();
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Nieuwe rekening" : r.naam,
    onderaan: true,
    inhoud: `
      <div class="veld">
        <label for="rnaam">Naam</label>
        <input type="text" id="rnaam" value="${esc(r.naam)}" placeholder="Betaalrekening, spaarpot…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="rsoort">Soort</label>
          <select id="rsoort">
            ${Object.entries(SOORTEN_REKENING).map(([id, s]) =>
              `<option value="${id}" ${r.soort === id ? "selected" : ""}>${esc(s.icoon)} ${esc(s.label)}</option>`).join("")}
          </select>
        </div>
        <div class="veld">
          <label for="rbegin">Beginsaldo</label>
          <input type="text" id="rbegin" inputmode="decimal" value="${String(r.beginsaldo ?? 0).replace(".", ",")}">
        </div>
      </div>
      <div class="veld">
        <label for="riban">IBAN of omschrijving</label>
        <input type="text" id="riban" value="${esc(r.iban || "")}" placeholder="optioneel">
      </div>
      <div class="veld">
        <span class="veld__label">Kleur</span>
        <div class="kleuren" id="rkleuren">
          ${KLEUREN.map(k => `<button type="button" data-kleur="${esc(k)}" style="background:${esc(k)}" aria-pressed="${k === r.kleur}" aria-label="Kleur"></button>`).join("")}
        </div>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Standaardrekening</span>
          <span class="schakelrij__uitleg">Deze staat vooringevuld bij een nieuwe boeking.</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" id="rstandaard" ${r.standaard ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Meetellen in je vermogen</span>
          <span class="schakelrij__uitleg">Zet uit voor bijvoorbeeld een zakelijke rekening.</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" id="rtelmee" ${r.telMee !== false ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
      ${nieuw ? "" : `<button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Rekening verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#rnaam").value.trim();
          if (!naam) { melding("Geef de rekening een naam.", "fout"); return undefined; }
          return {
            ...r,
            naam,
            soort: laag.querySelector("#rsoort").value,
            beginsaldo: leesBedrag(laag.querySelector("#rbegin").value) || 0,
            iban: laag.querySelector("#riban").value.trim(),
            kleur: laag.querySelector("[data-kleur][aria-pressed=true]")?.dataset.kleur || r.kleur,
            standaard: laag.querySelector("#rstandaard").checked,
            telMee: laag.querySelector("#rtelmee").checked,
          };
        },
      },
    ],
    opOpenen: (laag, sluit) => {
      laag.querySelector("#rkleuren")?.addEventListener("click", e => {
        const knop = e.target.closest("[data-kleur]");
        if (!knop) return;
        laag.querySelectorAll("[data-kleur]").forEach(k => k.setAttribute("aria-pressed", String(k === knop)));
      });

      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const aantal = state.transacties.filter(t => t.rekening === r.id || t.naarRekening === r.id).length;
        const zeker = await bevestig(
          aantal
            ? `Er hangen ${aantal} boekingen aan "${r.naam}". Die blijven staan, maar horen daarna bij geen rekening meer.`
            : `"${r.naam}" wordt verwijderd.`,
          { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisRekening(r.id);
        melding("Rekening verwijderd.");
        sluit(null);
      });

      if (nieuw) setTimeout(() => laag.querySelector("#rnaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarRekening(uitkomst);
  melding(nieuw ? "Rekening toegevoegd." : "Opgeslagen.", "goed");
}
