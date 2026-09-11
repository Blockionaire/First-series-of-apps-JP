/* =====================================================================
   GOALS — the app itself
   =====================================================================
   Keeps track of which screen is open, draws it, and draws it again as
   soon as the data changes. Navigation goes through the address
   (#/goals), so the phone's back button behaves.

   Every screen is a module with `title(params)`, `html(params)` and an
   optional `mount(root, params)` that hangs listeners and may return a
   cleanup function.
   ===================================================================== */

import { state, subscribe, start, Sync, activePeriod } from "./store.js";
import { $, applyTheme, esc } from "./util.js";
import { icon } from "./icons.js";

import * as Home     from "./views/home.js";
import * as Goals    from "./views/goals.js";
import * as Goal     from "./views/goal.js";
import * as Curiosity from "./views/curiosity.js";
import * as Topic    from "./views/topic.js";
import * as Module   from "./views/module.js";
import * as Reviews  from "./views/reviews.js";
import * as Review   from "./views/review.js";
import * as Settings from "./views/settings.js";
import * as Search   from "./views/search.js";
import * as Account  from "./views/account.js";
import { openLog } from "./log.js";

const SCREENS = {
  home: Home,
  goals: Goals,
  goal: Goal,
  curiosity: Curiosity,
  topic: Topic,
  module: Module,
  reviews: Reviews,
  review: Review,
  settings: Settings,
  search: Search,
};

/* Which bottom tab lights up for which screen. */
const TAB_OF = {
  home: "home", settings: "home", search: "home",
  goals: "goals", goal: "goals", period: "goals",
  curiosity: "curiosity", topic: "curiosity", module: "curiosity",
  reviews: "reviews", review: "reviews",
};

const NAV = [
  { id: "home",      label: "Home",      route: "#/home" },
  { id: "goals",     label: "Goals",     route: "#/goals" },
  { id: "curiosity", label: "Curiosity", route: "#/curiosity" },
  { id: "reviews",   label: "Reviews",   route: "#/reviews" },
  { id: "settings",  label: "Settings",  route: "#/settings" },
];

const TABS = [
  { id: "home",      label: "Home",      glyph: "home", route: "#/home" },
  { id: "goals",     label: "Goals",     glyph: "goals", route: "#/goals" },
  { id: "log",       label: "Log",       glyph: "plus", action: "log" },
  { id: "curiosity", label: "Curiosity", glyph: "curiosity", route: "#/curiosity" },
  { id: "reviews",   label: "Reviews",   glyph: "reviews", route: "#/reviews" },
];

/* ---------------------------------------------------------------
   Routing
   --------------------------------------------------------------- */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || "home", params: parts.slice(1) };
}

let current = { name: null, cleanup: null };

export function go(route) {
  if (location.hash === route) render();
  else location.hash = route;
}

/* ---------------------------------------------------------------
   Drawing
   --------------------------------------------------------------- */
let pending = false;

function render() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
}

function draw() {
  const app = $("#app");
  const { name, params } = parseRoute();

  /* An app with a cloud that insists on an account shows nothing else
     until you are in. */
  const screen = Sync.needsAccount() ? Account : (SCREENS[name] || NotFound);
  const isSame = current.name === name;

  if (current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current.cleanup = null;

  document.title = screen.title ? `${screen.title(params)} · Goals` : "Goals";

  /* A screen that throws should cost you that screen, not the app. */
  let body;
  try {
    body = screen.html(params);
  } catch (error) {
    console.error(error);
    body = failed(error);
  }

  app.innerHTML = `
    <div class="shell">
      ${screen === Account ? "" : `<a class="skip" href="#main">Skip to content</a>`}
      ${screen === Account ? "" : masthead(name)}
      <main class="page" id="main">${body}</main>
      ${screen === Account ? "" : tabbar(name)}
    </div>`;

  if (screen.mount) {
    try {
      current.cleanup = screen.mount($("#main"), params) || null;
    } catch (error) {
      console.error(error);
    }
  }
  current.name = name;

  if (!isSame) window.scrollTo({ top: 0 });
  hookChrome();
}

function masthead(active) {
  /* The bottom bar folds settings and search under Home; the wide
     navigation has room to show them for what they are. */
  const tab = active === "settings" || active === "search" ? active : (TAB_OF[active] || active);
  return `
    <header class="masthead">
      <div class="page masthead__inner">
        <a class="wordmark" href="#/home">Goals</a>
        <nav class="nav" aria-label="Main">
          ${NAV.map(item => `
            <a class="nav__link ${tab === item.id ? "is-active" : ""}" href="${item.route}"
               ${tab === item.id ? 'aria-current="page"' : ""}>${item.label}</a>
          `).join("")}
        </nav>
        <div class="row">
          <a class="icon-button" href="#/search" aria-label="Search">${icon("search")}</a>
          <a class="icon-button nav-settings" href="#/settings" aria-label="Settings">${icon("settings")}</a>
        </div>
      </div>
    </header>`;
}

function tabbar(active) {
  const tab = TAB_OF[active] || active;
  return `
    <nav class="tabbar" aria-label="Sections">
      ${TABS.map(item => item.action
        ? `<button class="tabbar__item tabbar__item--action" data-action="${item.action}">
             <span class="tabbar__glyph" aria-hidden="true">${icon(item.glyph, { size: 18 })}</span>
             <span>${item.label}</span>
           </button>`
        : `<a class="tabbar__item ${tab === item.id ? "is-active" : ""}" href="${item.route}"
             ${tab === item.id ? 'aria-current="page"' : ""}>
             <span class="tabbar__glyph" aria-hidden="true">${icon(item.glyph, { size: 19 })}</span>
             <span>${item.label}</span>
           </a>`).join("")}
    </nav>`;
}

function hookChrome() {
  const button = $('[data-action="log"]');
  if (button) button.addEventListener("click", () => openLog());
}

export const log = (...args) => openLog(...args);

function failed(error) {
  return `
    <div class="empty" style="padding-top:12vh">
      <p class="empty__title">This screen could not be drawn.</p>
      <p>${esc(error.message || String(error))}</p>
      <p style="margin-top:16px"><a class="link" href="#/home">Back to Home</a></p>
    </div>`;
}

/* A hash nobody recognises. Better to say so than to quietly show
   something else and leave you wondering what you clicked. */
const NotFound = {
  title: () => "Not found",
  html: () => `
    <div class="empty" style="padding-top:14vh">
      <p class="empty__title">There is nothing at this address.</p>
      <p>It may have been deleted, or the link may be old.</p>
      <p style="margin-top:16px"><a class="link" href="#/home">Back to Home</a></p>
    </div>`,
};

/* ---------------------------------------------------------------
   Boot
   --------------------------------------------------------------- */
async function boot() {
  applyTheme(localStorage.getItem("goals.theme") || "auto");

  window.addEventListener("hashchange", render);
  subscribe(render);

  try {
    await start();
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `
      <div class="page" style="padding-top:80px">
        <h1 class="title">Something went wrong while opening your goals.</h1>
        <p class="prose" style="margin-top:12px">${esc(e.message || String(e))}</p>
        <p class="prose" style="margin-top:12px">Reloading usually fixes it. If it does not, your browser may be blocking storage for this site.</p>
      </div>`;
    return;
  }

  applyTheme(state.settings.theme || "auto");
  if (!location.hash) location.hash = "#/home";

  const splash = $("#splash");
  if (splash) splash.remove();

  render();

  /* Keep the period header honest across midnight. */
  window.addEventListener("focus", () => { if (activePeriod()) render(); });
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  applyTheme(state.settings.theme || "auto");
});

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(e => console.warn("No offline mode:", e));
  });
}
