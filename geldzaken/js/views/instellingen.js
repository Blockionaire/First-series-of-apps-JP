/* =====================================================================
   GELDZAKEN — instellingen
   =====================================================================
   Alles wat je één keer instelt en daarna vergeet: hoe het huishouden
   heet, wie er meedoen, categorieën met hun budget, het thema, en de
   knoppen voor back-up en account.

   #/instellingen/categorieen opent het categorieënscherm.
   ===================================================================== */

import { esc, geld, melding, bevestig, dialoog, downloadTekst, maandLabel, datumNL,
         kiesBestand, leesTekst, leesBedrag, debounce,
         spoorBij, spoorTekst, spoorLeeg } from "../util.js";
import { state, zetInstelling, zetKoppeling, Sync, Koppeling, magBewerken, isBeheerder,
         legeCategorie, bewaarCategorie, wisCategorie, alsBackup,
         herstelBackup, alsCSV, wisAlles, duwAllesOmhoog, meld } from "../store.js";
import * as Bank from "../bank.js";
import { perCategorie, externeUitgaven, externeMaanden } from "../bereken.js";
import { ICONEN, KLEUREN } from "../data/standaard.js";
import { potjeOpties } from "./onderdelen.js";
import { ga, terug, eisBewerkrecht, pasThemaToe, merkVan } from "../app.js";

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

    ${bankBlok()}

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
      ${/* Welke versie draait hier eigenlijk? Dat is drie keer een
            raadsel geweest, dus nu staat het er gewoon. De naam komt
            uit de cache van de servicewerker zelf, zodat er geen tweede
            plek is die ernaast kan gaan zitten. */ ""}
      <div style="display:flex;justify-content:space-between;font-size:.83rem">
        <span class="dof">Versie</span><span data-versie>…</span>
      </div>
      <button class="knop knop--rand knop--breed" data-bijwerken style="margin-top:12px">
        Controleren op een nieuwe versie
      </button>
    </div>

    <button class="knop knop--rand knop--breed" data-wis-alles style="margin-top:8px;color:var(--fout);border-color:color-mix(in srgb, var(--fout) 40%, transparent)">
      Alles wissen
    </button>`;
}

/* ---------------------------- Bankkoppeling ------------------------- */
/* De gegevens hiervan staan alleen op dit apparaat. Dat is geen
   beperking maar de bedoeling: een adres en een woord waarmee je je
   eigen bankgegevens kunt opvragen horen niet in een cloud die je met
   anderen deelt. Op je telefoon vul je ze dus opnieuw in.

   Let op wat hier wél en niet van afhangt: niets in dit blok verandert
   doordat je in de velden tikt. Zou dat wel zo zijn, dan moest het
   scherm tijdens het typen opnieuw getekend worden, en dan verdwijnt
   de knop onder je vinger. De knoppen staan er dus altijd; of ze
   aanklikbaar zijn regelt `stemBankKnoppenAf` rechtstreeks. */
function bankBlok() {
  const b = Bank.bank;
  const dagen = Bank.dagenGeldig();

  return `
    <div class="sectiekop">
      <h2>Je bank</h2>
      <button class="uitlegknop" data-bank-uitleg aria-label="Hoe je de koppeling weer weghaalt">i</button>
    </div>
    <div class="kaart">
      ${!Bank.gekoppeld() ? `
        <p style="font-size:.86rem;color:var(--tekst-zacht);margin:0 0 12px">
          Je kunt je bankafschrift automatisch laten ophalen in plaats van een bestand
          te downloaden. Daar hoort een klein dienstje bij dat je zelf neerzet — hoe,
          staat in <code>bank/README.md</code>. Zonder dat blijft het bestand inlezen
          gewoon werken.
        </p>` : ""}

      <div class="veld">
        <label for="bankadres">Adres van je bankdienst</label>
        <input type="url" id="bankadres" value="${esc(b.adres)}"
               placeholder="https://geldzaken-bank.jouwnaam.workers.dev" autocomplete="off">
      </div>
      <div class="veld">
        <label for="bankwoord">Afgesproken woord</label>
        <input type="password" id="bankwoord" value="${esc(b.woord)}"
               placeholder="hetzelfde woord als in de dienst" autocomplete="off">
        <div class="veld__hint">
          Dit woord staat alleen in deze browser en in je eigen dienst. Het gaat niet mee
          naar de cloud en staat nergens in de app zelf.
        </div>
      </div>

      ${!Bank.gekoppeld() ? `
        <div class="knoprij knoprij--gelijk" style="margin-top:4px">
          <button class="knop" data-bank-proef>Verbinding testen</button>
          <button class="knop knop--primair" data-bank-koppel>Rekening koppelen</button>
        </div>
        ${/* Een uitgeschakelde knop doet niets als je erop tikt, en zwijgt
              daarover. Dus zeggen we erbij waarom. */ ""}
        <div class="veld__hint" data-bank-waarom style="margin-top:7px"></div>
        ${Bank.bank.opslag === false ? `
          <div class="signaal signaal--let-op" style="margin-top:10px">
            <span class="signaal__icoon">⚠️</span>
            <span>
              <span class="signaal__titel">Dit apparaat kan niets bewaren</span>
              <span class="signaal__tekst">Het adres en het woord blijven alleen staan zolang de app
                open is. Staat Geldzaken ergens anders nog open — een ander tabblad, of de app op je
                beginscherm — sluit dat dan helemaal af en open hem opnieuw.</span>
            </span>
          </div>` : ""}
      ` : `
          <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-top:4px">
            <span class="dof">Gekoppeld met</span>
            <strong>${esc(b.bankNaam || "je bank")}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.85rem">
            <span class="dof">Rekening</span>
            <strong>${esc(b.rekeningNaam || "nog niet gekozen")}</strong>
          </div>
          ${dagen != null ? `
            <div style="display:flex;justify-content:space-between;font-size:.85rem">
              <span class="dof">Toestemming</span>
              <strong class="${dagen <= 14 ? "af" : ""}">
                ${dagen > 0 ? `nog ${dagen} ${dagen === 1 ? "dag" : "dagen"}` : "verlopen"}
              </strong>
            </div>` : ""}
          ${b.laatst ? `
            <div style="display:flex;justify-content:space-between;font-size:.85rem">
              <span class="dof">Laatst opgehaald</span>
              <strong>${esc(datumNL(new Date(b.laatst).toISOString().slice(0, 10), { kort: true }))}</strong>
            </div>` : ""}

          ${dagen != null && dagen <= 14 ? `
            <div class="signaal signaal--let-op" style="margin-top:10px">
              <span class="signaal__icoon">⏳</span>
              <span>
                <span class="signaal__titel">${dagen > 0 ? "Bijna verlopen" : "Verlopen"}</span>
                <span class="signaal__tekst">Je bank vraagt elk half jaar opnieuw om in te loggen. Koppel opnieuw om door te gaan.</span>
              </span>
            </div>` : ""}

          <div class="knoprij knoprij--gelijk" style="margin-top:12px">
            <a class="knop knop--primair" href="#/importeren">Transacties ophalen</a>
            <button class="knop" data-bank-rekening>Andere rekening</button>
          </div>
          <button class="knop knop--rand knop--breed" data-bank-los style="margin-top:9px">Koppeling verbreken</button>
      `}

      ${b.proef ? `
        <div class="signaal signaal--${b.proef.gelukt ? "goed" : "let-op"}" style="margin-top:12px">
          <span class="signaal__icoon">${b.proef.gelukt ? "✅" : "⚠️"}</span>
          <span>
            <span class="signaal__titel">${b.proef.gelukt ? "De dienst antwoordt"
              : b.proef.koppelen ? "Het koppelen lukte niet"
              : b.proef.geenAntwoord ? "Geen antwoord van de dienst"
              : "De dienst wees het verzoek af"}</span>
            <span class="signaal__tekst">${esc(b.proef.tekst)}
              ${b.proef.gelukt ? "Je kunt je rekening koppelen." : ""}</span>
          </span>
        </div>` : ""}

      ${b.fout && b.fout !== b.proef?.tekst ? `<div class="veld__fout">${esc(b.fout)}</div>` : ""}

      ${/* Zolang hier een adres of een woord staat, hoort er een manier te
            zijn om ze weer weg te halen — zonder dat je daarvoor je hele
            boekhouding hoeft te wissen.

            Hij staat er altijd, net als de knoppen hierboven, en of je
            hem ziet regelt `stemBankKnoppenAf` rechtstreeks. Zouden we
            hem hier laten afhangen van wat er is opgeslagen, dan kwam
            hij pas bij de volgende hertekening tevoorschijn — en tijdens
            het typen tekenen we juist niet opnieuw. */ ""}
      <button class="knop knop--rand knop--breed" data-bank-vergeet style="margin-top:12px"
              ${Bank.ingesteld() ? "" : "hidden"}>
        Adres en woord van dit apparaat verwijderen
      </button>

      <div class="veld__hint" style="margin-top:12px">
        De dienst bewaart niets: hij haalt op, geeft door en vergeet. Je transacties
        komen in deze app terecht, op dit apparaat — en pas nadat jij ze hebt nagekeken.
      </div>

      ${/* Doet een knop hier niets, dan is dit de enige manier om erachter
            te komen wat er wél gebeurde. Een telefoon heeft geen console,
            dus staat het hier.

            En het staat open. Het zat eerst in een klapvakje, maar juist
            als er iets mis is met het aanraken gaat zo'n vakje ook niet
            open — en dan is het spoor onbereikbaar op het moment dat je
            het nodig hebt. Een diagnose mag niet afhangen van hetzelfde
            dat kapot is. */ ""}
      <div class="spoorvak" style="margin-top:12px">
        <div class="spoorvak__kop">Wat deed de app bij je laatste tik?</div>
        <pre class="spoorvak__regels" data-spoor>${esc(spoorTekst()) || "nog niets"}</pre>
        <button class="knop knop--klein" data-spoor-wis>Spoor wissen</button>
      </div>

      <div class="schakelrij" style="margin-top:4px">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Vrij vragen met Claude</span>
          <span class="schakelrij__uitleg">
            Bij ⚙️ → 💬 kun je vragen stellen over je geld. Dat rekent de app zelf uit,
            op dit apparaat. Zet dit aan en vragen die hij niet herkent gaan via je eigen
            dienst naar Claude — met een samenvatting in cijfers, geen losse boekingen.
            Je hebt er een Claude-sleutel in je dienst voor nodig.
          </span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" data-bank-ai ${b.aiAan ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
    </div>`;
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
     geen standaardnaam. Netjes maken gebeurt bij `change`, dus als je
     het veld verlaat — anders zou een trim de spatie wissen die je net
     tikte ("Ons " wordt weer "Ons") en zou een leeg veld op slag "Mijn
     huishouden" worden.

     En tijdens het typen tekenen we het scherm niet opnieuw. Je ziet
     immers al wat je intikt. Deed de app dat wél, dan werd elk knopje
     op dit scherm een halve seconde na je laatste letter vervangen
     door een nieuw exemplaar — en tikte je op zo'n moment een
     schakelaar aan, dan kwam die tik nergens meer aan. */
  const naamVeld = wortel.querySelector("#huisnaam");
  const bewaarNaam = debounce(waarde => zetInstelling({ huisNaam: waarde }, { hertekenen: false }), 500);

  naamVeld?.addEventListener("input", e => bewaarNaam(e.target.value));
  naamVeld?.addEventListener("change", e => {
    /* Eerst de wachtende ronde van het typen wegstrepen: die zou een
       tel later de opgeschoonde naam weer overschrijven met de ruwe.
       En ook hier niet hertekenen — `change` komt juist op het moment
       dat je het veld verlaat, meestal doordat je iets anders aantikt. */
    bewaarNaam.annuleer();
    const netjes = e.target.value.trim();
    if (netjes !== e.target.value) e.target.value = netjes;
    zetInstelling({ huisNaam: netjes || "Mijn huishouden" }, { hertekenen: false });
  });

  /* Adres en woord van de bankdienst gaan dezelfde kant op als de
     huisnaam: opslaan terwijl je typt, en níét hertekenen, zodat de
     knop eronder blijft staan waar je hem aantikt. Of die knoppen
     aanklikbaar zijn zetten we daarom met de hand. */
  const bankAdres = wortel.querySelector("#bankadres");
  const bankWoord = wortel.querySelector("#bankwoord");

  const stemBankKnoppenAf = () => {
    const adresIn = !!bankAdres?.value.trim();
    const woordIn = !!bankWoord?.value.trim();
    const klaar = adresIn && woordIn;
    wortel.querySelectorAll("[data-bank-proef], [data-bank-koppel]")
      .forEach(knop => { knop.disabled = !klaar; });

    /* Is er iets te vergeten, dan hoort de knop daarvoor er te staan. */
    const vergeet = wortel.querySelector("[data-bank-vergeet]");
    if (vergeet) vergeet.hidden = !(adresIn || woordIn || Bank.gekoppeld());

    const waarom = wortel.querySelector("[data-bank-waarom]");
    if (waarom) {
      waarom.textContent = klaar ? ""
        : !adresIn && !woordIn ? "Vul hierboven het adres en het woord in; dan kun je testen en koppelen."
        : !adresIn ? "Het adres ontbreekt nog, dus de knoppen hierboven doen nog niets."
        : "Het woord ontbreekt nog, dus de knoppen hierboven doen nog niets.";
    }
  };

  /* Elk veld zijn eigen uitgestelde opslag. Deelden ze er één, dan zou
     het tikken in het tweede veld het nog wachtende opslaan van het
     eerste wegstrepen — en was je het adres kwijt zodra je door naar
     het woord ging. */
  const bewaarAdres = debounce(adres => Bank.zetInstellingen({ adres }), 500);
  const bewaarWoord = debounce(woord => Bank.zetInstellingen({ woord }), 500);
  bankAdres?.addEventListener("input", e => { bewaarAdres(e.target.value); stemBankKnoppenAf(); });
  bankWoord?.addEventListener("input", e => { bewaarWoord(e.target.value); stemBankKnoppenAf(); });
  stemBankKnoppenAf();

  wortel.addEventListener("change", e => {
    if (e.target.matches("[data-privacy]")) zetInstelling({ privacy: e.target.checked });
    if (e.target.matches("[data-koppeling]")) zetKoppeling({ aan: e.target.checked });
    if (e.target.id === "koppelpot") zetKoppeling({ potje: e.target.value });
    if (e.target.matches("[data-potjes]")) zetInstelling({ potjesAutomatisch: e.target.checked });
    if (e.target.matches("[data-bank-ai]")) Bank.zetInstellingen({ aiAan: e.target.checked });
  });

  toonVersie(wortel);

  /* De bankknoppen krijgen hun eigen luisteraar, rechtstreeks op de knop.
     Dat scheelt een omweg langs het scherm, en juist die omweg is wat er
     misging: reageerde er een afhandelaar die bij een al vervangen scherm
     hoorde, dan kwam de tik nergens aan. Een luisteraar op de knop zelf
     leeft precies zo lang als de knop. */
  wortel.querySelector("[data-bank-proef]")?.addEventListener("click", e => {
    e.rechtstreeks = true;
    bankProef();
  });
  wortel.querySelector("[data-bank-koppel]")?.addEventListener("click", e => {
    e.rechtstreeks = true;
    bankKoppelen();
  });
  wortel.querySelector("[data-bank-vergeet]")?.addEventListener("click", e => {
    e.rechtstreeks = true;
    bankVergeten();
  });
  wortel.querySelector("[data-bank-uitleg]")?.addEventListener("click", e => {
    e.rechtstreeks = true;
    bankUitleg();
  });

  wortel.addEventListener("click", async e => {
    /* Wat ziet deze afhandeling eigenlijk, en hoort hij nog bij het
       scherm dat je voor je hebt? Zo niet, dan verklaart dat een knop
       die zwijgt. */
    const levend = document.querySelector("#scherm");
    spoorBij(`scherm hoort klik op ${merkVan(e.target)}`
      + (levend === wortel ? "" : ` — LET OP: dit is ronde ${wortel.dataset.ronde}, levend is ronde ${levend?.dataset.ronde}`));

    if (e.target.closest("[data-spoor-wis]")) return spoorLeeg();

    if (e.target.closest("[data-bijwerken]")) return bijwerken();

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

    /* `rechtstreeks` betekent: de knop heeft het zelf al afgehandeld. */
    if (e.target.closest("[data-bank-proef]")) return e.rechtstreeks || bankProef();
    if (e.target.closest("[data-bank-koppel]")) return e.rechtstreeks || bankKoppelen();
    if (e.target.closest("[data-bank-uitleg]")) return e.rechtstreeks || bankUitleg();
    if (e.target.closest("[data-bank-vergeet]")) return e.rechtstreeks || bankVergeten();
    if (e.target.closest("[data-bank-rekening]")) return bankRekeningKiezen();
    if (e.target.closest("[data-bank-los]")) return bankLoskoppelen();

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

    if (e.target.closest("[data-koppeling-test]")) {      try {
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

/* ---------------------------- Versie -------------------------------- */
/* De naam van de cache van de servicewerker is de versie. Die staat op
   één plek — in sw.js — dus er is niets dat ernaast kan gaan lopen. */
async function toonVersie(wortel) {
  const vak = wortel.querySelector("[data-versie]");
  if (!vak) return;
  try {
    const namen = await caches.keys();
    const mijne = namen.filter(n => n.startsWith("geldzaken-"));
    vak.textContent = mijne.length ? mijne.sort().reverse()[0].replace("geldzaken-", "") : "zonder cache";
  } catch {
    vak.textContent = "onbekend";
  }
}

async function bijwerken() {
  if (!("serviceWorker" in navigator)) return melding("Deze browser werkt niet met versies.", "fout");
  melding("Even kijken of er een nieuwe versie is…");
  try {
    const registratie = await navigator.serviceWorker.getRegistration();
    if (!registratie) return melding("Er draait geen servicewerker; herlaad de pagina eens.", "fout");
    await registratie.update();

    /* Staat er een nieuwe klaar, dan neemt die het over zodra we
       herladen. Zo niet, dan draai je al de laatste. */
    const nieuwe = registratie.installing || registratie.waiting;
    if (nieuwe) {
      melding("Nieuwe versie gevonden. Even opnieuw laden…", "goed");
      setTimeout(() => location.reload(), 900);
    } else {
      melding("Je draait al de nieuwste versie.", "goed");
    }
  } catch {
    melding("Het controleren lukte niet. Ben je online?", "fout");
  }
}

/* ------------------------- Bank: de knoppen ------------------------- */
/* Wat je in de velden hebt staan is misschien nog niet opgeslagen — het
   opslaan wacht een halve seconde. Voor een knop die er meteen iets mee
   doet nemen we daarom de veldwaarde zelf. */
function bankVeldenNu() {
  const adres = document.querySelector("#bankadres")?.value;
  const woord = document.querySelector("#bankwoord")?.value;
  if (adres === undefined && woord === undefined) return;
  /* Niet afwachten. `zetInstellingen` zet de waarden meteen klaar en
     bewaart ze daarna; zou het bewaren blijven hangen, dan hoort de
     knop daar niet op te wachten. */
  Bank.zetInstellingen({ adres, woord });
}

async function bankProef() {
  /* Eerst zichtbaar reageren, dan pas iets doen. Gaat er daarna iets
     mis, dan zie je in elk geval dát er iets gebeurde. */
  spoorBij("testen: begonnen");
  const knop = document.querySelector("[data-bank-proef]");
  if (knop) { knop.disabled = true; knop.textContent = "Bezig…"; }
  bankVeldenNu();
  try {
    await Bank.proefVerbinding();
    melding("De dienst antwoordt. Je kunt koppelen.", "goed");
  } catch (fout) {
    Bank.bank.fout = fout.message;
    melding(fout.message, "fout");
  }
  /* De uitslag staat nu in het kaartje zelf; hertekenen laat hem zien. */
  meld();
}

async function bankKoppelen() {
  spoorBij("koppelen: begonnen");
  if (!eisBewerkrecht()) return spoorBij("koppelen: gestopt, alleen leesrechten");
  const knop = document.querySelector("[data-bank-koppel]");
  if (knop) { knop.disabled = true; knop.textContent = "Bezig…"; }
  bankVeldenNu();

  let banken;
  try {
    banken = await Bank.welkeBanken("NL");
  } catch (fout) {
    Bank.bank.proef = { gelukt: false, tekst: fout.message, tijd: Date.now() };
    Bank.bank.fout = fout.message;
    melding(fout.message, "fout");
    return meld();
  }
  if (!banken.length) {
    Bank.bank.proef = { gelukt: false, tekst: "De dienst gaf geen banken terug.", tijd: Date.now() };
    melding("De dienst gaf geen banken terug.", "fout");
    return meld();
  }

  const keuze = await dialoog({
    titel: "Bij welke bank?",
    onderaan: true,
    inhoud: `
      <p class="dialoog__vraag">
        Je gaat straks naar je eigen bank om in te loggen. Geldzaken krijgt daarna
        alleen leesrechten op je afschrift — betalen kan er niet mee.
      </p>
      <div class="lijst">
        ${banken.map(b => `
          <button class="rij" data-kies="${esc(b.naam)}">
            <span class="rij__icoon">🏦</span>
            <span class="rij__midden">
              <span class="rij__titel">${esc(b.naam)}</span>
              ${b.maxDagen ? `<span class="rij__sub">toestemming geldt ${b.maxDagen} dagen</span>` : ""}
            </span>
            <span class="rij__rechts dof">›</span>
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

  if (!keuze) return meld();                // knop weer aan
  try {
    melding("Je gaat naar je bank…");
    await Bank.koppelStarten(keuze);        // dit verlaat de pagina
  } catch (fout) {
    Bank.bank.proef = { gelukt: false, tekst: fout.message, tijd: Date.now() };
    Bank.bank.fout = fout.message;
    melding(fout.message, "fout");
    meld();
  }
}

async function bankRekeningKiezen() {
  if (!eisBewerkrecht()) return;
  let gegevens;
  try {
    gegevens = await Bank.haalRekeningen();
  } catch (fout) {
    Bank.bank.fout = fout.message;
    melding(fout.message, "fout");
    return meld();
  }

  if (!gegevens.rekeningen.length) {
    return melding("Er zitten geen rekeningen in deze koppeling.", "fout");
  }

  const keuze = await dialoog({
    titel: "Welke rekening volgen?",
    inhoud: `
      <div class="lijst">
        ${gegevens.rekeningen.map(r => `
          <button class="rij" data-kies="${esc(r.id)}">
            <span class="rij__icoon">💳</span>
            <span class="rij__midden">
              <span class="rij__titel">${esc(r.naam || r.iban || "Rekening")}</span>
              ${r.iban ? `<span class="rij__sub">${esc(r.iban)}</span>` : ""}
            </span>
            <span class="rij__rechts dof">${Bank.bank.rekening === r.id ? "✓" : "›"}</span>
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
  const gekozen = gegevens.rekeningen.find(r => r.id === keuze);
  await Bank.kiesRekening(keuze, gekozen?.iban || gekozen?.naam || "");
  melding("Rekening gekozen.", "goed");
  meld();
}

async function bankLoskoppelen() {
  const zeker = await bevestig(
    "De toestemming bij je bank wordt ingetrokken. Wat je al hebt opgehaald blijft gewoon staan.",
    { titel: "Koppeling verbreken?", bevestigLabel: "Verbreken", gevaar: true });
  if (!zeker) return;
  await Bank.loskoppelen();
  melding("Koppeling verbroken.");
  meld();
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
    "Alle boekingen, vaste lasten, potjes en doelen worden gewist."
    + (Bank.ingesteld() ? " Ook je bankkoppeling wordt ingetrokken en vergeten." : "")
    + " Dit kan niet ongedaan gemaakt worden — maak eerst een back-up.",
    { titel: "Alles wissen?", bevestigLabel: "Ja, alles wissen", gevaar: true });
  if (!zeker) return;
  const nogmaals = await bevestig("Heel zeker? Er is geen weg terug.", { titel: "Echt alles wissen", bevestigLabel: "Wissen", gevaar: true });
  if (!nogmaals) return;
  await wisAlles();
  /* "Alles" hoort ook alles te zijn. Het adres, het woord en je sessie
     staan in de opslag van dít apparaat, en die valt buiten de gewone
     opruiming — dus bleven ze staan terwijl de knop iets anders beloofde. */
  await vergeetDeBank();
  melding("Alles gewist.");
  ga("#/start");
}

/* De toestemming bij de bank intrekken, en daarna adres, woord en sessie
   van dit apparaat halen. Lukt het intrekken niet, dan gaat het vergeten
   gewoon door: de toestemming verloopt vanzelf, en blijven staan is hier
   het ergere van de twee. */
async function vergeetDeBank() {
  if (!Bank.ingesteld()) return;
  try { await Bank.loskoppelen(); } catch { /* verloopt vanzelf */ }
  await Bank.vergeetAlles();
}

/* ------------------- Bank: hoe je er weer vanaf komt ---------------- */
/* Drie onafhankelijke noodremmen, en de laatste twee werken ook als deze
   app helemaal niet meewerkt. Dat hoort niet in een gesprek ergens maar
   in de app zelf, waar je het terug kunt vinden op het moment dat je het
   nodig hebt. */
function bankUitleg() {
  dialoog({
    titel: "Hoe je er weer vanaf komt",
    inhoud: `
      <p class="dialoog__tekst">
        Drie manieren om de koppeling weg te halen, en ze werken los van elkaar.
        De tweede en de derde werken ook als deze app niets meer doet.
      </p>

      <div class="uitleg">
        <div class="uitleg__nr">1</div>
        <div>
          <strong>In deze app</strong>
          <p>De knop <em>Adres en woord van dit apparaat verwijderen</em> hierboven
             trekt de toestemming bij je bank in en haalt het adres, het woord en je
             sessie van dit apparaat. Wat je al had opgehaald blijft in je boekhouding
             staan.</p>
          <p>Wil je ook je cijfers kwijt, gebruik dan <em>Alles wissen</em> onderaan —
             maak eerst een back-up.</p>
        </div>
      </div>

      <div class="uitleg">
        <div class="uitleg__nr">2</div>
        <div>
          <strong>Bij je bank zelf</strong>
          <p>In de app van je bank staat welke toestemmingen er lopen, en daar kun je
             ze intrekken. Dat is je echte noodrem: dat werkt ongeacht wat deze app
             doet of laat. De toestemming verloopt sowieso vanzelf na 180 dagen.</p>
        </div>
      </div>

      <div class="uitleg">
        <div class="uitleg__nr">3</div>
        <div>
          <strong>Bij Enable Banking en Cloudflare</strong>
          <p>In het Control Panel van Enable Banking kun je de hele applicatie
             verwijderen. Bij Cloudflare kun je je dienst weghalen — dan is er geen
             sleutel meer die ergens kan ondertekenen.</p>
        </div>
      </div>

      <div class="uitleg">
        <div class="uitleg__nr">＋</div>
        <div>
          <strong>Alles van de app wissen</strong>
          <p>Wil je werkelijk niets overhouden: in Safari onder Instellingen →
             Geavanceerd → Websitegegevens kun je alle gegevens van deze app
             verwijderen, inclusief je boekhouding.</p>
        </div>
      </div>

      <p class="dialoog__tekst dof">
        Er kan met deze koppeling nooit geld worden overgemaakt. De toestemming bij je
        bank geldt alleen voor lezen, en in de dienst zit geen enkel pad dat een
        betaling kan doen.
      </p>`,
    knoppen: [{ label: "Duidelijk", waarde: null }],
  });
}

async function bankVergeten() {
  if (!eisBewerkrecht()) return;
  const zeker = await bevestig(
    (Bank.gekoppeld()
      ? "De toestemming bij je bank wordt ingetrokken, en het adres, het woord en je sessie verdwijnen van dit apparaat. "
      : "Het adres en het woord verdwijnen van dit apparaat. ")
    + "Wat je al hebt opgehaald blijft gewoon in je boekhouding staan.",
    { titel: "Alles van je bank vergeten?", bevestigLabel: "Vergeten", gevaar: true });
  if (!zeker) return;
  await vergeetDeBank();
  melding("Van dit apparaat verdwenen.", "goed");
  meld();
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
