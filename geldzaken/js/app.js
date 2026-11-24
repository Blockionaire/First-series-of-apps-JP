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

import { state, abonneer, start, Sync, magBewerken, eenvoudig } from "./store.js";
import { $, zetValuta, zetPrivacy, melding, spoorBij } from "./util.js";
import * as Bank from "./bank.js";

import * as Dashboard   from "./views/dashboard.js";
import * as Overzicht   from "./views/overzicht.js";
import * as Verdelen    from "./views/verdelen.js";
import * as Inkomen     from "./views/inkomen.js";
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
import * as Regels      from "./views/regels.js";
import * as Vragen      from "./views/vragen.js";
import * as Toegang     from "./views/toegang.js";

/* ---------------------------------------------------------------
   De schermen
   ---------------------------------------------------------------
   Elk scherm levert `titel(params)` en `html(params)`, en mag met
   `koppel(wortel, params)` listeners ophangen. Geeft `koppel` een
   functie terug, dan wordt die aangeroepen als het scherm weggaat.
   --------------------------------------------------------------- */
const SCHERMEN = {
  start:        Dashboard,     // in de eenvoudige modus wordt dit Overzicht
  overzicht:    Overzicht,
  verdelen:     Verdelen,
  inkomen:      Inkomen,
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
  vragen:       Vragen,
  regels:       Regels,
};

const TAB_VAN_SCHERM = {
  start: "start", overzicht: "start", instellingen: "start", beheer: "start",
  rekeningen: "start", inkomen: "start",
  maand: "maand", importeren: "maand",
  regels: "start",
  vragen: "cijfers",
  boeken: "boeken",
  verdelen: "verdelen",
  potjes: "potjes", doelen: "potjes",
  cijfers: "cijfers", vast: "cijfers",
};

/* Twee balken, want de twee manieren van bijhouden vragen om andere
   knoppen. Op hoofdlijnen draait alles om verdelen; wie alles bijhoudt
   wil bij zijn boekingen kunnen. */
const TABS_EENVOUDIG = [
  { id: "start",    route: "#/start",                 icoon: "🥧", label: "Overzicht" },
  { id: "verdelen", route: "#/verdelen",              icoon: "⚖️", label: "Verdelen" },
  { id: "boeken",   route: "#/boeken/nieuw/inkomst",  icoon: "＋", label: "Inkomst", hoofd: true },
  { id: "potjes",   route: "#/potjes",                icoon: "🫙", label: "Potjes" },
  { id: "cijfers",  route: "#/cijfers",               icoon: "📊", label: "Cijfers" },
];

const TABS_VOLLEDIG = [
  { id: "start",   route: "#/start",   icoon: "🏠", label: "Start" },
  { id: "maand",   route: "#/maand",   icoon: "📒", label: "Boekingen" },
  { id: "boeken",  route: "#/boeken",  icoon: "＋", label: "Nieuw", hoofd: true },
  { id: "potjes",  route: "#/potjes",  icoon: "🫙", label: "Potjes" },
  { id: "cijfers", route: "#/cijfers", icoon: "📊", label: "Cijfers" },
];

/* Welk scherm hoort bij een routenaam? Alleen "start" verschilt per
   modus; de rest is in beide gewoon bereikbaar. */
function schermVoor(naam) {
  if (naam === "start") return eenvoudig() ? Overzicht : Dashboard;
  return SCHERMEN[naam];
}

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
let laatsteHtml = null;      // wat er nu op het scherm staat
let ronde = 0;               // hoeveelste hertekening dit is
let vingerNeer = false;      // staat er op dit moment een vinger op het scherm?
let wachtendeTekening = false;
const scrollGeheugen = {};
let opruimen = null;

function teken() {
  const app = $("#app");
  if (!app) return;

  /* Raakt iemand op dit moment het scherm aan, dan wachten we. Het
     element onder een vinger weghalen betekent dat die tik nergens
     aankomt — zie `volgAanrakingen`. Zodra de vinger loslaat gebeurt
     dit alsnog. */
  if (vingerNeer) { wachtendeTekening = true; return; }

  /* Eerst de poort: mag deze bezoeker überhaupt naar binnen? */
  const poort = poortStatus();
  if (poort) {
    if (poort !== vorigePoort) {
      opruimen?.(); opruimen = null;
      app.innerHTML = Toegang.html(poort);
      laatsteHtml = null;
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
  const scherm = schermVoor(naam);
  const routeSleutel = location.hash;
  const nieuwScherm = routeSleutel !== vorigeRoute;

  if (naam !== vorigSchermNaam || (nieuwScherm && params.length)) {
    scherm.opBinnenkomst?.(params, vorigSchermNaam);
    vorigSchermNaam = naam;
  }

  if (nieuwScherm && vorigeRoute) scrollGeheugen[vorigeRoute] = window.scrollY;

  const html = `
    ${scherm.kop ? scherm.kop(params) : standaardKop(scherm, params)}
    <main class="scherm" id="scherm">${scherm.html(params)}</main>
    ${tabbalk(naam)}`;

  /* Verandert er niets aan wat er te zien is, dan blijft het scherm
     staan zoals het staat. Dat scheelt niet alleen werk: elke
     hertekening gooit de knop weg waar je vinger op onderweg is, en
     dan komt je tik nergens aan. Precies dat gebeurde als er nog een
     opslagje van een halve seconde geleden binnenkwam terwijl jij een
     schakelaar aantikte. */
  if (!nieuwScherm && html === laatsteHtml) return;

  /* Een hertekening vervangt het hele scherm. Stond je in een veld te
     typen, dan ben je zonder dit je cursor — en soms je halve zin —
     kwijt. Bij een échte schermwissel doen we het niet: dan hoort de
     focus juist weg te zijn. */
  const focus = nieuwScherm ? null : bewaarFocus();

  opruimen?.();
  opruimen = null;

  app.innerHTML = html;
  laatsteHtml = html;

  const wortel = $("#scherm", app);
  /* Elke hertekening krijgt een nummer. Reageert er straks een
     afhandelaar die bij een ouder nummer hoort, dan weten we dat het
     scherm onder zijn handen is vervangen — en dat is precies het soort
     stilte dat van buiten niet te zien is. */
  if (wortel) wortel.dataset.ronde = String(++ronde);
  opruimen = scherm.koppel?.(wortel, params) || null;

  app.querySelector("[data-terug]")?.addEventListener("click", () => terug(scherm.terugNaar || "#/start"));

  if (nieuwScherm) {
    window.scrollTo(0, scrollGeheugen[routeSleutel] || 0);
    vorigeRoute = routeSleutel;
  } else {
    herstelFocus(focus);
  }

  document.title = (scherm.titel?.(params) || "Geldzaken") + " · Geldzaken";
}

function bewaarFocus() {
  const el = document.activeElement;
  if (!el || !el.id || !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return null;
  const staat = { id: el.id, start: null, eind: null };
  try { staat.start = el.selectionStart; staat.eind = el.selectionEnd; } catch { /* niet elk veld kan dat */ }
  return staat;
}

function herstelFocus(staat) {
  if (!staat) return;
  const el = document.getElementById(staat.id);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (staat.start != null) el.setSelectionRange(staat.start, staat.eind); }
  catch { /* een selectievak heeft geen cursorpositie */ }
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
  const tabs = eenvoudig() ? TABS_EENVOUDIG : TABS_VOLLEDIG;
  return `
    <nav class="tabbalk" aria-label="Hoofdmenu">
      ${tabs.map(t => `
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
   Aanrakingen volgen
   ---------------------------------------------------------------
   Een knop die niets doet heeft maar een handvol oorzaken, en van
   buitenaf zien ze er alle hetzelfde uit. Dit scheidt ze.

   Een klik ontstaat pas als indrukken én loslaten op hetzelfde element
   gebeuren. Wordt het scherm daartussenin opnieuw getekend, dan bestaat
   dat element niet meer en komt er helemaal geen klik — ook een
   klapvakje gaat dan niet open, terwijl typen wél blijft werken, want
   een veld krijgt zijn focus al bij het indrukken. Precies dat verschil
   is hieronder af te lezen.

   Het luistert op het document, niet op het scherm: ligt er iets
   overheen dat de tik opvangt, dan noemt het spoor dat ding bij naam.
   --------------------------------------------------------------- */
export const merkVan = el => {
  if (!el || !el.tagName) return "niets";
  const merk = [...(el.attributes || [])].map(a => a.name).find(n => n.startsWith("data-"));
  const klasse = String(el.className || "").trim().split(/\s+/)[0];
  return el.tagName.toLowerCase()
    + (el.id ? `#${el.id}` : "")
    + (merk ? ` ${merk}` : klasse ? ` .${klasse}` : "");
};

function volgAanrakingen() {
  let ingedrukt = null;

  /* Zolang je vinger op het scherm staat tekenen we niet opnieuw.

     Een klik ontstaat pas als indrukken én loslaten op hetzelfde
     element gebeuren. Hertekent de app daartussenin, dan is dat element
     weg en komt er geen klik — de knop lijkt stuk. Dat is hier
     herhaaldelijk gebeurd, en het was nooit de knop: de boodschappen-
     koppeling haalt bij het openen zijn gegevens op, en dat antwoord
     landt een seconde of twee later. Precies wanneer je aan het tikken
     bent.

     Wachten kost niets. Een hertekening een halve tel uitstellen ziet
     niemand; een tik die nergens aankomt wel. */
  const laatLos = () => {
    vingerNeer = false;
    clearTimeout(noodklok);
    if (wachtendeTekening) { wachtendeTekening = false; teken(); }
  };
  let noodklok = 0;

  document.addEventListener("pointerdown", () => {
    vingerNeer = true;
    /* Komt er geen loslaten — het gebeurt — dan gaat het na een tel
       gewoon door. Liever een late hertekening dan een bevroren app. */
    clearTimeout(noodklok);
    noodklok = setTimeout(laatLos, 1500);
  }, true);
  document.addEventListener("pointerup", laatLos, true);
  document.addEventListener("pointercancel", laatLos, true);

  document.addEventListener("pointerdown", e => {
    const el = e.target.closest?.("button, summary, a, input, label, .rij, .schakelrij") || e.target;
    ingedrukt = el;
    let regel = `tik op ${merkVan(el)}`;

    /* Een uitgeschakelde knop laat geen aanraking door: de tik landt op
       het vakje eromheen. In het spoor zie je dan een `div` waar je een
       knop verwachtte, dus zeggen we erbij welke knop daar uit staat. */
    if (el.disabled) regel += " — die staat uit";
    else if (!el.matches?.("button, summary, a, input, label")) {
      const uit = [...(el.querySelectorAll?.("button:disabled, input:disabled") || [])].map(merkVan);
      if (uit.length) regel += ` — hierin staat uitgeschakeld: ${uit.join(", ")}`;
    }
    spoorBij(regel);
  }, true);

  document.addEventListener("pointerup", e => {
    const el = e.target.closest?.("button, summary, a, input, label, .rij, .schakelrij") || e.target;
    if (el === ingedrukt) return;                     // gewoon goed, niets te melden
    spoorBij(ingedrukt && !ingedrukt.isConnected
      ? `losgelaten op ${merkVan(el)} — waar je op drukte was weg, dus geen klik`
      : `losgelaten op ${merkVan(el)} — iets anders dan waar je op drukte`);
  }, true);

  document.addEventListener("click", e => {
    spoorBij(`klik op ${merkVan(e.target.closest?.("button, summary, a, input, label") || e.target)}`);
  }, true);
}

/* ---------------------------------------------------------------
   Opstarten
   --------------------------------------------------------------- */
let laatsteInstellingen = "";

async function opstarten() {
  window.addEventListener("hashchange", teken);

  /* Een scriptfout in een app op je beginscherm is volkomen onzichtbaar:
     er is geen console waar hij in terechtkomt. Wat je ziet is een knop
     die niets doet — en wie dat overkomt, zoekt de fout op de verkeerde
     plek. Dus zegt de app het voortaan zelf. */
  window.addEventListener("error", e => {
    const waar = e.filename ? ` (${String(e.filename).split("/").pop()}:${e.lineno})` : "";
    spoorBij(`scriptfout: ${e.message}${waar}`);
    melding(`Er ging iets mis in de app: ${e.message}`, "fout");
  });
  window.addEventListener("unhandledrejection", e => {
    const reden = e.reason?.message || String(e.reason ?? "onbekend");
    spoorBij(`fout zonder vangnet: ${reden}`);
    melding(`Er ging iets mis in de app: ${reden}`, "fout");
  });

  volgAanrakingen();

  abonneer(() => {
    const stempel = `${state.instellingen.thema}|${state.instellingen.valuta}|${state.instellingen.privacy}|${state.instellingen.modus}`;
    if (stempel !== laatsteInstellingen) {
      laatsteInstellingen = stempel;
      pasThemaToe(state.instellingen.thema);
      zetValuta(state.instellingen.valuta);
      zetPrivacy(state.instellingen.privacy);
    }
    teken();
  });

  await start();

  /* Kom je net terug van je bank, dan staat het sessienummer in het
     anker van het adres. Dat moet opgeruimd zijn vóór de router het
     als route leest, en vóór er iets getekend wordt. */
  await Bank.laad();
  const bankTerugkomst = await Bank.verwerkTerugkomst();

  const laden = $("#laden");
  if (laden) {
    laden.classList.add("is-weg");
    setTimeout(() => laden.remove(), 400);
  }

  /* Eén regel met de omstandigheden. Zonder dit is elk antwoord op
     "waarom doet die knop niets" een gok over welke app, welke versie en
     welk startscherm er eigenlijk draait. */
  /* Mag de app zelf ophalen, en is het lang genoeg geleden? Niet
     afwachten: het scherm hoort er niet op te blijven staan, en zodra
     er iets binnen is meldt het zich vanzelf. */
  Bank.haalZelfOp().then(aantal => { if (aantal) teken(); });

  spoorBij([
    `start · ${window.matchMedia("(display-mode: standalone)").matches || navigator.standalone ? "vanaf beginscherm" : "in de browser"}`,
    `scherm ${window.innerWidth}×${window.innerHeight}`,
    navigator.serviceWorker?.controller ? "servicewerker stuurt" : "geen servicewerker",
    laden ? "laadscherm weggehaald" : "geen laadscherm aangetroffen",
  ].join(" · "));

  if (!location.hash) ga("#/start", { vervang: true });
  teken();

  if (bankTerugkomst === "gekoppeld") {
    melding("Je bankrekening is gekoppeld.", "goed");
  } else if (bankTerugkomst) {
    melding(Bank.bank.fout || "Het koppelen is niet gelukt.", "fout");
  }

  regelServiceWorker();
}

/* ---------------------------------------------------------------
   Service worker: installeerbaar maken, offline laten werken — en
   zichzelf op tijd vervangen
   ---------------------------------------------------------------
   Dat laatste is het lastige stuk. Staat de app op je beginscherm, dan
   sluit je hem nooit echt af, en dan blijft de oude versie draaien:
   je ziet een nieuwe versie pas als de browser toevallig besluit
   sw.js opnieuw op te halen. Daarom drie dingen:

   - `updateViaCache: "none"` — sw.js zelf nooit uit de browsercache
     halen, anders kijk je naar een oude wegwijzer.
   - bij elke start én zodra je terugkomt in de app even navragen of er
     een nieuwe versie klaarstaat.
   - neemt die het over, dan één keer herladen, zodat je meteen de
     nieuwe code draait in plaats van bij de volgende keer pas.
   --------------------------------------------------------------- */
function regelServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  /* Eén keer herladen, nooit twee keer: anders blijft de app in een
     kringetje verversen. Bij de allereerste installatie hoeft het niet,
     want dan draai je die code al. */
  let herlaadt = false;
  const hadAlEenVersie = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (herlaadt || !hadAlEenVersie) return;
    herlaadt = true;
    location.reload();
  });

  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then(registratie => {
      registratie.update().catch(() => { /* dan de volgende keer */ });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registratie.update().catch(() => { /* geen bereik, geeft niet */ });
        }
      });
    })
    .catch(() => { /* zonder servicewerker werkt de app ook */ });
}

export { Sync };

opstarten();
