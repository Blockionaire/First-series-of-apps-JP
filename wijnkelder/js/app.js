/* =====================================================================
   WIJNKELDER — de app zelf
   =====================================================================
   Houdt bij welk scherm open is, tekent het, en tekent het opnieuw
   zodra er iets aan de gegevens verandert. Navigeren gaat via het
   adres (#/kelder), zodat de terugknop van de telefoon gewoon werkt.
   ===================================================================== */

import { state, abonneer, start, Sync } from "./store.js";
import { $, zetValuta } from "./util.js";

import * as Start      from "./views/start.js";
import * as Kelder     from "./views/kelder.js";
import * as Toevoegen  from "./views/toevoegen.js";
import * as Fiche      from "./views/fiche.js";
import * as Combineer  from "./views/combineer.js";
import * as Cijfers    from "./views/cijfers.js";
import * as Historie   from "./views/historie.js";
import * as Wenslijst  from "./views/wenslijst.js";
import * as Profiel    from "./views/profiel.js";
import * as Kelder3D   from "./views/kelder3d.js";

/* ---------------------------------------------------------------
   De schermen
   ---------------------------------------------------------------
   Elk scherm levert `titel(params)`, `html(params)` en optioneel
   `koppel(wortel, params)` om listeners op te hangen.
   --------------------------------------------------------------- */
const SCHERMEN = {
  start:     Start,
  kelder:    Kelder,
  kelder3d:  Kelder3D,
  toevoegen: Toevoegen,
  fles:      Fiche,
  combineer: Combineer,
  cijfers:   Cijfers,
  historie:  Historie,
  wenslijst: Wenslijst,
  profiel:   Profiel,
};

/* Welke tab moet oplichten bij welk scherm. */
const TAB_VAN_SCHERM = {
  start: "start", kelder: "kelder", kelder3d: "kelder", fles: "kelder",
  toevoegen: "toevoegen", combineer: "combineer",
  cijfers: "cijfers", historie: "cijfers", wenslijst: "kelder", profiel: "start",
};

const TABS = [
  { id: "start",     route: "#/start",     icoon: "🏠", label: "Start" },
  { id: "kelder",    route: "#/kelder",    icoon: "🍷", label: "Kelder" },
  { id: "toevoegen", route: "#/toevoegen", icoon: "＋", label: "Toevoegen", hoofd: true },
  { id: "combineer", route: "#/combineer", icoon: "🍽️", label: "Combineer" },
  { id: "cijfers",   route: "#/cijfers",   icoon: "📊", label: "Cijfers" },
];

/* ---------------------------------------------------------------
   Route lezen en zetten
   --------------------------------------------------------------- */
export function huidigeRoute() {
  const hash = location.hash.replace(/^#\/?/, "") || "start";
  const [naam, ...rest] = hash.split("/");
  return { naam: SCHERMEN[naam] ? naam : "start", params: rest.map(decodeURIComponent) };
}

export function ga(route, { vervang = false } = {}) {
  if (vervang) location.replace(route);
  else location.hash = route;
}

export function terug(standaard = "#/kelder") {
  if (history.length > 1) history.back();
  else ga(standaard);
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
let vorigeRoute = "";
let vorigSchermNaam = null;
let scrollGeheugen = {};
let opruimen = null;

function teken() {
  const app = $("#app");
  if (!app) return;

  const { naam, params } = huidigeRoute();
  const scherm = SCHERMEN[naam];
  const routeSleutel = location.hash;
  const nieuwScherm = routeSleutel !== vorigeRoute;

  /* Een scherm dat net geopend wordt mag zich even klaarzetten. Dit is
     niet hetzelfde als hertekenen: bij een gegevenswijziging tekent het
     scherm opnieuw, maar dan is dit geen binnenkomst. */
  if (naam !== vorigSchermNaam || (nieuwScherm && params.length)) {
    scherm.opBinnenkomst?.(params, vorigSchermNaam);
    vorigSchermNaam = naam;
  }

  /* Scrollpositie onthouden per scherm, zodat je na het bekijken van
     een fles terugkomt waar je gebleven was in de lijst. */
  if (nieuwScherm && vorigeRoute) {
    scrollGeheugen[vorigeRoute] = window.scrollY;
  }

  opruimen?.();
  opruimen = null;

  app.innerHTML = `
    ${scherm.kop ? scherm.kop(params) : standaardKop(scherm, params)}
    <main class="scherm" id="scherm">${scherm.html(params)}</main>
    ${tabbalk(naam)}`;

  const wortel = $("#scherm", app);
  opruimen = scherm.koppel?.(wortel, params) || null;

  $$tabs(app);

  if (nieuwScherm) {
    window.scrollTo(0, scrollGeheugen[routeSleutel] || 0);
    vorigeRoute = routeSleutel;
  }

  document.title = (scherm.titel?.(params) || "Wijnkelder") + " · Wijnkelder";
}

function standaardKop(scherm, params) {
  const titel = scherm.titel?.(params) || "Wijnkelder";
  const sub = scherm.ondertitel?.(params) || "";
  return `
    <header class="kop">
      ${scherm.terugknop ? `<button class="icoonknop" data-terug aria-label="Terug">‹</button>` : ""}
      <div class="kop__titel">
        <h1>${titel}</h1>
        ${sub ? `<div class="kop__sub">${sub}</div>` : ""}
      </div>
      ${scherm.kopActies?.(params) || ""}
    </header>`;
}

function tabbalk(schermNaam) {
  const actief = TAB_VAN_SCHERM[schermNaam] || schermNaam;
  return `
    <nav class="tabbalk" aria-label="Hoofdmenu">
      ${TABS.map(t => `
        <a class="tab ${t.hoofd ? "tab--hoofd" : ""}" href="${t.route}"
           ${actief === t.id ? 'aria-current="page"' : ""}>
          <span class="tab__icoon" aria-hidden="true">${t.icoon}</span>
          <span>${t.label}</span>
        </a>`).join("")}
    </nav>`;
}

/* De terugknop in de kop werkt overal hetzelfde. */
function $$tabs(app) {
  app.querySelector("[data-terug]")?.addEventListener("click", () => terug());
}

/* ---------------------------------------------------------------
   Thema
   --------------------------------------------------------------- */
export function pasThemaToe(thema) {
  const html = document.documentElement;
  if (thema === "auto") html.removeAttribute("data-thema");
  else html.setAttribute("data-thema", thema);

  /* De adresbalk van de telefoon mee laten kleuren. */
  const donker = thema === "donker" ||
    (thema === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", donker ? "#14100f" : "#f7f3ee");
}

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
let laatsteInstellingen = "";

async function opstarten() {
  window.addEventListener("hashchange", teken);

  abonneer(() => {
    /* Thema en valuta volgen de instellingen. */
    const stempel = `${state.instellingen.thema}|${state.instellingen.valuta}`;
    if (stempel !== laatsteInstellingen) {
      laatsteInstellingen = stempel;
      pasThemaToe(state.instellingen.thema);
      zetValuta(state.instellingen.valuta);
    }
    teken();
  });

  await start();

  /* Het laadscherm mag weg zodra er echt iets staat. */
  const laden = $("#laden");
  if (laden) {
    laden.classList.add("is-weg");
    setTimeout(() => laden.remove(), 350);
  }

  if (!location.hash) ga("#/start", { vervang: true });
  teken();

  /* Service worker: alleen voor installeerbaarheid en offline gebruik. */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* niet erg */ });
  }
}

/* Kleine hulp voor de schermen: iets wat overal aangeroepen mag worden. */
export { Sync };

opstarten();
