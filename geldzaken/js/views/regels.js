/* =====================================================================
   GELDZAKEN — wat de app heeft geleerd
   =====================================================================
   Bij het inlezen raadt de app bij elke boeking een categorie en een
   potje. Deel je er zelf een anders in, dan onthoudt hij dat als een
   regel: een trefwoord uit de naam van de tegenpartij, met een
   categorie en eventueel een potje eraan.

   Dat gebeurde tot nu toe volledig onzichtbaar, en dat is precies het
   bezwaar: je kunt niet zien wat hij heeft onthouden, dus een regel die
   er één keer naast zit, zit er voorgoed naast. Hier staat alles op een
   rij en kun je het bijsturen.

   Twee dingen die de opzet bepalen:

   - Regels vullen alleen lege plekken. Wat jij zelf hebt ingedeeld
     blijft staan, ook als een regel iets anders zou zeggen. Jouw keuze
     wint van een vermoeden.
   - Het langste trefwoord wint, zodat "albert heijn" voorgaat op
     "albert" en een precieze regel niet door een vage wordt overstemd.
   ===================================================================== */

import { esc, melding, bevestig } from "../util.js";
import { state, bewaarRegel, wisRegel, pasRegelsToe, meld } from "../store.js";
import { leeg, potjeOpties } from "./onderdelen.js";
import { eisBewerkrecht } from "../app.js";

export const titel = () => "Herkenning";
export const ondertitel = () => "Wat de app heeft geleerd";
export const terugknop = true;
export const terugNaar = "#/instellingen";

/* Hoeveel boekingen er nu alsnog ingedeeld kunnen worden. Tellen kost
   een rondje door alle boekingen en dat gaat niet samen met tekenen,
   dus het gebeurt bij binnenkomst en blijft hier staan. */
let openTeDelen = 0;

export async function opBinnenkomst() {
  const nu = await pasRegelsToe({ alleenTellen: true });
  if (nu === openTeDelen) return;
  openTeDelen = nu;
  meld();
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const regels = [...state.regels].sort((a, b) =>
    String(a.trefwoord).localeCompare(String(b.trefwoord), "nl"));

  return `
    <p class="uitleg__intro">
      Deel je een boeking zelf in, dan onthoudt de app dat hier. Komt dat
      woord daarna weer langs, dan staat het meteen goed.
    </p>

    ${openTeDelen ? `
      <div class="kaart">
        <div class="signaal signaal--goed" style="margin:0">
          <span class="signaal__icoon">✨</span>
          <span>
            <span class="signaal__titel">${openTeDelen} ${openTeDelen === 1 ? "boeking" : "boekingen"} kan de app alsnog indelen</span>
            <span class="signaal__tekst">Met wat hij inmiddels weet. Alleen lege plekken worden
              gevuld — wat jij zelf hebt ingedeeld blijft staan.</span>
          </span>
        </div>
        <button class="knop knop--primair knop--breed" data-toepassen style="margin-top:11px">
          Toepassen op wat er al staat
        </button>
      </div>` : ""}

    ${!regels.length ? leeg({
      icoon: "🧠",
      titel: "Nog niets geleerd",
      tekst: "Zet bij het inlezen een boeking onder een categorie of potje, dan komt die keuze hier te staan.",
    }) : `
      <div class="kaart">
        ${regels.map(regelRij).join("")}
      </div>
      <p class="veld__hint" style="margin-top:10px">
        ${regels.length} ${regels.length === 1 ? "regel" : "regels"}. Pas er hier gerust iets aan
        of veeg een regel weg — boekingen die er al staan veranderen daar niet van.
      </p>`}`;
}

function regelRij(r) {
  return `
    <div class="regelrij" data-regel="${esc(r.id)}">
      <div class="regelrij__kop">
        <span class="regelrij__woord">${esc(r.trefwoord)}</span>
        <button class="icoonknop icoonknop--kaal" data-wis-regel="${esc(r.id)}"
                aria-label="Regel voor ${esc(r.trefwoord)} weghalen">✕</button>
      </div>
      <div class="regelrij__keuzes">
        <label class="sr-only" for="cat-${esc(r.id)}">Categorie</label>
        <select id="cat-${esc(r.id)}" data-regel-categorie>
          ${categorieKeuzes(r.categorie)}
        </select>
        <label class="sr-only" for="pot-${esc(r.id)}">Potje</label>
        <select id="pot-${esc(r.id)}" data-regel-potje>
          ${potjeOpties(r.potje)}
        </select>
      </div>
    </div>`;
}

/* Uitgaven én inkomsten, want een regel kan net zo goed over je salaris
   gaan als over de supermarkt. De lijst die de rest van de app gebruikt
   toont er maar één soort tegelijk, en dan zou je een inkomstenregel
   hier niet kunnen zien staan. */
function categorieKeuzes(gekozen) {
  const groep = (soort, label) => {
    const lijst = state.categorieen
      .filter(c => (c.soort || "uitgave") === soort)
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!lijst.length) return "";
    return `<optgroup label="${label}">` + lijst.map(c =>
      `<option value="${esc(c.id)}" ${c.id === gekozen ? "selected" : ""}>${esc(c.icoon)} ${esc(c.naam)}</option>`
    ).join("") + "</optgroup>";
  };
  return `<option value="">— geen categorie —</option>`
    + groep("uitgave", "Uitgaven") + groep("inkomst", "Inkomsten");
}

/* ---------------------------------------------------------------
   Bedienen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", async e => {
    if (e.target.closest("[data-toepassen]")) return toepassen();
    const wis = e.target.closest("[data-wis-regel]");
    if (wis) return wisDezeRegel(wis.dataset.wisRegel);
  });

  /* Een keuze hier verandert alleen de regel, niet je boekingen. Wat je
     al hebt ingedeeld hoort niet onder je handen te verschuiven. */
  wortel.addEventListener("change", e => {
    const rij = e.target.closest("[data-regel]");
    if (!rij) return;
    const regel = state.regels.find(r => r.id === rij.dataset.regel);
    if (!regel || !eisBewerkrecht()) return;

    if (e.target.matches("[data-regel-categorie]")) {
      bewaarRegel({ ...regel, categorie: e.target.value });
    }
    if (e.target.matches("[data-regel-potje]")) {
      bewaarRegel({ ...regel, potje: e.target.value });
    }
    opBinnenkomst();
  });
}

async function toepassen() {
  if (!eisBewerkrecht()) return;
  const aantal = await pasRegelsToe();
  openTeDelen = 0;
  melding(aantal
    ? `${aantal} ${aantal === 1 ? "boeking" : "boekingen"} ingedeeld.`
    : "Er was niets meer in te delen.", "goed");
  meld();
}

async function wisDezeRegel(id) {
  if (!eisBewerkrecht()) return;
  const regel = state.regels.find(r => r.id === id);
  if (!regel) return;
  const zeker = await bevestig(
    `De app vergeet dat "${regel.trefwoord}" ergens bij hoort. Boekingen die er al staan veranderen niet.`,
    { titel: "Regel weghalen?", bevestigLabel: "Weghalen", gevaar: true });
  if (zeker) wisRegel(id);
}
