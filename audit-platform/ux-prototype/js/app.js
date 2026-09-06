/* ============================================================================
   app.js — shell, hash router and event delegation.

   Views are pure `state -> HTML`. Everything interactive is a [data-act]
   attribute handled once here, so a re-render is a single innerHTML write.
   ========================================================================== */

import { esc, cx, btn, ICON, initPopover, hidePopover } from "./ui.js";
import { user, firm } from "./data-sources.js";
import { pipeline } from "./data-model.js";
import * as st from "./state.js";
import { S, act } from "./state.js";
import { demoBar, demoGo, demoStart, demoExit, STEPS } from "./demo.js";

import { home, clients, clientView, engagementView, revenue, prepare } from "./views/workflow.js";
import { coverage, generate, naDrawer, answerDrawer } from "./views/coverage.js";
import { review, editDrawer, resolveSourceDrawer, resolveConflictDrawer, bulkDrawer, sourceDrawer, explainDrawer } from "./views/review.js";
import { risksView, controlsView, rcm, openItemsView, gapDrawer, dismissDrawer } from "./views/rcm.js";
import { clientQuestionnaire, interview, cockpit } from "./views/gather.js";
import { signoff, exportView, settings } from "./views/close.js";

/* --- Routes ---------------------------------------------------------------- */

const ROUTES = {
  "#/": { view: home, nav: "work" },
  "#/clients": { view: clients, nav: "clients" },
  "#/client": { view: clientView, nav: "clients" },
  "#/engagement": { view: engagementView, nav: "clients" },
  "#/revenue": { view: revenue, nav: "clients" },
  "#/prepare": { view: prepare, nav: "clients" },
  "#/questionnaire": { view: clientQuestionnaire, bare: true },
  "#/interview": { view: interview, nav: "clients" },
  "#/cockpit": { view: cockpit, nav: "clients" },
  "#/coverage": { view: coverage, nav: "clients" },
  "#/generate": { view: generate, nav: "clients" },
  "#/review": { view: review, nav: "clients" },
  "#/risks": { view: risksView, nav: "clients" },
  "#/controls": { view: controlsView, nav: "clients" },
  "#/rcm": { view: rcm, nav: "clients" },
  "#/open-items": { view: openItemsView, nav: "clients" },
  "#/signoff": { view: signoff, nav: "clients" },
  "#/export": { view: exportView, nav: "clients" },
  "#/settings": { view: settings, nav: "settings" },
};

/* --- Shell ----------------------------------------------------------------- */

function rail(active) {
  const item = (id, label, href, icon) => `<button class="${cx("rail__item", active === id && "is-active")}"
    data-act="nav" data-href="${href}">${icon}<span>${esc(label)}</span></button>`;
  return `<nav class="rail">
    <div class="rail__brand">
      <div class="rail__mark"><i>A</i>Audit AI</div>
      <div class="rail__sub">${esc(firm.name)}</div>
    </div>
    <div class="rail__nav">
      ${item("work", "Work", "#/", ICON.work)}
      ${item("clients", "Clients", "#/clients", ICON.clients)}
      <div class="rail__label">Prototype</div>
      <button class="rail__item" data-act="demo-start">${ICON.chevron}<span>Design partner demo</span></button>
      <button class="rail__item" data-act="nav" data-href="#/cockpit">${ICON.external}<span>Future cockpit</span></button>
      <button class="rail__item" data-act="nav" data-href="#/questionnaire">${ICON.external}<span>Client questionnaire</span></button>
    </div>
    <div class="rail__foot">
      ${item("settings", "Settings", "#/settings", ICON.settings)}
      <div class="rail__user">
        <span class="rail__avatar">${esc(user.initials)}</span>
        <div><div class="rail__uname">${esc(user.name)}</div><div class="rail__urole">${esc(user.role)}</div></div>
      </div>
    </div>
  </nav>`;
}

function drawerHtml() {
  const d = S.drawer;
  if (!d) return "";
  switch (d.kind) {
    case "edit": return editDrawer(d.id);
    case "resolve-source": return resolveSourceDrawer(d.id);
    case "resolve-conflict": return resolveConflictDrawer(d.id);
    case "bulk": return bulkDrawer();
    case "source": return sourceDrawer(d.src, d.ref);
    case "explain": return explainDrawer(d.id);
    case "na": return naDrawer(d.id);
    case "answer": return answerDrawer(d.id, d.fact);
    case "gap": return gapDrawer(d.id);
    case "dismiss": return dismissDrawer(d.id);
    default: return "";
  }
}

function toastHtml() {
  if (!S.toast) return "";
  return `<div class="demobar" style="bottom:${S.demo ? "88px" : "20px"};background:var(--ink-800)">
    <span class="st st--approved"><i></i></span>
    <div class="demobar__t">${esc(S.toast)}</div>
  </div>`;
}

function render() {
  hidePopover();
  const hash = location.hash || "#/";
  const r = ROUTES[hash] || ROUTES["#/"];
  S.route = hash;

  const app = document.getElementById("app");
  app.innerHTML = r.bare
    ? `<div class="main">${r.view()}</div>`
    : `${rail(r.nav)}<div class="main">${r.view()}</div>`;

  document.getElementById("overlay").innerHTML = drawerHtml() + toastHtml() + demoBar();

  // Scroll a highlighted source into view inside the transcript drawer.
  const hit = document.getElementById("hit");
  if (hit) hit.scrollIntoView({ block: "center" });

  // The navigator has to actually navigate: bring the selected section to the
  // top of the document column. Consumed once, so ordinary re-renders (approve,
  // pin a source) leave the reader where they were.
  if (S.scrollTo) {
    document.getElementById("sec-" + S.scrollTo)?.scrollIntoView({ block: "start" });
    S.scrollTo = null;
  }
}

st.onChange(render);

/* --- Event delegation ------------------------------------------------------ */

const val = (id) => (document.getElementById(id)?.value || "").trim();

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset;
  const stop = () => e.preventDefault();

  switch (a.act) {
    /* navigation */
    case "nav": stop(); if (a.href) location.hash = a.href; break;
    case "reset": stop(); act.reset(); break;
    case "mock": stop(); st.S.toast = "Mocked in this prototype — no file, service or model is involved."; st.commit(st.S.toast); break;

    /* provenance */
    case "pin-source": {
      stop();
      // A chip clicked inside the document also selects its block, so the panel
      // always shows the sources of the statement the auditor just pointed at.
      const owner = el.closest(".doc__blk");
      if (owner?.dataset.block && owner.dataset.block !== S.selBlock) act.selectBlock(owner.dataset.block, true);
      act.pin(a.ref);
      break;
    }
    case "open-source": stop(); act.openDrawer({ kind: "source", src: a.src, ref: a.ref }); break;
    case "explain-nosource": stop(); act.openDrawer({ kind: "explain", id: a.block || S.selBlock }); break;

    /* review workspace */
    case "select-section": stop(); act.selectSection(a.id); break;
    case "select-block": act.selectBlock(a.block); break;
    case "approve-section": stop(); act.approveSection(a.id); break;
    case "reject-section": stop(); act.rejectSection(a.id); break;
    case "unapprove-section": stop(); act.unapproveSection(a.id); break;
    case "toggle-unresolved": stop(); act.toggleUnresolved(); break;
    case "bulk-approve": stop(); act.openDrawer({ kind: "bulk" }); break;
    case "confirm-bulk": stop(); act.bulkApprove(); break;
    case "edit-block": stop(); act.openDrawer({ kind: "edit", id: a.block }); break;
    case "save-edit": stop(); act.editBlock(a.block, val("edit-text")); break;
    case "reject-block": stop(); act.rejectBlock(a.block); break;
    case "resolve-source": stop(); act.openDrawer({ kind: "resolve-source", id: a.block }); break;
    case "accept-suggestion": stop(); act.editBlock(a.block, a.text); break;
    case "raise-item": stop(); S.drawer = null;
      st.commit("Open item raised. The statement stays blocked until the client answers."); break;
    case "resolve-conflict": stop(); act.openDrawer({ kind: "resolve-conflict", id: a.block }); break;
    case "pick-conflict": stop(); act.resolveContradiction(a.block, a.choice, a.text); break;

    /* coverage */
    case "toggle-expand": stop(); act.toggleExpand(a.id); break;
    case "mark-na": stop(); act.openDrawer({ kind: "na", id: a.item }); break;
    case "save-na": stop(); act.markNA(a.item, val("na-reason") || "No reason recorded."); break;
    case "record-answer": stop(); act.openDrawer({ kind: "answer", id: a.item, fact: a.fact }); break;
    case "save-answer": stop(); act.recordAnswer(a.item, a.fact, val("answer-text") || "Recorded by the auditor."); break;

    /* generation */
    case "run-pipeline": stop(); act.startGeneration(pipeline); break;

    /* risks and controls */
    case "select-risk": act.openDrawer(null); S.riskSel = a.id; st.commit(); break;
    case "open-risk": stop(); S.riskSel = a.id; st.commit(); break;
    case "decide-risk": stop(); act.decideRisk(a.id, a.d); break;
    case "clear-risk": stop(); delete S.riskDecisions[a.id]; st.commit(); break;
    case "accept-all-risks": stop(); act.decideAllRisks(); break;
    case "select-control": S.controlSel = a.id; st.commit(); break;
    case "decide-control": stop(); act.decideControl(a.id, a.d); break;
    case "clear-control": stop(); delete S.controlDecisions[a.id]; st.commit(); break;
    case "open-gap": stop(); act.openDrawer({ kind: "gap", id: a.id }); break;

    /* open items */
    case "set-item": stop(); act.setItemState(a.id, a.s); break;
    case "dismiss-item": stop(); act.openDrawer({ kind: "dismiss", id: a.id }); break;
    case "confirm-dismiss": stop(); act.setItemState(a.id, "dismissed"); break;

    /* gather modes */
    case "set-mode": stop(); act.setMode(a.mode); break;
    case "answer-q": stop(); act.answerQuestion(); break;
    case "cockpit-next": stop(); act.cockpitAdvance(); break;
    case "cockpit-play": stop(); act.cockpitToggle(); break;

    /* drawer + demo */
    case "close-drawer": stop(); act.closeDrawer(); break;
    case "demo-start": stop(); demoStart(); break;
    case "demo-next": stop(); demoGo(S.demoStep + 1); break;
    case "demo-prev": stop(); demoGo(S.demoStep - 1); break;
    case "demo-exit": stop(); demoExit(); break;
  }
});

/* --- Keyboard -------------------------------------------------------------- */

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.key === "Escape") { if (S.drawer) act.closeDrawer(); else if (S.demo) demoExit(); return; }
  if (S.drawer) return;

  if (S.demo) {
    if (e.key === "ArrowRight") { demoGo(S.demoStep + 1); return; }
    if (e.key === "ArrowLeft") { demoGo(S.demoStep - 1); return; }
  }

  if (S.route !== "#/review" || !S.generated) return;
  const secs = st.visibleSections();
  const i = secs.findIndex((s) => s.id === S.section);
  const cur = secs[i] || secs[0];
  if (!cur) return;

  switch (e.key.toLowerCase()) {
    case "j": e.preventDefault(); act.selectSection(secs[Math.min(i + 1, secs.length - 1)].id); break;
    case "k": e.preventDefault(); act.selectSection(secs[Math.max(i - 1, 0)].id); break;
    case "a": e.preventDefault(); if (st.sectionApprovable(cur)) act.approveSection(cur.id); break;
    case "u": e.preventDefault(); act.toggleUnresolved(); break;
    case "e": e.preventDefault(); act.openDrawer({ kind: "edit", id: S.selBlock || cur.blocks[0].id }); break;
  }
});

/* --- Boot ------------------------------------------------------------------ */

window.addEventListener("hashchange", render);
initPopover(document.body);
render();
