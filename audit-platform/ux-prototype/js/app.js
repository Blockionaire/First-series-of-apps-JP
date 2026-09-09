/* ============================================================================
   app.js — router, event delegation and the keyboard model.

   Views are pure `state -> HTML`. One click handler, one key handler.
   ========================================================================== */

import { esc, act as btn, icon as uiIcon } from "./ui.js";
import { pipeline, analysisPipeline, narrative } from "./data-model.js";
import { ref as srcRef } from "./data-sources.js";
import * as st from "./state.js";
import { S, act, undo, canUndo } from "./state.js";
import { palette, runPalette, matches } from "./palette.js";
import { demoBar, demoGo, demoStart, demoExit, STEPS } from "./demo.js";

import { work } from "./views/work.js";
import { engagementView, processHome, prepare } from "./views/process.js";
import { interview } from "./views/interview.js";
import { understanding } from "./views/understanding.js";
import { controlsStep } from "./views/controls.js";
import { trace } from "./views/trace.js";
import { testing } from "./views/testing.js";
import { resolve } from "./views/resolve.js";
import { complete, matrix, clientSurface } from "./views/complete.js";
import { cockpit } from "./views/cockpit.js";

window.__demoStart = demoStart;
window.__demoSteps = STEPS.length;
/* Test hooks. Read-only in practice; the smoke, route-integrity and
   state-integrity tests drive the app through them rather than through the DOM. */
window.__S = S;
window.__st = st;
window.__act = act;
window.__narrative = narrative;
window.__refs = (ids) => ids.map((id) => srcRef(id)).filter(Boolean);

const ROUTES = {
  "#/": work,                       // across engagements
  "#/engagement": engagementView,   // engagement layer
  "#/revenue": processHome,         // process workspace home
  "#/prepare": prepare,             // 1
  "#/interview": interview,         // 2
  "#/understanding": understanding, // 3
  "#/controls": controlsStep,       // 4
  "#/trace": trace,                 // 5
  "#/testing": testing,             // 6
  "#/complete": complete,           // 7
  "#/resolve": resolve,
  "#/matrix": matrix,
  "#/questionnaire": clientSurface,
  "#/cockpit": cockpit,
};

/* Screens that host a focus queue; leaving one drops out of it. */
const FOCUS_ROUTES = ["#/understanding", "#/controls", "#/trace"];

/* --- Overlays -------------------------------------------------------------- */

function undoBar() {
  if (!S.toast) return "";
  return `<div class="undo" role="status">
    <b>${esc(S.toast.label)}</b>
    ${S.toast.undoable && canUndo()
      ? `<button data-act="undo">${uiIcon("undo", 14)}Undo<span class="k">⌘Z</span></button>` : ""}
    <button data-act="dismiss-toast" title="Dismiss" style="opacity:.6">✕</button>
  </div>`;
}

function keysSheet() {
  if (S.sheet !== "keys") return "";
  const GROUPS = [
    ["Anywhere", [
      ["⌘K", "Search and commands"], ["/", "Search"],
      ["?", "This sheet"], ["⌘Z", "Undo the last decision"],
      ["Esc", "Back out one level"], ["→ ←", "Move through the demo"],
    ]],
    ["Statements — step 3", [
      ["Enter", "Use the correction as written"], ["E", "Edit it yourself"],
      ["A", "Ask the client about it"], ["R", "Reject the statement"],
      ["1 2 3", "Pick a resolution for a contradiction"],
    ]],
    ["Reading the working paper", [
      ["J K", "Next / previous section"], ["A", "Approve the section"],
    ]],
    ["Controls — step 4", [
      ["Enter", "Accept what is proposed"], ["K", "Key control"],
      ["N", "Not a key control"], ["C", "Carry forward undecided, with a reason"],
      ["U", "Park it — stays in the queue"], ["J", "Skip"],
    ]],
    ["Findings — step 4", [
      ["Enter", "Confirm as proposed"], ["M", "Modify before confirming"],
      ["D", "Dismiss"], ["J", "Skip"],
    ]],
    ["Line walkthrough — step 5", [
      ["Enter", "Accept the proposed verdict"], ["C", "Corroborated"],
      ["X", "Raise an exception"], ["J", "Skip"],
    ]],
  ];
  return `<div class="scrim" data-act="close-sheet"></div>
  <div class="sheet">
    <div class="row row--base">
      <h2 class="t-title">Keyboard</h2>
      <span class="sp"></span>
      ${btn("Close", "close-sheet", { variant: "ghost", size: "sm" })}
    </div>
    <p class="t-sub measure" style="margin-top:8px">Every queue can be worked without the mouse.
    A key only does something where the action exists.</p>
    ${GROUPS.map(([g, ks]) => `<div class="sec--tight">
      <div class="t-eyebrow rail__h">${esc(g)}</div>
      <div class="keys">${ks.map(([k, d]) => `<div><span class="k">${esc(k)}</span>${esc(d)}</div>`).join("")}</div>
    </div>`).join("")}
  </div>`;
}

let lastRoute = null;

function render() {
  const hash = location.hash || "#/";
  // Leaving a step that hosts a focus queue drops out of it, so coming back
  // lands on that step's overview rather than mid-queue.
  if (FOCUS_ROUTES.includes(lastRoute) && hash !== lastRoute) {
    S.reviewMode = "triage"; S.focusKind = null; S.focusIx = 0; S.editing = null;
  }
  lastRoute = hash;
  S.route = hash;
  const view = ROUTES[hash] || work;

  document.getElementById("app").innerHTML = view();
  document.getElementById("overlay").innerHTML = palette() + keysSheet() + undoBar() + demoBar();

  if (S.palette) {
    const inp = document.getElementById("pal-in");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
  const gq = document.getElementById("grid-q");
  if (gq && S.gridQuery && document.activeElement !== gq) {
    gq.focus(); gq.setSelectionRange(gq.value.length, gq.value.length);
  }
  const ed = document.getElementById("claim-edit") || document.getElementById("ans");
  if (ed && document.activeElement !== ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }

  if (S.scrollTo) {
    document.getElementById("sec-" + S.scrollTo)?.scrollIntoView({ block: "start", behavior: "smooth" });
    S.scrollTo = null;
  }
}

st.onChange(render);

/* --- Clicks ---------------------------------------------------------------- */

const val = (id) => (document.getElementById(id)?.value || "").trim();
const sel = (id) => document.getElementById(id)?.value || "";

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const d = el.dataset;
  e.preventDefault();

  switch (d.act) {
    case "nav":
      if (!d.href) break;
      // Activating the stage you are already on returns you to its overview —
      // the way back out of a focus queue without reaching for Escape.
      if (d.href === location.hash) {
        if (FOCUS_ROUTES.includes(d.href)) act.reviewMode("triage");
        else st.commit();
      } else location.hash = d.href;
      break;
    case "mock": act.toast("Mocked in this prototype — nothing is generated, sent or stored."); break;

    /* palette + sheets */
    case "palette": case "palette-eng": act.openPalette(); break;
    case "close-palette": act.closePalette(); break;
    case "pal-run": runPalette(Number(d.ix)); break;
    case "keys": act.sheet("keys"); break;
    case "close-sheet": act.sheet(null); break;
    case "disclose": act.disclose(d.id); break;
    case "grid-filter": act.gridFilter(d.f); break;
    case "undo": undo(); break;
    case "dismiss-toast": S.toast = null; st.commit(); break;

    /* review modes */
    case "read-mode": act.reviewMode("read"); break;
    case "triage-mode": act.reviewMode("triage"); break;
    case "start-focus": act.startFocus(d.kind); break;
    case "exit-focus": act.exitFocus(); break;
    case "focus-next": act.focusNext(); break;
    case "focus-claim": case "resolve-conflict": {
      const q = st.claimQueue();
      const i = q.findIndex((x) => x.b.id === d.claim);
      S.focusKind = "claims"; S.focusIx = Math.max(0, i); S.reviewMode = "focus";
      if (location.hash !== "#/understanding") location.hash = "#/understanding"; else st.commit();
      break;
    }
    case "run-pipeline": act.startGeneration(pipeline); break;
    case "read-gen": act.readGenResult(); break;
    case "run-analysis": act.startAnalysis(analysisPipeline); break;
    case "read-analysis": act.readAnalysis(); break;

    /* claims */
    case "toggle-claim": act.toggleClaim(d.claim); break;
    case "edit-claim": act.editClaim(d.claim); break;
    case "cancel-edit": act.cancelEdit(); break;
    case "save-claim": act.saveClaim(d.claim, val("claim-edit")); break;
    case "reject-claim": act.rejectClaim(d.claim); break;
    case "ask-about": act.askAbout(d.claim); break;
    case "use-suggestion": {
      const b = st.claimById(d.claim);
      act.saveClaim(d.claim, b.suggestion || b.text);
      break;
    }
    case "pick-conflict": act.resolveConflict(d.claim, d.choice, d.text); break;

    /* sections */
    case "approve-section": act.approveSection(d.id); break;
    case "reopen-section": act.reopenSection(d.id); break;
    case "accept-clean": act.acceptClean(); break;
    case "go-section": act.selectSection(d.id); break;

    /* controls, findings, the map */
    case "decide-control": act.decideControl(d.id, d.d); break;
    case "park-control": act.parkControl(d.id); break;
    case "carry-control-open": act.openEditor("carry:" + d.id); break;
    case "carry-control": act.carryControl(d.id, val("ans")); break;
    case "clear-control": act.clearControl(d.id); break;
    case "decide-finding": act.decideFinding(d.id, d.d); break;
    case "edit-finding": act.editFinding(d.id); break;
    case "cancel-finding-edit": act.cancelFindingEdit(); break;
    case "clear-finding": act.clearFinding(d.id); break;
    case "save-finding": act.decideFinding(d.id, "modified", {
      title: val("f-title"), detail: val("f-detail"), severity: sel("f-sev"),
      impact: val("f-impact"), remediation: val("f-rem") || null,
    }); break;
    case "map-node": S.mapStep = S.mapStep === d.step || !d.step ? null : d.step; st.commit(); break;
    case "noop": break;

    /* the process workflow */
    case "prepare-done": act.prepareDone(); break;
    case "pick-txn": act.pickTransaction(d.id); break;
    case "open-trace": act.openTrace(d.id); break;
    case "back-to-variants": act.backToVariants(); break;
    case "decide-trace": act.decideTrace(d.txn, d.id, d.v); break;
    case "conclude-trace": act.concludeTrace(d.txn || S.traceTxn); break;
    case "reopen-trace": act.reopenTrace(d.txn || S.traceTxn); break;
    case "lw-require": act.setWalkthroughRequirement(d.v, "required"); break;
    case "lw-not-open": act.openEditor("lw:" + d.v); break;
    case "lw-not-required": act.setWalkthroughRequirement(d.v, "not_required",
      val("ans") || "No reason recorded."); break;
    case "lw-reopen": act.setWalkthroughRequirement(d.v, "not_decided", null); break;

    /* step 6 — scope, then the test */
    case "test-require": act.setTestScope(d.id, "required"); break;
    case "test-not-open": act.openEditor("ts:" + d.id); break;
    case "test-not-required": act.setTestScope(d.id, "not_required", val("ans") || "No reason recorded."); break;
    case "test-reopen-scope": act.setTestScope(d.id, "deferred", null); break;
    case "extend-sample": act.extendSample(d.id); break;
    case "test-conclude-open": act.openEditor("tc:" + d.id); break;
    case "conclude-test": act.concludeTest(d.id, d.d || null, val("ans")); break;
    case "reopen-test": act.reopenTest(d.id); break;

    /* step 7 — sign-off */
    case "sign-preparer": act.signPreparer(); break;
    case "submit-review": act.submitForReview(); break;
    case "reviewer": act.reviewerAction(d.d); break;
    case "open-point": act.openPoint(d.id); break;
    case "answer-point-open": act.openEditor("rp:" + d.id); break;
    case "answer-point": act.answerPoint(d.id, val("ans")); break;
    case "reopen-point": act.reopenPoint(d.id); break;
    case "prepare-reopen": act.prepareReopen(); break;
    case "carry-item-open": act.openEditor("carry-item:" + d.id); break;
    case "carry-item": act.carryItem(d.id, sel("carry-dest") || "Final audit", val("ans")); break;
    case "answer-send": act.answerQuestion(Number(d.n), "answer", val("q-" + d.n)); break;
    case "answer-unknown": act.answerQuestion(Number(d.n), "unknown"); break;
    case "answer-call": act.answerQuestion(Number(d.n), "call"); break;

    /* coverage and open items */
    case "edit-item": case "edit-item-o": act.openEditor(d.item || d.id); break;
    case "save-answer": act.recordAnswer(d.item, d.fact, val("ans") || "Recorded by the auditor."); break;
    case "save-na": act.markNA(d.item, val("ans") || "Not applicable to this entity."); break;
    case "ask-client": act.askClient(d.item); break;
    case "set-item": act.setItem(d.id, d.s); break;

    /* peripheral */
    case "cockpit-next": act.cockpitAdvance(); break;
    case "cockpit-play": act.cockpitToggle(); break;
    case "reset": act.reset(); break;

    /* demo */
    case "demo-start": demoStart(); break;
    case "demo-next": demoGo(S.demoStep + 1); break;
    case "demo-prev": demoGo(S.demoStep - 1); break;
    case "demo-exit": demoExit(); break;
  }
});

/* --- Palette typing --------------------------------------------------------- */

document.addEventListener("input", (e) => {
  if (e.target.id === "pal-in") { S.palQuery = e.target.value; S.palIx = 0; render(); }
  if (e.target.id === "grid-q") { S.gridQuery = e.target.value; render(); }
});

/* --- Keyboard --------------------------------------------------------------- */

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  const typing = e.target.matches("input, textarea");

  /* Global, works while typing */
  if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); S.palette ? act.closePalette() : act.openPalette(); return; }
  if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }

  if (S.palette) {
    const list = matches();
    if (e.key === "Escape") { e.preventDefault(); act.closePalette(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); act.palMove(1, list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); act.palMove(-1, list.length); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(S.palIx); }
    return;
  }

  if (typing) {
    if (e.key === "Escape") { e.preventDefault(); act.cancelEdit(); }
    if (e.key === "Enter" && meta) {
      const claim = document.getElementById("claim-edit");
      if (claim && S.editing) { e.preventDefault(); act.saveClaim(S.editing, claim.value.trim()); }
    }
    return;
  }

  // A claim is a focusable div (it nests its own action buttons), so Enter and
  // Space have to be wired by hand.
  if (["Enter", " "].includes(e.key) && e.target.matches?.('[data-act="toggle-claim"]')) {
    e.preventDefault(); act.toggleClaim(e.target.dataset.claim); return;
  }

  if (e.key === "Escape") {
    if (S.sheet) act.sheet(null);
    else if (S.reviewMode === "focus") act.exitFocus();
    else if (S.reviewMode === "read") act.reviewMode("triage");
    else if (S.demo) demoExit();
    return;
  }
  if (e.key === "?" ) { e.preventDefault(); act.sheet(S.sheet ? null : "keys"); return; }
  if (e.key === "/") { e.preventDefault(); act.openPalette(); return; }

  if (S.demo) {
    if (e.key === "ArrowRight") { e.preventDefault(); demoGo(S.demoStep + 1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); demoGo(S.demoStep - 1); return; }
  }

  const k = e.key.toLowerCase();

  // Enter on a step's overview starts that step's queue.
  if (S.route === "#/prepare" && e.key === "Enter" && !S.prepared) { e.preventDefault(); act.prepareDone(); return; }
  if (S.route === "#/understanding" && e.key === "Enter" && !S.generated && !S.generating) { e.preventDefault(); act.startGeneration(pipeline); return; }
  if (S.route === "#/understanding" && e.key === "Enter" && S.generated && !S.genSeen) { e.preventDefault(); act.readGenResult(); return; }
  if (S.route === "#/controls" && e.key === "Enter" && S.generated && !st.narrativeSummary().pending
      && !S.analysed && !S.analysing) { e.preventDefault(); act.startAnalysis(analysisPipeline); return; }
  if (S.route === "#/controls" && e.key === "Enter" && S.analysed && !S.anaSeen) { e.preventDefault(); act.readAnalysis(); return; }
  if (S.route === "#/trace" && S.reviewMode !== "focus" && e.key === "Enter" && S.traceTxn) {
    const prog = st.traceProgress(S.traceTxn);
    if (prog && !prog.concluded) {
      e.preventDefault();
      if (prog.pending.length) act.pickTransaction(S.traceTxn); else act.concludeTrace(S.traceTxn);
      return;
    }
  }
  if (!FOCUS_ROUTES.includes(S.route) || !S.generated) return;
  if (S.route === "#/controls" && (!S.analysed || !S.anaSeen)) return;

  /* Focus mode: the queue is keyboard-first */
  if (S.reviewMode === "focus") {
    if (S.focusKind === "claims") {
      const q = st.claimQueue();
      const cur = q[Math.min(S.focusIx, q.length - 1)];
      if (!cur) return;
      const b = cur.b;
      if (st.claimState(b) === "contradiction") {
        const ix = ["1", "2", "3"].indexOf(e.key);
        if (ix >= 0 && b.options?.[ix]) {
          e.preventDefault();
          act.resolveConflict(b.id, b.options[ix].choice, b.options[ix].text);
        }
        return;
      }
      if (e.key === "Enter") { e.preventDefault(); act.saveClaim(b.id, b.suggestion || b.text); }
      else if (k === "e") { e.preventDefault(); act.editClaim(b.id); }
      else if (k === "a") { e.preventDefault(); act.askAbout(b.id); }
      else if (k === "r") { e.preventDefault(); act.rejectClaim(b.id); }
      return;
    }
    if (S.focusKind === "findings") {
      const q = st.findingSummary().queue;
      const f = q[Math.min(S.focusIx, q.length - 1)];
      if (!f) return;
      if (e.key === "Enter") { e.preventDefault(); act.decideFinding(f.id, "confirmed"); }
      else if (k === "m") { e.preventDefault(); act.editFinding(f.id); }
      else if (k === "d") { e.preventDefault(); act.decideFinding(f.id, "dismissed"); }
      else if (k === "j") { e.preventDefault(); act.focusNext(); }
      return;
    }
    if (S.focusKind === "trace") {
      const prog = S.traceTxn ? st.traceProgress(S.traceTxn) : null;
      const q = prog ? prog.pending : [];
      const t = q[Math.min(S.focusIx, q.length - 1)];
      if (!t) return;
      if (e.key === "Enter") { e.preventDefault(); act.decideTrace(S.traceTxn, t.id, t.suggested); }
      else if (k === "x") { e.preventDefault(); act.decideTrace(S.traceTxn, t.id, "exception"); }
      else if (k === "c") { e.preventDefault(); act.decideTrace(S.traceTxn, t.id, "corroborated"); }
      else if (k === "j") { e.preventDefault(); act.focusNext(); }
      return;
    }
    if (S.focusKind === "controls") {
      const q = st.controlSummary().queue;
      const c = q[Math.min(S.focusIx, q.length - 1)];
      if (!c) return;
      const suggested = c.keyProposal === false ? "not_key" : "key";
      if (e.key === "Enter") { e.preventDefault(); act.decideControl(c.id, suggested); }
      else if (k === "k" && !meta) { e.preventDefault(); act.decideControl(c.id, "key"); }
      else if (k === "n") { e.preventDefault(); act.decideControl(c.id, "not_key"); }
      else if (k === "c") { e.preventDefault(); act.openEditor("carry:" + c.id); }
      else if (k === "u") { e.preventDefault(); act.parkControl(c.id); }
      else if (k === "j") { e.preventDefault(); act.focusNext(); }
      return;
    }
    return;
  }

  /* Triage: Enter starts whatever this step owes you */
  if (S.reviewMode === "triage") {
    if (e.key === "Enter") {
      e.preventDefault();
      if (S.route === "#/understanding") {
        if (st.claimQueue().length) act.startFocus("claims"); else act.reviewMode("read");
      } else if (S.route === "#/controls") {
        if (st.controlSummary().pending) act.startFocus("controls");
        else if (st.findingSummary().queue.length) act.startFocus("findings");
      }
    }
    return;
  }

  /* Read */
  if (S.reviewMode === "read") {
    const secs = narrative;
    const i = Math.max(0, secs.findIndex((s) => s.id === S.section));
    if (k === "j") { e.preventDefault(); act.selectSection(secs[Math.min(i + 1, secs.length - 1)].id); }
    else if (k === "k") { e.preventDefault(); act.selectSection(secs[Math.max(i - 1, 0)].id); }
    else if (k === "a") {
      e.preventDefault();
      const sec = secs[i];
      if (sec && st.sectionApprovable(sec)) act.approveSection(sec.id);
    }
  }
});

/* --- Route integrity -----------------------------------------------------------
   Every data-href the app renders must resolve to a registered route. Runs over
   each screen once on boot; a mismatch is a console error naming the offender.
   -------------------------------------------------------------------------- */

function checkRoutes() {
  const valid = new Set(Object.keys(ROUTES));
  const bad = new Set();
  const probe = document.createElement("div");
  Object.entries(ROUTES).forEach(([route, view]) => {
    let html = "";
    try { html = view(); } catch { return; }        // a view that needs state we lack
    probe.innerHTML = html;
    probe.querySelectorAll("[data-href]").forEach((el) => {
      const h = el.dataset.href;
      if (h && !valid.has(h)) bad.add(`${h}  (rendered by ${route})`);
    });
  });
  probe.innerHTML = "";
  if (bad.size) console.error("Route integrity: unregistered routes —\n  " + [...bad].join("\n  "));
  else console.info(`Route integrity: ${valid.size} routes, every link resolves.`);
  return [...bad];
}
window.__checkRoutes = checkRoutes;

/* --- Boot ------------------------------------------------------------------- */

window.addEventListener("hashchange", render);
render();
checkRoutes();
