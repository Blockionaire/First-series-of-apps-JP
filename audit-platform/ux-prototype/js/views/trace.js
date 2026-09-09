/* Step 5 — Line walkthrough.

   Testing the process model against a real transaction. Three things changed
   in this pass:

   · A walkthrough is required *per applicable variant*, and whether a variant
     needs one is a decision with a reason, not an assumption.
   · Selecting a transaction genuinely loads that transaction — its own path,
     its own evidence, its own verdicts.
   · A step that was not traced says why: not on this variant's path, or it has
     not happened yet. Neither is a corroboration, and neither is silently
     dropped. */

import { esc, cx, act as btn, row, dot, more, empty, callout, evidence } from "../ui.js";
import { transactions, txnById, variants, traceFindings, processSteps } from "../data-process.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";
import { processMap, mapLegend, mapDetail } from "./map.js";

const S = st.S;
const vName = (id) => variants.find((v) => v.id === id)?.name || id;

/* --- Which variants need a walkthrough, and which transaction ------------- */

function overview() {
  const tr = st.traceSummary();

  const variantCard = (vw) => {
    const v = vw.variant;
    const req = vw.requirement;
    const editing = S.editing === `lw:${v.id}`;
    const candidates = transactions.filter((t) => t.variant === v.id);
    const suggested = st.lwProposal(v.id);

    return `<section class="vcard">
      <div class="row" style="align-items:baseline;gap:12px">
        <h3 class="t-h">${esc(v.name)}</h3>
        <span class="t-meta">${esc(v.value)} · ${esc(v.recognition)}</span>
        <span class="sp"></span>
        <span class="t-meta">${
          vw.state === "not_required" ? "no walkthrough required"
          : vw.state === "completed" ? "walkthrough complete"
          : vw.state === "in_progress" ? `${vw.progress.done} of ${vw.progress.expected} steps traced`
          : vw.state === "not_started" ? "not started"
          : "no decision recorded"}</span>
      </div>
      <p class="t-sub" style="margin-top:6px;max-width:74ch">${esc(v.what)}</p>

      ${req.state === "not_decided" && !editing ? `
        <div class="callout" style="margin-top:16px">
          <b>Does this variant need a line walkthrough?</b>
          ${suggested ? ` The methodology pack proposes <b>${
            suggested.state === "required" ? "yes" : "no"}</b>${
            suggested.state === "not_required" ? ` — ${esc(suggested.reason)}` : ""}. ` : " "}
          It is your decision and it is recorded either way.
          <div class="acts" style="margin-top:12px">
            ${btn("A walkthrough is required", "lw-require", { variant: "go", data: { v: v.id } })}
            ${btn("Not required — record why", "lw-not-open", { data: { v: v.id } })}
          </div>
        </div>` : ""}

      ${editing ? `<div class="callout" style="margin-top:16px">
        <b>Why does this variant not need a line walkthrough?</b>
        <p class="t-meta" style="margin:6px 0 10px">The reason is what the reviewer reads. "Immaterial"
        on its own is not one.</p>
        <textarea class="field" id="ans" rows="3">${esc(suggested?.state === "not_required" ? suggested.reason : "")}</textarea>
        <div class="acts" style="margin-top:12px">
          ${btn("Record as not required", "lw-not-required", { variant: "go", data: { v: v.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "plain" })}
        </div>
      </div>` : ""}

      ${req.state === "not_required" ? `<div class="callout" style="margin-top:16px">
        <b>No line walkthrough required.</b> ${esc(req.reason || "No reason recorded.")}
        <div class="acts" style="margin-top:12px">
          ${btn("Change this decision", "lw-reopen", { variant: "plain", size: "sm", data: { v: v.id } })}
        </div>
      </div>` : ""}

      ${req.state === "required" ? (
        vw.txn ? `<div class="rows" style="margin-top:16px">
          ${row({
            lead: dot(vw.progress.exceptions ? "alert" : vw.progress.concluded ? "ok" : "open"),
            title: `<span class="b">${esc(vw.txn.id)}</span> — ${esc(vw.txn.customer)}`,
            detail: vw.progress.concluded
              ? `Concluded · ${vw.progress.corroborated} corroborated, ${vw.progress.exceptions} exception${vw.progress.exceptions === 1 ? "" : "s"}`
              : `${vw.progress.done} of ${vw.progress.expected} steps traced`,
            side: btn(vw.progress.concluded ? "Open" : "Continue", "open-trace",
              { size: "sm", variant: vw.progress.concluded ? "" : "go", data: { id: vw.txn.id } }),
          })}
        </div>`
        : candidates.length ? `<div style="margin-top:16px">
          <div class="t-eyebrow" style="margin-bottom:10px">Choose a transaction</div>
          <div class="rows">
            ${candidates.map((t) => `
              <button class="rw ${t.recommended ? "rw--attn" : ""}" data-act="pick-txn" data-id="${esc(t.id)}">
                <span class="rw__lead">${dot(t.recommended ? "warn" : "open")}</span>
                <span class="rw__main">
                  <span class="rw__t"><span class="b">${esc(t.id)}</span> — ${esc(t.customer)}</span>
                  <span class="rw__d">${esc(t.what)} · ${esc(t.value)}</span>
                  <span class="rw__d" style="margin-top:6px">${t.recommended ? "<b>Suggested.</b> " : ""}${esc(t.why)}</span>
                </span>
                <span class="rw__side">${t.recommended ? `<span class="t-meta" style="color:var(--warn)">suggested</span>` : ""}</span>
              </button>`).join("")}
          </div>
          <p class="t-meta" style="margin-top:10px">
            Suggested from the period's transactions for this variant. The selection is yours and the
            reason is recorded.</p>
        </div>`
        : `<p class="t-sub" style="margin-top:16px;color:var(--warn)">
            No candidate transactions have been loaded for this variant in the prototype.</p>`
      ) : ""}
    </section>`;
  };

  const body = `
    <div class="head">
      <h1 class="t-title">Line walkthrough</h1>
      <p class="t-lede" style="margin-top:10px">
        Trace one real transaction end to end through the process we documented. Everything up to
        here is what people said; this is the first point at which the file tests it.
      </p>
    </div>

    <section style="margin-top:28px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">The process it will be traced against</h2>
        <span class="sp"></span>${mapLegend("annotated")}
      </div>
      ${processMap("annotated", { compact: true, onSelect: "noop" })}
      <p class="t-meta" style="margin-top:10px">
        Revenue runs three different paths. A walkthrough of a machine sale says nothing about how a
        spare-part order or a service contract behaves, so the requirement is decided per variant.</p>
    </section>

    <section style="margin-top:40px">
      <div class="row" style="margin-bottom:6px">
        <h2 class="t-h">Which variants need a walkthrough</h2>
        <span class="sp"></span>
        <span class="t-meta">${tr.completed} of ${tr.required} required complete${
          tr.undecided ? ` · ${tr.undecided} undecided` : ""}</span>
      </div>
      ${tr.variants.map(variantCard).join("")}
    </section>

    ${tr.satisfied ? `<section style="margin-top:36px;border-top:1px solid var(--line);padding-top:26px">
      ${callout(`<b>Every variant is dealt with.</b> ${tr.completed} walkthrough${tr.completed === 1 ? "" : "s"}
        completed and ${tr.variants.length - tr.required} variant${tr.variants.length - tr.required === 1 ? "" : "s"}
        documented as not requiring one.`, "ok")}
      <div class="acts" style="margin-top:16px">
        ${btn("Go to control testing", "nav", { variant: "go", data: { href: "#/testing" } })}
      </div>
    </section>` : ""}
  `;
  return screen("trace", body, { width: "wide" });
}

/* --- One step of the trace ------------------------------------------------- */

function stepFocus() {
  const txnId = S.traceTxn;
  const prog = st.traceProgress(txnId);
  if (!prog || !prog.pending.length) return txnSummary();

  const txn = prog.txn;
  const ix = Math.min(S.focusIx, prog.pending.length - 1);
  const t = prog.pending[ix];
  const p = processSteps.find((x) => x.id === t.step);
  const n = txn.steps.indexOf(t) + 1;
  const isEx = t.suggested === "exception";

  const body = `
    <div class="tracehead">
      <div class="row" style="margin-bottom:10px">
        <span class="t-meta"><b style="color:var(--ink-2)">${esc(txn.id)}</b>
          · ${esc(txn.customer)} · ${esc(txn.value)} · ${esc(vName(txn.variant))}</span>
        <span class="sp"></span>
        <span class="t-meta">${prog.done} of ${prog.expected} traced</span>
        ${btn("Leave", "exit-focus", { variant: "plain", size: "sm" })}
      </div>
      ${processMap("trace", { selected: t.step, onSelect: "noop", variant: txn.variant, txn: txn.id })}
    </div>

    <div class="focus__body"><div class="q">
      <div class="t-meta" style="margin-bottom:6px">Step ${n} of ${txn.steps.length} on this transaction</div>
      <h1 class="q__t">${esc(p ? p.name : t.step)}</h1>
      <p class="t-meta" style="margin-top:6px">${esc(p ? p.actor + " · " + p.system : "")}</p>

      <div class="expect">
        <div class="expect__r"><dt>Expected step</dt><dd>${esc(t.expectedStep)}</dd></div>
        <div class="expect__r"><dt>Expected control</dt><dd>${esc(t.expectedControl)}</dd></div>
        <div class="expect__r"><dt>Expected evidence</dt><dd>${esc(t.expectedEvidence)}</dd></div>
      </div>

      <div class="actual">
        <div class="t-eyebrow" style="margin-bottom:8px">Evidence obtained</div>
        <p class="actual__e">${esc(t.actualEvidence)}</p>
        <div class="t-eyebrow" style="margin:20px 0 8px">Observation</div>
        <p class="actual__o">${esc(t.observation)}</p>
      </div>

      ${isEx ? `<div class="q__flag q__flag--alert" style="margin-top:22px">
        <b>Possible exception.</b> ${esc(t.exception)}
        <div class="t-meta" style="margin-top:8px;color:inherit;opacity:.8">Found by ${esc(t.why)}</div>
      </div>` : ""}

      ${t.note === "not_triggered" ? `<div class="q__flag" style="margin-top:22px">
        <b>The control did not operate on this transaction.</b> Nothing was blocked, so this trace
        gives no evidence about whether the control works. That is a corroborated step, not a tested control.
      </div>` : ""}

      <div class="q__sug">
        <span class="l">Proposed by the platform</span>
        <span class="v">${isEx ? "Exception" : "Corroborated"}</span>
      </div>
      <div class="q__acts">
        ${btn(isEx ? "Record the exception" : "Corroborated", "decide-trace",
          { variant: isEx ? "go" : "ok", key: "Enter", data: { txn: txn.id, id: t.id, v: isEx ? "exception" : "corroborated" } })}
        ${btn(isEx ? "No exception" : "Raise an exception", "decide-trace",
          { key: isEx ? "C" : "X", data: { txn: txn.id, id: t.id, v: isEx ? "corroborated" : "exception" } })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "plain", key: "J" })}
      </div>
    </div></div>
  `;

  return screen("trace", `<div class="focus">${body}</div>`, { raw: true });
}

/* --- The result for one transaction ---------------------------------------- */

function txnSummary() {
  const txnId = S.traceTxn;
  const prog = st.traceProgress(txnId);
  if (!prog) return overview();
  const txn = prog.txn;
  const exSteps = txn.steps.filter((t) => st.traceVerdict(txnId, t) === "exception");
  const finding = traceFindings[txnId];
  const notYet = (txn.untraced || []).filter((u) => u.kind === "not_yet");
  const openFinding = finding && st.findingSummary().fromTraceOpen.some((f) => f.id === finding.id);

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <button class="b-link" data-act="back-to-variants">← All variants</button>
          <h1 class="t-title" style="margin-top:8px">${prog.concluded ? "Line walkthrough complete"
            : prog.pending.length ? "Line walkthrough in progress" : "Every step traced"}</h1>
          <p class="t-lede" style="margin-top:10px">
            ${esc(txn.id)} — ${esc(txn.customer)}, ${esc(txn.what)}, ${esc(txn.value)}.
            <span class="t-meta">${esc(vName(txn.variant))}</span>
          </p>
        </div>
      </div>
    </div>

    <div class="tally">
      <div><span class="tally__n">${prog.expected}</span><span class="tally__l">steps on this path</span></div>
      <div><span class="tally__n" style="color:var(--ok)">${prog.corroborated}</span><span class="tally__l">corroborated</span></div>
      <div><span class="tally__n" style="color:${prog.exceptions ? "var(--alert)" : "var(--ink-4)"}">${prog.exceptions}</span>
        <span class="tally__l">exception${prog.exceptions === 1 ? "" : "s"}</span></div>
    </div>

    <section style="margin-top:36px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">Against the process map</h2>
        <span class="sp"></span>${mapLegend("trace")}
      </div>
      ${processMap("trace", { selected: S.mapStep, txn: txn.id })}
      ${S.mapStep ? mapDetail(S.mapStep, { txn: txn.id }) : ""}
      <p class="t-meta" style="margin-top:10px">
        The faded steps are not on this transaction's path. Steps outside the variant and steps that
        have not happened yet are two different things, and both are stated below.</p>
    </section>

    ${exSteps.length ? `
      <section style="margin-top:40px">
        <h2 class="t-h" style="margin-bottom:14px">Exception</h2>
        ${exSteps.map((t) => `<div class="rw rw--conflict" style="display:block">
          <div class="rw__t"><span class="b">${esc(processSteps.find((p) => p.id === t.step)?.name || t.step)}</span></div>
          <div class="rw__d" style="margin-top:6px;max-width:74ch">${esc(t.exception)}</div>
          <div class="rw__d" style="margin-top:8px">${esc(t.actualEvidence)}</div>
        </div>`).join("")}
        ${prog.concluded && finding ? callout(`<b>Raised as finding ${esc(finding.id)}.</b>
          ${esc(finding.title)} — now in Controls and findings, on the invoicing step of the process
          map. ${openFinding ? "It has not been concluded yet." : "It has been concluded."}
          <div class="acts" style="margin-top:12px">
            ${btn(openFinding ? "Review the finding" : "See it in Controls and findings", "nav",
              { variant: openFinding ? "go" : "plain", size: "sm", data: { href: "#/controls" } })}
          </div>`, openFinding ? "alert" : "") : ""}
      </section>` : ""}

    <section style="margin-top:40px">
      <h2 class="t-h" style="margin-bottom:14px">Every step on this transaction</h2>
      <div class="rows">
        ${txn.steps.map((t, i) => {
          const v = st.traceVerdict(txnId, t);
          return row({
            lead: dot(v === "exception" ? "alert" : v ? "ok" : "open"),
            title: `<span class="b">${i + 1}. ${esc(processSteps.find((p) => p.id === t.step)?.name || t.step)}</span>`,
            detail: esc(t.actualEvidence),
            side: `<span class="t-meta" style="${v === "exception" ? "color:var(--alert)" : v ? "color:var(--ok)" : ""}">${
              v === "exception" ? "exception" : v ? "corroborated" : "not traced"}</span>`,
            mod: v === "exception" ? "conflict" : "",
          });
        }).join("")}
      </div>
    </section>

    ${(txn.untraced || []).length ? `<section style="margin-top:34px">
      <h2 class="t-h" style="margin-bottom:6px">Steps not covered by this walkthrough</h2>
      <p class="t-sub" style="margin-bottom:14px;max-width:74ch">
        Not the same as corroborated, and not the same as a gap in the work. Each one says which.</p>
      <div class="rows">
        ${txn.untraced.map((u) => row({
          lead: dot("open"),
          title: `<span style="color:var(--ink-3)">${esc(processSteps.find((p) => p.id === u.step)?.name || u.step)}</span>`,
          detail: esc(u.why),
          side: `<span class="t-meta">${u.kind === "not_applicable" ? "not in this variant" : "not yet occurred"}</span>`,
        })).join("")}
      </div>
    </section>` : ""}

    <section style="margin-top:40px;border-top:1px solid var(--line);padding-top:28px">
      ${prog.concluded
        ? `<h2 class="t-h">Concluded</h2>
           <p class="t-sub" style="margin:6px 0 18px;max-width:70ch">
             ${prog.exceptions
               ? `The transaction did not behave as documented at ${prog.exceptions} step${prog.exceptions === 1 ? "" : "s"}.
                  The exception is recorded as a finding against the process, not against this order.`
               : `The transaction behaved as documented at every step on its path.`}
             ${notYet.length ? ` This walkthrough covers the process up to ${esc(
                 processSteps.find((p) => p.id === notYet[0].step)?.name.toLowerCase() || "the last traced step")}
                 — ${esc(notYet[0].why.toLowerCase())} So it is not evidence over the full order-to-cash cycle.` : ""}
           </p>
           <div class="acts">
             ${openFinding
               ? btn("Review the finding it raised", "nav", { variant: "go", data: { href: "#/controls" } })
               : btn("Back to the variants", "back-to-variants", { variant: "go" })}
             ${btn("Reopen the walkthrough", "reopen-trace", { variant: "plain", data: { txn: txn.id } })}
           </div>`
        : prog.pending.length
        ? `<h2 class="t-h">${prog.pending.length} step${prog.pending.length === 1 ? "" : "s"} still to trace</h2>
           <div class="acts" style="margin-top:16px">
             ${btn("Continue tracing", "pick-txn", { variant: "go", size: "lg", data: { id: txn.id }, key: "Enter" })}
           </div>`
        : `<h2 class="t-h">Conclude</h2>
           <p class="t-sub" style="margin:6px 0 18px;max-width:70ch">
             Concluding records the result in the file${prog.exceptions ? ` and raises the exception as a
             finding against the process, which goes back to step four for your conclusion` : ""}.
             ${notYet.length ? "It will also record which steps this transaction could not evidence, and why." : ""}</p>
           <div class="acts">
             ${btn("Conclude the line walkthrough", "conclude-trace", { variant: "go", size: "lg", key: "Enter", data: { txn: txn.id } })}
           </div>`}
    </section>
  `;

  return screen("trace", body, { width: "wide" });
}

/* --- Entry ----------------------------------------------------------------- */

export function trace() {
  if (!S.generated) {
    return screen("trace", `
      ${empty("Nothing to trace against yet",
        "A line walkthrough tests a real transaction against the documented process, so the process has to be documented first.")}
      <div style="text-align:center;margin-top:-40px">
        ${btn("Go to the process understanding", "nav", { variant: "go", data: { href: "#/understanding" } })}
      </div>`);
  }
  if (!S.analysed) {
    return screen("trace", `
      ${empty("The controls to trace against have not been identified yet",
        "A line walkthrough compares a real transaction with the documented process and the controls identified on it, so step 4 has to run first.")}
      <div style="text-align:center;margin-top:-40px">
        ${btn("Go to controls and findings", "nav", { variant: "go", data: { href: "#/controls" } })}
      </div>`);
  }
  if (!S.traceTxn) return overview();
  if (S.reviewMode === "focus" && S.focusKind === "trace") return stepFocus();
  return txnSummary();
}
