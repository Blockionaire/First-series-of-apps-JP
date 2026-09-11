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

import { esc, cx, act as btn, row, rows, dot, tag, icon, more, empty, callout,
         evidence, card, dependencies } from "../ui.js";
import { transactions, txnById, variants, traceFindings, processSteps } from "../data-process.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";
import { dwBar } from "./understanding.js";
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

    const badge = vw.state === "not_required" ? tag("no walkthrough required", "quiet")
      : vw.state === "completed" ? tag(`complete${vw.progress?.exceptions ? ` · ${vw.progress.exceptions} exception` : ""}`,
          vw.progress?.exceptions ? "warn" : "ok", "check")
      : vw.state === "in_progress" ? tag(`${vw.progress.done} of ${vw.progress.expected} traced`, "accent", "walkthrough")
      : vw.state === "not_started" ? tag("not started", "quiet")
      : tag("no decision recorded", "warn");

    return `<section class="vcard">
      <div class="row row--base">
        <span class="rw__lead">${icon("variant", 18)}</span>
        <h3 class="t-h">${esc(v.name)}</h3>
        <span class="t-meta">${esc(v.value)} · ${esc(v.recognition)}</span>
        <span class="sp"></span>
        ${badge}
      </div>
      <p class="t-sub measure" style="margin-top:8px">${esc(v.what)}</p>

      ${req.state === "not_decided" && !editing ? `
        <div class="callout callout--warn sec__note">
          <b>Does this variant need a line walkthrough?</b>
          ${suggested ? ` The methodology pack proposes <b>${
            suggested.state === "required" ? "yes" : "no"}</b>${
            suggested.state === "not_required" ? ` — ${esc(suggested.reason)}` : ""}. ` : " "}
          It is your decision and it is recorded either way.
          <div class="acts sec__note">
            ${btn("A walkthrough is required", "lw-require", { variant: "primary", data: { v: v.id } })}
            ${btn("Not required — record why", "lw-not-open", { data: { v: v.id } })}
          </div>
        </div>` : ""}

      ${editing ? `<div class="callout sec__note">
        <b>Why does this variant not need a line walkthrough?</b>
        <p class="t-meta sec__note">The reason is what the reviewer reads. "Immaterial" on its own
        is not one.</p>
        <textarea class="field" id="ans" rows="3">${esc(suggested?.state === "not_required" ? suggested.reason : "")}</textarea>
        <div class="acts sec__note">
          ${btn("Record as not required", "lw-not-required", { variant: "primary", data: { v: v.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
        </div>
      </div>` : ""}

      ${req.state === "not_required" ? `<div class="callout sec__note">
        <b>No line walkthrough required.</b> ${esc(req.reason || "No reason recorded.")}
        <div class="acts sec__note">
          ${btn("Change this decision", "lw-reopen", { variant: "ghost", size: "sm", data: { v: v.id } })}
        </div>
      </div>` : ""}

      ${req.state === "required" ? (
        vw.txn ? `<div class="sec__note">${rows(row({
            title: `<span class="b">${esc(vw.txn.id)}</span> — ${esc(vw.txn.customer)}`,
            detail: vw.progress.concluded
              ? `Concluded · ${vw.progress.corroborated} corroborated, ${vw.progress.exceptions} exception${vw.progress.exceptions === 1 ? "" : "s"}`
              : `${vw.progress.done} of ${vw.progress.expected} steps traced`,
            lead: icon("walkthrough", 17),
            side: btn(vw.progress.concluded ? "Open" : "Continue", "open-trace",
              { size: "sm", variant: vw.progress.concluded ? "" : "primary", data: { id: vw.txn.id } }),
          }))}</div>`
        : candidates.length ? `<div class="sec--tight">
          <div class="t-eyebrow rail__h">Choose a transaction</div>
          <div class="cards">
            ${candidates.map((t) => card({
              mod: t.recommended ? "accent" : "flat",
              lead: icon("walkthrough", 18),
              title: `<span class="b">${esc(t.id)}</span> — ${esc(t.customer)}`,
              detail: `${esc(t.what)} · ${esc(t.value)}`,
              side: t.recommended ? tag("suggested", "accent") : "",
              body: `<p class="t-sub measure">${t.recommended ? "<b>Suggested.</b> " : ""}${esc(t.why)}</p>`,
              action: "pick-txn", data: { id: t.id },
            })).join("")}
          </div>
          <p class="t-meta sec__note">
            Suggested from the period's transactions for this variant. The selection is yours and the
            reason is recorded.</p>
        </div>`
        : `<p class="t-sub sec__note"><span class="state state--warn">${icon("question", 14)}
            No candidate transactions have been loaded for this variant in the prototype.</span></p>`
      ) : ""}
    </section>`;
  };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Line walkthrough</h1>
          <p class="t-lede">
            Trace one real transaction end to end through the process we documented. Everything up to
            here is what people said; this is the first point at which the file tests it.
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n">${tr.completed}<span class="ink4">/${tr.required}</span></span>
            <span class="tally__l">required complete</span></div>
          ${tr.exceptions ? `<div><span class="tally__n" style="color:var(--danger)">${tr.exceptions}</span>
            <span class="tally__l">exception${tr.exceptions === 1 ? "" : "s"}</span></div>` : ""}
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="sec__h">
        <h2 class="t-eyebrow">The process it will be traced against</h2>
        <span class="sp"></span>${mapLegend("annotated")}
      </div>
      ${processMap("annotated", { compact: true, onSelect: "noop" })}
      <p class="t-meta sec__note measure">
        Revenue runs three different paths. A walkthrough of a machine sale says nothing about how a
        spare-part order or a service contract behaves, so the requirement is decided per variant.</p>
    </section>

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-h">Which variants need a walkthrough</h2>
        <span class="sp"></span>
        <span class="t-meta">${tr.undecided ? `${tr.undecided} undecided` : "all decided"}</span>
      </div>
      ${tr.variants.map(variantCard).join("")}
    </section>

    ${tr.satisfied ? `<section class="sec--loose"><hr class="rule">
      ${callout(`<b>Every variant is dealt with.</b> ${tr.completed} walkthrough${tr.completed === 1 ? "" : "s"}
        completed and ${tr.variants.length - tr.required} variant${tr.variants.length - tr.required === 1 ? "" : "s"}
        documented as not requiring one.`, "ok")}
      <div class="acts sec">
        ${btn("Go to control testing", "nav", { variant: "primary", ic: "arrow", data: { href: "#/testing" } })}
      </div>
    </section>` : ""}
  `;
  return screen("trace", body, { width: "workspace" });
}

/* --- The progress ribbon: where the auditor is in this transaction --------
   Traced, exception, now, not yet occurred and not-in-this-variant are five
   different states and the ribbon shows all five.
   -------------------------------------------------------------------------- */
function ribbon(txn, currentId) {
  const all = [...txn.steps.map((t) => ({ kind: "step", t })),
               ...(txn.untraced || []).map((u) => ({ kind: "skip", u }))];
  const order = processSteps.map((p) => p.id);
  all.sort((a, b) => order.indexOf(a.t ? a.t.step : a.u.step) - order.indexOf(b.t ? b.t.step : b.u.step));

  return `<div class="ribbon">${all.map((x, i) => {
    const stepId = x.t ? x.t.step : x.u.step;
    const name = processSteps.find((p) => p.id === stepId)?.name || stepId;
    if (x.kind === "skip") {
      return `<div class="rbn is-na">
        <span class="rbn__top">${i ? `<span class="rbn__ln"></span>` : ""}
          <span class="rbn__m"></span><span class="rbn__n">${esc(name)}</span></span>
        <span class="rbn__c">${esc(x.u.kind === "not_applicable" ? "not in this variant" : "not yet occurred")}</span>
      </div>`;
    }
    const v = st.traceVerdict(txn.id, x.t);
    const now = x.t.id === currentId;
    return `<div class="${cx("rbn", v === "corroborated" && "is-ok", v === "exception" && "is-ex", now && "is-now")}">
      <span class="rbn__top">${i ? `<span class="rbn__ln"></span>` : ""}
        <span class="rbn__m">${v ? icon(v === "exception" ? "contradiction" : "check", 11) : ""}</span>
        <span class="rbn__n">${esc(name)}</span></span>
      <span class="rbn__c">${v === "exception" ? "exception" : v === "corroborated" ? "corroborated"
        : now ? "tracing now" : "not traced"}</span>
    </div>`;
  }).join("")}</div>`;
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

  const body = `<div class="dw">
    <div class="tracehead">
      <div class="row sec__h" style="margin-bottom:12px">
        <span class="t-meta">${icon("walkthrough", 15)}</span>
        <span class="t-meta"><b class="ink2">${esc(txn.id)}</b> · ${esc(txn.customer)} ·
          ${esc(txn.value)} · ${esc(vName(txn.variant))}</span>
        <span class="sp"></span>
        <span class="t-meta">${prog.done} of ${prog.expected} traced</span>
        ${btn("Leave", "exit-focus", { variant: "ghost", size: "sm", ic: "back" })}
      </div>
      ${ribbon(txn, t.id)}
    </div>

    <div class="dw__body"><div class="dw__in">
      <div class="dw__ctx">${icon("step", 15)}<span class="t-eyebrow">Step ${n} of ${txn.steps.length}</span>
        <span>·</span><b>${esc(p ? p.actor : "")}</b></div>
      <h1 class="dw__t">${esc(p ? p.name : t.step)}</h1>

      <div class="expect">
        <div class="expect__r"><dt>Expected step</dt><dd>${esc(t.expectedStep)}</dd></div>
        <div class="expect__r"><dt>Expected control</dt><dd>${esc(t.expectedControl)}</dd></div>
        <div class="expect__r"><dt>Expected evidence</dt><dd>${esc(t.expectedEvidence)}</dd></div>
      </div>

      <div class="actual">
        <div class="t-eyebrow rail__h">Evidence obtained</div>
        <p class="actual__e">${esc(t.actualEvidence)}</p>
        <div class="t-eyebrow rail__h" style="margin-top:22px">Observation</div>
        <p class="actual__o">${esc(t.observation)}</p>
      </div>

      ${isEx ? `<div class="flag flag--alert">
        <b>Possible exception.</b> ${esc(t.exception)}
        <div class="t-meta" style="margin-top:8px;color:inherit;opacity:.85">Found by ${esc(t.why)}</div>
      </div>` : ""}

      ${t.note === "not_triggered" ? `<div class="flag">
        <b>The control did not operate on this transaction.</b> Nothing was blocked, so this trace
        gives no evidence about whether the control works. That is a corroborated step, not a tested
        control.</div>` : ""}

      <div class="proposal">
        <span class="proposal__l">${icon("walkthrough", 14)}Proposed by the platform</span>
        <span class="proposal__v">${isEx ? "Exception" : "Corroborated"}</span>
      </div>

      <div class="dock"><div class="dock__in">
        ${btn(isEx ? "Record the exception" : "Corroborated", "decide-trace",
          { variant: isEx ? "primary" : "ok", key: "⏎",
            data: { txn: txn.id, id: t.id, v: isEx ? "exception" : "corroborated" },
            ic: isEx ? "contradiction" : "check" })}
        ${btn(isEx ? "No exception" : "Raise an exception", "decide-trace",
          { key: isEx ? "C" : "X", data: { txn: txn.id, id: t.id, v: isEx ? "corroborated" : "exception" } })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "ghost", key: "J" })}
      </div></div>
    </div></div>
  </div>`;

  return screen("trace", body, { raw: true });
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
          ${btn("All variants", "back-to-variants", { variant: "ghost", size: "sm", ic: "back" })}
          <h1 class="t-display" style="margin-top:10px">${prog.concluded ? "Line walkthrough complete"
            : prog.pending.length ? "Line walkthrough in progress" : "Every step traced"}</h1>
          <p class="t-lede">
            ${esc(txn.id)} — ${esc(txn.customer)}, ${esc(txn.what)}, ${esc(txn.value)}.
            <span class="t-meta">${esc(vName(txn.variant))}</span>
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n">${prog.expected}</span><span class="tally__l">steps on this path</span></div>
          <div><span class="tally__n" style="color:var(--ok)">${prog.corroborated}</span><span class="tally__l">corroborated</span></div>
          <div><span class="tally__n" style="color:${prog.exceptions ? "var(--danger)" : "var(--ink-4)"}">${prog.exceptions}</span>
            <span class="tally__l">exception${prog.exceptions === 1 ? "" : "s"}</span></div>
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="sec__h"><h2 class="t-eyebrow">Every step on this transaction</h2></div>
      ${ribbon(txn, null)}
    </section>

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-eyebrow">Against the process map</h2>
        <span class="sp"></span>${mapLegend("trace")}
      </div>
      ${processMap("trace", { selected: S.mapStep, txn: txn.id })}
      ${S.mapStep ? mapDetail(S.mapStep, { txn: txn.id }) : ""}
      <p class="t-meta sec__note measure">
        The faded steps are not on this transaction's path. Steps outside the variant and steps that
        have not happened yet are two different things, and the ribbon above says which.</p>
    </section>

    ${exSteps.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">The exception</h2></div>
        ${exSteps.map((t) => card({
          mod: "alert",
          lead: icon("contradiction", 18),
          title: esc(processSteps.find((p) => p.id === t.step)?.name || t.step),
          detail: esc(t.exception),
          body: `<p class="t-sub measure sec__note">${esc(t.actualEvidence)}</p>`,
        })).join("")}
        ${prog.concluded && finding ? callout(`<b>Raised as finding ${esc(finding.id)}.</b>
          ${esc(finding.title)} — now in Controls and findings, on the invoicing step of the process
          map. ${openFinding ? "It has not been concluded yet." : "It has been concluded."}
          <div class="acts sec__note">
            ${btn(openFinding ? "Review the finding" : "See it in Controls and findings", "nav",
              { variant: openFinding ? "primary" : "ghost", size: "sm", data: { href: "#/controls" } })}
          </div>`, openFinding ? "alert" : "") : ""}
      </section>` : ""}

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">What each step evidenced</h2></div>
      ${rows(txn.steps.map((t, i) => {
        const v = st.traceVerdict(txnId, t);
        return row({
          lead: icon(v === "exception" ? "contradiction" : v ? "check" : "clock", 17),
          title: `<span class="b">${i + 1}. ${esc(processSteps.find((p) => p.id === t.step)?.name || t.step)}</span>`,
          detail: esc(t.actualEvidence),
          side: tag(v === "exception" ? "exception" : v ? "corroborated" : "not traced",
            v === "exception" ? "alert" : v ? "ok" : "quiet"),
          mod: v === "exception" ? "conflict" : "",
        });
      }).join(""))}
    </section>

    ${(txn.untraced || []).length ? `<section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Steps not covered by this walkthrough</h2></div>
      <p class="t-sub sec__h measure">
        Not the same as corroborated, and not the same as a gap in the work. Each one says which.</p>
      ${rows(txn.untraced.map((u) => row({
        lead: icon(u.kind === "not_applicable" ? "variant" : "clock", 17),
        title: `<span class="ink3">${esc(processSteps.find((p) => p.id === u.step)?.name || u.step)}</span>`,
        detail: esc(u.why),
        side: tag(u.kind === "not_applicable" ? "not in this variant" : "not yet occurred", "quiet"),
      })).join(""))}
    </section>` : ""}

    <hr class="rule">
    <section class="sec">
      ${prog.concluded
        ? `<h2 class="t-h">Concluded</h2>
           <p class="t-sub sec__h measure">
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
               ? btn("Review the finding it raised", "nav", { variant: "primary", ic: "arrow", data: { href: "#/controls" } })
               : btn("Back to the variants", "back-to-variants", { variant: "primary", ic: "back" })}
             ${btn("Reopen the walkthrough", "reopen-trace", { variant: "ghost", data: { txn: txn.id } })}
           </div>`
        : prog.pending.length
        ? `<h2 class="t-h">${prog.pending.length} step${prog.pending.length === 1 ? "" : "s"} still to trace</h2>
           <div class="acts sec">
             ${btn("Continue tracing", "pick-txn", { variant: "primary", size: "lg", data: { id: txn.id }, key: "Enter", ic: "arrow" })}
           </div>`
        : `<h2 class="t-h">Conclude</h2>
           <p class="t-sub sec__h measure">
             Concluding records the result in the file${prog.exceptions ? ` and raises the exception as a
             finding against the process, which goes back to step four for your conclusion` : ""}.
             ${notYet.length ? "It will also record which steps this transaction could not evidence, and why." : ""}</p>
           <div class="acts">
             ${btn("Conclude the line walkthrough", "conclude-trace", { variant: "primary", size: "lg", key: "Enter", data: { txn: txn.id }, ic: "check" })}
           </div>`}
    </section>
  `;

  return screen("trace", body, { width: "workspace" });
}

/* --- Entry ----------------------------------------------------------------- */

export function trace() {
  if (!S.generated) {
    return screen("trace", `
      ${empty("Nothing to trace against yet",
        "A line walkthrough tests a real transaction against the documented process, so the process has to be documented first.", "walkthrough")}
      <div class="acts" style="justify-content:center">
        ${btn("Go to the process understanding", "nav", { variant: "primary", ic: "arrow", data: { href: "#/understanding" } })}
      </div>`, { width: "reading" });
  }
  if (!S.analysed) {
    return screen("trace", `
      ${empty("The controls to trace against have not been identified yet",
        "A line walkthrough compares a real transaction with the documented process and the controls identified on it, so step 4 has to run first.", "control")}
      <div class="acts" style="justify-content:center">
        ${btn("Go to controls and findings", "nav", { variant: "primary", ic: "arrow", data: { href: "#/controls" } })}
      </div>`, { width: "reading" });
  }
  if (!S.traceTxn) return overview();
  if (S.reviewMode === "focus" && S.focusKind === "trace") return stepFocus();
  return txnSummary();
}
