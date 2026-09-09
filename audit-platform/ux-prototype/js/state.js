/* ============================================================================
   state.js — prototype state, derivations and actions.

   Second iteration. The derivations are unchanged from v1 (they were right);
   what is new is the exception model that drives review-by-exception, the
   focus queues, and a real undo stack so no routine action needs a
   confirmation dialog.

   Every number on every screen is computed here from data-model.js.
   ========================================================================== */

import { subProcesses, narrative, risks, controls, gaps, openItems } from "./data-model.js";
import { journey, processSteps, processFindings, traceFinding, lineWalk, lineWalkCandidates,
         controlTest } from "./data-process.js";

/* The decision state that undo restores. Everything else is view state. */
const DECISIONS = ["blocks", "sections", "coverage", "controlDecisions", "findingDecisions",
                   "itemStates", "traceDecisions", "traceTxn", "traceConcluded", "testConclusion",
                   "prepared"];

const initial = () => ({
  route: "#/",
  generated: false,
  generating: false,
  genStage: -1,
  genSeen: false,          // the pipeline result has been read

  /* --- decisions (undoable) --- */
  blocks: {},              // claim id -> { text, edited, rejected, resolution }
  sections: {},            // section id -> "approved" | "rejected"
  coverage: {},            // coverage item id -> { state, naReason, facts }
  controlDecisions: {},    // control id -> "key" | "not_key" | "undecided"
  findingDecisions: {},    // finding id -> "confirmed" | "dismissed"
  itemStates: {},          // open item id -> "open" | "sent" | "resolved" | "dismissed"
  traceTxn: null,          // selected transaction for the line walkthrough
  traceDecisions: {},      // trace step id -> "corroborated" | "exception"
  traceConcluded: false,
  testConclusion: null,    // the control-testing concept's auditor conclusion
  prepared: false,         // step 1 acknowledged

  /* --- view state --- */
  reviewMode: "triage",    // triage | focus | read
  focusKind: null,         // claims | controls | findings | trace
  focusIx: 0,
  openClaim: null,         // claim whose evidence is expanded inline
  mapStep: null,           // process-map step whose detail is open
  section: null,           // active section in read mode
  scrollTo: null,
  disclosed: {},           // progressive-disclosure toggles
  palette: false,
  palQuery: "",
  palIx: 0,
  sheet: null,             // "keys"
  toast: null,             // { label, undoable }
  editing: null,           // claim id being edited inline
  mode: "transcript",
  qIndex: 12,
  cockpitTurn: 6,
  cockpitPlaying: false,
  demo: false,
  demoStep: 0,
});

export const S = initial();

/* --- Undo ------------------------------------------------------------------
   Snapshot-and-restore. Cheap, total, and it means no routine action in the
   product ever asks "are you sure?".
   -------------------------------------------------------------------------- */
const undoStack = [];

function snapshot() {
  const o = {};
  DECISIONS.forEach((k) => { o[k] = JSON.parse(JSON.stringify(S[k])); });
  return o;
}

function checkpoint(label) {
  undoStack.push({ label, before: snapshot() });
  if (undoStack.length > 40) undoStack.shift();
}

export const canUndo = () => undoStack.length > 0;

export function undo() {
  const last = undoStack.pop();
  if (!last) return;
  DECISIONS.forEach((k) => { S[k] = last.before[k]; });
  S.toast = { label: `Undone — ${last.label}`, undoable: false };
  scheduleToastClear();
  commit();
}

/* --- Render plumbing -------------------------------------------------------- */

let renderFn = () => {};
export const onChange = (fn) => { renderFn = fn; };

let toastTimer = null;
function scheduleToastClear() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; renderFn(); }, 7000);
}

export function commit(label, undoable = false) {
  if (label) { S.toast = { label, undoable }; scheduleToastClear(); }
  renderFn();
}

/* --- Claim state ------------------------------------------------------------ */

export function claimState(b) {
  const rt = S.blocks[b.id] || {};
  if (rt.rejected) return "rejected";
  if (rt.edited || rt.resolution) return "edited";
  if (b.unsupported) return "needs_source";
  if (b.conflict) return "contradiction";
  if (b.missing) return "absent";
  return "draft";
}

export const claimText = (b) => (S.blocks[b.id]?.text ?? b.text);
export const claimBlocking = (b) => ["needs_source", "contradiction"].includes(claimState(b));

export const sectionDecision = (sec) => S.sections[sec.id] ?? null;
export const sectionBlockers = (sec) => sec.blocks.filter(claimBlocking);
export const sectionEdited = (sec) => sec.blocks.some((b) => S.blocks[b.id]?.edited || S.blocks[b.id]?.resolution);

export function sectionState(sec) {
  const d = sectionDecision(sec);
  if (d) return d;
  const bl = sectionBlockers(sec);
  if (bl.some((b) => claimState(b) === "contradiction")) return "contradiction";
  if (bl.length) return "needs_source";
  return sectionEdited(sec) ? "edited" : "clean";
}

export const sectionApprovable = (sec) => sectionBlockers(sec).length === 0 && !sectionDecision(sec);

/* --- Coverage --------------------------------------------------------------- */

export const covState = (item) => S.coverage[item.id]?.state ?? item.state;
export const covFacts = (item) => {
  const ov = S.coverage[item.id];
  if (!ov?.facts) return item.facts;
  return item.facts.map((f) => (ov.facts[f.key] ? { ...f, ...ov.facts[f.key] } : f));
};
export const covReason = (item) => S.coverage[item.id]?.naReason ?? item.naReason;

export function coverageCounts(items) {
  const c = { covered: 0, partial: 0, open: 0, na: 0 };
  items.forEach((i) => {
    const s = covState(i);
    if (s === "covered") c.covered++;
    else if (s === "partial") c.partial++;
    else if (s === "na") c.na++;
    else c.open++;
  });
  return c;
}

export const allItems = () => subProcesses.flatMap((sp) => sp.items);

export function coverageSummary() {
  const items = allItems();
  const c = coverageCounts(items);
  const applicable = items.length - c.na;
  const facts = { known: 0, unknown: 0, contradictory: 0, assumed: 0, total: 0 };
  items.forEach((i) => covFacts(i).forEach((f) => { facts[f.status]++; facts.total++; }));
  return {
    total: items.length, applicable, ...c,
    pct: applicable ? Math.round((c.covered / applicable) * 100) : 0,
    facts,
    mandatoryOpen: items.filter((i) => i.mandatory && ["open", "partial"].includes(covState(i))),
  };
}

/** Sub-processes that still owe something, in plain language. */
export function coverageGaps() {
  const out = [];
  subProcesses.forEach((sp) => {
    sp.items.forEach((item) => {
      const st = covState(item);
      if (st === "covered" || st === "na") return;
      const facts = covFacts(item);
      const contra = facts.filter((f) => f.status === "contradictory");
      const unknown = facts.filter((f) => f.status === "unknown");
      out.push({
        sub: sp, item,
        kind: contra.length ? "contradiction" : "unknown",
        plain: item.plain || item.q,
        unknown, contra,
        mandatory: !!item.mandatory,
      });
    });
  });
  return out.sort((a, b) =>
    (b.kind === "contradiction") - (a.kind === "contradiction") || b.mandatory - a.mandatory);
}

export const coverageSettled = () =>
  subProcesses.filter((sp) => sp.items.every((i) => ["covered", "na"].includes(covState(i))));

/* --- Narrative -------------------------------------------------------------- */

export function narrativeSummary() {
  const blocks = narrative.flatMap((s) => s.blocks);
  const needsSource = blocks.filter((b) => claimState(b) === "needs_source");
  const contradiction = blocks.filter((b) => claimState(b) === "contradiction");
  const absent = blocks.filter((b) => claimState(b) === "absent");
  const decided = narrative.filter((s) => sectionDecision(s));
  const pending = narrative.filter((s) => !sectionDecision(s));
  const attention = pending.filter((s) => sectionBlockers(s).length);
  const cleanReady = pending.filter((s) => sectionApprovable(s) && !sectionEdited(s));
  return {
    sections: narrative.length, blocks: blocks.length,
    needsSource, contradiction, absent,
    approved: narrative.filter((s) => sectionDecision(s) === "approved").length,
    rejected: narrative.filter((s) => sectionDecision(s) === "rejected").length,
    decided: decided.length, pending: pending.length,
    attention, cleanReady,
    pct: Math.round((decided.length / narrative.length) * 100),
  };
}

/** The claims that need a judgement, in the order they should be presented:
 *  contradictions first, then unsupported claims in document order. */
export function claimQueue() {
  const all = narrative.flatMap((sec) => sec.blocks.map((b) => ({ b, sec })));
  const live = all.filter(({ b, sec }) => claimBlocking(b) && !sectionDecision(sec));
  return live.sort((a, b) =>
    (claimState(b.b) === "contradiction") - (claimState(a.b) === "contradiction"));
}

export const sectionOf = (claimId) => narrative.find((s) => s.blocks.some((b) => b.id === claimId));
export const claimById = (id) => narrative.flatMap((s) => s.blocks).find((b) => b.id === id);

/* --- Risks and controls ------------------------------------------------------ */

export const controlDecision = (c) => S.controlDecisions[c.id] ?? null;

/** Risks are identified during interim but concluded during risk analysis,
 *  which is the next phase and outside this product. They are carried
 *  forward, not decided here (V3-DESIGN-DIRECTION.md §1). */
export function riskSummary() {
  return {
    total: risks.length,
    significant: risks.filter((r) => r.significant).length,
    fraud: risks.filter((r) => r.fraud).length,
    newRisks: risks.filter((r) => !r.lib).length,
    blocked: risks.filter((r) => r.blocked),
  };
}

export function controlSummary() {
  const pending = controls.filter((c) => !controlDecision(c));
  return {
    total: controls.length,
    decided: controls.length - pending.length,
    pending: pending.length,
    queue: pending,
    suggestedKey: controls.filter((c) => c.keyProposal === true).length,
    unassessable: controls.filter((c) => c.keyProposal === null).length,
    agreedKey: controls.filter((c) => controlDecision(c) === "key").length,
    gaps: gaps.length,
  };
}

/* --- Findings ----------------------------------------------------------------
   Control gaps and process observations are one auditor-facing object. The line
   walkthrough can add to the list, which is how step 5 feeds step 4.
   -------------------------------------------------------------------------- */

export function allFindings() {
  const fromGaps = gaps.map((g) => ({
    id: g.id, step: stepOfSubProcess(g.sub), kind: "gap", severity: g.severity,
    title: g.desc, detail: g.impact, remediation: g.remediation, refs: g.refs,
    risk: g.risk, fromTrace: false,
  }));
  const out = [...fromGaps, ...processFindings];
  if (S.traceConcluded && Object.values(S.traceDecisions).includes("exception")) out.push(traceFinding);
  return out;
}

const stepOfSubProcess = (sub) => processSteps.find((p) => p.sub === sub)?.id || null;

export const findingDecision = (f) => S.findingDecisions[f.id] ?? null;

export function findingSummary() {
  const all = allFindings();
  const pending = all.filter((f) => !findingDecision(f));
  return {
    total: all.length, all, pending, queue: pending,
    decided: all.length - pending.length,
    confirmed: all.filter((f) => findingDecision(f) === "confirmed").length,
    fromTrace: all.filter((f) => f.fromTrace).length,
  };
}

/* --- Line walkthrough --------------------------------------------------------- */

export const traceVerdict = (t) => S.traceDecisions[t.id] ?? null;

export function traceSummary() {
  const steps = lineWalk.steps;
  const done = steps.filter(traceVerdict);
  return {
    expected: steps.length,
    corroborated: steps.filter((t) => traceVerdict(t) === "corroborated").length,
    exceptions: steps.filter((t) => traceVerdict(t) === "exception").length,
    pending: steps.filter((t) => !traceVerdict(t)),
    done: done.length,
    started: !!S.traceTxn,
    concluded: S.traceConcluded,
    steps,
  };
}

export const traceStepFor = (mapStepId) =>
  lineWalk.steps.find((t) => t.step === mapStepId) || null;

/* --- Control testing (future-state concept) ----------------------------------- */

export function testSummary() {
  const r = controlTest.results;
  return {
    control: controlTest.controlId,
    selected: r.length,
    corroborated: r.filter((x) => x.ok).length,
    exceptions: r.filter((x) => !x.ok).length,
    concluded: !!S.testConclusion,
    conclusion: S.testConclusion,
  };
}

/* --- Open items --------------------------------------------------------------- */

export const itemState = (i) => S.itemStates[i.id] ?? i.state;
export function openItemSummary() {
  const live = openItems.filter((i) => !["resolved", "dismissed"].includes(itemState(i)));
  return {
    total: openItems.length, open: live.length, live,
    questions: live.filter((i) => i.kind === "question").length,
    evidence: live.filter((i) => i.kind === "evidence").length,
    contradictions: live.filter((i) => i.kind === "contradiction").length,
    sent: live.filter((i) => itemState(i) === "sent").length,
    blocking: live.filter((i) => i.blocks && i.blocks.length),
    resolved: openItems.length - live.length,
  };
}

/* --- RCM ---------------------------------------------------------------------- */

export function rcmRows() {
  const rows = [];
  risks.forEach((r) => {
    const linked = controls.filter((c) => c.risks.includes(r.id));
    if (!linked.length) rows.push({ risk: r, control: null, gap: gaps.find((g) => g.risk === r.id) || null });
    else linked.forEach((c) => rows.push({ risk: r, control: c, gap: null }));
  });
  return rows;
}

/* --- The process journey -------------------------------------------------------
   Seven ordered steps, each carrying its own state. Not a tab bar: the order is
   the order the work happens in, and a step that has not started says so.
   -------------------------------------------------------------------------- */

export function journeyStates() {
  const cov = coverageSummary();
  const n = narrativeSummary();
  const cs = controlSummary();
  const fs = findingSummary();
  const tr = traceSummary();
  const ts = testSummary();

  const st = (id) => {
    switch (id) {
      case "prepare":
        return S.prepared ? { s: "done", c: "ready" } : { s: "open", c: "start here" };
      case "walkthrough":
        return cov.mandatoryOpen.length ? { s: "open", c: `${cov.pct}%`, tone: "warn" }
          : cov.open + cov.partial ? { s: "open", c: `${cov.pct}%` }
          : { s: "done", c: `${cov.pct}%` };
      case "understanding":
        return !S.generated ? { s: "later", c: "not drafted", why: "Available once the walkthrough has established enough facts to draft from." }
          : n.attention.length ? { s: "open", c: `${n.attention.length} need you`, tone: "warn" }
          : n.pending ? { s: "open", c: `${n.pending} to approve` }
          : { s: "done", c: "approved" };
      case "controls":
        return !S.generated ? { s: "later", c: "—", why: "Controls are identified from the process understanding." }
          : cs.pending + fs.pending.length ? { s: "open", c: `${cs.pending + fs.pending.length} to conclude` }
          : { s: "done", c: `${cs.agreedKey} key` };
      case "trace":
        return !S.generated ? { s: "later", c: "—", why: "A transaction is traced against the documented process, so the process has to be documented first." }
          : !tr.started ? { s: "open", c: "not started" }
          : tr.concluded ? { s: "done", c: tr.exceptions ? `${tr.exceptions} exception` : "no exceptions", tone: tr.exceptions ? "warn" : "" }
          : { s: "open", c: `${tr.done} of ${tr.expected}` };
      case "testing":
        return { s: ts.concluded ? "done" : "later", c: ts.concluded ? "concluded" : "concept",
                 why: "Control testing is a future-state concept in this prototype." };
      case "complete":
        return readyToSign() ? { s: "open", c: "ready", tone: "ok" }
          : { s: "later", c: "blocked", why: "Every completion gate has to be met first." };
    }
    return { s: "later", c: "" };
  };

  return journey.map((j) => ({ ...j, ...st(j.id) }));
}

export const journeyStep = (id) => journeyStates().find((j) => j.id === id);

/** How far through the process, for the engagement layer. */
export function processProgress() {
  const js = journeyStates();
  const done = js.filter((j) => j.s === "done").length;
  const current = js.find((j) => j.s === "open") || js[js.length - 1];
  return { done, total: js.length, current };
}

/* --- Completion gates -----------------------------------------------------------
   The process is complete when the process-level interim work is complete. Risk
   analysis is deliberately not among these.
   -------------------------------------------------------------------------- */

export const completionGates = [
  { id: "understanding", label: "Process understanding reviewed", step: "understanding" },
  { id: "documentation", label: "Process documentation approved", step: "understanding" },
  { id: "controls",      label: "Controls concluded", step: "controls" },
  { id: "findings",      label: "Findings concluded", step: "controls" },
  { id: "trace",         label: "Line walkthrough completed", step: "trace" },
  { id: "testing",       label: "Required control testing completed", step: "testing" },
  { id: "needsSource",   label: "No unsupported statements", step: "understanding" },
  { id: "contradiction", label: "No unresolved contradictions", step: "walkthrough" },
  { id: "openItems",     label: "Open matters resolved or carried forward", step: "walkthrough" },
  { id: "signed",        label: "Prepared and reviewed", step: "complete" },
];

export function gateStates() {
  const n = narrativeSummary(), cs = controlSummary(), fs = findingSummary();
  const oi = openItemSummary(), cov = coverageSummary(), tr = traceSummary();
  const map = {
    understanding: { ok: S.generated && cov.mandatoryOpen.length === 0,
      detail: !S.generated ? "Nothing drafted yet"
        : cov.mandatoryOpen.length ? `${cov.mandatoryOpen.length} required areas still open`
        : `${cov.covered} of ${cov.applicable} areas established` },
    documentation: { ok: S.generated && n.pending === 0,
      detail: !S.generated ? "Nothing drafted yet"
        : `${n.approved} approved · ${n.rejected} rejected · ${n.pending} still to decide` },
    controls:      { ok: S.generated && cs.pending === 0,
      detail: S.generated ? `${cs.decided} of ${cs.total} concluded · ${cs.agreedKey} key` : "Not identified yet" },
    findings:      { ok: S.generated && fs.pending.length === 0,
      detail: S.generated ? `${fs.decided} of ${fs.total} concluded` : "Not identified yet" },
    trace:         { ok: tr.concluded,
      detail: !tr.started ? "Not started"
        : tr.concluded ? `${tr.expected} steps · ${tr.corroborated} corroborated · ${tr.exceptions} exception${tr.exceptions === 1 ? "" : "s"}`
        : `${tr.done} of ${tr.expected} steps traced` },
    testing:       { ok: !!S.testConclusion,
      detail: S.testConclusion ? "One control tested and concluded"
        : "One control identified as requiring a test" },
    needsSource:   { ok: S.generated && n.needsSource.length === 0,
      detail: n.needsSource.length ? `${n.needsSource.length} statements have no support` : "Every statement is traced to a source" },
    contradiction: { ok: n.contradiction.length === 0 && cov.facts.contradictory === 0,
      detail: n.contradiction.length ? "One contradiction is unresolved" : "No unresolved contradictions" },
    openItems:     { ok: oi.open === 0, detail: `${oi.open} open · ${oi.resolved} settled` },
    signed:        { ok: false, detail: "Sign-off is the last act, and it is yours" },
  };
  return completionGates.map((g) => ({ ...g, ...map[g.id] }));
}

/** Sign-off becomes available when every gate but the signature itself is met. */
export function readyToSign() {
  return gateStates().filter((g) => g.id !== "signed").every((g) => g.ok);
}

/** The single most useful next action, computed by walking the journey. */
export function nextAction() {
  const cov = coverageSummary(), n = narrativeSummary(), cs = controlSummary();
  const fs = findingSummary(), oi = openItemSummary(), tr = traceSummary();

  if (!S.prepared) return { t: "Prepare the Revenue process", d: "Scope, systems, people and what we already know.", href: "#/prepare" };
  if (cov.facts.contradictory) return { t: "Two sources disagree about who can change a credit limit", d: "It blocks a statement, a control and a risk at once.", href: "#/walkthrough" };
  if (cov.mandatoryOpen.length) return { t: `${cov.mandatoryOpen.length} required areas are still open`, d: "The walkthrough cannot be concluded while an ISA 240 area is unaddressed.", href: "#/walkthrough" };
  if (!S.generated) return { t: "Draft the process understanding", d: `Coverage is ${cov.pct}% and the required areas are addressed.`, href: "#/understanding" };
  if (n.attention.length) return { t: `${n.attention.length} statements need your judgement`, d: "Unsupported or contradictory statements are blocking their sections.", href: "#/understanding" };
  if (n.pending) return { t: `${n.pending} sections to approve`, d: "Every statement in them is traced to a source.", href: "#/understanding" };
  if (cs.pending) return { t: `${cs.pending} controls to conclude`, d: `${cs.suggestedKey} are suggested as key controls.`, href: "#/controls" };
  if (fs.pending.length) return { t: `${fs.pending.length} findings to conclude`, d: "Severity is your judgement, not the model's.", href: "#/controls" };
  if (!tr.concluded) return { t: tr.started ? "Finish the line walkthrough" : "Trace a transaction through the process", d: tr.started ? `${tr.done} of ${tr.expected} steps traced.` : "Test the process model against a real transaction.", href: "#/trace" };
  if (!S.testConclusion) return { t: "Conclude the control test", d: "One control requires testing before it can be relied on.", href: "#/testing" };
  if (oi.open) return { t: `${oi.open} open items`, d: "Ask, record or carry each one forward.", href: "#/resolve" };
  return { t: "Revenue is ready for sign-off", d: "Every completion gate is met.", href: "#/complete" };
}

/* --- Actions ----------------------------------------------------------------
   Every mutating action takes a checkpoint first, so ⌘Z always works and no
   routine action needs a confirmation dialog.
   -------------------------------------------------------------------------- */

export const act = {
  go(href) { location.hash = href; },
  toast(label) { commit(label); },

  /* palette + sheets */
  openPalette() { S.palette = true; S.palQuery = ""; S.palIx = 0; commit(); },
  closePalette() { S.palette = false; commit(); },
  palQuery(q) { S.palQuery = q; S.palIx = 0; commit(); },
  palMove(d, max) { S.palIx = Math.max(0, Math.min(max - 1, S.palIx + d)); commit(); },
  sheet(k) { S.sheet = k; commit(); },

  disclose(id) { S.disclosed[id] = !S.disclosed[id]; commit(); },

  readGenResult() { S.genSeen = true; commit(); },

  /* review modes */
  reviewMode(m) { S.reviewMode = m; S.openClaim = null; commit(); },
  startFocus(kind) {
    S.focusKind = kind; S.focusIx = 0; S.reviewMode = "focus"; S.openClaim = null; commit();
  },
  /** Skip: the item stays in the queue, so move past it. */
  focusNext() {
    const len = focusLength();
    if (S.focusIx + 1 >= len) { S.reviewMode = "triage"; S.focusKind = null; }
    else S.focusIx++;
    commit();
  },

  /** After a decision the item leaves the queue, so the next one slides into
   *  the same index. Incrementing here would silently skip it. */
  afterDecision() {
    const len = focusLength();
    if (len === 0) { S.reviewMode = "triage"; S.focusKind = null; S.focusIx = 0; }
    else S.focusIx = Math.min(S.focusIx, len - 1);
  },
  focusPrev() { S.focusIx = Math.max(0, S.focusIx - 1); commit(); },
  exitFocus() { S.reviewMode = "triage"; S.focusKind = null; commit(); },

  /* reading */
  toggleClaim(id) { S.openClaim = S.openClaim === id ? null : id; S.editing = null; commit(); },
  selectSection(id) { S.section = id; S.scrollTo = id; commit(); },

  /* claim decisions */
  editClaim(id) { S.editing = id; S.openClaim = id; commit(); },
  cancelEdit() { S.editing = null; commit(); },
  saveClaim(id, text) {
    checkpoint("statement edited");
    S.blocks[id] = { ...(S.blocks[id] || {}), text, edited: true };
    S.editing = null;
    if (S.reviewMode === "focus") this.afterDecision();
    commit("Statement replaced", true);
  },
  rejectClaim(id) {
    checkpoint("statement rejected");
    S.blocks[id] = { ...(S.blocks[id] || {}), rejected: true };
    if (S.reviewMode === "focus") this.afterDecision();
    commit("Statement rejected", true);
  },
  askAbout(id) {
    checkpoint("question raised");
    S.blocks[id] = { ...(S.blocks[id] || {}), resolution: { kind: "asked" },
      text: (claimById(id)?.askedText) || claimText(claimById(id)) };
    if (S.reviewMode === "focus") this.afterDecision();
    commit("Question sent to the client", true);
  },
  resolveConflict(id, choice, text) {
    checkpoint("contradiction resolved");
    S.blocks[id] = { ...(S.blocks[id] || {}), text, resolution: { kind: "conflict", choice } };
    S.itemStates["OI-01"] = "resolved";
    if (S.reviewMode === "focus") this.afterDecision();
    commit("Contradiction resolved", true);
  },

  /* sections */
  approveSection(id) {
    checkpoint("section approved");
    S.sections[id] = "approved";
    commit("Section approved", true);
  },
  rejectSection(id) { checkpoint("section rejected"); S.sections[id] = "rejected"; commit("Section rejected", true); },
  reopenSection(id) { checkpoint("section reopened"); delete S.sections[id]; commit(); },
  acceptClean() {
    const ready = narrativeSummary().cleanReady;
    if (!ready.length) return;
    checkpoint(`${ready.length} sections approved`);
    ready.forEach((s) => { S.sections[s.id] = "approved"; });
    commit(`${ready.length} sections approved`, true);
  },

  /* risks and controls */
  decideFinding(id, d) {
    checkpoint("finding concluded");
    S.findingDecisions[id] = d;
    if (S.reviewMode === "focus" && S.focusKind === "findings") this.afterDecision();
    commit(d === "confirmed" ? `${id} confirmed as a finding` : `${id} dismissed`, true);
  },
  decideControl(id, d) {
    checkpoint("control concluded");
    S.controlDecisions[id] = d;
    const w = d === "key" ? "recorded as a key control" : d === "not_key" ? "recorded as not key" : "left undecided";
    if (S.reviewMode === "focus" && S.focusKind === "controls") this.afterDecision();
    commit(`${id} ${w}`, true);
  },
  clearFinding(id) { checkpoint("finding reopened"); delete S.findingDecisions[id]; commit(); },
  clearControl(id) { checkpoint("control reopened"); delete S.controlDecisions[id]; commit(); },

  /* open items */
  setItem(id, st) { checkpoint("open item updated"); S.itemStates[id] = st; commit(`${id} ${st}`, true); },

  /* coverage */
  markNA(itemId, reason) {
    checkpoint("marked not applicable");
    S.coverage[itemId] = { state: "na", naReason: reason };
    S.editing = null;
    commit("Marked not applicable — the reason is on file", true);
  },
  recordAnswer(itemId, factKey, value) {
    checkpoint("answer recorded");
    const ov = S.coverage[itemId] || {};
    ov.facts = { ...(ov.facts || {}), [factKey]: { status: "known", value } };
    const item = allItems().find((i) => i.id === itemId);
    const merged = item.facts.map((f) => (ov.facts[f.key] ? { ...f, ...ov.facts[f.key] } : f));
    ov.state = merged.every((f) => f.status === "known") ? "covered" : "partial";
    S.coverage[itemId] = ov;
    S.editing = null;
    commit("Recorded — coverage updated", true);
  },
  askClient(itemId) {
    checkpoint("question sent");
    const ov = S.coverage[itemId] || {};
    ov.asked = true;
    S.coverage[itemId] = ov;
    commit("Question sent to the client", true);
  },
  openEditor(id) { S.editing = id; commit(); },

  /* step 1 */
  prepareDone() { checkpoint("preparation confirmed"); S.prepared = true; commit("Preparation confirmed", true); },

  /* step 5 — the line walkthrough */
  pickTransaction(id) {
    checkpoint("transaction selected");
    S.traceTxn = id; S.focusKind = "trace"; S.focusIx = 0; S.reviewMode = "focus";
    commit("Transaction selected", true);
  },
  decideTrace(id, verdict) {
    checkpoint("trace step concluded");
    S.traceDecisions[id] = verdict;
    const remaining = traceSummary().pending.length;
    if (remaining === 0) { S.reviewMode = "triage"; S.focusKind = null; S.focusIx = 0; }
    else S.focusIx = Math.min(S.focusIx, remaining - 1);
    commit(verdict === "exception" ? "Exception recorded" : "Step corroborated", true);
  },
  concludeTrace() {
    checkpoint("line walkthrough concluded");
    S.traceConcluded = true;
    S.reviewMode = "triage"; S.focusKind = null;
    const ex = traceSummary().exceptions;
    commit(ex ? `Line walkthrough concluded — ${ex} exception raised as a finding` : "Line walkthrough concluded", true);
  },
  reopenTrace() { checkpoint("line walkthrough reopened"); S.traceConcluded = false; commit(); },

  /* step 6 — the control-testing concept */
  concludeTest(d) { checkpoint("control test concluded"); S.testConclusion = d; commit(`Control test concluded — ${d}`, true); },

  /* generation */
  startGeneration(stagesList) {
    S.generating = true; S.genStage = 0; commit();
    const step = (i) => {
      if (i >= stagesList.length) {
        // Stay on the result. The validation stage caught three ungrounded
        // statements and the auditor has to see that, not have it flash past.
        S.generating = false; S.generated = true; S.genStage = stagesList.length;
        S.genSeen = false; S.reviewMode = "triage"; commit();
        return;
      }
      S.genStage = i; commit();
      setTimeout(() => step(i + 1), stagesList[i].ms);
    };
    step(0);
  },

  /* peripheral */
  setMode(m) { S.mode = m; commit(); },
  answerQuestion() { if (S.qIndex < 14) S.qIndex++; commit(); },
  cockpitAdvance() { S.cockpitTurn = Math.min(S.cockpitTurn + 1, 14); commit(); },
  cockpitToggle() {
    S.cockpitPlaying = !S.cockpitPlaying; commit();
    const tick = () => {
      if (!S.cockpitPlaying) return;
      if (S.cockpitTurn >= 14) { S.cockpitPlaying = false; commit(); return; }
      S.cockpitTurn++; commit(); setTimeout(tick, 2400);
    };
    if (S.cockpitPlaying) setTimeout(tick, 900);
  },

  reset() {
    undoStack.length = 0;
    Object.assign(S, initial());
    location.hash = "#/";
    commit("Reset");
  },
};

export function focusLength() {
  if (S.focusKind === "claims") return claimQueue().length;
  if (S.focusKind === "controls") return controlSummary().queue.length;
  if (S.focusKind === "findings") return findingSummary().queue.length;
  if (S.focusKind === "trace") return traceSummary().pending.length;
  return 0;
}
