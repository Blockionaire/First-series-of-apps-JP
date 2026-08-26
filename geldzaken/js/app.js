/* =====================================================================
   GELDZAKEN — de app zelf
   =====================================================================
   Houdt bij welk scherm open is, tekent het, en tekent het opnieuw
   zodra er iets aan de gegevens verandert. Navigeren gaat via het adres
   (#/potjes), zodat de terugknop van de telefoon gewoon werkt.

   Voor het eerste scherm getekend wordt komt de poort langs: is er een
   account nodig, ben je ingelogd, en heeft de beheerder je toegelaten?
   Zolang dat niet klopt, komt er geen cijfer in beeld.
   ===================================================================== */

import { state, abonneer, start, Sync, magBewerken } from "./store.js";
import { $, zetValuta, zetPrivacy, melding } from "./util.js";

import * as Dashboard   from "./views/dashboard.js";
import * as Maand       from "./views/maand.js";
import * as Boeken      from "./views/boeken.js";
import * as Vast        from "./views/vast.js";
import * as Potjes      from "./views/potjes.js";
import * as Doelen      from "./views/doelen.js";
import * as Rekeningen  from "./views/rekeningen.js";
import * as Cijfers     from "./views/cijfers.js";
import * as Instellingen from "./views/instellingen.js";
import * as Beheer      from "./views/beheer.js";
import * as Importeren  from "./views/importeren.js";
import * as Toegang     from "./views/toegang.js";

/* ---------------------------------------------------------------
   De schermen
   ---------------------------------------------------------------
   Elk scherm levert `titel(params)` en `html(params)`, en mag met
   `koppel(wortel, params)` listeners ophangen. Geeft `koppel` een
   functie terug, dan wordt die aangeroepen als het scherm weggaat.
   --------------------------------------------------------------- */
const SCHERMEN = {
  start:        Dashboard,
  maand:        Maand,
  boeken:       Boeken,
  vast:         Vast,
  potjes:       Potjes,
  doelen:       Doelen,
  rekeningen:   Rekeningen,
  cijfers:      Cijfers,
  instellingen: Instellingen,
  beheer:       Beheer,
  importeren:   Importeren,
};

const TAB_VAN_SCHERM = {
  start: "start", instellingen: "start", beheer: "start", rekeningen: "start",
  maand: "maand", importeren: "maand",
  boeken: "boeken",
  potjes: "potjes", doelen: "potjes",
  cijfers: "cijfers", vast: "cijfers",
};

const TABS = [
  { id: "start",   route: "#/start",   icoon: "🏠", label: "Start" },
  { id: "maand",   route: "#/maand",   icoon: "📒", label: "Boekingen" },
  { id: "boeken",  route: "#/boeken",  icoon: "＋", label: "Nieuw", hoofd: true },
  { id: "potjes",  route: "#/potjes",  icoon: "🫙", label: "Potjes" },
  { id: "cijfers", route: "#/cijfers", icoon: "📊", label: "Cijfers" },
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

export function terug(standaard = "#/start") {
  if (history.length > 1) history.back();
  else ga(standaard);
}

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
let vorigeRoute = "";
let vorigSchermNaam = null;
let vorigePoort = null;
const scrollGeheugen = {};
let opruimen = null;

function teken() {
  const app = $("#app");
  if (!app) return;

  /* Eerst de poort: mag deze bezoeker überhaupt naar binnen? */
  const poort = poortStatus();
  if (poort) {
    if (poort !== vorigePoort) {
      opruimen?.(); opruimen = null;
      app.innerHTML = Toegang.html(poort);
      opruimen = Toegang.koppel(app, poort) || null;
      vorigePoort = poort;
      vorigSchermNaam = null;
      vorigeRoute = "";
      document.title = "Geldzaken";
    } else {
      Toegang.ververs?.(app, poort);
    }
    return;
  }
  vorigePoort = null;

  const { naam, params } = huidigeRoute();
  const scherm = SCHERMEN[naam];
  const routeSleutel = location.hash;
  const nieuwScherm = routeSleutel !== vorigeRoute;

  if (naam !== vorigSchermNaam || (nieuwScherm && params.length)) {
    scherm.opBinnenkomst?.(params, vorigSchermNaam);
    vorigSchermNaam = naam;
  }

  if (nieuwScherm && vorigeRoute) scrollGeheugen[vorigeRoute] = window.scrollY;

  opruimen?.();
  opruimen = null;

  app.innerHTML = `
    ${scherm.kop ? scherm.kop(params) : standaardKop(scherm, params)}
    <main class="scherm" id="scherm">${scherm.html(params)}</main>
    ${tabbalk(naam)}`;

  const wortel = $("#scherm", app);
  opruimen = scherm.koppel?.(wortel, params) || null;

  app.querySelector("[data-terug]")?.addEventListener("click", () => terug(scherm.terugNaar || "#/start"));

  if (nieuwScherm) {
    window.scrollTo(0, scrollGeheugen[routeSleutel] || 0);
    vorigeRoute = routeSleutel;
  }

  document.title = (scherm.titel?.(params) || "Geldzaken") + " · Geldzaken";
}

function standaardKop(scherm, params) {
  const titel = scherm.titel?.(params) || "Geldzaken";
  const sub = scherm.ondertitel?.(params) || "";
  return `
    <header class="kop">
      ${scherm.terugknop ? `<button class="icoonknop icoonknop--kaal" data-terug aria-label="Terug">‹</button>` : ""}
      <div class="kop__titel">
        <h1>${titel}</h1>
        ${sub ? `<div class="kop__sub">${sub}</div>` : ""}
      </div>
      <div class="kop__acties">${scherm.kopActies?.(params) || ""}</div>
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

/* ---------------------------------------------------------------
   De poort
   ---------------------------------------------------------------
   Geeft terug welk toegangsscherm er moet komen, of null als de app
   gewoon open mag. Zonder Firebase draait alles lokaal en is er niets
   af te schermen — dan gaat de poort meteen open.
   --------------------------------------------------------------- */
function poortStatus() {
  if (!Sync.sync.beschikbaar) return null;
  if (!state.geladen) return null;

  switch (Sync.sync.status) {
    case "laden":      return "laden";
    case "uitgelogd":  return "inloggen";
    case "wacht":      return "wacht";
    case "geweigerd":  return "geweigerd";
    case "geblokkeerd":return "geblokkeerd";
    case "actief":     return null;
    default:           return "laden";
  }
}

/* ---------------------------------------------------------------
   Thema en privacy
   --------------------------------------------------------------- */
export function pasThemaToe(thema) {
  const html = document.documentElement;
  if (thema === "auto") html.removeAttribute("data-thema");
  else html.setAttribute("data-thema", thema);

  const donker = thema === "donker" ||
    (thema === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", donker ? "#090c11" : "#f2f5f9");
}

/* Een scherm mag hierlangs vragen of er wel geschreven mag worden. */
export function eisBewerkrecht() {
  if (magBewerken()) return true;
  melding("Je hebt alleen leesrechten. Vraag de beheerder om te mogen bewerken.", "fout");
  return false;
}

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
let laatsteInstellingen = "";

async function opstarten() {
  window.addEventListener("hashchange", teken);

  abonneer(() => {
    const stempel = `${state.instellingen.thema}|${state.instellingen.valuta}|${state.instellingen.privacy}`;
    if (stempel !== laatsteInstellingen) {
      laatsteInstellingen = stempel;
      pasThemaToe(state.instellingen.thema);
      zetValuta(state.instellingen.valuta);
      zetPrivacy(state.instellingen.privacy);
    }
    teken();
  });

  await start();

  const laden = $("#laden");
  if (laden) {
    laden.classList.add("is-weg");
    setTimeout(() => laden.remove(), 400);
  }

  if (!location.hash) ga("#/start", { vervang: true });
  teken();

  /* Service worker: installeerbaar maken en offline laten werken. */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* niet erg */ });
  }
}

export { Sync };

opstarten();
