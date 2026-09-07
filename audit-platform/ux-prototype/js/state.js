/* ============================================================================
   state.js — prototype state, derivations and actions.

   Second iteration. The derivations are unchanged from v1 (they were right);
   what is new is the exception model that drives review-by-exception, the
   focus queues, and a real undo stack so no routine action needs a
   confirmation dialog.

   Every number on every screen is computed here from data-model.js.
   ========================================================================== */

import { subProcesses, narrative, risks, controls, gaps, openItems, signOffGates } from "./data-model.js";

/* The decision state that undo restores. Everything else is view state. */
const DECISIONS = ["blocks", "sections", "coverage", "riskDecisions", "controlDecisions", "itemStates"];

const initial = () => ({
  route: "#/",
  generated: false,
  generating: false,
  genStage: -1,

  /* --- decisions (undoable) --- */
  blocks: {},              // claim id -> { text, edited, rejected, resolution }
  sections: {},            // section id -> "approved" | "rejected"
  coverage: {},            // coverage item id -> { state, naReason, facts }
  riskDecisions: {},       // risk id -> "accepted" | "modified" | "rejected"
  controlDecisions: {},    // control id -> "key" | "not_key" | "undecided"
  itemStates: {},          // open item id -> "open" | "sent" | "resolved" | "dismissed"

  /* --- view state --- */
  reviewMode: "triage",    // triage | focus | read
  focusKind: null,         // claims | risks | controls
  focusIx: 0,
  openClaim: null,         // claim whose evidence is expanded inline
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

export const riskDecision = (r) => S.riskDecisions[r.id] ?? null;
export const controlDecision = (c) => S.controlDecisions[c.id] ?? null;

export function riskSummary() {
  const pending = risks.filter((r) => !riskDecision(r));
  return {
    total: risks.length,
    decided: risks.length - pending.length,
    pending: pending.length,
    queue: pending.filter((r) => !r.blocked),
    blocked: pending.filter((r) => r.blocked),
    significant: risks.filter((r) => r.significant).length,
    fraud: risks.filter((r) => r.fraud).length,
    newRisks: risks.filter((r) => !r.lib).length,
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

/* --- Stages ------------------------------------------------------------------- */

export function stages() {
  const cov = coverageSummary();
  const n = narrativeSummary();
  const rs = riskSummary();
  const cs = controlSummary();
  const oi = openItemSummary();
  const reviewOwed = S.generated ? n.attention.length + n.pending.length + rs.pending + cs.pending : 0;
  return [
    { id: "understand", name: "Understand", href: "#/understand",
      count: `${cov.pct}%`, tone: cov.mandatoryOpen.length ? "warn" : cov.pct >= 85 ? "ok" : "" },
    { id: "review", name: "Review", href: "#/review",
      count: !S.generated ? "not generated"
        : reviewOwed === 0 ? "done"
        : n.attention.length ? `${n.attention.length} need you`
        : `${rs.pending + cs.pending + n.pending} to confirm`,
      tone: !S.generated ? "" : n.attention.length ? "warn" : reviewOwed === 0 ? "ok" : "" },
    { id: "resolve", name: "Resolve", href: "#/resolve",
      count: oi.open ? `${oi.open} open` : "clear",
      tone: oi.contradictions ? "alert" : oi.open ? "" : "ok" },
    { id: "complete", name: "Complete", href: "#/complete",
      count: readyToSign() ? "ready" : "blocked", tone: readyToSign() ? "ok" : "" },
  ];
}

export function gateStates() {
  const n = narrativeSummary(), rs = riskSummary(), cs = controlSummary();
  const oi = openItemSummary(), cov = coverageSummary();
  const map = {
    narrative:     { ok: n.pending === 0, detail: `${n.approved} approved · ${n.rejected} rejected · ${n.pending} still to decide` },
    needsSource:   { ok: n.needsSource.length === 0, detail: n.needsSource.length ? `${n.needsSource.length} statements have no support` : "Every statement is traced to a source" },
    contradiction: { ok: n.contradiction.length === 0, detail: n.contradiction.length ? "One contradiction is unresolved" : "No unresolved contradictions" },
    risks:         { ok: rs.pending === 0, detail: `${rs.decided} of ${rs.total} concluded` },
    controls:      { ok: cs.pending === 0, detail: `${cs.decided} of ${cs.total} concluded` },
    mandatory:     { ok: cov.mandatoryOpen.length === 0, detail: cov.mandatoryOpen.length ? `${cov.mandatoryOpen.length} required areas still open` : "All required areas addressed" },
    openItems:     { ok: oi.open === 0, detail: `${oi.open} open · ${oi.resolved} resolved` },
  };
  return signOffGates.map((g) => ({ ...g, ...map[g.id] }));
}

export function readyToSign() {
  const n = narrativeSummary(), rs = riskSummary(), cs = controlSummary(), oi = openItemSummary();
  const cov = coverageSummary();
  return S.generated && n.pending === 0 && n.needsSource.length === 0 && n.contradiction.length === 0
    && rs.pending === 0 && cs.pending === 0 && oi.open === 0 && cov.mandatoryOpen.length === 0;
}

/** The single most useful next action, computed. Drives the Work screen and
 *  the empty states — the product should always know what to suggest. */
export function nextAction() {
  const cov = coverageSummary(), n = narrativeSummary(), rs = riskSummary();
  const cs = controlSummary(), oi = openItemSummary();
  if (!S.generated) return { t: "Generate the Revenue documentation", d: `Coverage is ${cov.pct}% and the required areas are addressed.`, href: "#/review", act: "generate" };
  if (n.attention.length) return { t: `${n.attention.length} statements need your judgement`, d: "Contradictions and unsupported claims are blocking four sections.", href: "#/review" };
  if (n.cleanReady.length) return { t: `${n.cleanReady.length} sections are clean and ready`, d: "Every statement traced. Accept them and move on.", href: "#/review" };
  if (rs.pending) return { t: `${rs.pending} risks to conclude`, d: "Accept, modify or reject each proposed risk.", href: "#/review" };
  if (cs.pending) return { t: `${cs.pending} control recommendations`, d: `${cs.suggestedKey} are suggested as key controls.`, href: "#/review" };
  if (oi.open) return { t: `${oi.open} open items`, d: "Ask, record or carry each one forward.", href: "#/resolve" };
  return { t: "Revenue is ready for sign-off", d: "Every gate is met.", href: "#/complete" };
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
  decideRisk(id, d) {
    checkpoint("risk concluded");
    S.riskDecisions[id] = d;
    if (S.reviewMode === "focus" && S.focusKind === "risks") this.afterDecision();
    commit(`Risk ${id} ${d}`, true);
  },
  decideControl(id, d) {
    checkpoint("control concluded");
    S.controlDecisions[id] = d;
    const w = d === "key" ? "recorded as a key control" : d === "not_key" ? "recorded as not key" : "left undecided";
    if (S.reviewMode === "focus" && S.focusKind === "controls") this.afterDecision();
    commit(`${id} ${w}`, true);
  },
  clearRisk(id) { checkpoint("risk reopened"); delete S.riskDecisions[id]; commit(); },
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

  /* generation */
  startGeneration(stagesList) {
    S.generating = true; S.genStage = 0; commit();
    const step = (i) => {
      if (i >= stagesList.length) {
        S.generating = false; S.generated = true; S.genStage = stagesList.length;
        S.reviewMode = "triage"; commit();
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
  if (S.focusKind === "risks") return riskSummary().queue.length;
  if (S.focusKind === "controls") return controlSummary().queue.length;
  return 0;
}
