/* Step 5 — Line walkthrough.

   Testing the process model against a real transaction. The map from step 3
   sits above the work and fills in as the trace advances, so the auditor can
   see how far through the process they are and where it broke. */

import { esc, cx, act as btn, row, dot, more, empty, callout, evidence } from "../ui.js";
import { lineWalk, lineWalkCandidates, traceFinding, processSteps } from "../data-process.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";
import { processMap, mapLegend } from "./map.js";

const S = st.S;

/* --- Choosing the transaction --------------------------------------------- */

function pick() {
  const body = `
    <div class="head">
      <h1 class="t-title">Line walkthrough</h1>
      <p class="t-lede" style="margin-top:10px">
        Trace one real transaction end to end through the process we documented. It is how you find
        out whether the process actually works the way everybody described it.
      </p>
    </div>

    <section style="margin-top:28px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">The process it will be traced against</h2>
        <span class="sp"></span>${mapLegend("annotated")}
      </div>
      ${processMap("annotated", { compact: true, onSelect: "noop" })}
    </section>

    <section style="margin-top:44px">
      <h2 class="t-h" style="margin-bottom:4px">Choose a transaction</h2>
      <p class="t-meta" style="margin-bottom:18px">
        Suggested from the period's transactions. The selection is yours, and the reason is recorded.</p>
      <div class="rows">
        ${lineWalkCandidates.map((t) => `
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
    </section>
  `;
  return screen("trace", body, { width: "wide" });
}

/* --- One step of the trace ------------------------------------------------- */

function stepFocus() {
  const tr = st.traceSummary();
  const pending = tr.pending;
  if (!pending.length) return summary();

  const ix = Math.min(S.focusIx, pending.length - 1);
  const t = pending[ix];
  const p = processSteps.find((x) => x.id === t.step);
  const n = lineWalk.steps.indexOf(t) + 1;
  const isEx = t.suggested === "exception";

  const body = `
    <div class="tracehead">
      <div class="row" style="margin-bottom:10px">
        <span class="t-meta"><b style="color:var(--ink-2)">${esc(lineWalk.transaction.id)}</b>
          · ${esc(lineWalk.transaction.customer)} · ${esc(lineWalk.transaction.value)}</span>
        <span class="sp"></span>
        <span class="t-meta">${tr.done} of ${tr.expected} traced</span>
        ${btn("Leave", "exit-focus", { variant: "plain", size: "sm" })}
      </div>
      ${processMap("trace", { selected: t.step, onSelect: "noop" })}
    </div>

    <div class="focus__body"><div class="q">
      <div class="t-meta" style="margin-bottom:6px">Step ${n} of ${lineWalk.steps.length}</div>
      <h1 class="q__t">${esc(t.name)}</h1>
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
        <span class="l">Suggested</span>
        <span class="v">${isEx ? "Exception" : "Corroborated"}</span>
      </div>
      <div class="q__acts">
        ${btn(isEx ? "Record the exception" : "Corroborated", "decide-trace",
          { variant: isEx ? "go" : "ok", key: "Enter", data: { id: t.id, v: isEx ? "exception" : "corroborated" } })}
        ${btn(isEx ? "No exception" : "Raise an exception", "decide-trace",
          { key: isEx ? "C" : "X", data: { id: t.id, v: isEx ? "corroborated" : "exception" } })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "plain" })}
      </div>
    </div></div>
  `;

  return screen("trace", `<div class="focus">${body}</div>`, { raw: true });
}

/* --- The result ------------------------------------------------------------ */

function summary() {
  const tr = st.traceSummary();
  const na = lineWalk.notApplicable;
  const exSteps = lineWalk.steps.filter((t) => st.traceVerdict(t) === "exception");

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">${tr.concluded ? "Line walkthrough complete" : "Every step traced"}</h1>
          <p class="t-lede" style="margin-top:10px">
            ${esc(lineWalk.transaction.id)} — ${esc(lineWalk.transaction.customer)},
            ${esc(lineWalk.transaction.what)}, ${esc(lineWalk.transaction.value)}.
          </p>
        </div>
      </div>
    </div>

    <div class="tally">
      <div><span class="tally__n">${tr.expected}</span><span class="tally__l">steps expected</span></div>
      <div><span class="tally__n" style="color:var(--ok)">${tr.corroborated}</span><span class="tally__l">corroborated</span></div>
      <div><span class="tally__n" style="color:${tr.exceptions ? "var(--alert)" : "var(--ink-4)"}">${tr.exceptions}</span>
        <span class="tally__l">exception${tr.exceptions === 1 ? "" : "s"}</span></div>
    </div>

    <section style="margin-top:36px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">Against the process map</h2>
        <span class="sp"></span>${mapLegend("trace")}
      </div>
      ${processMap("trace", { selected: S.mapStep })}
    </section>

    ${exSteps.length ? `
      <section style="margin-top:40px">
        <h2 class="t-h" style="margin-bottom:14px">Exception</h2>
        ${exSteps.map((t) => `<div class="rw rw--conflict" style="display:block">
          <div class="rw__t"><span class="b">${esc(t.name)}</span></div>
          <div class="rw__d" style="margin-top:6px;max-width:74ch">${esc(t.exception)}</div>
          <div class="rw__d" style="margin-top:8px">${esc(t.actualEvidence)}</div>
        </div>`).join("")}
        ${tr.concluded ? callout(`<b>Raised as finding ${esc(traceFinding.id)}.</b>
          ${esc(traceFinding.title)} — now in Controls &amp; findings, attached to the invoicing step
          of the process map.`, "") : ""}
      </section>` : ""}

    <section style="margin-top:40px">
      <h2 class="t-h" style="margin-bottom:14px">Every step</h2>
      <div class="rows">
        ${lineWalk.steps.map((t, i) => {
          const v = st.traceVerdict(t);
          return row({
            lead: dot(v === "exception" ? "alert" : v ? "ok" : "open"),
            title: `<span class="b">${i + 1}. ${esc(t.name)}</span>`,
            detail: esc(t.actualEvidence),
            side: `<span class="t-meta" style="${v === "exception" ? "color:var(--alert)" : v ? "color:var(--ok)" : ""}">${
              v === "exception" ? "exception" : v ? "corroborated" : "not traced"}</span>`,
            mod: v === "exception" ? "conflict" : "",
          });
        }).join("")}
        ${row({
          lead: dot("open"),
          title: `<span style="color:var(--ink-3)">${esc(na.name)}</span>`,
          detail: esc(na.why),
          side: `<span class="t-meta">not applicable</span>`,
        })}
      </div>
    </section>

    <section style="margin-top:40px;border-top:1px solid var(--line);padding-top:28px">
      ${tr.concluded
        ? `<div class="acts">
            ${btn("Go to control testing", "nav", { variant: "go", data: { href: "#/testing" } })}
            ${btn("Reopen the walkthrough", "reopen-trace", { variant: "plain" })}
          </div>`
        : `<h2 class="t-h">Conclude</h2>
           <p class="t-sub" style="margin:6px 0 18px;max-width:64ch">
             Concluding records the result in the file${tr.exceptions ? ` and raises the exception as a
             finding against the process` : ""}. The documentation is drafted from the trace; you review it
             like everything else.</p>
           <div class="acts">
             ${btn("Conclude the line walkthrough", "conclude-trace", { variant: "go", size: "lg", key: "Enter" })}
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
        ${btn("Go to Understanding", "nav", { variant: "go", data: { href: "#/understanding" } })}
      </div>`);
  }
  if (!S.traceTxn) return pick();
  if (S.reviewMode === "focus" && S.focusKind === "trace" && st.traceSummary().pending.length) return stepFocus();
  return summary();
}
