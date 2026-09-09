/* Step 4 — Controls and findings.

   Two recommendation queues over one process. Controls are what the process
   relies on; findings are what is wrong with it. Both are *proposed* by the
   platform and *concluded* by the auditor — and those two values are stored
   separately, so the file always shows what the platform said and what the
   auditor decided.

   Two corrections in this pass:
   · Undecided is not a conclusion. A control left undecided stays in the
     queue. Moving on despite uncertainty takes an explicit carry-forward
     with a documented reason.
   · A finding can be modified, not only confirmed or dismissed. */

import { esc, cx, act as btn, row, rows, dot, chip, tag, icon, more, evidence, empty,
         callout, state, dependencies, card } from "../ui.js";
import { controls, risks, gaps, subProcesses, analysisPipeline } from "../data-model.js";
import { processSteps } from "../data-process.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";
import { dwBar } from "./understanding.js";
import { processMap, mapLegend, mapDetail } from "./map.js";

const S = st.S;
const refsOf = (ids) => (ids || []).map(ref).filter(Boolean);

const NAT = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent manual" };
const FRQ = { per_transaction: "Per transaction", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", annual: "Annual", event_driven: "Event-driven" };

const CRIT = {
  addresses_rmm: "Addresses an assessed risk at assertion level",
  precision: "Precise enough to detect a material misstatement",
  evidence_of_operation: "Evidence exists that it operated",
  owner_competence_authority: "Owner has the authority to act on exceptions",
  it_dependencies_identified: "IT dependencies and information used are identified",
  not_redundant: "Not redundant with a stronger control",
};

export const SEV = {
  observation: "Observation",
  deficiency: "Deficiency",
  significant_deficiency_candidate: "Significant deficiency — candidate",
  material_weakness_candidate: "Material weakness — candidate",
};

/* ── Triage ──────────────────────────────────────────────────────────────── */

/* --- The analysis run ------------------------------------------------------
   Step 4 is its own piece of work. It reads the understanding the auditor has
   just reviewed and proposes what controls the process and what is wrong with
   it. Step 3 deliberately did none of this.
   -------------------------------------------------------------------------- */

function fill(t) {
  return t.replace("CONTROL_COUNT", controls.length)
    .replace("FINDING_COUNT", gaps.length + 1)
    .replace("GAP_COUNT", gaps.length)
    .replace("RISK_COUNT", risks.length)
    .replace("KEY_COUNT", controls.filter((c) => c.keyProposal === true).length)
    .replace("RCM_ROWS", 15);
}

function analysisView() {
  const running = S.analysing;
  const done = S.analysed && !S.anaSeen;
  const n = st.narrativeSummary();

  const body = `
    <div class="head">
      <h1 class="t-display">${done ? "Analysis ready" : running ? "Analysing controls and findings"
        : "Analyse controls and findings"}</h1>
      <p class="t-lede">
        ${analysisPipeline.length} stages against the understanding you approved. This is where
        controls, gaps and risk signals are identified — none of it happened in step 3, because none
        of it should be proposed from a draft nobody has read.
      </p>
    </div>

    ${!running && !done ? `
      ${rows(`
        ${row({ lead: icon("document", 17), title: "Process understanding",
          side: `<span class="b ink2">${n.approved} sections approved</span>` })}
        ${row({ lead: icon("map", 17), title: "Process steps to analyse",
          side: `<span class="b ink2">${processSteps.length} across 3 variants</span>` })}
        ${row({ lead: icon("control", 17), title: "Control library",
          side: `<span class="mono t-meta">33 entries · revenue v0.1.0</span>` })}
        ${row({ lead: icon("finding", 17), title: "Risk library",
          side: `<span class="mono t-meta">30 entries · revenue v0.1.0</span>` })}`)}
      <div class="acts sec">
        ${btn("Start the analysis", "run-analysis", { variant: "primary", size: "lg", key: "Enter", ic: "arrow" })}
      </div>
      <p class="t-meta sec__note measure">
        Everything it produces is a proposal. Nothing is concluded until you conclude it, one item
        at a time.</p>` : `
      <div class="sec">${rows(analysisPipeline.map((p, i) => {
        const fin = i < S.anaStage, now = i === S.anaStage && running;
        return `<div class="rw" style="opacity:${fin || now ? 1 : .38}">
          <span class="rw__lead">${fin ? `<span class="state state--ok">${icon("check", 17)}</span>`
            : now ? `<span class="dot dot--accent"></span>` : `<span class="t-meta">${i + 1}</span>`}</span>
          <span class="rw__main">
            <span class="rw__t">${esc(p.name)}</span>
            <span class="rw__d">${esc(p.desc)}</span>
            ${fin ? `<span class="rw__d ink2">${esc(fill(p.out))}</span>` : ""}
          </span>
          <span class="rw__side"><span class="mono t-meta">${esc(p.model)}</span></span>
        </div>`;
      }).join(""))}</div>
      ${done ? `
        <div class="sec">
          ${callout(`<b>${controls.length} controls and ${gaps.length + 1} findings proposed.</b>
            Every one cites the part of the understanding it came from, and every one is a proposal
            until you conclude it. ${controls.filter((c) => c.keyProposal === null).length} controls
            could not be assessed against the key-control criteria at all — those are questions, not
            low-confidence answers.`)}
          <div class="acts sec">
            ${btn("Review the proposals", "read-analysis", { variant: "primary", size: "lg", key: "Enter", ic: "arrow" })}
          </div>
        </div>` : ""}`}
  `;
  return screen("controls", body, { width: "narrow" });
}

function triage() {
  const cs = st.controlSummary();
  const fs = st.findingSummary();
  const rs = st.riskSummary();
  const undecided = cs.undecided;

  const findingItem = (f, i) => {
    const alert = f.severity !== "observation";
    return `<button class="${cx("aqi", alert ? "aqi--alert" : "aqi--warn")}"
        data-act="start-focus" data-kind="findings">
      <span class="aqi__top">
        <span class="aqi__n">${String(i + 1).padStart(2, "0")}</span>
        <span class="aqi__k">${icon(f.fromTrace ? "walkthrough" : "finding", 13)}${
          f.fromTrace ? "Raised by the walkthrough" : "Finding"}</span>
        <span class="aqi__ctx">${esc(SEV[f.severity] || f.severity)}</span>
      </span>
      <span class="aqi__t">${esc(f.title)}</span>
      <span class="aqi__why">${esc(f.impact)}</span>
      <span class="aqi__ft">
        <span class="blocks">${icon("link", 13)}<b>Blocks</b>
          <span class="blocks__i">Findings concluded</span></span>
        <span class="aqi__go">Review${icon("chevron", 14)}</span>
      </span>
    </button>`;
  };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Controls and findings</h1>
          <p class="t-lede">
            ${cs.total} controls and ${fs.total} findings, identified from the process understanding
            and attached to the steps they belong to.
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n" style="color:var(--ok)">${cs.agreedKey}</span>
            <span class="tally__l">key controls</span></div>
          <div><span class="tally__n" style="color:${cs.pending + fs.pending.length ? "var(--warn)" : "var(--ok)"}">${
            cs.pending + fs.pending.length}</span>
            <span class="tally__l">to conclude</span></div>
        </div>
      </div>
    </div>

    ${fs.fromTraceOpen.length ? `
      <section class="sec">
        ${callout(`<b>The line walkthrough changed the process understanding.</b>
          Tracing a real transaction raised ${fs.fromTraceOpen.length === 1 ? "a finding" : `${fs.fromTraceOpen.length} findings`}
          that nobody described in the interview. ${fs.fromTraceOpen.length === 1 ? "It has" : "They have"}
          not been concluded yet.
          <div class="acts sec__note">
            ${btn("Review it now", "start-focus", { variant: "primary", data: { kind: "findings" }, ic: "arrow" })}
          </div>`, "alert")}
      </section>` : ""}

    <section class="sec">
      <div class="sec__h">
        <h2 class="t-eyebrow">The process, annotated</h2>
        <span class="sp"></span>${mapLegend("annotated")}
      </div>
      ${processMap("annotated", { selected: S.mapStep })}
      ${S.mapStep ? mapDetail(S.mapStep) : `<p class="t-meta sec__note">
        Click a step to see what controls it and what is wrong with it.</p>`}
    </section>

    ${cs.pending ? `
      <section class="sec--loose">
        <div class="sec__h">
          <h2 class="t-h">${cs.pending} controls to conclude</h2>
          <span class="sp"></span>
          ${btn("Review recommendations", "start-focus", { variant: "primary", data: { kind: "controls" }, key: "⏎" })}
        </div>
        <p class="t-sub sec__h measure">
          ${cs.suggestedKey} suggested as key · ${cs.unassessable} where the criteria could not be
          established${undecided.length ? ` · ${undecided.length} left undecided` : ""}
        </p>
        ${undecided.length ? `${callout(`<b>Undecided is not a conclusion.</b>
          ${undecided.length === 1 ? "One control is" : `${undecided.length} controls are`} parked.
          Either conclude ${undecided.length === 1 ? "it" : "them"}, or carry
          ${undecided.length === 1 ? "it" : "them"} forward with a documented reason — which is a
          decision the reviewer can see.`, "warn")}
          <div class="sec__note">${rows(undecided.map((c) => row({
            lead: icon("control", 17),
            title: esc(c.title), detail: "Undecided — no conclusion recorded",
            side: btn("Carry forward", "carry-control-open", { size: "sm", data: { id: c.id } }),
          })).join(""))}</div>` : ""}
      </section>` : `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Controls concluded</h2></div>
        <p class="t-sub measure">${cs.agreedKey} of ${cs.total} recorded as key controls${
          cs.carriedForward ? ` · ${cs.carriedForward} carried forward undecided, with a reason` : ""}.</p>
        ${cs.carriedForward ? `<div class="sec__note">${rows(
          controls.filter((c) => st.controlDecision(c) === "carried_forward").map((c) => row({
            lead: icon("control", 17), title: esc(c.title),
            detail: esc(S.controlCarry[c.id] || "Carried forward undecided."),
            side: btn("Reopen", "clear-control", { size: "sm", variant: "ghost", data: { id: c.id } }),
          })).join(""))}</div>` : ""}
      </section>`}

    ${fs.pending.length ? `
      <section class="sec--loose">
        <div class="sec__h">
          <h2 class="t-h">${fs.pending.length} findings to conclude</h2>
          <span class="sp"></span>
          ${btn("Review findings", "start-focus", { variant: "primary", data: { kind: "findings" } })}
        </div>
        <p class="t-sub sec__h measure">
          Confirm, modify or dismiss each one. Severity is a professional judgement and stays yours.
          These feed the ISA 265 communication to management.</p>
        <div class="aq">${fs.pending.slice(0, 4).map(findingItem).join("")}</div>
      </section>` : `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Findings concluded</h2></div>
        <p class="t-sub measure">${fs.confirmed} confirmed for the management letter${
          fs.modified ? `, ${fs.modified} of them after you changed what the platform proposed` : ""}.</p>
      </section>`}

    ${fs.decided ? `<section class="sec--loose">
      ${more("fdec", `Show ${fs.decided} concluded ${fs.decided === 1 ? "finding" : "findings"}`,
        rows(fs.all.filter((f) => !st.findingOpen(f)).map((f) => {
          const o = st.findingOutcome(f);
          const changed = o.decision === "modified";
          return row({
            lead: icon(o.decision === "dismissed" ? "check" : "finding", 17),
            title: esc(o.title),
            detail: `${o.decision === "dismissed" ? "Dismissed by the auditor"
              : changed ? `Your conclusion · ${esc(SEV[o.severity] || o.severity)}`
              : `Confirmed as proposed · ${esc(SEV[o.severity] || o.severity)}`}${
              changed ? `<br><span class="ink4">Platform proposed: &ldquo;${esc(f.title)}&rdquo; · ${
                esc(SEV[f.severity] || f.severity)}</span>` : ""}`,
            side: btn("Reopen", "clear-finding", { size: "sm", variant: "ghost", data: { id: f.id } }),
          });
        }).join("")), S.disclosed.fdec)}
    </section>` : ""}

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">${rs.total} risk signals identified</h2></div>
      <p class="t-sub sec__h measure">
        ${rs.significant} carry a system-proposed significance flag · ${rs.fraud} touch fraud
        considerations · ${rs.newRisks} are outside the firm's library. <b>Nothing here is assessed
        or concluded.</b> These are inputs the process work produces; assessing risks of material
        misstatement is risk analysis, a separate phase that reads this output.
      </p>
      <div class="acts">
        ${btn("See what is carried forward", "nav", { data: { href: "#/matrix" }, ic: "arrow" })}
      </div>
    </section>
  `;

  return screen("controls", body, { width: "wide" });
}

/* ── Control decision ────────────────────────────────────────────────────── */

function controlFocus() {
  const q = st.controlSummary().queue;
  if (!q.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, q.length - 1);
  const c = q[ix];
  const refs = refsOf(c.refs);
  const linked = risks.filter((r) => c.risks.includes(r.id));
  const unmet = Object.entries(c.criteria).filter(([, v]) => v !== "met");
  const met = Object.entries(c.criteria).filter(([, v]) => v === "met");
  const step = processSteps.find((p) => p.controls.includes(c.id));
  const parked = st.controlDecision(c) === "undecided";
  const carrying = S.editing === `carry:${c.id}`;

  const body = `<div class="dw">
    ${dwBar(ix, q.length, "Controls")}
    <div class="dw__body"><div class="dw__in">
      <div class="dw__ctx">${icon("control", 15)}<span class="t-eyebrow">Control</span>
        ${step ? `<span>·</span>on the process at <b>${esc(step.name)}</b>` : ""}</div>
      <h1 class="dw__t">${esc(c.title)}</h1>
      <p class="dw__d">${esc(c.desc)}</p>

      <div class="dw__blk">
        <h4>${c.keyProposal === true ? "Why this may be a key control"
          : c.keyProposal === false ? "Why this is probably not a key control"
          : "Why this cannot be assessed"}</h4>
        <p>${esc(c.rationale)}</p>
      </div>

      <dl class="facts">
        <div class="fact"><dt>Owner</dt><dd>${esc(c.owner || "Not established")}</dd></div>
        <div class="fact"><dt>Type</dt><dd>${c.type === "preventive" ? "Preventive" : "Detective"} · ${esc(NAT[c.nature])} · ${esc(FRQ[c.frequency])}</dd></div>
        <div class="fact"><dt>Addresses</dt><dd>${linked.length ? linked.map((r) => esc(r.title)).join("; ") : "No identified risk signal linked"}</dd></div>
        <div class="fact"><dt>Evidence it operated</dt><dd>${c.evidenceOfOperation ? esc(c.evidenceOfOperation)
          : `<span class="state state--warn">${icon("evidence", 14)}Not established</span>`}</dd></div>
        ${c.ipe ? `<div class="fact"><dt>Information used</dt><dd>${esc(c.ipe)}${
          c.ipeNote ? `<div class="t-meta">${esc(c.ipeNote)}</div>` : ""}</dd></div>` : ""}
      </dl>

      ${more("csrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.csrc)}

      ${c.blocked ? `<div class="flag flag--alert"><b>Blocked.</b> ${esc(c.blocked)}</div>` : ""}
      ${!c.blocked && unmet.length ? `<div class="flag">
        <b>${met.length} of 6 criteria met.</b>
        ${unmet.map(([k]) => esc(CRIT[k].toLowerCase())).join("; ")}.
        ${c.followUp ? " " + esc(c.followUp) : ""}</div>` : ""}
      ${!c.blocked && !unmet.length ? `<div class="flag flag--ok">
        <b>All six criteria met.</b> Nothing about this control needs establishing before you
        conclude on it.</div>` : ""}
      ${parked && !carrying ? `<div class="flag">
        <b>Left undecided.</b> That is a bookmark, not a conclusion — this control is still counted
        as outstanding and still blocks the completion gate.</div>` : ""}

      ${more("crit", "Show the six criteria", `<div class="meth">
        ${Object.entries(c.criteria).map(([k, v]) => `<div class="row meth__row" style="padding:9px 0">
          <span style="flex:1" class="ink2">${esc(CRIT[k])}</span>
          ${v === "met" ? tag("met", "ok", "check") : v === "not_met" ? tag("not met", "alert")
            : tag("cannot establish", "warn")}
        </div>`).join("")}
        <p class="t-meta" style="margin-top:12px">A criterion that cannot be established produces a
        follow-up question, never a lower-confidence conclusion.</p>
      </div>`, S.disclosed.crit)}

      <div class="proposal">
        <span class="proposal__l">${icon("control", 14)}Proposed by the platform</span>
        <span class="proposal__v">${c.keyProposal === true ? "Key control"
          : c.keyProposal === false ? "Not a key control" : "Cannot be assessed"}</span>
      </div>

      ${carrying ? `
        <div class="dw__blk">
          <h4>Carry forward undecided — why</h4>
          <p class="t-meta measure">This reason goes on the file and is shown to the reviewer. It is
          what makes moving on without a conclusion defensible.</p>
          <textarea class="field" id="ans" rows="3" style="margin-top:12px"
            placeholder="e.g. The control owner is on leave until the final audit; whether this is a key control depends on the override report we have not received.">${
            esc(S.controlCarry[c.id] || "")}</textarea>
          <div class="acts sec__note">
            ${btn("Carry forward with this reason", "carry-control", { variant: "primary", data: { id: c.id } })}
            ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
          </div>
        </div>`
      : `<div class="dock"><div class="dock__in">
        ${btn(c.keyProposal === true ? "Accept — key control" : c.keyProposal === false ? "Accept — not key" : "Record as key control",
          "decide-control", { variant: "primary", key: "⏎",
          data: { id: c.id, d: c.keyProposal === false ? "not_key" : "key" } })}
        ${c.keyProposal !== true ? btn("Key control", "decide-control", { data: { id: c.id, d: "key" }, key: "K" }) : ""}
        ${c.keyProposal !== false ? btn("Not key", "decide-control", { data: { id: c.id, d: "not_key" }, key: "N" }) : ""}
        ${btn("Carry forward undecided", "carry-control-open", { data: { id: c.id }, key: "C" })}
        <span class="sp"></span>
        ${btn(parked ? "Next" : "Park for now", parked ? "focus-next" : "park-control",
          { variant: "ghost", data: { id: c.id }, key: "U" })}
      </div>
      <p class="dock__note">Parking keeps the control in this queue. Only <i>key</i>, <i>not key</i>
        and <i>carried forward with a reason</i> conclude it.</p></div>`}
    </div></div>
  </div>`;

  return screen("controls", body, { raw: true });
}

/* ── Finding decision ────────────────────────────────────────────────────── */

function findingFocus() {
  const q = st.findingSummary().queue;
  if (!q.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, q.length - 1);
  const f = q[ix];
  const refs = refsOf((f.refs || []).filter((r) => !r.startsWith("LW:")));
  const step = processSteps.find((p) => p.id === f.step);
  const risk = f.risk ? risks.find((r) => r.id === f.risk) : null;
  const editing = S.editingFinding === f.id;

  const form = `
    <div class="dw__blk">
      <h4>Your conclusion — edit anything the platform got wrong</h4>
      <p class="t-meta measure">The proposal above is kept as it was. What you write here is
      recorded as the auditor's conclusion, and it is this version that goes to management.</p>

      <div class="fgroup" style="margin-top:18px">
        <label class="t-eyebrow flabel" for="f-title">Finding</label>
        <input class="field" id="f-title" value="${esc(f.title)}">
      </div>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="f-detail">What was found</label>
        <textarea class="field" id="f-detail" rows="4">${esc(f.detail)}</textarea>
      </div>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="f-sev">Severity</label>
        <select class="field" id="f-sev">
          ${Object.entries(SEV).map(([k, v]) =>
            `<option value="${esc(k)}"${k === f.severity ? " selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
      </div>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="f-impact">Why it matters</label>
        <textarea class="field" id="f-impact" rows="3">${esc(f.impact)}</textarea>
      </div>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="f-rem">Suggested remediation</label>
        <textarea class="field" id="f-rem" rows="3">${esc(f.remediation || "")}</textarea>
      </div>

      <div class="acts sec">
        ${btn("Record as modified", "save-finding", { variant: "primary", data: { id: f.id } })}
        ${btn("Cancel", "cancel-finding-edit", { variant: "ghost" })}
      </div>
    </div>`;

  const body = `<div class="dw">
    ${dwBar(ix, q.length, "Findings")}
    <div class="dw__body"><div class="dw__in">
      <div class="dw__ctx">${icon(f.fromTrace ? "walkthrough" : "finding", 15)}
        <span class="t-eyebrow">${f.fromTrace ? "Raised by the line walkthrough" : "Finding"}</span>
        ${step ? `<span>·</span>at <b>${esc(step.name)}</b>` : ""}</div>
      <h1 class="dw__t">${esc(f.title)}</h1>
      <p class="dw__d">${esc(f.detail)}</p>

      <div class="dw__blk">
        <h4>Why it matters</h4>
        <p>${esc(f.impact)}</p>
      </div>

      ${f.remediation ? `<div class="dw__blk">
        <h4>Suggested remediation — for the management letter</h4>
        <p>${esc(f.remediation)}</p>
      </div>` : ""}

      ${risk ? `<dl class="facts">
        <div class="fact"><dt>Related risk signal</dt><dd>${esc(risk.title)}
          <div class="t-meta">Carried into risk analysis. Not assessed here.</div></dd></div>
      </dl>` : ""}

      ${refs.length ? more("fsrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.fsrc) : ""}

      ${f.fromTrace ? `<div class="flag flag--alert">
        <b>Found by tracing a real transaction.</b> This did not come from what anyone said in the
        interview — it came from comparing two dates on one order. Concluding on it here is what
        closes the loop between step five and step four.</div>` : ""}

      <div class="proposal">
        <span class="proposal__l">${icon("finding", 14)}Severity proposed by the platform</span>
        <span class="proposal__v">${esc(SEV[f.severity] || f.severity)}</span>
      </div>

      ${editing ? form : `<div class="dock"><div class="dock__in">
        ${btn("Confirm as proposed", "decide-finding", { variant: "primary", key: "⏎", data: { id: f.id, d: "confirmed" } })}
        ${btn("Modify", "edit-finding", { key: "M", data: { id: f.id } })}
        ${btn("Dismiss", "decide-finding", { key: "D", data: { id: f.id, d: "dismissed" } })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "ghost", key: "J" })}
      </div>
      <p class="dock__note">ISA 265 requires deficiencies to be communicated. Whether this one is
        significant is a conclusion you record — the platform proposes a severity and stops there.</p>
      </div>`}
    </div></div>
  </div>`;

  return screen("controls", body, { raw: true });
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function controlsStep() {
  if (!S.generated) {
    return screen("controls", `
      ${empty("The process is not documented yet",
        "Controls are analysed from the process understanding, so step 3 has to run first.", "document")}
      <div class="acts" style="justify-content:center">
        ${btn("Go to the process understanding", "nav", { variant: "primary", ic: "arrow", data: { href: "#/understanding" } })}
      </div>`, { width: "narrow" });
  }
  const n = st.narrativeSummary();
  if (n.pending) {
    return screen("controls", `
      ${empty(`${n.pending} sections of the understanding are still unreviewed`,
        "Step 4 analyses the understanding you have accepted. Proposing controls from a draft nobody has read would put the analysis ahead of the judgement it depends on.", "document")}
      <div class="acts" style="justify-content:center">
        ${btn("Finish reviewing the understanding", "nav", { variant: "primary", ic: "arrow", data: { href: "#/understanding" } })}
      </div>`, { width: "narrow" });
  }
  if (!S.analysed || !S.anaSeen) return analysisView();
  if (S.reviewMode === "focus" && S.focusKind === "controls") return controlFocus();
  if (S.reviewMode === "focus" && S.focusKind === "findings") return findingFocus();
  return triage();
}
