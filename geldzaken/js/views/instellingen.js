/* =====================================================================
   GELDZAKEN — instellingen
   =====================================================================
   Alles wat je één keer instelt en daarna vergeet: hoe het huishouden
   heet, wie er meedoen, categorieën met hun budget, het thema, en de
   knoppen voor back-up en account.

   #/instellingen/categorieen opent het categorieënscherm.
   ===================================================================== */

import { esc, geld, melding, bevestig, dialoog, downloadTekst, maandLabel,
         kiesBestand, leesTekst, leesBedrag, debounce } from "../util.js";
import { state, zetInstelling, zetKoppeling, Sync, Koppeling, magBewerken, isBeheerder,
         legeCategorie, bewaarCategorie, wisCategorie, alsBackup,
         herstelBackup, alsCSV, wisAlles, duwAllesOmhoog } from "../store.js";
import { perCategorie, externeUitgaven, externeMaanden } from "../bereken.js";
import { ICONEN, KLEUREN } from "../data/standaard.js";
import { potjeOpties } from "./onderdelen.js";
import { ga, terug, eisBewerkrecht, pasThemaToe } from "../app.js";

export const terugknop = true;
export const titel = params => params[0] === "categorieen" ? "Categorieën" : "Instellingen";
export const ondertitel = params => params[0] === "categorieen" ? "Indelen en budgetteren" : "";

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html(params) {
  if (params[0] === "categorieen") return categorieScherm();

  const i = state.instellingen;
  const s = Sync.sync;

  return `
    <div class="kaart">
      <div class="kaart__kop"><h2>Huishouden</h2></div>
      <div class="veld">
        <label for="huisnaam">Naam</label>
        <input type="text" id="huisnaam" value="${esc(i.huisNaam || "")}" placeholder="Ons huishouden">
      </div>
      <div class="veld">
        <span class="veld__label">Wie doen er mee</span>
        <div class="chips" id="personen">
          ${(i.personen || []).map(p => `
            <span class="chip">${esc(p)}<button data-wis-persoon="${esc(p)}" aria-label="Verwijderen">✕</button></span>`).join("")}
          <button class="chip" data-nieuw-persoon>＋ Toevoegen</button>
        </div>
        <div class="veld__hint">Met meerdere personen kun je bij elke boeking aangeven van wie hij was.</div>
      </div>
    </div>

    <div class="kaart">
      <div class="kaart__kop"><h2>Hoe wil je bijhouden?</h2></div>
      <div class="soortkeuze" id="modus">
        <button type="button" data-modus="eenvoudig" aria-pressed="${(i.modus || "eenvoudig") === "eenvoudig"}">
          <span class="soortkeuze__icoon">🥧</span>
          <span>
            <span class="soortkeuze__titel">Op hoofdlijnen</span>
            <span class="soortkeuze__uitleg">Inkomen verdelen over potjes. Losse uitgaven hoef je niet te boeken.</span>
          </span>
        </button>
        <button type="button" data-modus="volledig" aria-pressed="${i.modus === "volledig"}">
          <span class="soortkeuze__icoon">📒</span>
          <span>
            <span class="soortkeuze__titel">Alles bijhouden</span>
            <span class="soortkeuze__uitleg">Elke boeking erin, met budgetten per categorie en bankbestanden inlezen.</span>
          </span>
        </button>
      </div>
      <div class="veld__hint">
        Je kunt altijd wisselen; er gaat niets verloren. Wat je in de ene modus invoert
        blijft ook in de andere staan.
      </div>
    </div>

    <div class="kaart">
      <div class="kaart__kop"><h2>Weergave</h2></div>
      <div class="veld">
        <span class="veld__label">Thema</span>
        <div class="keuzes">
          ${[["auto", "Systeem"], ["donker", "Donker"], ["licht", "Licht"]].map(([w, l]) => `
            <button class="keuze" data-thema="${w}" aria-pressed="${(i.thema || "auto") === w}">${l}</button>`).join("")}
        </div>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Bedragen verbergen</span>
          <span class="schakelrij__uitleg">Handig in de trein. Ook te bereiken met het oogje bovenin.</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" data-privacy ${i.privacy ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Potjes automatisch vullen</span>
          <span class="schakelrij__uitleg">Elke maand gaat het ingestelde bedrag vanzelf in elk potje.</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" data-potjes ${i.potjesAutomatisch !== false ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
    </div>

    <div class="sectiekop"><h2>Indeling</h2></div>
    <a class="rij" href="#/inkomen">
      <span class="rij__icoon">💼</span>
      <span class="rij__midden">
        <span class="rij__titel">Inkomen</span>
        <span class="rij__sub">${state.terugkerend.filter(p => p.soort === "inkomst").length} vaste bronnen</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>
    <a class="rij" href="#/verdelen">
      <span class="rij__icoon">⚖️</span>
      <span class="rij__midden">
        <span class="rij__titel">Verdeling over potjes</span>
        <span class="rij__sub">${state.potjes.filter(p => p.actief !== false).length} potjes</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>
    <a class="rij" href="#/instellingen/categorieen">
      <span class="rij__icoon">🏷️</span>
      <span class="rij__midden">
        <span class="rij__titel">Categorieën en budgetten</span>
        <span class="rij__sub">${state.categorieen.length} categorieën · ${state.categorieen.filter(c => c.budget > 0).length} met budget</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>
    <a class="rij" href="#/rekeningen">
      <span class="rij__icoon">🏦</span>
      <span class="rij__midden">
        <span class="rij__titel">Rekeningen</span>
        <span class="rij__sub">${state.rekeningen.length} rekeningen</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>
    <a class="rij" href="#/vast">
      <span class="rij__icoon">🔁</span>
      <span class="rij__midden">
        <span class="rij__titel">Vaste lasten</span>
        <span class="rij__sub">${state.terugkerend.length} vaste posten</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>
    <a class="rij" href="#/importeren">
      <span class="rij__icoon">📥</span>
      <span class="rij__midden">
        <span class="rij__titel">Bankbestand inlezen</span>
        <span class="rij__sub">CSV van ING, Rabobank, ABN AMRO of bunq</span>
      </span>
      <span class="rij__rechts dof">›</span>
    </a>

    ${koppelingBlok()}

    ${accountBlok(s)}

    <div class="sectiekop"><h2>Back-up</h2></div>
    <div class="kaart">
      <div class="knoprij knoprij--gelijk">
        <button class="knop" data-backup>Back-up downloaden</button>
        <button class="knop" data-herstel>Terugzetten</button>
      </div>
      <div class="knoprij" style="margin-top:9px">
        <button class="knop knop--rand knop--breed" data-csv>Alle boekingen als CSV</button>
      </div>
      <div class="veld__hint">
        Een back-up is één bestand met alles erin: boekingen, vaste lasten, potjes, doelen en instellingen.
      </div>
    </div>

    <div class="sectiekop"><h2>Over deze app</h2></div>
    <div class="kaart">
      <p style="font-size:.86rem;color:var(--tekst-zacht)">
        Geldzaken werkt volledig op je eigen apparaat. ${s.beschikbaar
          ? "Met een account staan je gegevens ook in de cloud, zodat je telefoon en laptop hetzelfde laten zien."
          : "Er is geen cloud ingesteld, dus alles blijft op dit apparaat."}
      </p>
      <div style="display:flex;justify-content:space-between;font-size:.83rem;margin-top:8px">
        <span class="dof">Boekingen</span><span>${state.transacties.length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.83rem">
        <span class="dof">Vaste posten</span><span>${state.terugkerend.length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.83rem">
        <span class="dof">Potjes en doelen</span><span>${state.potjes.length + state.doelen.length}</span>
      </div>
    </div>

    <button class="knop knop--rand knop--breed" data-wis-alles style="margin-top:8px;color:var(--fout);border-color:color-mix(in srgb, var(--fout) 40%, transparent)">
      Alles wissen
    </button>`;
}

/* ---------------------------- Koppelingen --------------------------- */
/* Meelezen met een andere app van jezelf. Nu alleen de boodschappenapp;
   de opzet is zo dat er later meer bij kan. */
function koppelingBlok() {
  if (!Koppeling.configuratie()) return "";

  const k = state.instellingen.koppeling || {};
  const stand = Koppeling.koppeling;
  const extern = externeUitgaven(state, state.maand);
  const maanden = k.aan ? externeMaanden(state) : [];

  return `
    <div class="sectiekop"><h2>Koppelingen</h2></div>
    <div class="kaart">
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">${esc(Koppeling.appNaam())} meelezen</span>
          <span class="schakelrij__uitleg">
            Laat zien wat er in die app is afgerekend, zonder dat je het overtikt.
          </span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" data-koppeling ${k.aan ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>

      ${k.aan ? `
        <div class="veld" style="margin-top:12px">
          <label for="koppelpot">Tel mee bij dit potje</label>
          <select id="koppelpot">${potjeOpties(k.potje, { leegLabel: "— alleen laten zien —" })}</select>
          <div class="veld__hint">
            Kies je hier je potje Boodschappen, dan zie je op het overzicht direct
            hoeveel daarvan nog over is.
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-top:4px">
          <span class="dof">Status</span>
          <strong>${stand.fout ? "probleem" : stand.aantalTotaal ? "verbonden" : stand.bezig ? "verbinden…" : "wachten op gegevens"}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.85rem">
          <span class="dof">Gevonden</span>
          <strong>${stand.aantalTotaal} ${stand.aantalTotaal === 1 ? "bon" : "bonnen"} in totaal</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.85rem">
          <span class="dof">Deze maand</span>
          <strong class="bedrag">${geld(extern.totaal)} in ${extern.aantal} ${extern.aantal === 1 ? "bon" : "bonnen"}</strong>
        </div>
        ${stand.laatst ? `
          <div style="display:flex;justify-content:space-between;font-size:.85rem">
            <span class="dof">Laatst opgehaald</span>
            <strong>${esc(new Date(stand.laatst).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }))}</strong>
          </div>` : ""}
        ${stand.fout ? `<div class="veld__fout">${esc(stand.fout)}</div>` : ""}

        ${maanden.length ? `
          <div class="kaart__voet">
            <div class="veld__label">Per maand</div>
            ${maanden.slice(0, 4).map(m => `
              <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:5px">
                <span style="text-transform:capitalize">${esc(maandLabel(m.maand))}</span>
                <span class="bedrag">${geld(m.totaal)}</span>
              </div>`).join("")}
          </div>` : ""}

        <button class="knop knop--rand knop--breed" data-koppeling-test style="margin-top:12px">Nu ophalen</button>
      ` : ""}

      <div class="veld__hint" style="margin-top:12px">
        Er wordt alleen gelezen, nooit geschreven, en er komen geen boekingen bij. Het bedrag
        telt daarom niet mee in je maandtotalen — zo gaat er niets dubbel als je daarnaast je
        bankafschrift inleest.
      </div>
    </div>`;
}

/* ------------------------------ Account ----------------------------- */
function accountBlok(s) {
  if (!s.beschikbaar) {
    return `
      <div class="sectiekop"><h2>Account</h2></div>
      <div class="kaart">
        <p style="font-size:.86rem;color:var(--tekst-zacht);margin:0">
          Voor Geldzaken zelf is nog geen cloud ingesteld, dus je cijfers staan alleen op dit
          apparaat. In <code>firebase-config.js</code> staat hoe je dat aanzet — dan kun je
          inloggen, samen bijhouden en bepalen wie erbij mag.
        </p>
        ${Koppeling.configuratie() ? `
          <p style="font-size:.86rem;color:var(--tekst-zacht);margin:8px 0 0">
            Dit staat los van de koppeling hierboven: meelezen met ${esc(Koppeling.appNaam())}
            werkt ook zonder account hier.
          </p>` : ""}
      </div>`;
  }

  const rol = { beheerder: "Beheerder", bewerker: "Mag bewerken", kijker: "Mag meekijken" }[s.lid?.rol] || "—";

  return `
    <div class="sectiekop"><h2>Account</h2></div>
    <div class="kaart">
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:.88rem;margin-bottom:8px">
        <span class="dof">Ingelogd als</span>
        <strong style="text-align:right;overflow:hidden;text-overflow:ellipsis">${esc(s.gebruiker?.email || "")}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:.88rem;margin-bottom:8px">
        <span class="dof">Jouw rol</span><strong>${esc(rol)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:.88rem">
        <span class="dof">Synchronisatie</span>
        <strong>${s.fout ? "probleem" : s.actief ? "aan" : "uit"}</strong>
      </div>
      ${s.fout ? `<div class="veld__fout">${esc(s.fout)}</div>` : ""}

      <div class="knoprij" style="margin-top:12px">
        <button class="knop knop--klein" data-wachtwoord>Wachtwoord wijzigen</button>
        <button class="knop knop--klein" data-uitloggen>Uitloggen</button>
        ${magBewerken() ? `<button class="knop knop--klein" data-duw>Dit apparaat als bron gebruiken</button>` : ""}
      </div>
    </div>

    ${isBeheerder() ? `
      <a class="rij" href="#/beheer">
        <span class="rij__icoon">👥</span>
        <span class="rij__midden">
          <span class="rij__titel">Wie mag erbij</span>
          <span class="rij__sub">
            ${Sync.sync.leden.length} ${Sync.sync.leden.length === 1 ? "aanmelding" : "aanmeldingen"}
            ${wachtenden() ? ` · ${wachtenden()} wacht${wachtenden() === 1 ? "" : "en"} op je` : ""}
          </span>
        </span>
        <span class="rij__rechts">${wachtenden() ? `<span class="label label--letop">${wachtenden()}</span>` : `<span class="dof">›</span>`}</span>
      </a>` : ""}`;
}

const wachtenden = () => Sync.sync.leden.filter(l => l.status === "wacht").length;

/* --------------------------- Categorieën ---------------------------- */
function categorieScherm() {
  const gebruik = perCategorie(state, state.maand);
  const groepen = [
    ["Inkomsten", state.categorieen.filter(c => c.soort === "inkomst")],
    ["Vaste lasten", state.categorieen.filter(c => c.soort !== "inkomst" && c.vast)],
    ["Losse uitgaven", state.categorieen.filter(c => c.soort !== "inkomst" && !c.vast)],
  ];

  return `
    <p class="veld__hint" style="margin-bottom:14px">
      Zet een budget op een categorie, dan waarschuwt het startscherm zodra je in de buurt komt.
      Categorieën die als vaste last staan aangemerkt tellen mee in het blok "vast".
    </p>

    ${groepen.map(([kop, lijst]) => !lijst.length ? "" : `
      <div class="sectiekop"><h2>${esc(kop)}</h2></div>
      <div class="lijst">
        ${lijst.sort((a, b) => a.naam.localeCompare(b.naam)).map(c => {
          const gebruikt = gebruik.find(g => g.id === c.id)?.bedrag || 0;
          return `
            <button class="rij" data-categorie="${esc(c.id)}">
              <span class="rij__icoon" style="background:color-mix(in srgb, ${esc(c.kleur)} 20%, var(--vlak-diep))">${esc(c.icoon)}</span>
              <span class="rij__midden">
                <span class="rij__titel">${esc(c.naam)}</span>
                <span class="rij__sub">
                  ${c.budget > 0 ? `budget ${geld(c.budget)} · deze maand ${geld(gebruikt)}` : `deze maand ${geld(gebruikt)}`}
                </span>
              </span>
              <span class="rij__rechts dof">›</span>
            </button>`;
        }).join("")}
      </div>`).join("")}

    <button class="knop knop--primair knop--breed" data-nieuwe-categorie style="margin-top:16px">Categorie toevoegen</button>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel, params) {
  if (params[0] === "categorieen") return koppelCategorieen(wortel);

  /* De naam slaan we op terwijl je typt, niet pas als je het veld
     verlaat. Tik je meteen daarna op een tabblad, dan is je invoer
     anders weg — het veld verdwijnt dan zonder dat de browser nog een
     wijziging meldt.

     Tijdens het typen bewaren we letterlijk wat er staat: geen trim en
     geen standaardnaam. Elk opslaan tekent het scherm opnieuw, dus zou
     een trim hier de spatie wissen die je net tikte ("Ons " wordt weer
     "Ons") en zou een lege naam meteen in "Mijn huishouden" veranderen.
     Netjes maken doen we pas als je klaar bent — bij `change`, dus als
     je het veld verlaat. Niet bij `blur`: het hertekenen haalt dit veld
     weg, en dat geeft een blur die opnieuw opslaat, wat opnieuw
     hertekent. Daar komt de browser niet meer uit. */
  const naamVeld = wortel.querySelector("#huisnaam");
  const bewaarNaam = debounce(waarde => zetInstelling({ huisNaam: waarde }), 500);

  naamVeld?.addEventListener("input", e => bewaarNaam(e.target.value));
  naamVeld?.addEventListener("change", e => {
    const netjes = e.target.value.trim();
    if (netjes !== e.target.value) e.target.value = netjes;
    zetInstelling({ huisNaam: netjes || "Mijn huishouden" });
  });

  wortel.addEventListener("change", e => {
    if (e.target.matches("[data-privacy]")) zetInstelling({ privacy: e.target.checked });
    if (e.target.matches("[data-koppeling]")) zetKoppeling({ aan: e.target.checked });
    if (e.target.id === "koppelpot") zetKoppeling({ potje: e.target.value });
    if (e.target.matches("[data-potjes]")) zetInstelling({ potjesAutomatisch: e.target.checked });
  });

  wortel.addEventListener("click", async e => {
    const thema = e.target.closest("[data-thema]");
    if (thema) {
      await zetInstelling({ thema: thema.dataset.thema });
      pasThemaToe(thema.dataset.thema);
      return;
    }

    const modus = e.target.closest("[data-modus]");
    if (modus) {
      await zetInstelling({ modus: modus.dataset.modus });
      melding(modus.dataset.modus === "eenvoudig" ? "Op hoofdlijnen." : "Alles bijhouden staat aan.", "goed");
      return ga("#/start");
    }

    if (e.target.closest("[data-nieuw-persoon]")) return voegPersoonToe();

    const wisPersoon = e.target.closest("[data-wis-persoon]");
    if (wisPersoon) {
      const naam = wisPersoon.dataset.wisPersoon;
      await zetInstelling({ personen: (state.instellingen.personen || []).filter(p => p !== naam) });
      return;
    }

    if (e.target.closest("[data-backup]")) {
      downloadTekst(`geldzaken-backup-${new Date().toISOString().slice(0, 10)}.json`, alsBackup());
      return melding("Back-up gedownload.", "goed");
    }

    if (e.target.closest("[data-csv]")) {
      if (!state.transacties.length) return melding("Er is nog niets te downloaden.", "fout");
      downloadTekst(`geldzaken-boekingen-${new Date().toISOString().slice(0, 10)}.csv`, alsCSV(), "text/csv");
      return melding("CSV gedownload.", "goed");
    }

    if (e.target.closest("[data-koppeling-test]")) {
      try {
        const aantal = await Koppeling.haalNu();
        melding(aantal
          ? `Verbonden. ${aantal} ${aantal === 1 ? "bon" : "bonnen"} gevonden.`
          : "Verbonden, maar er staat nog geen enkele bon in die app.", "goed");
      } catch (fout) {
        melding(fout.message || "Ophalen lukte niet.", "fout");
      }
      return;
    }

    if (e.target.closest("[data-herstel]")) return herstel();
    if (e.target.closest("[data-wis-alles]")) return allesWissen();
    if (e.target.closest("[data-wachtwoord]")) return wijzigWachtwoord();
    if (e.target.closest("[data-duw]")) return duwOmhoog();

    if (e.target.closest("[data-uitloggen]")) {
      const zeker = await bevestig("Je gegevens blijven op dit apparaat staan.", { titel: "Uitloggen?", bevestigLabel: "Uitloggen" });
      if (zeker) await Sync.uitloggen();
    }
  });
}

function koppelCategorieen(wortel) {
  wortel.addEventListener("click", e => {
    if (e.target.closest("[data-nieuwe-categorie]")) return bewerkCategorie(null);
    const rij = e.target.closest("[data-categorie]");
    if (rij) bewerkCategorie(state.categorieen.find(c => c.id === rij.dataset.categorie));
  });
}

/* ------------------------------ Acties ------------------------------ */
async function voegPersoonToe() {
  if (!eisBewerkrecht()) return;
  const naam = await dialoog({
    titel: "Wie doet er mee?",
    inhoud: `
      <div class="veld">
        <label for="pnaam">Naam</label>
        <input type="text" id="pnaam" placeholder="Bijvoorbeeld: Sam">
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Toevoegen", soort: "primair",
        waardeUit: laag => laag.querySelector("#pnaam").value.trim() || undefined,
      },
    ],
    opOpenen: laag => setTimeout(() => laag.querySelector("#pnaam")?.focus(), 60),
  });
  if (!naam) return;
  const personen = [...(state.instellingen.personen || [])];
  if (personen.includes(naam)) return;
  personen.push(naam);
  await zetInstelling({ personen });
}

async function herstel() {
  if (!eisBewerkrecht()) return;
  const bestand = await kiesBestand("application/json,.json");
  if (!bestand) return;

  const vervangen = await dialoog({
    titel: "Hoe terugzetten?",
    inhoud: `<p class="dialoog__vraag">
        <strong>Samenvoegen</strong> laat wat je nu hebt staan en vult aan.<br>
        <strong>Vervangen</strong> gooit eerst alles weg wat er nu staat.
      </p>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      { label: "Samenvoegen", waarde: "samen", soort: "primair" },
      { label: "Vervangen", waarde: "vervang", soort: "gevaar" },
    ],
  });
  if (!vervangen) return;

  try {
    const aantal = await herstelBackup(await leesTekst(bestand), { vervang: vervangen === "vervang" });
    melding(`${aantal} regels teruggezet.`, "goed");
  } catch (e) {
    melding("Terugzetten lukte niet: " + e.message, "fout");
  }
}

async function allesWissen() {
  if (!eisBewerkrecht()) return;
  const zeker = await bevestig(
    "Alle boekingen, vaste lasten, potjes en doelen worden gewist. Dit kan niet ongedaan gemaakt worden — maak eerst een back-up.",
    { titel: "Alles wissen?", bevestigLabel: "Ja, alles wissen", gevaar: true });
  if (!zeker) return;
  const nogmaals = await bevestig("Heel zeker? Er is geen weg terug.", { titel: "Echt alles wissen", bevestigLabel: "Wissen", gevaar: true });
  if (!nogmaals) return;
  await wisAlles();
  melding("Alles gewist.");
  ga("#/start");
}

async function wijzigWachtwoord() {
  const velden = await dialoog({
    titel: "Wachtwoord wijzigen",
    inhoud: `
      <div class="veld">
        <label for="wnu">Huidig wachtwoord</label>
        <input type="password" id="wnu" autocomplete="current-password">
      </div>
      <div class="veld">
        <label for="wnieuw">Nieuw wachtwoord</label>
        <input type="password" id="wnieuw" autocomplete="new-password">
        <div class="veld__hint">Minstens 8 tekens.</div>
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Wijzigen", soort: "primair",
        waardeUit: laag => {
          const nu = laag.querySelector("#wnu").value;
          const nieuw = laag.querySelector("#wnieuw").value;
          if (!nu || nieuw.length < 8) { melding("Vul allebei in; het nieuwe wachtwoord is minstens 8 tekens.", "fout"); return undefined; }
          return { nu, nieuw };
        },
      },
    ],
  });
  if (!velden) return;
  try {
    await Sync.wijzigWachtwoord(velden.nu, velden.nieuw);
    melding("Wachtwoord gewijzigd.", "goed");
  } catch (e) {
    melding(Sync.foutTekst(e), "fout");
  }
}

async function duwOmhoog() {
  const zeker = await bevestig(
    "Alles wat op dit apparaat staat wordt naar de cloud gestuurd. Boekingen die daar al staan blijven bestaan; bij dezelfde boeking wint deze versie.",
    { titel: "Dit apparaat als bron", bevestigLabel: "Versturen" });
  if (!zeker) return;
  try {
    await duwAllesOmhoog();
    melding("Alles verstuurd.", "goed");
  } catch (e) {
    melding(Sync.foutTekst(e), "fout");
  }
}

/* -------------------- Categorie toevoegen of wijzigen ---------------- */
async function bewerkCategorie(bestaand) {
  if (!eisBewerkrecht()) return;
  const c = bestaand ? { ...bestaand } : legeCategorie();
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Nieuwe categorie" : c.naam,
    onderaan: true,
    inhoud: `
      <div class="veld">
        <label for="cnaam">Naam</label>
        <input type="text" id="cnaam" value="${esc(c.naam)}" placeholder="Boodschappen, kapper…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="csoort">Soort</label>
          <select id="csoort">
            <option value="uitgave" ${c.soort !== "inkomst" ? "selected" : ""}>Uitgave</option>
            <option value="inkomst" ${c.soort === "inkomst" ? "selected" : ""}>Inkomst</option>
          </select>
        </div>
        <div class="veld">
          <label for="cbudget">Budget per maand</label>
          <input type="text" id="cbudget" inputmode="decimal" value="${c.budget ? String(c.budget).replace(".", ",") : ""}" placeholder="geen">
        </div>
      </div>
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Hoort bij mijn vaste lasten</span>
          <span class="schakelrij__uitleg">Uitgaven in deze categorie tellen mee in het blok "vast".</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" id="cvast" ${c.vast ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
      <div class="veld">
        <span class="veld__label">Icoon</span>
        <div class="iconenraster" id="ciconen">
          ${ICONEN.map(i => `<button type="button" data-icoon="${esc(i)}" aria-pressed="${i === c.icoon}">${esc(i)}</button>`).join("")}
        </div>
      </div>
      <div class="veld">
        <span class="veld__label">Kleur</span>
        <div class="kleuren" id="ckleuren">
          ${KLEUREN.map(k => `<button type="button" data-kleur="${esc(k)}" style="background:${esc(k)}" aria-pressed="${k === c.kleur}" aria-label="Kleur"></button>`).join("")}
        </div>
      </div>
      ${nieuw ? "" : `<button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Categorie verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const naam = laag.querySelector("#cnaam").value.trim();
          if (!naam) { melding("Geef de categorie een naam.", "fout"); return undefined; }
          return {
            ...c,
            naam,
            soort: laag.querySelector("#csoort").value,
            budget: leesBedrag(laag.querySelector("#cbudget").value),
            vast: laag.querySelector("#cvast").checked,
            icoon: laag.querySelector("[data-icoon][aria-pressed=true]")?.dataset.icoon || c.icoon,
            kleur: laag.querySelector("[data-kleur][aria-pressed=true]")?.dataset.kleur || c.kleur,
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
      kiezer("#ciconen", "data-icoon");
      kiezer("#ckleuren", "data-kleur");

      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const aantal = state.transacties.filter(t => t.categorie === c.id).length;
        const zeker = await bevestig(
          aantal ? `Er zijn ${aantal} boekingen met deze categorie. Die blijven staan, maar zonder categorie.` : `"${c.naam}" wordt verwijderd.`,
          { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisCategorie(c.id);
        melding("Categorie verwijderd.");
        sluit(null);
      });

      if (nieuw) setTimeout(() => laag.querySelector("#cnaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarCategorie(uitkomst);
  melding(nieuw ? "Categorie toegevoegd." : "Opgeslagen.", "goed");
}
