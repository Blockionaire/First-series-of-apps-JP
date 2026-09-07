/* ============================================================================
   app.js — router, event delegation and the keyboard model.

   Views are pure `state -> HTML`. One click handler, one key handler.
   ========================================================================== */

import { esc, act as btn } from "./ui.js";
import { pipeline, narrative } from "./data-model.js";
import * as st from "./state.js";
import { S, act, undo, canUndo } from "./state.js";
import { palette, runPalette, matches } from "./palette.js";
import { demoBar, demoGo, demoStart, demoExit, STEPS } from "./demo.js";

import { work } from "./views/work.js";
import { understand } from "./views/understand.js";
import { review, prose } from "./views/review.js";
import { resolve } from "./views/resolve.js";
import { complete, matrix, clientSurface } from "./views/complete.js";
import { cockpit } from "./views/cockpit.js";

window.__demoStart = demoStart;

const ROUTES = {
  "#/": work,
  "#/understand": understand,
  "#/review": review,
  "#/resolve": resolve,
  "#/complete": complete,
  "#/matrix": matrix,
  "#/questionnaire": clientSurface,
  "#/cockpit": cockpit,
};

/* --- Overlays -------------------------------------------------------------- */

function undoBar() {
  if (!S.toast) return "";
  return `<div class="undo">
    <b>${esc(S.toast.label)}</b>
    ${S.toast.undoable && canUndo()
      ? `<button data-act="undo">Undo<span class="k">⌘Z</span></button>` : ""}
    <button data-act="dismiss-toast" style="color:#6e7c8a">✕</button>
  </div>`;
}

function keysSheet() {
  if (S.sheet !== "keys") return "";
  const K = [
    ["⌘K", "Search and commands"], ["/", "Search"],
    ["J K", "Next / previous"], ["Enter", "Accept the suggestion"],
    ["E", "Edit"], ["A", "Approve or ask"],
    ["R", "Reject"], ["N", "Not key"],
    ["U", "Undecided"], ["1 2 3", "Pick a resolution"],
    ["⌘Z", "Undo the last decision"], ["Esc", "Back out one level"],
    ["?", "This sheet"], ["→ ←", "Move through the demo"],
  ];
  return `<div class="sheet-scrim" data-act="close-sheet"></div>
  <div class="sheet">
    <div class="t-h">Keyboard</div>
    <p class="t-sub" style="margin-top:6px">Everything in the review queue can be done without the mouse.</p>
    <div class="keys">${K.map(([k, d]) => `<div><span class="k">${esc(k)}</span>${esc(d)}</div>`).join("")}</div>
    <div style="margin-top:24px">${btn("Close", "close-sheet", { variant: "plain" })}</div>
  </div>`;
}

let lastRoute = null;

function render() {
  const hash = location.hash || "#/";
  // Navigating away from Review leaves the focus queue, so returning always
  // lands on triage rather than dropping the auditor mid-queue.
  if (lastRoute === "#/review" && hash !== "#/review") {
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
        if (d.href === "#/review") act.reviewMode("triage");
        else st.commit();
      } else location.hash = d.href;
      break;
    case "mock": act.toast("Mocked in this prototype — nothing is generated, sent or stored."); break;
    case "sign": act.toast("Signed as preparer. In the product this records who and when."); break;

    /* palette + sheets */
    case "palette": case "palette-eng": act.openPalette(); break;
    case "close-palette": act.closePalette(); break;
    case "pal-run": runPalette(Number(d.ix)); break;
    case "keys": act.sheet("keys"); break;
    case "close-sheet": act.sheet(null); break;
    case "disclose": act.disclose(d.id); break;
    case "undo": undo(); break;
    case "dismiss-toast": S.toast = null; st.commit(); break;

    /* review modes */
    case "read-mode": act.reviewMode("read"); break;
    case "triage-mode": act.reviewMode("triage"); break;
    case "start-focus": act.startFocus(d.kind); break;
    case "exit-focus": act.exitFocus(); break;
    case "focus-next": act.focusNext(); break;
    case "focus-claim": {
      const q = st.claimQueue();
      const i = q.findIndex((x) => x.b.id === d.claim);
      S.focusKind = "claims"; S.focusIx = Math.max(0, i); S.reviewMode = "focus";
      if (location.hash !== "#/review") location.hash = "#/review"; else st.commit();
      break;
    }
    case "resolve-conflict": {
      const q = st.claimQueue();
      const i = q.findIndex((x) => x.b.id === d.claim);
      S.focusKind = "claims"; S.focusIx = Math.max(0, i); S.reviewMode = "focus";
      if (location.hash !== "#/review") location.hash = "#/review"; else st.commit();
      break;
    }
    case "run-pipeline": act.startGeneration(pipeline); break;

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

    /* risks and controls */
    case "decide-risk": act.decideRisk(d.id, d.d); break;
    case "decide-control": act.decideControl(d.id, d.d); break;

    /* coverage and open items */
    case "edit-item": case "edit-item-o": act.openEditor(d.item || d.id); break;
    case "save-answer": act.recordAnswer(d.item, d.fact, val("ans") || "Recorded by the auditor."); break;
    case "save-na": act.markNA(d.item, val("ans") || "Not applicable to this entity."); break;
    case "ask-client": act.askClient(d.item); break;
    case "set-item": act.setItem(d.id, d.s); break;

    /* peripheral */
    case "answer-q": act.answerQuestion(); break;
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

  if (S.route !== "#/review" || !S.generated) return;
  const k = e.key.toLowerCase();

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
    if (S.focusKind === "risks") {
      const q = st.riskSummary().queue;
      const r = q[Math.min(S.focusIx, q.length - 1)];
      if (!r) return;
      if (e.key === "Enter") { e.preventDefault(); act.decideRisk(r.id, "accepted"); }
      else if (k === "m") { e.preventDefault(); act.decideRisk(r.id, "modified"); }
      else if (k === "r") { e.preventDefault(); act.decideRisk(r.id, "rejected"); }
      else if (k === "j") { e.preventDefault(); act.focusNext(); }
      else if (k === "k") { e.preventDefault(); act.focusPrev(); }
      return;
    }
    if (S.focusKind === "controls") {
      const q = st.controlSummary().queue;
      const c = q[Math.min(S.focusIx, q.length - 1)];
      if (!c) return;
      const suggested = c.keyProposal === true ? "key" : c.keyProposal === false ? "not_key" : "undecided";
      if (e.key === "Enter") { e.preventDefault(); act.decideControl(c.id, suggested); }
      else if (k === "k" && !meta) { e.preventDefault(); act.decideControl(c.id, "key"); }
      else if (k === "n") { e.preventDefault(); act.decideControl(c.id, "not_key"); }
      else if (k === "u") { e.preventDefault(); act.decideControl(c.id, "undecided"); }
      else if (k === "j") { e.preventDefault(); act.focusNext(); }
      return;
    }
    return;
  }

  /* Triage */
  if (S.reviewMode === "triage") {
    if (e.key === "Enter") {
      e.preventDefault();
      if (st.claimQueue().length) act.startFocus("claims");
      else if (st.riskSummary().pending) act.startFocus("risks");
      else if (st.controlSummary().pending) act.startFocus("controls");
      else act.reviewMode("read");
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

/* --- Boot ------------------------------------------------------------------- */

window.addEventListener("hashchange", render);
render();
