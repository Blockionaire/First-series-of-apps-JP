/* =====================================================================
   GELDZAKEN — de poort
   =====================================================================
   Inloggen, een account aanvragen, en de wachtkamer voor wie nog niet
   is toegelaten. Dit scherm is alles wat een onbekende bezoeker van de
   app te zien krijgt.

   Aanmelden kan iedereen — dat is niet erg, want een aanmelding is
   alleen een verzoek. Pas als de beheerder je goedkeurt zie je cijfers.
   Firestore laat een wachtende ook echt niets lezen; dit scherm is de
   nette voorkant van die regel, niet de regel zelf.
   ===================================================================== */

import { $, esc, melding } from "../util.js";
import * as Sync from "../sync.js";

let modus = "inloggen";     // inloggen | aanmelden | vergeten
let bezig = false;

const huisNaam = () => window.GELDZAKEN_CONFIG?.huisNaam || "Geldzaken";

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html(poort) {
  if (poort === "laden") {
    return `
      <div class="poort">
        <div class="poort__merk">
          <div class="poort__logo" aria-hidden="true">💶</div>
          <h1>${esc(huisNaam())}</h1>
          <p>Even kijken of je al bent ingelogd…</p>
        </div>
      </div>`;
  }

  if (poort === "inloggen") {
    return `
      <div class="poort">
        <div class="poort__merk">
          <div class="poort__logo" aria-hidden="true">💶</div>
          <h1>${esc(huisNaam())}</h1>
          <p>Inkomsten, vaste lasten, potjes en sparen — op één plek.</p>
        </div>
        <div class="poort__kaart" id="poortkaart">${formulier()}</div>
        <p class="poort__uitleg">
          Nieuw account? Je aanmelding komt eerst bij de beheerder terecht.
          Pas na goedkeuring zie je de cijfers.
        </p>
      </div>`;
  }

  return wachtkamer(poort);
}

function formulier() {
  if (modus === "vergeten") {
    return `
      <h2>Wachtwoord vergeten</h2>
      <p class="veld__hint" style="margin:6px 0 14px">
        We sturen je een mailtje waarmee je een nieuw wachtwoord kunt kiezen.
      </p>
      <form id="poortform" novalidate>
        <div class="veld">
          <label for="email">E-mailadres</label>
          <input type="email" id="email" name="email" autocomplete="email" required
                 inputmode="email" placeholder="jij@voorbeeld.nl">
        </div>
        <div class="veld__fout verborgen" id="fout"></div>
        <button class="knop knop--primair knop--breed" type="submit">Stuur de mail</button>
      </form>
      <div class="poort__wissel">
        <button type="button" data-modus="inloggen">Terug naar inloggen</button>
      </div>`;
  }

  const aanmelden = modus === "aanmelden";
  return `
    <h2>${aanmelden ? "Account aanvragen" : "Inloggen"}</h2>
    <form id="poortform" novalidate style="margin-top:14px">
      ${aanmelden ? `
        <div class="veld">
          <label for="naam">Je naam</label>
          <input type="text" id="naam" name="naam" autocomplete="name" required placeholder="Hoe heet je?">
        </div>` : ""}
      <div class="veld">
        <label for="email">E-mailadres</label>
        <input type="email" id="email" name="email" autocomplete="email" required
               inputmode="email" placeholder="jij@voorbeeld.nl">
      </div>
      <div class="veld">
        <label for="wachtwoord">Wachtwoord</label>
        <input type="password" id="wachtwoord" name="wachtwoord" required
               autocomplete="${aanmelden ? "new-password" : "current-password"}"
               placeholder="${aanmelden ? "Minstens 8 tekens" : "••••••••"}">
        ${aanmelden ? `<div class="veld__hint">Kies iets van minstens 8 tekens dat je nergens anders gebruikt.</div>` : ""}
      </div>
      <div class="veld__fout verborgen" id="fout"></div>
      <button class="knop knop--primair knop--breed" type="submit" id="verzend">
        ${aanmelden ? "Aanmelding versturen" : "Inloggen"}
      </button>
    </form>
    <div class="poort__wissel">
      ${aanmelden
        ? `Heb je al een account? <button type="button" data-modus="inloggen">Inloggen</button>`
        : `Nog geen account? <button type="button" data-modus="aanmelden">Aanmelden</button>
           <div style="margin-top:8px"><button type="button" data-modus="vergeten">Wachtwoord vergeten?</button></div>`}
    </div>`;
}

function wachtkamer(poort) {
  const email = Sync.sync.gebruiker?.email || "";
  const bevestigd = Sync.sync.gebruiker?.emailBevestigd;

  const teksten = {
    wacht: {
      icoon: "⏳",
      titel: "Je aanmelding staat klaar",
      tekst: `De beheerder van ${huisNaam()} ziet je aanmelding en kan je toegang geven.
              Zodra dat gebeurt komt dit scherm vanzelf goed — je hoeft niets te doen.`,
    },
    geweigerd: {
      icoon: "🚫",
      titel: "Geen toegang",
      tekst: "Je aanmelding is niet goedgekeurd. Klopt dat niet? Neem even contact op met de beheerder.",
    },
    geblokkeerd: {
      icoon: "🔒",
      titel: "Toegang gepauzeerd",
      tekst: "De beheerder heeft je toegang tijdelijk uitgezet.",
    },
  };
  const t = teksten[poort] || teksten.wacht;

  return `
    <div class="poort">
      <div class="poort__kaart wacht">
        <div class="wacht__icoon" aria-hidden="true">${t.icoon}</div>
        <h1 style="font-size:1.3rem">${esc(t.titel)}</h1>
        <p class="wacht__tekst" style="margin-top:10px">${esc(t.tekst)}</p>

        <div class="rij rij--vlak" style="justify-content:center;gap:8px">
          <span class="dof" style="font-size:.84rem">Ingelogd als</span>
          <strong style="font-size:.88rem">${esc(email)}</strong>
        </div>

        ${poort === "wacht" && !bevestigd ? `
          <p class="veld__hint" style="margin:14px 0 8px">
            Je e-mailadres is nog niet bevestigd. Dat helpt de beheerder om te zien dat je het echt bent.
          </p>
          <button class="knop knop--rand knop--breed" data-bevestigmail>Stuur de bevestigingsmail opnieuw</button>
        ` : ""}

        <div style="margin-top:14px">
          <button class="knop knop--stil knop--breed" data-uitloggen>Uitloggen</button>
        </div>
      </div>
      <p class="poort__uitleg">Dit scherm ververst zichzelf zodra je bent toegelaten.</p>
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(app, poort) {
  if (poort === "inloggen") koppelFormulier(app);
  koppelWachtkamer(app);
}

/* Bij een hertekening zonder poortwissel laten we het formulier staan —
   anders ben je midden in het typen je invoer kwijt. */
export function ververs() { /* niets nodig */ }

function koppelFormulier(app) {
  const kaart = $("#poortkaart", app);
  if (!kaart) return;

  kaart.addEventListener("click", e => {
    const knop = e.target.closest("[data-modus]");
    if (!knop) return;
    modus = knop.dataset.modus;
    kaart.innerHTML = formulier();
    kaart.querySelector("input")?.focus();
  });

  kaart.addEventListener("submit", async e => {
    e.preventDefault();
    if (bezig) return;

    const form = e.target;
    const fout = $("#fout", kaart);
    const knop = form.querySelector("button[type=submit]");
    const toonFout = tekst => {
      fout.textContent = tekst;
      fout.classList.remove("verborgen");
    };
    fout.classList.add("verborgen");

    const email = form.email?.value.trim() || "";
    const wachtwoord = form.wachtwoord?.value || "";
    const naam = form.naam?.value.trim() || "";

    if (!email) return toonFout("Vul je e-mailadres in.");
    if (modus !== "vergeten" && wachtwoord.length < 6) return toonFout("Je wachtwoord is te kort.");
    if (modus === "aanmelden" && !naam) return toonFout("Vul je naam in, dan weet de beheerder wie je bent.");

    bezig = true;
    knop.disabled = true;
    const oudLabel = knop.textContent;
    knop.textContent = "Momentje…";

    try {
      if (modus === "vergeten") {
        await Sync.wachtwoordVergeten(email);
        melding("Kijk in je mail voor de link.", "goed");
        modus = "inloggen";
        kaart.innerHTML = formulier();
      } else if (modus === "aanmelden") {
        await Sync.registreren(email, wachtwoord, naam);
        melding("Aanmelding verstuurd.", "goed");
      } else {
        await Sync.inloggen(email, wachtwoord);
      }
    } catch (e) {
      toonFout(Sync.foutTekst(e));
      knop.disabled = false;
      knop.textContent = oudLabel;
    } finally {
      bezig = false;
    }
  });
}

function koppelWachtkamer(app) {
  app.querySelector("[data-uitloggen]")?.addEventListener("click", async () => {
    modus = "inloggen";
    await Sync.uitloggen();
  });

  app.querySelector("[data-bevestigmail]")?.addEventListener("click", async () => {
    try {
      await Sync.stuurBevestigingsmail();
      melding("Bevestigingsmail verstuurd.", "goed");
    } catch (e) {
      melding(Sync.foutTekst(e), "fout");
    }
  });
}
