/* ============================================================================
   state.js — prototype state, derivations and actions.

   Second iteration. The derivations are unchanged from v1 (they were right);
   what is new is the exception model that drives review-by-exception, the
   focus queues, and a real undo stack so no routine action needs a
   confirmation dialog.

   Every number on every screen is computed here from data-model.js.
   ========================================================================== */

import { subProcesses, narrative, risks, controls, gaps, openItems } from "./data-model.js";
import { questionnaire, recordAnswerEvidence, clearSessionEvidence,
         sessionEvidence } from "./data-sources.js";
import { journey, processSteps, processFindings, traceFindings, transactions, txnById,
         variants, stepsForVariant, lineWalkRequirements,
         controlTest as controlTestPack, reviewPointLibrary,
         methodologyConfig } from "./data-process.js";

/* The decision state that undo restores. Everything else is view state. */
const DECISIONS = ["blocks", "sections", "coverage", "factOverrides", "controlDecisions",
                   "controlCarry", "findingDecisions", "itemStates", "itemCarry",
                   "traceDecisions", "traceTxn", "traceStarted", "traceConcluded", "lwRequirements",
                   "testScope", "controlTests", "answers", "signOff", "reviewPoints",
                   "prepared"];

const initial = () => ({
  route: "#/",
  /* Step 3 — the process understanding is drafted. */
  generated: false,
  generating: false,
  genStage: -1,
  genSeen: false,          // the step 3 result has been read

  /* Step 4 — controls and findings are analysed. A separate run against the
     reviewed understanding: step 3 documents the process, step 4 analyses it. */
  analysed: false,
  analysing: false,
  anaStage: -1,
  anaSeen: false,

  /* --- decisions (undoable) --- */
  blocks: {},              // claim id -> { text, edited, rejected, resolution }
  sections: {},            // section id -> "approved" | "rejected"
  coverage: {},            // coverage item id -> { state, naReason, facts }
  controlDecisions: {},    // control id -> "key" | "not_key" | "undecided" | "carried_forward"
  controlCarry: {},        // control id -> reason, when carried forward undecided
  findingDecisions: {},    // finding id -> { decision, severity, title, detail, impact, remediation }
  itemStates: {},          // open item id -> "open" | "sent" | "resolved" | "carried_forward"
  itemCarry: {},           // open item id -> { destination, reason }
  factOverrides: {},       // "itemId::factKey" -> { status, value, resolution }
  traceTxn: null,          // the transaction being traced now
  traceDecisions: {},      // "txnId::stepId" -> "corroborated" | "exception"
  traceStarted: {},        // txnId -> true, once selected for a variant
  traceConcluded: {},      // txnId -> true
  lwRequirements: {},      // variant id -> { state, reason }
  testScope: {},           // control id -> { state: required|not_required|deferred, reason }
  /* Per control, never global: concluding one test must not close another. */
  controlTests: {},        // control id -> { started, extended, conclusion, note }
  answers: {},             // questionnaire: question n -> { kind, text, evidenceId }
  signOff: { preparer: "unsigned", review: "not_submitted" },
  reviewPoints: {},        // review point id -> { state, response, respondedAt }
  prepared: false,         // step 1 confirmed

  /* --- view state --- */
  reviewMode: "triage",    // triage | focus | read
  focusKind: null,         // claims | controls | findings | trace
  editingFinding: null,    // finding id open in the modify form
  openPoint: null,         // review point whose detail is open
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
  // Evidence created by an answer that has just been undone must go with it.
  Object.keys(sessionEvidence).forEach((id) => {
    const n = Number(id.split(":")[1]);
    if (S.answers[n]?.kind !== "answer") delete sessionEvidence[id];
  });
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

export function covState(item) {
  const forced = S.coverage[item.id]?.state;
  if (forced === "na") return "na";
  const facts = covFacts(item);
  if (!facts.length) return forced ?? item.state;
  // Recomputed from the facts, so a resolution moves the item without a second action.
  if (facts.every(factSettled)) return "covered";
  if (facts.some(factSettled) || forced === "partial") return "partial";
  return forced ?? item.state;
}
export const covFacts = (item) => {
  const ov = S.coverage[item.id];
  return item.facts.map((f) => {
    const res = S.factOverrides[`${item.id}::${f.key}`];
    const rec = ov?.facts?.[f.key];
    return { ...f, ...(rec || {}), ...(res || {}) };
  });
};

/** A fact is settled if it is known, or resolved by an auditor decision. */
export const factSettled = (f) => ["known", "resolved_known", "resolved_with_exception"].includes(f.status);
export const factContradictory = (f) => f.status === "contradictory";
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

export const stepsForVariantCount = (vid) => stepsForVariant(vid).length;

export const allItems = () => subProcesses.flatMap((sp) => sp.items);

export function coverageSummary() {
  const items = allItems();
  const c = coverageCounts(items);
  const applicable = items.length - c.na;
  const facts = { known: 0, unknown: 0, contradictory: 0, assumed: 0,
                  resolved_known: 0, resolved_with_exception: 0, total: 0 };
  items.forEach((i) => covFacts(i).forEach((f) => { facts[f.status] = (facts[f.status] || 0) + 1; facts.total++; }));
  facts.settled = facts.known + facts.resolved_known + facts.resolved_with_exception;
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
      const contra = facts.filter(factContradictory);
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
  if (!S.analysed) return { total: 0, significant: 0, fraud: 0, newRisks: 0, blocked: [] };
  return {
    total: risks.length,
    significant: risks.filter((r) => r.significant).length,
    fraud: risks.filter((r) => r.fraud).length,
    newRisks: risks.filter((r) => !r.lib).length,
    blocked: risks.filter((r) => r.blocked),
  };
}

/** Only key and not_key conclude a control. Undecided keeps it open; moving on
 *  with uncertainty takes the explicit carry-forward action and a reason. */
export const CONCLUDED_CONTROL = ["key", "not_key", "carried_forward"];
export const controlOpen = (c) => !CONCLUDED_CONTROL.includes(controlDecision(c));

export function controlSummary() {
  if (!S.analysed) {
    return { total: 0, decided: 0, pending: 0, queue: [], undecided: [], carriedForward: 0,
             suggestedKey: 0, unassessable: 0, agreedKey: 0, keyControls: [], gaps: 0,
             identified: controls.length };
  }
  const open = controls.filter(controlOpen);
  const undecided = controls.filter((c) => controlDecision(c) === "undecided");
  return {
    total: controls.length,
    decided: controls.length - open.length,
    pending: open.length,
    queue: open,
    undecided,
    carriedForward: controls.filter((c) => controlDecision(c) === "carried_forward").length,
    suggestedKey: controls.filter((c) => c.keyProposal === true).length,
    unassessable: controls.filter((c) => c.keyProposal === null).length,
    agreedKey: controls.filter((c) => controlDecision(c) === "key").length,
    keyControls: controls.filter((c) => controlDecision(c) === "key"),
    gaps: gaps.length,
    identified: controls.length,
  };
}

/* --- Findings ----------------------------------------------------------------
   Control gaps and process observations are one auditor-facing object. The line
   walkthrough can add to the list, which is how step 5 feeds step 4.
   -------------------------------------------------------------------------- */

const stepOfSubProcess = (sub) => processSteps.find((p) => p.sub === sub)?.id || null;

/** Every finding, including any the line walkthrough raised. The system
 *  proposal and the auditor's conclusion are kept as separate values. */
export function allFindings() {
  if (!S.analysed) return [];      // step 4 has not been run
  const fromGaps = gaps.map((g) => ({
    id: g.id, step: stepOfSubProcess(g.sub), kind: "gap", severity: g.severity,
    title: g.desc, detail: g.impact, remediation: g.remediation, refs: g.refs,
    risk: g.risk, fromTrace: false,
  }));
  const out = [...fromGaps, ...processFindings];
  Object.entries(traceFindings).forEach(([txnId, f]) => {
    if (!S.traceConcluded[txnId]) return;
    const raised = (txnById(txnId)?.steps || []).some((t) => traceVerdict(txnId, t) === "exception");
    if (raised) out.push(f);
  });
  return out;
}

export const findingDecision = (f) => S.findingDecisions[f.id] ?? null;
export const findingOutcome = (f) => {
  const d = findingDecision(f);
  return d ? { ...f, ...d.fields, decision: d.decision } : { ...f, decision: null };
};
export const findingOpen = (f) => !findingDecision(f);

export function findingSummary() {
  const all = allFindings();
  const pending = all.filter(findingOpen);
  return {
    total: all.length, all, pending, queue: pending,
    decided: all.length - pending.length,
    confirmed: all.filter((f) => ["confirmed", "modified"].includes(findingDecision(f)?.decision)).length,
    modified: all.filter((f) => findingDecision(f)?.decision === "modified").length,
    dismissed: all.filter((f) => findingDecision(f)?.decision === "dismissed").length,
    fromTrace: all.filter((f) => f.fromTrace),
    fromTraceOpen: all.filter((f) => f.fromTrace && findingOpen(f)),
  };
}

/* --- Line walkthrough, per variant --------------------------------------------
   A walkthrough is required per applicable variant, not once for the process.
   Every verdict is keyed by transaction, so selecting a transaction genuinely
   loads that transaction.
   -------------------------------------------------------------------------- */

/** The methodology pack *proposes*; nothing is required until the auditor says
 *  so. Pre-seeding the decision from the pack would be the platform deciding. */
export const lwRequirement = (vid) => S.lwRequirements[vid] ?? { state: "not_decided", reason: null };
export const lwProposal = (vid) => lineWalkRequirements[vid] ?? null;

export const traceVerdict = (txnId, t) => S.traceDecisions[`${txnId}::${t.id}`] ?? null;
export const traceConcluded = (txnId) => !!S.traceConcluded[txnId];

/** The transaction traced for a variant, if one has been chosen. */
export const txnForVariant = (vid) =>
  transactions.find((t) => t.variant === vid && (S.traceStarted[t.id] || S.traceConcluded[t.id] || S.traceTxn === t.id));

export function traceProgress(txnId) {
  const txn = txnById(txnId);
  if (!txn) return null;
  const done = txn.steps.filter((t) => traceVerdict(txnId, t));
  return {
    txn,
    expected: txn.steps.length,
    done: done.length,
    corroborated: txn.steps.filter((t) => traceVerdict(txnId, t) === "corroborated").length,
    exceptions: txn.steps.filter((t) => traceVerdict(txnId, t) === "exception").length,
    pending: txn.steps.filter((t) => !traceVerdict(txnId, t)),
    concluded: traceConcluded(txnId),
  };
}

/** Requirement and status for every variant — what the completion gate reads. */
export function variantWalkthroughs() {
  return variants.map((v) => {
    const req = lwRequirement(v.id);
    const txn = txnForVariant(v.id);
    const prog = txn ? traceProgress(txn.id) : null;
    const state = req.state === "not_required" ? "not_required"
      : req.state === "not_decided" ? "not_decided"
      : prog?.concluded ? "completed"
      : prog ? "in_progress" : "not_started";
    return { variant: v, requirement: req, txn, progress: prog, state,
             satisfied: state === "not_required" || state === "completed" };
  });
}

export function traceSummary() {
  const vws = variantWalkthroughs();
  const required = vws.filter((v) => v.requirement.state === "required");
  return {
    variants: vws,
    required: required.length,
    completed: required.filter((v) => v.state === "completed").length,
    satisfied: vws.every((v) => v.satisfied),
    undecided: vws.filter((v) => v.requirement.state === "not_decided").length,
    exceptions: vws.reduce((n, v) => n + (v.progress?.exceptions || 0), 0),
    active: S.traceTxn ? traceProgress(S.traceTxn) : null,
  };
}

/** Which map step a trace step belongs to, for the given transaction. */
export const traceStepFor = (txnId, mapStepId) =>
  (txnById(txnId)?.steps || []).find((t) => t.step === mapStepId) || null;

/* --- Control testing -----------------------------------------------------------
   Conditional: the scope decision comes first, and extending the sample is not
   a conclusion.
   -------------------------------------------------------------------------- */

export const testScopeFor = (cid) => S.testScope[cid] ?? { state: "deferred", reason: null };

/** Test state for one control. Never global — concluding C-04 says nothing
 *  about any other control that was scoped for testing. */
export const controlTest = (cid) =>
  S.controlTests[cid] ?? { started: false, extended: false, conclusion: null };

/** Only this control carries a worked example in the prototype. */
export const hasWorkpaper = (cid) => cid === controlTestPack.controlId;

export function testingScope() {
  const keys = controlSummary().keyControls;
  const rows = keys.map((c) => ({ control: c, scope: testScopeFor(c.id), test: controlTest(c.id) }));
  const required = rows.filter((r) => r.scope.state === "required");
  const deferred = rows.filter((r) => r.scope.state === "deferred");
  const concluded = required.filter((r) => !!r.test.conclusion);
  return {
    rows, keys,
    required, deferred, concluded,
    outstanding: required.filter((r) => !r.test.conclusion),
    notRequired: rows.filter((r) => r.scope.state === "not_required"),
    decided: rows.length - deferred.length,
    // Nothing to test is a legitimate outcome, provided it was decided.
    applicable: required.length > 0,
    scopeDecided: keys.length > 0 && deferred.length === 0,
  };
}

/** The worked test, for the one control that has a workpaper. */
export function testSummary(cid = controlTestPack.controlId) {
  const t = controlTest(cid);
  if (!hasWorkpaper(cid)) {
    return { control: cid, workpaper: false, results: [], selected: 0, corroborated: 0,
             exceptions: 0, extended: false, concluded: !!t.conclusion, conclusion: t.conclusion };
  }
  const base = controlTestPack.results;
  const ext = t.extended ? controlTestPack.extendedResults : [];
  const all = [...base, ...ext];
  return {
    control: cid, workpaper: true,
    results: all,
    selected: all.length,
    corroborated: all.filter((x) => x.ok).length,
    exceptions: all.filter((x) => !x.ok).length,
    extended: t.extended,
    // Extending is not concluding.
    concluded: !!t.conclusion,
    conclusion: t.conclusion,
  };
}

/** Step 6 is satisfied when every key control has been scoped, and every
 *  control scoped as requiring a test has its *own* conclusion. */
export function testingSatisfied() {
  const sc = testingScope();
  if (!sc.keys.length) return true;             // nothing concluded key yet
  if (!sc.scopeDecided) return false;
  return sc.outstanding.length === 0;
}

/* --- Sign-off and review points ------------------------------------------------
   Reopening is only real if it carries something to do. A review point has to be
   answered before the file can go back to the reviewer.
   -------------------------------------------------------------------------- */

export const signOff = () => S.signOff;
export const reviewRequired = () => methodologyConfig.requiresManagerReview;
export const partnerRequired = () => methodologyConfig.requiresPartnerReview;

/** Review points exist once the reviewer has raised them, not before. */
export function reviewPoints() {
  return reviewPointLibrary
    .filter((p) => S.reviewPoints[p.id])
    .map((p) => ({ ...p, ...S.reviewPoints[p.id] }));
}
export const openReviewPoints = () => reviewPoints().filter((p) => p.state !== "addressed");
export const reviewPointById = (id) =>
  reviewPoints().find((p) => p.id === id) || null;

/** The file goes back to the reviewer only when every point has an answer. */
export const canResubmit = () =>
  S.signOff.preparer === "signed" && openReviewPoints().length === 0;

/** Everything except the signatures themselves. */
export function workComplete() {
  return gateStates().filter((g) => !g.signature && g.applicable).every((g) => g.ok);
}

export function processState() {
  const so = S.signOff;
  if (so.review === "approved") return { id: "complete", label: "Complete" };
  if (so.review === "in_review") return { id: "in_review", label: "In review" };
  if (so.review === "reopened") return { id: "reopened", label: "Review points open" };
  if (so.review === "submitted") return { id: "submitted", label: "Submitted for review" };
  if (so.preparer === "signed") return { id: "signed", label: "Ready for review" };
  if (workComplete()) return { id: "ready", label: "Ready to sign" };
  return { id: "wip", label: "Work in progress" };
}

/* --- Open items --------------------------------------------------------------- */

export const itemState = (i) => S.itemStates[i.id] ?? i.state;
export const allOpenItems = () => [...openItems, ...questionnaireItems()];

export function openItemSummary() {
  const all = allOpenItems();
  const live = all.filter((i) => !["resolved", "carried_forward", "dismissed"].includes(itemState(i)));
  return {
    total: all.length, all, open: live.length, live,
    questions: live.filter((i) => i.kind === "question").length,
    evidence: live.filter((i) => i.kind === "evidence").length,
    contradictions: live.filter((i) => i.kind === "contradiction").length,
    sent: live.filter((i) => itemState(i) === "sent").length,
    blocking: live.filter((i) => i.blocks && i.blocks.length),
    carried: all.filter((i) => itemState(i) === "carried_forward"),
    resolved: all.length - live.length,
  };
}

/* --- RCM ---------------------------------------------------------------------- */

export function rcmRows() {
  if (!S.analysed) return [];
  const rows = [];
  risks.forEach((r) => {
    const linked = controls.filter((c) => c.risks.includes(r.id));
    if (!linked.length) rows.push({ risk: r, control: null, gap: gaps.find((g) => g.risk === r.id) || null });
    else linked.forEach((c) => rows.push({ risk: r, control: c, gap: null }));
  });
  return rows;
}

/* --- Questionnaire answers feed the same fact model -------------------------
   A questionnaire answer is another evidence source into coverage, not a
   separate mini-application. Deterministic, but structurally connected.
   -------------------------------------------------------------------------- */

export const QUESTION_FACTS = {
  13: { item: "R5.3", fact: "override_report_reviewer", openItem: "OI-02",
        value: "Nobody reviews it routinely — confirmed by the Commercial Director." },
  14: { item: "R9.3", fact: "consignment_treatment", openItem: "OI-03",
        value: "Recognised on sale to the end customer, not on despatch to the distributor." },
};

/** Facts established during this session, with the evidence behind each — the
 *  answer to "where did that come from?" for anything settled after the draft. */
export function sessionFacts() {
  return Object.entries(S.factOverrides)
    .filter(([, v]) => v.refs && v.refs.length)
    .map(([key, v]) => {
      const [itemId, factKey] = key.split("::");
      const item = allItems().find((i) => i.id === itemId);
      return { itemId, factKey, item, ...v };
    });
}

export const questionState = (q) => S.answers[q.n]?.kind
  ?? (q.a ? "answer" : q.state === "sent" ? "sent" : "open");
export const questionAnswer = (q) => S.answers[q.n]?.text ?? q.a ?? null;

/** Open items the questionnaire raised, alongside the methodology ones. */
export function questionnaireItems() {
  return Object.entries(S.answers)
    .filter(([, a]) => a.kind !== "answer")
    .map(([n, a]) => ({
      id: `QQ-${n}`, kind: "question", coverage: "—", priority: "medium",
      state: "open", origin: "client_response",
      title: a.kind === "unknown"
        ? `The client could not answer question ${n}`
        : `The client asked for a call about question ${n}`,
      detail: a.kind === "unknown"
        ? "Recorded as unable to answer. The underlying fact is still unresolved and needs another route."
        : "The client would rather discuss this than answer in writing. Schedule the follow-up.",
      blocks: [], refs: [], owner: "Unassigned", fromQuestionnaire: true,
    }));
}

/** Evidence that settled an open item, when a questionnaire answer did it. */
export function itemEvidence(i) {
  const entry = Object.entries(QUESTION_FACTS).find(([, m]) => m.openItem === i.id);
  if (!entry) return [];
  const a = S.answers[Number(entry[0])];
  return a && a.kind === "answer" && a.evidenceId ? [a.evidenceId] : [];
}

/* --- Open items: carry-forward carries a destination and a reason ------------ */

export const itemCarry = (i) => S.itemCarry[i.id] ?? null;

/* --- The process journey -------------------------------------------------------
   Seven ordered steps, each carrying its own state.
   -------------------------------------------------------------------------- */

export function journeyStates() {
  const cov = coverageSummary();
  const n = narrativeSummary();
  const cs = controlSummary();
  const fs = findingSummary();
  const tr = traceSummary();
  const sc = testingScope();
  const ps = processState();

  const st = (id) => {
    switch (id) {
      case "prepare":
        return S.prepared ? { s: "done", c: "confirmed" } : { s: "open", c: "start here" };
      case "interview":
        return interviewComplete() ? { s: "done", c: `${cov.pct}%` }
          : cov.facts.contradictory ? { s: "open", c: "contradiction", tone: "alert" }
          : cov.mandatoryOpen.length ? { s: "open", c: `${cov.pct}%`, tone: "warn" }
          : { s: "open", c: `${cov.pct}%` };
      case "understanding":
        return !S.generated ? { s: "later", c: "not drafted", why: "Draft the current understanding once the interview has established enough to draft from." }
          : n.attention.length ? { s: "open", c: `${n.attention.length} need you`, tone: "warn" }
          : n.pending ? { s: "open", c: `${n.pending} to approve` }
          : { s: "done", c: "approved" };
      case "controls": {
        const owed = cs.pending + fs.pending.length;
        return !S.generated ? { s: "later", c: "—", why: "Controls are analysed from the process understanding, so the process has to be documented first." }
          : n.pending ? { s: "later", c: "—", why: "The analysis runs against the reviewed understanding. Finish reviewing the draft first." }
          : !S.analysed ? { s: "open", c: "not analysed" }
          : fs.fromTraceOpen.length ? { s: "open", c: "new finding", tone: "alert" }
          : owed ? { s: "open", c: `${owed} to conclude` }
          : { s: "done", c: `${cs.agreedKey} key` };
      }
      case "trace":
        return !S.analysed ? { s: "later", c: "—", why: "A transaction is traced against the documented process and the controls identified on it, so step 4 has to run first." }
          : tr.undecided ? { s: "open", c: "scope undecided" }
          : tr.satisfied ? { s: "done", c: tr.exceptions ? `${tr.exceptions} exception` : "no exceptions", tone: tr.exceptions ? "warn" : "" }
          : { s: "open", c: `${tr.completed} of ${tr.required}` };
      case "testing":
        if (!cs.keyControls.length) return { s: "later", c: "—", why: "Controls concluded as key appear here." };
        if (!sc.scopeDecided) return { s: "open", c: "decide scope" };
        if (!sc.applicable) return { s: "done", c: "not required" };
        return sc.outstanding.length === 0 ? { s: "done", c: `${sc.concluded.length} concluded` }
          : { s: "open", c: `${sc.outstanding.length} to conclude` };
      case "complete":
        return ps.id === "complete" ? { s: "done", c: "complete", tone: "ok" }
          : ps.id === "reopened" ? { s: "open", c: "review points", tone: "alert" }
          : ps.id === "wip" ? { s: "later", c: "blocked", why: "Every applicable gate has to be met first." }
          : { s: "open", c: ps.label.toLowerCase(), tone: "ok" };
    }
    return { s: "later", c: "" };
  };

  return journey.map((j) => ({ ...j, ...st(j.id) }));
}

export const journeyStep = (id) => journeyStates().find((j) => j.id === id);

/** The process interview is complete when nothing required is left unresolved. */
export function interviewComplete() {
  const cov = coverageSummary();
  return S.prepared && cov.mandatoryOpen.length === 0 && cov.facts.contradictory === 0;
}

export function processProgress() {
  const js = journeyStates();
  return {
    done: js.filter((j) => j.s === "done").length,
    total: js.length,
    current: js.find((j) => j.s === "open") || js[js.length - 1],
  };
}

/* --- Completion gates ----------------------------------------------------------
   Every gate declares whether it applies, so nothing blocks on work this
   process does not need. No risk-analysis gate: interim ends before it.
   -------------------------------------------------------------------------- */

export function gateStates() {
  const n = narrativeSummary(), cs = controlSummary(), fs = findingSummary();
  const oi = openItemSummary(), cov = coverageSummary(), tr = traceSummary();
  const sc = testingScope(), so = S.signOff;
  const carried = openItems.filter((i) => itemState(i) === "carried_forward").length;

  const g = [
    { id: "prepared", label: "Preparation confirmed", step: "prepare", applicable: true,
      ok: S.prepared, detail: S.prepared ? "Scope, participants and carried context confirmed" : "Not yet confirmed" },

    { id: "interview", label: "Process interview sufficiently complete", step: "interview", applicable: true,
      ok: interviewComplete(),
      detail: !S.prepared ? "Preparation not confirmed"
        : cov.facts.contradictory ? `${cov.facts.contradictory} facts are still contradictory`
        : cov.mandatoryOpen.length ? `${cov.mandatoryOpen.length} required areas still open`
        : `${cov.covered} of ${cov.applicable} areas established` },

    { id: "mandatory", label: "Required methodology areas addressed or documented", step: "interview", applicable: true,
      ok: cov.mandatoryOpen.length === 0,
      detail: cov.mandatoryOpen.length ? `${cov.mandatoryOpen.map((i) => i.id).join(", ")} open without a documented reason` : "All required areas addressed" },

    { id: "understanding", label: "Process understanding reviewed", step: "understanding", applicable: true,
      ok: S.generated && n.pending === 0,
      detail: !S.generated ? "Nothing drafted yet" : `${n.approved} approved · ${n.rejected} rejected · ${n.pending} to decide` },

    { id: "needsSource", label: "No unsupported statements", step: "understanding", applicable: true,
      ok: S.generated && n.needsSource.length === 0,
      detail: n.needsSource.length ? `${n.needsSource.length} statements have no support` : "Every statement is traced to a source" },

    /* Carrying a contradiction forward preserves it — it does not resolve it,
       and it does not clear this gate. The label has to say that. */
    { id: "contradiction", label: "No unresolved contradictions", step: "interview", applicable: true,
      ok: n.contradiction.length === 0 && cov.facts.contradictory === 0,
      detail: cov.facts.contradictory || n.contradiction.length
        ? (openItems.some((i) => itemState(i) === "carried_forward" && i.kind === "contradiction")
            ? "Carried forward, which preserves the conflict — it does not resolve it"
            : "One contradiction is unresolved")
        : "Every contradiction is resolved on the evidence" },

    { id: "analysed", label: "Controls and findings analysed", step: "controls", applicable: true,
      ok: S.analysed,
      detail: S.analysed ? `${cs.total} controls and ${fs.total} findings identified from the reviewed understanding`
        : n.pending ? "The analysis runs against the reviewed understanding, which is not finished"
        : "Not analysed yet" },

    { id: "controls", label: "Controls concluded", step: "controls", applicable: true,
      ok: S.analysed && cs.pending === 0,
      detail: !S.analysed ? "Not analysed yet"
        : cs.undecided.length ? `${cs.undecided.length} left undecided — carry forward or conclude`
        : `${cs.decided} of ${cs.total} concluded · ${cs.agreedKey} key` },

    { id: "findings", label: "Findings concluded", step: "controls", applicable: true,
      ok: S.analysed && fs.pending.length === 0,
      detail: !S.analysed ? "Not analysed yet"
        : fs.fromTraceOpen.length ? "A finding raised by the line walkthrough needs review"
        : `${fs.decided} of ${fs.total} concluded` },

    { id: "trace", label: "Required line walkthroughs completed", step: "trace",
      applicable: true, ok: tr.satisfied,
      detail: tr.undecided ? `${tr.undecided} variants have no walkthrough decision`
        : tr.required === 0 ? "No line walkthrough required for this process"
        : `${tr.completed} of ${tr.required} required walkthroughs complete` },

    { id: "testing", label: "Control testing completed or documented as not required", step: "testing",
      applicable: cs.keyControls.length > 0, ok: testingSatisfied(),
      detail: !cs.keyControls.length ? "No key controls concluded yet"
        : !sc.scopeDecided ? `${sc.deferred.length} key controls have no testing decision`
        : !sc.applicable ? "No reliance planned on any key control — no testing required, reasons on file"
        : sc.outstanding.length ? `${sc.concluded.length} of ${sc.required.length} scoped tests concluded · ${
            sc.outstanding.map((r) => r.control.id).join(", ")} outstanding`
        : `${sc.concluded.length} of ${sc.required.length} scoped tests concluded` },

    { id: "openItems", label: "Open matters resolved or carried forward", step: "interview", applicable: true,
      ok: oi.open === 0, detail: `${oi.open} open · ${oi.resolved} settled · ${carried} carried forward` },

    { id: "signed", label: "Preparer signed", step: "complete", applicable: true, signature: true,
      ok: so.preparer === "signed",
      detail: so.preparer === "signed" ? `Signed by the preparer` : "Not yet signed" },

    { id: "review", label: "Manager review approved", step: "complete",
      applicable: methodologyConfig.requiresManagerReview, signature: true,
      ok: so.review === "approved",
      detail: so.review === "approved" ? "Approved"
        : so.review === "reopened" ? `Reopened · ${openReviewPoints().length} review point${
            openReviewPoints().length === 1 ? "" : "s"} to answer before it can go back`
        : so.review === "in_review" ? "With the reviewer"
        : so.review === "submitted" ? "Submitted, awaiting review"
        : "Not yet submitted" },

    { id: "partner", label: "Partner review approved", step: "complete",
      applicable: methodologyConfig.requiresPartnerReview, signature: true,
      ok: false, detail: methodologyConfig.partnerReviewNote },
  ];
  return g.filter((x) => x.applicable);
}

export const readyToSign = () => workComplete() && S.signOff.preparer !== "signed";

/** The most valuable unresolved next step, following the corrected order. */
export function nextAction() {
  const cov = coverageSummary(), n = narrativeSummary(), cs = controlSummary();
  const fs = findingSummary(), oi = openItemSummary(), tr = traceSummary();
  const sc = testingScope(), so = S.signOff;

  if (!S.prepared) return { t: "Prepare the Revenue process", d: "Scope, systems, people and the context carried in from planning.", href: "#/prepare" };
  if (cov.facts.contradictory) return { t: "Two sources disagree about who can change a credit limit", d: "It blocks a statement, a control and a coverage area at once.", href: "#/interview" };
  if (cov.mandatoryOpen.length) return { t: `${cov.mandatoryOpen.length} required areas are still open`, d: "The process interview cannot be concluded while an ISA 240 area is unaddressed.", href: "#/interview" };
  if (!S.generated) return { t: "Draft the process understanding", d: `Coverage is ${cov.pct}% and the required areas are addressed.`, href: "#/understanding" };
  if (n.attention.length) return { t: `${n.attention.length} statements need your judgement`, d: "Unsupported or contradictory statements are blocking their sections.", href: "#/understanding" };
  if (n.pending) return { t: `${n.pending} sections to approve`, d: "Every statement in them is traced to a source. Nothing is analysed until the understanding is reviewed.", href: "#/understanding" };
  if (!S.analysed) return { t: "Analyse controls and findings", d: "The understanding is reviewed. Step 4 identifies what controls this process and what is wrong with it.", href: "#/controls" };
  if (fs.fromTraceOpen.length) return { t: "The line walkthrough raised a finding", d: "Testing a real transaction changed the documented understanding. Review it before moving on.", href: "#/controls" };
  if (cs.pending) return { t: `${cs.pending} controls to conclude`, d: cs.undecided.length ? `${cs.undecided.length} are undecided — conclude them or carry them forward with a reason.` : `${cs.suggestedKey} are suggested as key controls.`, href: "#/controls" };
  if (fs.pending.length) return { t: `${fs.pending.length} findings to conclude`, d: "Confirm, modify or dismiss each one. Severity is your judgement.", href: "#/controls" };
  if (tr.undecided) return { t: "Decide which variants need a line walkthrough", d: "Revenue has three process variants and they do not all need one.", href: "#/trace" };
  if (!tr.satisfied) return { t: `${tr.required - tr.completed} required line walkthroughs outstanding`, d: "Trace a real transaction through each variant that needs one.", href: "#/trace" };
  if (cs.keyControls.length && !sc.scopeDecided) return { t: "Decide which controls require testing", d: `${sc.deferred.length} key controls have no testing decision.`, href: "#/testing" };
  if (sc.outstanding.length) {
    const r = sc.outstanding[0];
    return { t: sc.outstanding.length === 1
        ? `Conclude the control test on ${r.control.id}`
        : `${sc.outstanding.length} control tests still to conclude`,
      d: r.test.extended ? "The sample was extended; a conclusion is still required."
        : `Each control scoped for testing needs its own conclusion — ${sc.outstanding.map((x) => x.control.id).join(", ")}.`,
      href: "#/testing" };
  }
  if (oi.open) return { t: `${oi.open} open matters`, d: "Resolve each one, or carry it forward with a destination and a reason.", href: "#/resolve" };
  if (so.preparer !== "signed") return { t: "Sign as preparer", d: "Every applicable gate is met. Signing makes Revenue ready for review.", href: "#/complete" };
  /* Reopened work comes back to the preparer, and says so. */
  if (openReviewPoints().length) {
    const n2 = openReviewPoints().length;
    return { t: `${n2} review point${n2 === 1 ? "" : "s"} need${n2 === 1 ? "s" : ""} your attention`,
      d: `The reviewer sent Revenue back. ${openReviewPoints()[0].subject}.`, href: "#/complete" };
  }
  if (methodologyConfig.requiresManagerReview && so.review === "reopened") return { t: "Resubmit for manager review", d: "Every review point has been answered.", href: "#/complete" };
  if (methodologyConfig.requiresManagerReview && so.review === "not_submitted") return { t: "Submit for manager review", d: "The preparer has signed. The process is not complete until the reviewer approves.", href: "#/complete" };
  if (methodologyConfig.requiresManagerReview && so.review !== "approved") return { t: "Awaiting manager review", d: "The reviewer approves, or reopens with review points.", href: "#/complete" };
  return { t: "Revenue is complete", d: "Handed forward to risk analysis.", href: "#/complete" };
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
  /** One decision, propagated: narrative → fact/coverage → open item → gates.
   *  The two conflicting source statements stay in provenance in every case. */
  resolveConflict(id, choice, text) {
    checkpoint("contradiction resolved");
    S.blocks[id] = { ...(S.blocks[id] || {}), text, resolution: { kind: "conflict", choice } };

    const status = choice === "controller" ? "resolved_known"
      : choice === "both" ? "resolved_with_exception"
      : "contradictory";                       // left unresolved, deliberately
    const note = choice === "controller"
      ? "Credit control is the accepted process, on two corroborating sources. The Commercial Director's answer is recorded as inconsistent and followed up."
      : choice === "both"
      ? "Both routes exist. The Commercial Director can raise a limit by up to EUR 50,000, which the financial controller was unaware of."
      : "Unresolved. The difference is documented and carried forward.";

    ["limit_change_owner", "limit_change_approval"].forEach((key) => {
      S.factOverrides[`R3.1::${key}`] = { status, resolution: note,
        value: choice === "unresolved" ? undefined : note };
    });

    S.itemStates["OI-01"] = choice === "unresolved" ? "carried_forward" : "resolved";
    if (choice === "unresolved") {
      S.itemCarry["OI-01"] = { destination: "Final audit",
        reason: "The difference between the two sources could not be settled during interim and is carried forward." };
    }
    if (S.reviewMode === "focus") this.afterDecision();
    commit(choice === "unresolved"
      ? "Left unresolved and carried forward — the gate stays blocked"
      : "Contradiction resolved — coverage updated", true);
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
  decideFinding(id, d, fields) {
    checkpoint("finding concluded");
    // The system proposal stays on the finding; this is the auditor's conclusion.
    S.findingDecisions[id] = { decision: d, fields: fields || null };
    S.editingFinding = null;
    if (S.reviewMode === "focus" && S.focusKind === "findings") this.afterDecision();
    commit(d === "confirmed" ? `${id} confirmed` : d === "modified" ? `${id} confirmed as modified` : `${id} dismissed`, true);
  },
  editFinding(id) { S.editingFinding = id; commit(); },
  cancelFindingEdit() { S.editingFinding = null; commit(); },
  decideControl(id, d) {
    checkpoint("control concluded");
    S.controlDecisions[id] = d;
    S.editing = null;
    if (S.reviewMode === "focus" && S.focusKind === "controls") this.afterDecision();
    commit(`${id} recorded as ${d === "key" ? "a key control" : "not key"}`, true);
  },
  /** Parking is a bookmark. The control stays in the queue and still blocks the
   *  gate; only a conclusion or a carry-forward removes it. */
  parkControl(id) {
    checkpoint("control parked");
    S.controlDecisions[id] = "undecided";
    S.editing = null;
    if (S.reviewMode === "focus" && S.focusKind === "controls") this.focusNext();
    else commit(`${id} left undecided — still outstanding`, true);
  },
  clearFinding(id) { checkpoint("finding reopened"); delete S.findingDecisions[id]; S.editingFinding = null; commit(); },

  carryControl(id, reason) {
    checkpoint("control carried forward");
    S.controlDecisions[id] = "carried_forward";
    S.controlCarry[id] = reason || "Carried forward undecided.";
    S.editing = null;
    commit(`${id} carried forward undecided`, true);
  },
  clearControl(id) { checkpoint("control reopened"); delete S.controlDecisions[id]; commit(); },

  /* open items */
  setItem(id, state) {
    checkpoint("open item updated");
    S.itemStates[id] = state;
    if (state !== "carried_forward") delete S.itemCarry[id];
    S.editing = null;
    commit(`${id} ${state.replace("_", " ")}`, true);
  },
  carryItem(id, destination, reason) {
    checkpoint("open item carried forward");
    S.itemStates[id] = "carried_forward";
    S.itemCarry[id] = { destination, reason: reason || "No reason recorded." };
    S.editing = null;
    commit(`${id} carried forward to ${destination}`, true);
  },

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
  /** Confirming is also the way into step 2 — the button says so, so it has to
   *  actually go there. */
  prepareDone() {
    checkpoint("preparation confirmed");
    S.prepared = true;
    commit("Preparation confirmed", true);
    location.hash = "#/interview";
  },
  prepareReopen() { checkpoint("preparation reopened"); S.prepared = false; commit("Preparation reopened", true); },

  /* step 5 — the line walkthrough, per variant */
  setWalkthroughRequirement(vid, state, reason) {
    checkpoint("walkthrough requirement set");
    S.lwRequirements[vid] = { state, reason: reason || null };
    S.editing = null;
    commit(state === "required" ? "Line walkthrough required for this variant"
      : state === "not_required" ? "Recorded as not requiring a line walkthrough" : "Decision deferred", true);
  },
  pickTransaction(id) {
    checkpoint("transaction selected");
    S.traceTxn = id; S.traceStarted[id] = true;
    S.focusKind = "trace"; S.focusIx = 0; S.reviewMode = "focus";
    commit(`${id} selected — tracing its own path through the process`, true);
  },
  openTrace(id) { S.traceTxn = id; S.reviewMode = "triage"; S.focusKind = null; S.mapStep = null; commit(); },
  backToVariants() { S.traceTxn = null; S.reviewMode = "triage"; S.focusKind = null; S.mapStep = null; commit(); },
  decideTrace(txnId, stepId, verdict) {
    checkpoint("trace step concluded");
    S.traceDecisions[`${txnId}::${stepId}`] = verdict;
    const remaining = traceProgress(txnId).pending.length;
    if (remaining === 0) { S.reviewMode = "triage"; S.focusKind = null; S.focusIx = 0; }
    else S.focusIx = Math.min(S.focusIx, remaining - 1);
    commit(verdict === "exception" ? "Exception recorded" : "Step corroborated", true);
  },
  concludeTrace(txnId) {
    checkpoint("line walkthrough concluded");
    S.traceConcluded[txnId] = true;
    S.reviewMode = "triage"; S.focusKind = null;
    const ex = traceProgress(txnId).exceptions;
    commit(ex ? `Concluded — ${ex} exception raised as a finding, waiting for your conclusion in step 4`
      : "Line walkthrough concluded", true);
  },
  reopenTrace(txnId) { checkpoint("line walkthrough reopened"); delete S.traceConcluded[txnId]; commit(); },

  /* step 6 — scope first, then the test */
  setTestScope(cid, state, reason) {
    checkpoint("testing scope decided");
    S.testScope[cid] = { state, reason: reason || null };
    S.editing = null;
    commit(state === "required" ? "Test required for this control"
      : state === "not_required" ? "No reliance planned — no test required" : "Decision deferred", true);
  },
  extendSample(cid) {
    checkpoint("sample extended");
    S.controlTests[cid] = { ...controlTest(cid), started: true, extended: true };
    // Extending is not concluding: the test stays open and the gate stays blocked.
    commit(`${cid} — sample extended to 10 items, a conclusion is still required`, true);
  },
  concludeTest(cid, d, note) {
    checkpoint("control test concluded");
    S.controlTests[cid] = { ...controlTest(cid), started: true, conclusion: d, note: note || null };
    S.editing = null;
    const left = testingScope().outstanding.length;
    commit(`${cid} — ${d === "rely" ? "reliance placed" : "no reliance placed"}${
      left ? `; ${left} other control${left === 1 ? "" : "s"} still to conclude` : ""}`, true);
  },
  reopenTest(cid) {
    checkpoint("control test reopened");
    S.controlTests[cid] = { ...controlTest(cid), conclusion: null, note: null };
    commit();
  },

  /* step 7 — sign-off */
  signPreparer() {
    checkpoint("signed as preparer");
    S.signOff = { ...S.signOff, preparer: "signed" };
    commit("Signed as preparer — Revenue is ready for review", true);
  },
  submitForReview() {
    // Guarded, not just labelled: an unanswered review point blocks resubmission.
    if (!canResubmit()) {
      commit(`${openReviewPoints().length} review point${openReviewPoints().length === 1 ? "" : "s"} still to answer`);
      return;
    }
    checkpoint("submitted for review");
    S.signOff = { ...S.signOff, review: "submitted" };
    commit("Submitted for manager review", true);
  },
  reviewerAction(d) {
    checkpoint("reviewer decision");
    S.signOff = { ...S.signOff, review: d };
    if (d === "reopened") {
      // Reopening carries work, not only a status. The point is raised here.
      reviewPointLibrary.forEach((p) => {
        if (!S.reviewPoints[p.id]) S.reviewPoints[p.id] = { state: "open", response: null };
      });
      const n = openReviewPoints().length;
      commit(`Reopened — ${n} review point${n === 1 ? "" : "s"} for the preparer`, true);
      return;
    }
    commit(d === "approved" ? "Approved — Revenue is complete" : "In review", true);
  },
  openPoint(id) { S.openPoint = S.openPoint === id ? null : id; S.editing = null; commit(); },
  answerPoint(id, response) {
    checkpoint("review point answered");
    S.reviewPoints[id] = { state: "addressed", response: response || "No response recorded.",
                           respondedAt: "3 October 2026" };
    S.editing = null; S.openPoint = null;
    const left = openReviewPoints().length;
    commit(left ? `${id} addressed — ${left} still open`
      : `${id} addressed — the file can go back to the reviewer`, true);
  },
  reopenPoint(id) {
    checkpoint("review point reopened");
    S.reviewPoints[id] = { ...(S.reviewPoints[id] || {}), state: "open" };
    commit();
  },

  /* --- The two generation runs -------------------------------------------
     Step 3 documents the process. Step 4 analyses it, against the reviewed
     understanding. Two runs because they are two pieces of audit work, and the
     auditor reviews the first before anything is concluded from it.
     -------------------------------------------------------------------- */
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
  startAnalysis(stagesList) {
    S.analysing = true; S.anaStage = 0; commit();
    const step = (i) => {
      if (i >= stagesList.length) {
        S.analysing = false; S.analysed = true; S.anaStage = stagesList.length;
        S.anaSeen = false; S.reviewMode = "triage"; commit();
        return;
      }
      S.anaStage = i; commit();
      setTimeout(() => step(i + 1), stagesList[i].ms);
    };
    step(0);
  },
  readAnalysis() { S.anaSeen = true; commit(); },

  /* peripheral */
  setMode(m) { S.mode = m; commit(); },
  /** Send / I don't know / Rather have a call are three different outcomes. */
  answerQuestion(n, kind, text) {
    checkpoint("questionnaire answered");
    S.answers[n] = { kind, text: text || null, evidenceId: null };
    const map = QUESTION_FACTS[n];
    if (kind === "answer") {
      // The answer becomes a source first. Everything downstream then cites it,
      // rather than resting on an unexplained internal override.
      const q = questionnaire.find((x) => x.n === n);
      const evidenceId = q ? recordAnswerEvidence(q, text || map?.value || "", "3 October 2026") : null;
      S.answers[n] = { kind, text: text || null, evidenceId };
      // One answer, three consequences: the fact, the coverage area it belongs
      // to, and the open item that was raised to chase it.
      if (map) {
        S.factOverrides[`${map.item}::${map.fact}`] = {
          status: "known",
          value: text || map.value,
          resolution: `Established by the client's answer to questionnaire question ${n}.`,
          refs: evidenceId ? [evidenceId] : [],
          via: "client_questionnaire",
          question: n,
        };
        if (map.openItem) {
          S.itemStates[map.openItem] = "resolved";
          S.itemCarry[map.openItem] = null;
        }
      }
      commit("Answer recorded as evidence — the fact, the coverage area and the open item all update", true);
    } else if (kind === "unknown") {
      // Not evidence. Nothing is established, and the fact stays unknown.
      S.itemStates[`QQ-${n}`] = "open";
      if (map?.openItem) S.itemStates[map.openItem] = "open";   // back off "sent"
      commit("Recorded as unable to answer — nothing established, raised for the auditor", true);
    } else {
      S.itemStates[`QQ-${n}`] = "open";
      if (map?.openItem) S.itemStates[map.openItem] = "open";
      commit("Follow-up call requested — nothing established, raised for the auditor", true);
    }
  },
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
    clearSessionEvidence();
    Object.assign(S, initial());
    location.hash = "#/";
    commit("Reset");
  },
};

export function focusLength() {
  if (S.focusKind === "claims") return claimQueue().length;
  if (S.focusKind === "controls") return controlSummary().queue.length;
  if (S.focusKind === "findings") return findingSummary().queue.length;
  if (S.focusKind === "trace") return S.traceTxn ? (traceProgress(S.traceTxn)?.pending.length || 0) : 0;
  return 0;
}
