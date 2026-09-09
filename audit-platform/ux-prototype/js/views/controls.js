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

import { esc, cx, act as btn, row, dot, chip, more, evidence, empty, callout, state } from "../ui.js";
import { controls, risks, subProcesses } from "../data-model.js";
import { processSteps } from "../data-process.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";
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

const focusBar = (i, len, label) => `<div class="focus__bar">
  <button class="b-act b-act--plain b-act--sm" data-act="exit-focus">← Back</button>
  <span class="sp"></span><span>${esc(label)}</span><span class="idline__sep">·</span>
  <span><b style="color:var(--ink-2)">${i + 1}</b> of ${len}</span>
</div>`;

/* ── Triage ──────────────────────────────────────────────────────────────── */

function triage() {
  const cs = st.controlSummary();
  const fs = st.findingSummary();
  const rs = st.riskSummary();
  const undecided = cs.undecided;

  const body = `
    <div class="head">
      <h1 class="t-title">Controls and findings</h1>
      <p class="t-lede" style="margin-top:10px">
        ${cs.total} controls and ${fs.total} findings, identified from the process understanding
        and attached to the steps they belong to.
      </p>
    </div>

    <section style="margin-top:28px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">The process, annotated</h2>
        <span class="sp"></span>${mapLegend("annotated")}
      </div>
      ${processMap("annotated", { selected: S.mapStep })}
      ${S.mapStep ? mapDetail(S.mapStep) : `<p class="t-meta" style="margin-top:12px">
        Click a step to see what controls it and what is wrong with it.</p>`}
    </section>

    ${fs.fromTraceOpen.length ? `
      <section class="triage__group" style="margin-top:36px">
        <div class="callout callout--alert">
          <b>The line walkthrough changed the process understanding.</b>
          Tracing a real transaction raised ${fs.fromTraceOpen.length === 1 ? "a finding" : `${fs.fromTraceOpen.length} findings`}
          that nobody described in the interview. ${fs.fromTraceOpen.length === 1 ? "It has" : "They have"}
          not been concluded yet.
          <div class="acts" style="margin-top:12px">
            ${btn("Review it now", "start-focus", { variant: "go", data: { kind: "findings" } })}
          </div>
        </div>
      </section>` : ""}

    ${cs.pending ? `
      <section class="triage__group" style="margin-top:36px">
        <div class="triage__n"><span class="c">${cs.pending}</span> controls to conclude</div>
        <p class="t-sub" style="margin-bottom:18px">
          ${cs.suggestedKey} suggested as key · ${cs.unassessable} where the criteria could not be
          established${undecided.length ? ` · <b>${undecided.length} left undecided</b>` : ""}
        </p>
        ${undecided.length ? `<div class="callout" style="margin-bottom:18px">
          <b>Undecided is not a conclusion.</b> ${undecided.length === 1 ? "One control is" : `${undecided.length} controls are`}
          parked. Either conclude ${undecided.length === 1 ? "it" : "them"}, or carry
          ${undecided.length === 1 ? "it" : "them"} forward with a documented reason — which is a
          decision the reviewer can see.
          <div class="rows" style="margin-top:14px">
            ${undecided.map((c) => row({
              lead: dot("open"),
              title: esc(c.title),
              detail: "Undecided — no conclusion recorded",
              side: btn("Carry forward", "carry-control-open", { size: "sm", data: { id: c.id } }),
            })).join("")}
          </div>
        </div>` : ""}
        <div class="acts">
          ${btn("Review recommendations", "start-focus", { variant: "go", data: { kind: "controls" }, key: "Enter" })}
        </div>
      </section>` : `
      <section class="triage__group" style="margin-top:36px">
        <div class="triage__n">Controls concluded</div>
        <p class="t-sub">${cs.agreedKey} of ${cs.total} recorded as key controls${
          cs.carriedForward ? ` · ${cs.carriedForward} carried forward undecided, with a reason` : ""}.</p>
        ${cs.carriedForward ? `<div class="rows" style="margin-top:14px">
          ${controls.filter((c) => st.controlDecision(c) === "carried_forward").map((c) => row({
            lead: dot("open"), title: esc(c.title),
            detail: esc(S.controlCarry[c.id] || "Carried forward undecided."),
            side: btn("Reopen", "clear-control", { size: "sm", variant: "plain", data: { id: c.id } }),
          })).join("")}
        </div>` : ""}
      </section>`}

    ${fs.pending.length ? `
      <section class="triage__group">
        <div class="triage__n"><span class="c">${fs.pending.length}</span> findings to conclude</div>
        <p class="t-sub" style="margin-bottom:16px">
          Confirm, modify or dismiss each one. Severity is a professional judgement and stays yours.
          These feed the ISA 265 communication to management.
        </p>
        <div class="rows" style="margin-bottom:18px">
          ${fs.pending.slice(0, 4).map((f) => row({
            lead: dot(f.severity === "observation" ? "warn" : "alert"),
            title: esc(f.title),
            detail: `${esc(SEV[f.severity] || f.severity)}${f.fromTrace ? " · raised by the line walkthrough" : ""}`,
            side: `<span class="t-meta mono">${esc(f.id)}</span>`,
          })).join("")}
        </div>
        <div class="acts">
          ${btn("Review findings", "start-focus", { variant: "go", data: { kind: "findings" } })}
        </div>
      </section>` : `
      <section class="triage__group">
        <div class="triage__n">Findings concluded</div>
        <p class="t-sub">${fs.confirmed} confirmed for the management letter${
          fs.modified ? `, ${fs.modified} of them after you changed what the platform proposed` : ""}.</p>
      </section>`}

    ${fs.decided ? `<section class="triage__group">
      ${more("fdec", `Show ${fs.decided} concluded ${fs.decided === 1 ? "finding" : "findings"}`, `<div class="rows">
        ${fs.all.filter((f) => !st.findingOpen(f)).map((f) => {
          const o = st.findingOutcome(f);
          return row({
            lead: dot(o.decision === "dismissed" ? "" : o.severity === "observation" ? "warn" : "alert"),
            title: esc(o.title),
            detail: o.decision === "dismissed" ? "Dismissed by the auditor"
              : o.decision === "modified" ? `Confirmed as modified · ${esc(SEV[o.severity] || o.severity)}`
              : `Confirmed as proposed · ${esc(SEV[o.severity] || o.severity)}`,
            side: btn("Reopen", "clear-finding", { size: "sm", variant: "plain", data: { id: f.id } }),
          });
        }).join("")}
      </div>`, S.disclosed.fdec)}
    </section>` : ""}

    <section class="triage__group">
      <div class="triage__n">${rs.total} risk signals identified</div>
      <p class="t-sub" style="margin-bottom:14px">
        ${rs.significant} carry a system-proposed significance flag · ${rs.fraud} touch fraud
        considerations · ${rs.newRisks} are outside the firm's library. <b>Nothing here is
        assessed or concluded.</b> These are inputs the process work produces; assessing risks of
        material misstatement is risk analysis, a separate phase that reads this output — it is not
        part of this product.
      </p>
      <div class="acts">
        ${btn("See what is carried forward", "nav", { variant: "plain", data: { href: "#/matrix" } })}
      </div>
    </section>
  `;

  return screen("controls", body, { width: "wide" });
}

/* ── Control focus ───────────────────────────────────────────────────────── */

function controlFocus() {
  const q = st.controlSummary().queue;
  if (!q.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, q.length - 1);
  const c = q[ix];
  const refs = refsOf(c.refs);
  const linked = risks.filter((r) => c.risks.includes(r.id));
  const unmet = Object.entries(c.criteria).filter(([, v]) => v !== "met");
  const step = processSteps.find((p) => p.controls.includes(c.id));
  const parked = st.controlDecision(c) === "undecided";
  const carrying = S.editing === `carry:${c.id}`;

  const body = `<div class="focus">
    ${focusBar(ix, q.length, "Controls")}
    <div class="focus__body"><div class="q">
      ${step ? `<div class="t-meta" style="margin-bottom:8px">On the process at
        <b style="color:var(--ink-2)">${esc(step.name)}</b></div>` : ""}
      <h1 class="q__t">${esc(c.title)}</h1>
      <p class="q__d">${esc(c.desc)}</p>

      <div class="q__block">
        <h4>${c.keyProposal === true ? "Why this may be a key control"
          : c.keyProposal === false ? "Why this is probably not a key control"
          : "Why this cannot be assessed"}</h4>
        <p>${esc(c.rationale)}</p>
      </div>

      <dl class="q__facts">
        <div class="q__fact"><dt>Owner</dt><dd>${esc(c.owner || "Not established")}</dd></div>
        <div class="q__fact"><dt>Type</dt><dd>${c.type === "preventive" ? "Preventive" : "Detective"} · ${esc(NAT[c.nature])} · ${esc(FRQ[c.frequency])}</dd></div>
        <div class="q__fact"><dt>Addresses</dt><dd>${linked.length ? linked.map((r) => esc(r.title)).join("; ") : "No identified risk linked"}</dd></div>
        <div class="q__fact"><dt>Evidence it operated</dt><dd>${c.evidenceOfOperation ? esc(c.evidenceOfOperation)
          : `<span style="color:var(--warn)">Not established</span>`}</dd></div>
        ${c.ipe ? `<div class="q__fact"><dt>Information used</dt><dd>${esc(c.ipe)}${
          c.ipeNote ? `<div class="t-meta" style="margin-top:3px">${esc(c.ipeNote)}</div>` : ""}</dd></div>` : ""}
      </dl>

      ${more("csrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.csrc)}

      ${c.blocked ? `<div class="q__flag q__flag--alert"><b>Blocked.</b> ${esc(c.blocked)}</div>` : ""}
      ${!c.blocked && unmet.length ? `<div class="q__flag">
        <b>${unmet.length === 1 ? "One criterion is not met" : `${unmet.length} criteria are not met`}.</b>
        ${unmet.map(([k]) => esc(CRIT[k].toLowerCase())).join("; ")}.
        ${c.followUp ? " " + esc(c.followUp) : ""}</div>` : ""}
      ${parked && !carrying ? `<div class="q__flag">
        <b>Left undecided.</b> That is a bookmark, not a conclusion — this control is still counted
        as outstanding and still blocks the completion gate.</div>` : ""}

      ${more("crit", "Show the six criteria", `<div class="meth">
        ${Object.entries(c.criteria).map(([k, v]) => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="flex:1;color:var(--ink-2)">${esc(CRIT[k])}</span>
          ${v === "met" ? state("approved", "Met") : v === "not_met" ? state("rejected", "Not met") : state("needs_source", "Unknown")}
        </div>`).join("")}
        <p class="t-meta" style="margin-top:12px">A criterion that cannot be established produces a
        follow-up question, never a lower-confidence conclusion.</p>
      </div>`, S.disclosed.crit)}

      <div class="q__sug">
        <span class="l">Proposed by the platform</span>
        <span class="v">${c.keyProposal === true ? "Key control"
          : c.keyProposal === false ? "Not a key control" : "Cannot be assessed"}</span>
      </div>

      ${carrying ? `
        <div class="q__block" style="margin-top:18px">
          <h4>Carry forward undecided — why</h4>
          <p class="t-meta" style="margin-bottom:10px">This reason goes on the file and is shown to
          the reviewer. It is what makes moving on without a conclusion defensible.</p>
          <textarea class="field" id="ans" rows="3" placeholder="e.g. The control owner is on leave until the final audit; whether this is a key control depends on the override report we have not received.">${
            esc(S.controlCarry[c.id] || "")}</textarea>
          <div class="acts" style="margin-top:12px">
            ${btn("Carry forward with this reason", "carry-control", { variant: "go", data: { id: c.id } })}
            ${btn("Cancel", "cancel-edit", { variant: "plain" })}
          </div>
        </div>`
      : `<div class="q__acts">
        ${btn(c.keyProposal === true ? "Accept — key control" : c.keyProposal === false ? "Accept — not key" : "Record as key control",
          "decide-control", { variant: "go", key: "Enter",
          data: { id: c.id, d: c.keyProposal === true ? "key" : c.keyProposal === false ? "not_key" : "key" } })}
        ${c.keyProposal !== true ? btn("Key control", "decide-control", { data: { id: c.id, d: "key" }, key: "K" }) : ""}
        ${c.keyProposal !== false ? btn("Not key", "decide-control", { data: { id: c.id, d: "not_key" }, key: "N" }) : ""}
        ${btn("Carry forward undecided", "carry-control-open", { data: { id: c.id }, key: "C" })}
        <span class="sp"></span>
        ${btn(parked ? "Next" : "Park for now", parked ? "focus-next" : "park-control",
          { variant: "plain", data: { id: c.id }, key: "U" })}
      </div>
      <p class="t-meta" style="margin-top:14px;max-width:60ch">
        Parking keeps the control in this queue. Only <i>key</i>, <i>not key</i> and
        <i>carried forward with a reason</i> conclude it.</p>`}
    </div></div>
  </div>`;

  return screen("controls", body, { raw: true });
}

/* ── Finding focus ───────────────────────────────────────────────────────── */

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
    <div class="q__block" style="margin-top:18px">
      <h4>Your conclusion — edit anything the platform got wrong</h4>
      <p class="t-meta" style="margin-bottom:12px">The proposal above is kept as it was. What you
      write here is recorded as the auditor's conclusion, and it is this version that goes to
      management.</p>

      <label class="t-eyebrow" for="f-title">Finding</label>
      <input class="field" id="f-title" value="${esc(f.title)}" style="margin:6px 0 14px">

      <label class="t-eyebrow" for="f-sev">Severity</label>
      <select class="field" id="f-sev" style="margin:6px 0 14px">
        ${Object.entries(SEV).map(([k, v]) =>
          `<option value="${esc(k)}"${k === f.severity ? " selected" : ""}>${esc(v)}</option>`).join("")}
      </select>

      <label class="t-eyebrow" for="f-impact">Why it matters</label>
      <textarea class="field" id="f-impact" rows="3" style="margin:6px 0 14px">${esc(f.impact)}</textarea>

      <label class="t-eyebrow" for="f-rem">Suggested remediation</label>
      <textarea class="field" id="f-rem" rows="3" style="margin:6px 0 0">${esc(f.remediation || "")}</textarea>

      <div class="acts" style="margin-top:14px">
        ${btn("Record as modified", "save-finding", { variant: "go", data: { id: f.id } })}
        ${btn("Cancel", "cancel-finding-edit", { variant: "plain" })}
      </div>
    </div>`;

  const body = `<div class="focus">
    ${focusBar(ix, q.length, "Findings")}
    <div class="focus__body"><div class="q">
      ${step ? `<div class="t-meta" style="margin-bottom:8px">On the process at
        <b style="color:var(--ink-2)">${esc(step.name)}</b>${f.fromTrace ? " · raised by the line walkthrough" : ""}</div>` : ""}
      <h1 class="q__t">${esc(f.title)}</h1>
      <p class="q__d">${esc(f.detail)}</p>

      <div class="q__block">
        <h4>Why it matters</h4>
        <p>${esc(f.impact)}</p>
      </div>

      ${f.remediation ? `<div class="q__block">
        <h4>Suggested remediation — for the management letter</h4>
        <p>${esc(f.remediation)}</p>
      </div>` : ""}

      ${risk ? `<dl class="q__facts">
        <div class="q__fact"><dt>Related risk signal</dt><dd>${esc(risk.title)}<div class="t-meta"
          style="margin-top:3px">Carried into risk analysis. Not assessed here.</div></dd></div>
      </dl>` : ""}

      ${refs.length ? more("fsrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.fsrc) : ""}

      ${f.fromTrace ? `<div class="q__flag q__flag--alert">
        <b>Found by tracing a real transaction.</b> This did not come from what anyone said in the
        interview — it came from comparing two dates on one order. Concluding on it here is what
        closes the loop between step five and step four.</div>` : ""}

      <div class="q__sug">
        <span class="l">Severity proposed by the platform</span>
        <span class="v">${esc(SEV[f.severity] || f.severity)}</span>
      </div>

      ${editing ? form : `<div class="q__acts">
        ${btn("Confirm as proposed", "decide-finding", { variant: "go", key: "Enter", data: { id: f.id, d: "confirmed" } })}
        ${btn("Modify", "edit-finding", { key: "M", data: { id: f.id } })}
        ${btn("Dismiss", "decide-finding", { key: "D", data: { id: f.id, d: "dismissed" } })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "plain", key: "J" })}
      </div>
      <p class="t-meta" style="margin-top:14px;max-width:60ch">
        ISA 265 requires deficiencies to be communicated. Whether this one is significant is a
        conclusion you record — the platform proposes a severity and stops there.</p>`}
    </div></div>
  </div>`;

  return screen("controls", body, { raw: true });
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function controlsStep() {
  if (!S.generated) {
    return screen("controls", `
      ${empty("No controls identified yet",
        "Controls are identified from the process understanding, so the process has to be documented first.")}
      <div style="text-align:center;margin-top:-40px">
        ${btn("Go to the process understanding", "nav", { variant: "go", data: { href: "#/understanding" } })}
      </div>`);
  }
  if (S.reviewMode === "focus" && S.focusKind === "controls") return controlFocus();
  if (S.reviewMode === "focus" && S.focusKind === "findings") return findingFocus();
  return triage();
}
