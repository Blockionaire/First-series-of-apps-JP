/* =====================================================================
   WIJNKELDER — instellingen
   =====================================================================
   Account en synchronisatie, thema en valuta, en de knoppen waarmee je
   je kelder in of uit een bestand haalt.
   ===================================================================== */

import {
  state, Sync, bewaarInstellingen, totalen, exporteer, importeer,
  wisAlles, duwLokaalOmhoog,
} from "../store.js";
import {
  esc, getal, dialoog, melding, bevestig,
  downloadTekst, kiesBestand, leesTekst,
} from "../util.js";
import { syncRegel } from "./onderdelen.js";
import { pasThemaToe, ga } from "../app.js";

export const titel = () => "Instellingen";
export const terugknop = true;
export const ondertitel = () => "Account, weergave en back-up";

const VALUTAS = [
  { id: "EUR", naam: "Euro (€)" },
  { id: "GBP", naam: "Brits pond (£)" },
  { id: "USD", naam: "Amerikaanse dollar ($)" },
  { id: "CHF", naam: "Zwitserse frank (CHF)" },
];

const THEMAS = [
  { id: "auto",   naam: "Volg mijn telefoon" },
  { id: "donker", naam: "Altijd donker" },
  { id: "licht",  naam: "Altijd licht" },
];

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
export function html() {
  return `
    ${accountKaart()}
    ${weergaveKaart()}
    ${backupKaart()}
    ${overKaart()}
    ${gevarenzone()}`;
}

/* ---------------------------------------------------------------
   Account en synchronisatie
   --------------------------------------------------------------- */
function accountKaart() {
  const s = Sync.sync;

  if (!s.beschikbaar) {
    return `
      <div class="sectiekop"><h2>Synchronisatie</h2></div>
      <div class="kaart">
        ${syncRegel(s)}
        <p class="metaregel" style="margin:8px 0 0">
          Er staat nog geen Firebase-configuratie in <code>firebase-config.js</code>. De app werkt
          volledig, maar je kelder staat alleen op dit apparaat. In de README staat in vijf stappen
          hoe je synchronisatie aanzet.
        </p>
      </div>`;
  }

  if (s.actief) {
    return `
      <div class="sectiekop"><h2>Account</h2></div>
      <div class="kaart">
        ${syncRegel(s)}
        <div class="schakelrij" style="border-bottom:0;padding-bottom:4px">
          <span class="schakelrij__tekst">
            <span class="schakelrij__titel">${esc(s.gebruiker.email)}</span>
            <span class="schakelrij__uitleg">Je kelder staat op al je apparaten</span>
          </span>
        </div>
        <div class="knoprij knoprij--gelijk" style="margin-top:10px">
          <button class="knop knop--klein" data-duw>Alles opnieuw uploaden</button>
          <button class="knop knop--klein" data-uitloggen>Uitloggen</button>
        </div>
      </div>`;
  }

  return `
    <div class="sectiekop"><h2>Synchroniseren</h2></div>
    <div class="kaart">
      ${syncRegel(s)}
      <p class="metaregel" style="margin:8px 0 12px">
        Log in met een e-mailadres en je kelder staat op al je apparaten. Zonder account werkt
        alles gewoon, maar dan alleen hier.
      </p>
      <div class="knoprij knoprij--gelijk">
        <button class="knop knop--primair" data-inloggen>Inloggen</button>
        <button class="knop" data-registreren>Account maken</button>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Weergave
   --------------------------------------------------------------- */
function weergaveKaart() {
  const i = state.instellingen;
  return `
    <div class="sectiekop"><h2>Weergave</h2></div>
    <div class="kaart">
      <div class="veld" style="margin-bottom:11px">
        <label for="i-thema">Thema</label>
        <select id="i-thema">
          ${THEMAS.map(t => `<option value="${t.id}" ${i.thema === t.id ? "selected" : ""}>${esc(t.naam)}</option>`).join("")}
        </select>
      </div>
      <div class="veld" style="margin-bottom:0">
        <label for="i-valuta">Valuta</label>
        <select id="i-valuta">
          ${VALUTAS.map(v => `<option value="${v.id}" ${i.valuta === v.id ? "selected" : ""}>${esc(v.naam)}</option>`).join("")}
        </select>
        <p class="veld__hint">Alleen de weergave verandert — bedragen worden niet omgerekend.</p>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Back-up
   --------------------------------------------------------------- */
function backupKaart() {
  const t = totalen();
  return `
    <div class="sectiekop"><h2>Back-up</h2></div>
    <div class="kaart">
      <p class="metaregel" style="margin:0 0 11px">
        ${getal(t.aantalWijnen)} wijnen · ${getal(state.notities.length)} proefnotities ·
        ${getal(state.historie.length)} logregels · ${getal(state.wenslijst.length)} wensen.
        Een back-up is één JSON-bestand met alles erin, inclusief de etiketfoto's.
      </p>
      <div class="knoprij knoprij--gelijk">
        <button class="knop" data-export>⬇ Back-up opslaan</button>
        <button class="knop" data-import>⬆ Back-up inlezen</button>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Over
   --------------------------------------------------------------- */
function overKaart() {
  return `
    <div class="sectiekop"><h2>Over deze app</h2></div>
    <div class="kaart" style="padding:2px 14px">
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Op je beginscherm zetten</span>
          <span class="schakelrij__uitleg">Deelknop → "Zet op beginscherm". Dan opent hij zonder browserbalk.</span>
        </span>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Rijpingsvensters zijn schattingen</span>
          <span class="schakelrij__uitleg">Gebaseerd op regio, druiven en prijs. Weet jij het beter, vul dan
            op de wijnfiche je eigen venster in — dat wint altijd.</span>
        </span>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Waardes vul je zelf in</span>
          <span class="schakelrij__uitleg">De app haalt geen marktprijzen op. Wat je invult is wat je ziet.</span>
        </span>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Gevarenzone
   --------------------------------------------------------------- */
function gevarenzone() {
  return `
    <div class="sectiekop"><h2>Opnieuw beginnen</h2></div>
    <div class="kaart">
      <p class="metaregel" style="margin:0 0 11px">
        Hiermee wis je alle flessen, notities, historie en wensen. Maak eerst een back-up —
        dit kan niet ongedaan gemaakt worden.
      </p>
      <button class="knop knop--breed" data-wis-alles style="color:var(--fout);border-color:var(--fout)">
        Alles wissen</button>
    </div>`;
}

/* =====================================================================
   Interactie
   ===================================================================== */
export function koppel(wortel) {
  wortel.querySelector("#i-thema")?.addEventListener("change", e => {
    pasThemaToe(e.target.value);
    bewaarInstellingen({ thema: e.target.value });
  });

  wortel.querySelector("#i-valuta")?.addEventListener("change", e => {
    bewaarInstellingen({ valuta: e.target.value });
  });

  wortel.addEventListener("click", async e => {
    if (e.target.closest("[data-inloggen]"))    return accountDialoog("inloggen");
    if (e.target.closest("[data-registreren]")) return accountDialoog("registreren");

    if (e.target.closest("[data-uitloggen]")) {
      const zeker = await bevestig(
        "Je kelder blijft op dit apparaat staan. Inloggen kan altijd weer.",
        { titel: "Uitloggen?", bevestigLabel: "Uitloggen" });
      if (zeker) { await Sync.uitloggen(); melding("Uitgelogd"); }
      return;
    }

    if (e.target.closest("[data-duw]")) {
      melding("Bezig met uploaden…");
      await duwLokaalOmhoog();
      melding("Alles staat in de cloud", "goed");
      return;
    }

    if (e.target.closest("[data-export]")) {
      const datum = new Date().toISOString().slice(0, 10);
      downloadTekst(`wijnkelder-backup-${datum}.json`, exporteer());
      melding("Back-up gedownload", "goed");
      return;
    }

    if (e.target.closest("[data-import]")) return importDialoog();

    if (e.target.closest("[data-wis-alles]")) {
      const zeker = await bevestig(
        `Alle ${getal(state.flessen.length)} wijnen, ${getal(state.notities.length)} notities en je hele historie worden gewist. Dit kan niet ongedaan gemaakt worden.`,
        { titel: "Alles wissen?", bevestigLabel: "Ja, alles wissen", gevaar: true });
      if (!zeker) return;

      const nogEens = await bevestig("Echt zeker? Maak eerst een back-up als je twijfelt.",
        { titel: "Laatste kans", bevestigLabel: "Wissen", gevaar: true });
      if (!nogEens) return;

      await wisAlles();
      melding("Alles gewist");
      ga("#/start");
    }
  });
}

/* ---------------------------------------------------------------
   Inloggen en registreren
   --------------------------------------------------------------- */
async function accountDialoog(modus) {
  const registreren = modus === "registreren";

  const uitkomst = await dialoog({
    titel: registreren ? "Account maken" : "Inloggen",
    inhoud: `
      <div class="veld">
        <label for="a-email">E-mailadres</label>
        <input type="email" id="a-email" autocomplete="email" inputmode="email" placeholder="jij@voorbeeld.nl">
      </div>
      <div class="veld">
        <label for="a-wachtwoord">Wachtwoord</label>
        <input type="password" id="a-wachtwoord"
               autocomplete="${registreren ? "new-password" : "current-password"}"
               placeholder="${registreren ? "Minstens 6 tekens" : ""}">
      </div>
      ${registreren ? `
        <p class="metaregel">Je e-mailadres wordt alleen gebruikt om je kelder aan te koppelen.
          Er komt geen nieuwsbrief.</p>
      ` : `
        <button type="button" class="knop knop--klein knop--stil" data-vergeten style="padding-left:0">
          Wachtwoord vergeten?</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: registreren ? "Account maken" : "Inloggen", soort: "primair",
        waardeUit: laag => {
          const email = laag.querySelector("#a-email").value.trim();
          const wachtwoord = laag.querySelector("#a-wachtwoord").value;
          if (!email || !wachtwoord) { melding("Vul allebei de velden in.", "fout"); return undefined; }
          return { email, wachtwoord };
        },
      },
    ],
    opOpenen: laag => {
      laag.querySelector("[data-vergeten]")?.addEventListener("click", async () => {
        const email = laag.querySelector("#a-email").value.trim();
        if (!email) return melding("Vul eerst je e-mailadres in.", "fout");
        try {
          await Sync.wachtwoordVergeten(email);
          melding("Kijk in je mailbox voor de herstelmail.", "goed");
        } catch (err) {
          melding(Sync.foutTekst(err), "fout");
        }
      });
    },
  });

  if (!uitkomst) return;

  try {
    /* Had je al een kelder op dit apparaat? Dan gaat die na het
       registreren meteen mee omhoog, anders sta je met lege handen. */
    const hadAlIets = state.flessen.length > 0;

    if (registreren) await Sync.registreren(uitkomst.email, uitkomst.wachtwoord);
    else await Sync.inloggen(uitkomst.email, uitkomst.wachtwoord);

    melding(registreren ? "Account aangemaakt" : "Ingelogd", "goed");

    if (hadAlIets) {
      /* Even wachten tot de verbinding staat, dan pas uploaden. */
      setTimeout(async () => {
        await duwLokaalOmhoog();
        melding("Je kelder staat nu ook in de cloud", "goed");
      }, 1200);
    }
  } catch (err) {
    melding(Sync.foutTekst(err), "fout");
  }
}

/* ---------------------------------------------------------------
   Back-up inlezen
   --------------------------------------------------------------- */
async function importDialoog() {
  const bestand = await kiesBestand("application/json,.json");
  if (!bestand) return;

  let tekst;
  try {
    tekst = await leesTekst(bestand);
  } catch {
    return melding("Het bestand kon niet gelezen worden.", "fout");
  }

  const keuze = await dialoog({
    titel: "Back-up inlezen",
    inhoud: `
      <p class="dialoog__vraag">Wat moet er met je huidige gegevens gebeuren?</p>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Samenvoegen</span>
          <span class="schakelrij__uitleg">Wat je nu hebt blijft staan; alleen nieuwe wijnen komen erbij.</span>
        </span>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Vervangen</span>
          <span class="schakelrij__uitleg">Je huidige kelder wordt gewist en volledig door de back-up vervangen.</span>
        </span>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      { label: "Samenvoegen", waarde: "samen" },
      { label: "Vervangen", waarde: "vervang", soort: "gevaar" },
    ],
  });

  if (!keuze) return;

  if (keuze === "vervang") {
    const zeker = await bevestig("Je huidige kelder wordt gewist en vervangen door de back-up.",
      { titel: "Zeker weten?", bevestigLabel: "Vervangen", gevaar: true });
    if (!zeker) return;
  }

  try {
    const aantal = await importeer(tekst, { vervang: keuze === "vervang" });
    melding(`${getal(aantal)} regels ingelezen`, "goed");
  } catch (err) {
    melding(err.message, "fout");
  }
}
