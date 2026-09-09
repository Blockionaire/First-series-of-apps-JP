/* Step 6 — Control testing. A labelled future-state concept, shown once.

   Control identification and control testing are different objects. A control
   exists in the process; a test is a procedure performed on it, with a
   population, a selection, evidence and a conclusion.

   Corrections in this pass:
   · The step is conditional. Nothing is testable until something has been
     concluded as a key control, and even then whether to test it is a
     scope decision with a reason — reliance is planned, not assumed.
   · Extending the sample is not a conclusion. It enlarges the selection and
     leaves the test open. */

import { esc, cx, act as btn, row, rows, dot, tag, icon, more, callout, empty, card } from "../ui.js";
import { controlTest as controlTestPack } from "../data-process.js";
import { controls } from "../data-model.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

/* --- Scope: which key controls are to be tested --------------------------- */

function scopeSection(sc) {
  return `<section class="sec">
    <div class="sec__h">
      <h2 class="t-h">Which key controls will be tested</h2>
      <span class="sp"></span>
      <span class="t-meta">${sc.decided} of ${sc.rows.length} decided</span>
    </div>
    <p class="t-sub sec__h measure">
      A control is tested because you intend to rely on it. Deciding not to rely, and taking a
      substantive response instead, is a legitimate answer — it just has to be an answer.</p>

    ${sc.rows.map(({ control: c, scope, test }) => {
      const editing = S.editing === `ts:${c.id}`;
      const badge = scope.state === "required"
          ? (test.conclusion ? tag(test.conclusion === "rely" ? "tested · reliance placed" : "tested · no reliance",
              test.conclusion === "rely" ? "ok" : "warn", "check")
             : test.extended ? tag("sample extended — open", "warn", "test")
             : tag("test required, not concluded", "accent", "test"))
        : scope.state === "not_required" ? tag("no test — reason on file", "quiet")
        : tag("no decision recorded", "warn");

      return `<section class="vcard">
        <div class="row row--base">
          <span class="rw__lead">${icon("control", 18)}</span>
          <h3 class="t-h-sm">${esc(c.title)}</h3>
          <span class="sp"></span>
          ${badge}
        </div>
        <p class="t-meta" style="margin-top:6px">
          <span class="mono">${esc(c.id)}</span> · ${esc(c.owner || "owner not established")} ·
          ${c.nature === "automated" ? "automated" : c.nature === "manual" ? "manual" : "IT-dependent manual"}</p>

        ${scope.state === "deferred" && !editing ? `<div class="acts sec__note">
          ${btn("Test this control", "test-require", { variant: "primary", size: "sm", data: { id: c.id } })}
          ${btn("No test — record why", "test-not-open", { size: "sm", data: { id: c.id } })}
        </div>` : ""}

        ${editing ? `<div class="callout sec__note">
          <b>Why will this control not be tested?</b>
          <p class="t-meta sec__note">Usually because no reliance is planned and the assertion is
          covered substantively. That reason goes on the file.</p>
          <textarea class="field" id="ans" rows="3" placeholder="e.g. No reliance planned. Cut-off is covered substantively by the year-end sales cut-off testing, so testing operating effectiveness would not change the audit response."></textarea>
          <div class="acts sec__note">
            ${btn("Record — no test required", "test-not-required", { variant: "primary", data: { id: c.id } })}
            ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
          </div>
        </div>` : ""}

        ${scope.state === "not_required" ? `<div class="callout sec__note">
          <b>No test required.</b> ${esc(scope.reason || "No reason recorded.")}
          <div class="acts sec__note">
            ${btn("Change this decision", "test-reopen-scope", { variant: "ghost", size: "sm", data: { id: c.id } })}
          </div>
        </div>` : ""}

        ${scope.state === "required" ? placeholder(c, test) : ""}
      </section>`;
    }).join("")}
  </section>`;
}

/* --- Controls scoped for testing that have no workpaper in the prototype ----
   A placeholder, not a shortcut: the control still needs its own conclusion,
   and step 6 stays open until it has one.
   -------------------------------------------------------------------------- */

function placeholder(c, test) {
  if (st.hasWorkpaper(c.id)) {
    return `<p class="t-sub" style="margin-top:14px;color:var(--ink-4)">
      Scoped for testing. The worked test is below.</p>`;
  }
  const editing = S.editing === `tc:${c.id}`;
  return `<div class="callout sec__note">
    <b>Scoped for testing.</b> No test workpaper has been drafted for this control in the
    prototype — only <span class="mono">${esc(controlTestPack.controlId)}</span> carries a worked
    example. The conclusion is still this control's own, and step 6 stays open without it.
    ${test.conclusion ? `<div class="t-meta sec__note">
      <b class="ink2">${esc(test.conclusion === "rely"
        ? "Concluded — reliance placed on this control." : "Concluded — no reliance placed.")}</b>
      ${test.note ? " " + esc(test.note) : ""}</div>
      <div class="acts sec__note">
        ${btn("Reopen this conclusion", "reopen-test", { variant: "ghost", size: "sm", data: { id: c.id } })}
      </div>`
    : editing ? `<div class="sec__note">
        <textarea class="field" id="ans" rows="2"
          placeholder="What the test found, in one line."></textarea>
        <div class="acts sec__note">
          ${btn("Rely on the control", "conclude-test", { variant: "primary", size: "sm", data: { id: c.id, d: "rely" } })}
          ${btn("Do not rely", "conclude-test", { size: "sm", data: { id: c.id, d: "no_rely" } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
        </div>
      </div>`
    : `<div class="acts sec__note">
        ${btn("Record this control's conclusion", "test-conclude-open", { size: "sm", data: { id: c.id }, ic: "test" })}
      </div>`}
  </div>`;
}

/* --- The worked test ------------------------------------------------------- */

function testSection() {
  const c = controls.find((x) => x.id === controlTestPack.controlId);
  const t = controlTestPack;
  const ts = st.testSummary(t.controlId);

  const stage = (n, name, body, done = true) => `
    <div class="tstage ${done ? "is-done" : ""}">
      <div class="tstage__h"><span class="tstage__n">${n}</span><span class="tstage__t">${esc(name)}</span></div>
      <div class="tstage__b">${body}</div>
    </div>`;

  return `<section class="sec--loose">
    <div class="sec__h"><h2 class="t-h">${esc(c ? c.title : t.controlId)}</h2></div>
    <p class="t-meta sec__h">
      <span class="mono">${esc(t.controlId)}</span> · scoped for testing, worked through end to end</p>

    <div class="tflow">
      ${stage(1, "Test setup", `
        <div class="expect">
          <div class="expect__r"><dt>Objective</dt><dd>${esc(t.objective)}</dd></div>
          <div class="expect__r"><dt>Nature</dt><dd>${t.nature.map(esc).join(", ")}</dd></div>
          <div class="expect__r"><dt>Timing</dt><dd>${esc(t.timing)}</dd></div>
        </div>`)}

      ${stage(2, "Population and selection", `
        <div class="expect">
          <div class="expect__r"><dt>Population</dt><dd>${esc(t.population)} — <b>${t.populationSize} items</b></dd></div>
          <div class="expect__r"><dt>Source</dt><dd>${esc(t.populationSource)}</dd></div>
          <div class="expect__r"><dt>Completeness</dt><dd>${esc(t.completeness)}</dd></div>
          <div class="expect__r"><dt>Sample</dt><dd><b>${ts.selected} items</b> — ${esc(ts.extended ? t.extendedBasis : t.sampleBasis)}</dd></div>
        </div>
        <p class="t-meta sec__note">The number always shows the firm parameter that produced it,
        never a number the model chose.</p>`)}

      ${stage(3, "Evidence", `
        <p class="t-sub" style="margin-bottom:10px">What to inspect on each selected item:</p>
        <ul class="ticks">${t.attributes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
        <p class="t-meta" style="margin-top:12px">Requested from the client:
          ${t.evidenceToRequest.map(esc).join("; ")}.</p>`)}

      ${stage(4, "Results", `
        <div class="gridwrap" style="max-height:none">
          <table class="agrid">
            <thead><tr><th>Item</th><th>What was inspected</th><th>Selection</th><th>Result</th></tr></thead>
            <tbody>
              ${ts.results.map((r, i) => `<tr>
                <td class="mono">${esc(r.id)}</td>
                <td>${esc(r.note)}</td>
                <td class="t-meta">${ts.extended && i >= t.results.length ? "extension" : "initial"}</td>
                <td class="c-num">${r.ok ? tag("attributes met", "ok", "check") : tag("exception", "alert", "contradiction")}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <p class="t-sub sec__note">
          <b>${ts.corroborated} of ${ts.selected}</b> items met every attribute.
          ${ts.exceptions} exception${ts.exceptions === 1 ? "" : "s"}.</p>
        ${!ts.extended ? `<div class="acts sec__note">
          ${btn("Extend the sample to 10", "extend-sample", { data: { id: t.controlId }, ic: "plus" })}
        </div>
        <p class="t-meta sec__note">Extending changes the selection. It does not conclude the test,
        and the step stays open until you do.</p>` : `
        <p class="t-meta sec__note">Extended to ${ts.selected} items on the firm parameter, after the
        exception in the initial sample. A second exception was found.</p>`}`)}

      ${stage(5, "Conclusion", `
        ${callout(ts.extended
          ? `<b>Two exceptions in an extended sample of ${ts.selected}.</b> Extending did not resolve
             the question; the second item was raised while the controller was on leave, which points
             at the control rather than at the paperwork. Whether the control can be relied on is
             still your judgement, and it is now a judgement with more evidence behind it.`
          : `<b>One exception in a sample of five.</b> The consequence is a matter of professional
             judgement: an isolated documentation lapse, or evidence that the control does not operate
             consistently enough to rely on. The platform will not decide that, and it will not
             extend the sample on your behalf either.`)}
        ${more("pynote", "Prior-year consideration", `<div class="meth">
          <p style="color:var(--ink-2);line-height:1.65">${esc(t.priorYearNote)}</p></div>`, S.disclosed.pynote)}
        <div class="proposal">
          <span class="proposal__l">${icon("test", 14)}Auditor conclusion</span>
          <span class="proposal__v">${ts.conclusion
            ? esc(ts.conclusion === "rely" ? "Control operates — reliance placed"
                : "Not relied upon — substantive response instead")
            : ts.extended ? "still required, after the extension" : "required"}</span>
        </div>
        <div class="acts sec__note">
          ${ts.conclusion
            ? btn("Reopen the conclusion", "reopen-test", { variant: "ghost", data: { id: t.controlId } })
            : `${btn("Rely on the control", "conclude-test", { variant: "primary", data: { id: t.controlId, d: "rely" } })}
               ${btn("Do not rely — respond substantively", "conclude-test", { data: { id: t.controlId, d: "no_rely" } })}`}
        </div>
        ${!ts.conclusion ? `<p class="t-meta sec__note measure">
          Only these two answers close the test. Everything else — extending, requesting more
          evidence, going back to the client — leaves it open, which is what the completion gate
          reads. And this conclusion closes <i>this</i> control only.</p>` : ""}`, !!ts.conclusion)}
    </div>
  </section>`;
}

/* --- Entry ----------------------------------------------------------------- */

export function testing() {
  const sc = st.testingScope();

  const intro = `
    <div class="callout callout--future" style="margin-bottom:32px">
      <b>Future concept.</b> Control testing is not built. This is one worked example of how the
      workflow would run, shown so the shape is visible — real populations, sampling, evidence
      upload and test workpapers are all out of scope for this prototype.
    </div>`;

  /* Conditional: nothing to do until a control has been concluded as key. */
  if (!sc.keys.length) {
    return screen("testing", `${intro}
      ${empty("No control has been concluded as key yet",
        "Testing operates on controls you intend to rely on. Conclude the controls in step 4 and any key control appears here — including, legitimately, none.", "test")}
      <div class="acts" style="justify-content:center">
        ${btn("Go to controls and findings", "nav", { variant: "primary", ic: "arrow", data: { href: "#/controls" } })}
      </div>`, { width: "narrow" });
  }

  const showTest = sc.rows.some(
    (r) => r.control.id === controlTestPack.controlId && r.scope.state === "required");

  const body = `${intro}
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Control testing</h1>
          <p class="t-lede">
            ${sc.keys.length} control${sc.keys.length === 1 ? " has" : "s have"} been concluded as key.
            Identifying a control is not testing it: a test needs a population, a selection, evidence
            and a conclusion, and it is performed only where you plan to rely.
          </p>
        </div>
      </div>
    </div>

    ${scopeSection(sc)}

    ${sc.scopeDecided && !sc.applicable ? `
      <section class="sec--loose"><hr class="rule">
        ${callout(`<b>No control testing required for this process.</b> Every key control has a
          recorded reason for not being tested, and the assertions are covered substantively. Step 6
          is complete without a test — which is a real outcome, not a skipped step.`, "ok")}
      </section>` : ""}

    ${showTest ? testSection() : ""}

    <hr class="rule">
    <section class="sec">
      <div class="acts">
        ${btn("Go to completion", "nav",
          { variant: st.testingSatisfied() ? "primary" : "", ic: "arrow", data: { href: "#/complete" } })}
      </div>
      ${!st.testingSatisfied() ? `<p class="t-meta sec__note measure">
        ${!sc.scopeDecided
          ? `${sc.deferred.length} key control${sc.deferred.length === 1 ? " has" : "s have"} no testing decision.`
          : `${sc.outstanding.length} of ${sc.required.length} scoped test${sc.required.length === 1 ? "" : "s"}
             ${sc.outstanding.length === 1 ? "is" : "are"} not concluded —
             ${esc(sc.outstanding.map((r) => r.control.id).join(", "))}. Concluding one control
             says nothing about another.`}
        Completion reads this.</p>` : ""}
    </section>
  `;

  return screen("testing", body, { width: "reading" });
}
