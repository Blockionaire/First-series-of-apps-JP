/* ============================================================================
   state.js — prototype state, derivations and actions.

   In-memory only. Every headline number on every screen is derived here from
   data-model.js, so the screens cannot claim something the model does not say.
   ========================================================================== */

import { subProcesses, narrative, risks, controls, gaps, openItems, signOffGates } from "./data-model.js";

const initial = () => ({
  route: "#/",
  generated: false,          // has the working paper been generated?
  generating: false,
  genStage: -1,

  /* per-narrative-block runtime state */
  blocks: {},                // id -> { text, flag, edited, rejected, resolution }
  sections: {},              // id -> "approved" | "rejected" | null
  /* per-coverage-item overrides */
  coverage: {},              // id -> { state, naReason, answered }
  riskDecisions: {},         // id -> "accepted" | "modified" | "rejected"
  controlDecisions: {},      // id -> "key" | "not_key" | "undecided"
  itemStates: {},            // openItem id -> "open" | "sent" | "resolved" | "dismissed"

  /* view state */
  pinned: null,              // pinned evidence ref id
  drawer: null,              // { kind, id, ... }
  unresolvedOnly: false,
  section: "N5",
  selBlock: null,
  scrollTo: null,           // section id the document should scroll to on the next render
  expanded: {},              // coverage sub-process id -> bool
  riskSel: null,
  controlSel: null,
  toast: null,

  /* demo */
  demo: false,
  demoStep: 0,

  /* walkthrough prep */
  mode: "transcript",
  qIndex: 12,                // client questionnaire position
  cockpitTurn: 6,
  cockpitPlaying: false,
});

export const S = initial();

/* --- Block state ---------------------------------------------------------- */

export function blockState(b) {
  const rt = S.blocks[b.id] || {};
  if (rt.rejected) return "rejected";
  if (rt.edited) return "edited";
  if (rt.resolution) return "edited";
  if (b.unsupported) return "needs_source";
  if (b.conflict) return "contradiction";
  if (b.missing) return "missing";
  return "draft";
}

export const blockText = (b) => (S.blocks[b.id]?.text ?? b.text);

/** A block that blocks its section from being approved. */
export const blockIsBlocking = (b) => {
  const st = blockState(b);
  return st === "needs_source" || st === "contradiction";
};

export const sectionDecision = (sec) => S.sections[sec.id] ?? null;

export const sectionBlocking = (sec) => sec.blocks.filter(blockIsBlocking);

export const sectionEdited = (sec) => sec.blocks.some((b) => S.blocks[b.id]?.edited || S.blocks[b.id]?.resolution);

export function sectionState(sec) {
  const d = sectionDecision(sec);
  if (d) return d;
  const blocking = sectionBlocking(sec);
  if (blocking.some((b) => blockState(b) === "contradiction")) return "contradiction";
  if (blocking.length) return "needs_source";
  return sectionEdited(sec) ? "edited" : "draft";
}

export const sectionApprovable = (sec) => sectionBlocking(sec).length === 0 && !sectionDecision(sec);

/* --- Coverage derivations -------------------------------------------------- */

export const covState = (item) => S.coverage[item.id]?.state ?? item.state;
export const covFacts = (item) => {
  const ov = S.coverage[item.id];
  if (!ov?.facts) return item.facts;
  return item.facts.map((f) => (ov.facts[f.key] ? { ...f, ...ov.facts[f.key] } : f));
};

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
  const mandatoryOpen = items.filter((i) => i.mandatory && ["open", "partial"].includes(covState(i)));
  return {
    total: items.length, applicable, ...c,
    pct: applicable ? Math.round((c.covered / applicable) * 100) : 0,
    facts, mandatoryOpen,
  };
}

export function subProcessPct(sp) {
  const c = coverageCounts(sp.items);
  const applicable = sp.items.length - c.na;
  if (!applicable) return null;
  return Math.round(((c.covered + c.partial * 0.5) / applicable) * 100);
}

/* --- Narrative derivations -------------------------------------------------- */

export function narrativeSummary() {
  const all = narrative;
  const blocks = all.flatMap((s) => s.blocks);
  const needsSource = blocks.filter((b) => blockState(b) === "needs_source");
  const contradiction = blocks.filter((b) => blockState(b) === "contradiction");
  const missing = blocks.filter((b) => blockState(b) === "missing");
  const approved = all.filter((s) => sectionDecision(s) === "approved");
  const rejected = all.filter((s) => sectionDecision(s) === "rejected");
  const pending = all.filter((s) => !sectionDecision(s));
  const bulk = pending.filter((s) => sectionApprovable(s) && !sectionEdited(s));
  return {
    sections: all.length, blocks: blocks.length,
    needsSource, contradiction, missing,
    approved: approved.length, rejected: rejected.length,
    pending: pending.length, bulkReady: bulk,
    pct: Math.round(((approved.length + rejected.length) / all.length) * 100),
  };
}

export function visibleSections() {
  if (!S.unresolvedOnly) return narrative;
  return narrative.filter((s) => !sectionDecision(s));
}

/** Keep the active section — and therefore the source panel — inside the set the
 *  reader can actually see, after a filter change or a bulk approval. */
function ensureVisibleSection() {
  const vis = visibleSections();
  if (!vis.length) { S.selBlock = null; return; }
  if (!vis.some((s) => s.id === S.section)) {
    S.section = vis[0].id;
    S.selBlock = null;
    S.pinned = null;
  }
}

/* --- Risk / control derivations -------------------------------------------- */

export const riskDecision = (r) => S.riskDecisions[r.id] ?? null;
export const controlDecision = (c) =>
  S.controlDecisions[c.id] ?? (c.keyProposal === null ? null : null);

export function riskSummary() {
  const decided = risks.filter((r) => riskDecision(r)).length;
  return {
    total: risks.length, decided, pending: risks.length - decided,
    significant: risks.filter((r) => r.significant).length,
    fraud: risks.filter((r) => r.fraud).length,
    blocked: risks.filter((r) => r.blocked && !riskDecision(r)).length,
    newRisks: risks.filter((r) => !r.lib).length,
  };
}

export function controlSummary() {
  const decided = controls.filter((c) => controlDecision(c)).length;
  return {
    total: controls.length, decided, pending: controls.length - decided,
    proposedKey: controls.filter((c) => c.keyProposal === true).length,
    unassessable: controls.filter((c) => c.keyProposal === null).length,
    agreedKey: controls.filter((c) => controlDecision(c) === "key").length,
    gaps: gaps.length,
  };
}

/* --- Open items ------------------------------------------------------------ */

export const itemState = (i) => S.itemStates[i.id] ?? i.state;
export function openItemSummary() {
  const live = openItems.filter((i) => !["resolved", "dismissed"].includes(itemState(i)));
  return {
    total: openItems.length,
    open: live.length,
    questions: live.filter((i) => i.kind === "question").length,
    evidence: live.filter((i) => i.kind === "evidence").length,
    contradictions: live.filter((i) => i.kind === "contradiction").length,
    sent: live.filter((i) => itemState(i) === "sent").length,
    resolved: openItems.length - live.length,
  };
}

/* --- RCM ------------------------------------------------------------------- */

export function rcmRows() {
  const rows = [];
  risks.forEach((r) => {
    const linked = controls.filter((c) => c.risks.includes(r.id));
    if (linked.length === 0) {
      const gap = gaps.find((g) => g.risk === r.id);
      rows.push({ risk: r, control: null, gap: gap || null });
    } else {
      linked.forEach((c) => rows.push({ risk: r, control: c, gap: null }));
    }
  });
  return rows;
}

/* --- Sign-off gates -------------------------------------------------------- */

export function gateStates() {
  const n = narrativeSummary();
  const rs = riskSummary();
  const cs = controlSummary();
  const oi = openItemSummary();
  const cov = coverageSummary();
  const map = {
    narrative:     { ok: n.pending === 0, detail: `${n.approved} approved · ${n.rejected} rejected · ${n.pending} awaiting a decision` },
    needsSource:   { ok: n.needsSource.length === 0, detail: n.needsSource.length ? `${n.needsSource.length} statement(s) cannot be supported` : "All statements carry a validated source" },
    contradiction: { ok: n.contradiction.length === 0, detail: n.contradiction.length ? `${n.contradiction.length} unresolved contradiction` : "No unresolved contradictions" },
    risks:         { ok: rs.pending === 0, detail: `${rs.decided} of ${rs.total} concluded` },
    controls:      { ok: cs.pending === 0, detail: `${cs.decided} of ${cs.total} concluded` },
    mandatory:     { ok: cov.mandatoryOpen.length === 0, detail: cov.mandatoryOpen.length ? `${cov.mandatoryOpen.map((i) => i.id).join(", ")} still open` : "All mandatory items addressed" },
    openItems:     { ok: oi.open === 0, detail: `${oi.open} open · ${oi.resolved} resolved` },
  };
  return signOffGates.map((g) => ({ ...g, ...map[g.id] }));
}

export const readyToSign = () => gateStates().every((g) => g.ok);

/* --- Actions ---------------------------------------------------------------
   Every action mutates S and asks for a re-render. Kept deliberately blunt.
   -------------------------------------------------------------------------- */

let renderFn = () => {};
export const onChange = (fn) => { renderFn = fn; };
export function commit(msg) {
  if (msg) { S.toast = msg; setTimeout(() => { if (S.toast === msg) { S.toast = null; renderFn(); } }, 2600); }
  renderFn();
}

export const act = {
  go(href) { location.hash = href; },

  pin(refId) { S.pinned = S.pinned === refId ? null : refId; commit(); },

  openDrawer(d) { S.drawer = d; commit(); },
  closeDrawer() { S.drawer = null; commit(); },

  toggleUnresolved() { S.unresolvedOnly = !S.unresolvedOnly; ensureVisibleSection(); commit(); },

  selectSection(id) { S.section = id; S.selBlock = null; S.pinned = null; S.scrollTo = id; commit(); },

  /** Selecting a block also moves the active section, so the navigator, the
   *  document and the source panel can never disagree about what is in view. */
  selectBlock(id, keepPin) {
    S.selBlock = id;
    const owner = narrative.find((sec) => sec.blocks.some((b) => b.id === id));
    if (owner) S.section = owner.id;
    if (!keepPin) S.pinned = null;
    commit();
  },

  approveSection(id) {
    S.sections[id] = "approved";
    if (S.unresolvedOnly) ensureVisibleSection();
    const idx = narrative.findIndex((s) => s.id === id);
    const next = narrative.slice(idx + 1).find((s) => !S.sections[s.id]);
    if (next) { S.section = next.id; S.scrollTo = next.id; }
    commit(`Section approved — ${narrative.find((s) => s.id === id).heading}`);
  },

  rejectSection(id) { S.sections[id] = "rejected"; commit("Section rejected and excluded from the working paper"); },
  unapproveSection(id) { delete S.sections[id]; commit(); },

  bulkApprove() {
    const ready = narrativeSummary().bulkReady;
    ready.forEach((s) => { S.sections[s.id] = "approved"; });
    S.drawer = null;
    ensureVisibleSection();
    commit(`${ready.length} sections approved`);
  },

  editBlock(id, text) {
    S.blocks[id] = { ...(S.blocks[id] || {}), text, edited: true };
    S.drawer = null;
    commit("Statement edited — the section can now be approved");
  },

  rejectBlock(id) {
    S.blocks[id] = { ...(S.blocks[id] || {}), rejected: true };
    S.drawer = null;
    commit("Statement rejected and removed from the working paper");
  },

  attachSource(id, refId) {
    S.blocks[id] = { ...(S.blocks[id] || {}), resolution: { kind: "attached", refId } };
    S.drawer = null;
    commit("Evidence attached — the statement is now supported");
  },

  resolveContradiction(blockId, choice, text) {
    S.blocks[blockId] = { ...(S.blocks[blockId] || {}), text, resolution: { kind: "contradiction", choice } };
    S.itemStates["OI-01"] = "resolved";
    S.drawer = null;
    commit("Contradiction resolved and recorded in the file");
  },

  decideRisk(id, decision) { S.riskDecisions[id] = decision; commit(`Risk ${id} — ${decision}`); },
  decideControl(id, decision) { S.controlDecisions[id] = decision; commit(`Control ${id} — ${decision === "key" ? "key control" : decision === "not_key" ? "not a key control" : "undecided"}`); },

  decideAllRisks() {
    risks.forEach((r) => { if (!S.riskDecisions[r.id] && !r.blocked) S.riskDecisions[r.id] = "accepted"; });
    commit("Remaining unblocked risks accepted as proposed");
  },

  setItemState(id, st) { S.itemStates[id] = st; S.drawer = null; commit(`Open item ${id} — ${st}`); },

  markNA(itemId, reason) {
    S.coverage[itemId] = { state: "na", naReason: reason };
    S.drawer = null;
    commit(`${itemId} marked not applicable — the reason is written into the documentation`);
  },

  recordAnswer(itemId, factKey, value) {
    const ov = S.coverage[itemId] || {};
    ov.facts = { ...(ov.facts || {}), [factKey]: { status: "known", value } };
    const item = allItems().find((i) => i.id === itemId);
    const merged = item.facts.map((f) => (ov.facts[f.key] ? { ...f, ...ov.facts[f.key] } : f));
    ov.state = merged.every((f) => f.status === "known") ? "covered" : "partial";
    S.coverage[itemId] = ov;
    S.drawer = null;
    commit(`Auditor response recorded against ${itemId}`);
  },

  toggleExpand(id) { S.expanded[id] = !S.expanded[id]; commit(); },

  setMode(m) { S.mode = m; commit(); },

  /* --- Generation ---------------------------------------------------------- */
  startGeneration(stages, done) {
    S.generating = true; S.genStage = 0; commit();
    const step = (i) => {
      if (i >= stages.length) {
        S.generating = false; S.generated = true; S.genStage = stages.length;
        commit(); done && done();
        return;
      }
      S.genStage = i; commit();
      setTimeout(() => step(i + 1), stages[i].ms);
    };
    step(0);
  },

  answerQuestion() { if (S.qIndex < 14) S.qIndex++; commit(); },

  cockpitAdvance() {
    S.cockpitTurn = Math.min(S.cockpitTurn + 1, 14);
    commit();
  },
  cockpitToggle() {
    S.cockpitPlaying = !S.cockpitPlaying;
    commit();
    const tick = () => {
      if (!S.cockpitPlaying) return;
      if (S.cockpitTurn >= 14) { S.cockpitPlaying = false; commit(); return; }
      S.cockpitTurn++; commit();
      setTimeout(tick, 2400);
    };
    if (S.cockpitPlaying) setTimeout(tick, 900);
  },

  reset() {
    Object.assign(S, initial(), { route: S.route });
    location.hash = "#/";
    commit("Prototype reset");
  },
};
