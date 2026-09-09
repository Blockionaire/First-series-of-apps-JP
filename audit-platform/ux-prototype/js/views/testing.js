/* Step 6 — Control testing. A labelled future-state concept, shown once.

   Control identification and control testing are different objects. A control
   exists in the process; a test is a procedure performed on it, with a
   population, a selection, evidence and a conclusion. */

import { esc, cx, act as btn, row, dot, more, callout, empty } from "../ui.js";
import { controlTest } from "../data-process.js";
import { controls } from "../data-model.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

export function testing() {
  const c = controls.find((x) => x.id === controlTest.controlId);
  const t = controlTest;
  const ts = st.testSummary();
  const keyControls = controls.filter((x) => st.controlDecision(x) === "key");

  const stage = (n, name, body, done = true) => `
    <div class="tstage ${done ? "is-done" : ""}">
      <div class="tstage__h"><span class="tstage__n">${n}</span><span class="tstage__t">${esc(name)}</span></div>
      <div class="tstage__b">${body}</div>
    </div>`;

  const body = `
    <div class="callout callout--future" style="margin-bottom:28px">
      <b>Future concept.</b> Control testing is not built. This is one worked example of how the
      workflow would run, shown so the shape is visible — real populations, sampling, evidence
      upload and test workpapers are all out of scope for this prototype.
    </div>

    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Control testing</h1>
          <p class="t-lede" style="margin-top:10px">
            ${keyControls.length
              ? `${keyControls.length} controls have been concluded as key. Where you intend to rely on
                 one, it has to be tested — identifying a control is not testing it.`
              : `Controls concluded as key in step 4 appear here. Identifying a control and testing it
                 are different pieces of work, and the product keeps them apart.`}
          </p>
        </div>
      </div>
    </div>

    ${keyControls.length ? `
      <section style="margin-top:32px">
        <h2 class="t-eyebrow" style="margin-bottom:14px">Key controls</h2>
        <div class="rows">
          ${keyControls.map((k) => row({
            lead: dot(k.id === t.controlId ? "warn" : "open"),
            title: esc(k.title),
            detail: `${esc(k.owner || "owner not established")} · ${k.nature === "automated" ? "automated" : k.nature === "manual" ? "manual" : "IT-dependent manual"}`,
            side: k.id === t.controlId
              ? `<span class="t-meta" style="color:var(--warn)">test drafted</span>`
              : `<span class="t-meta">not tested</span>`,
          })).join("")}
        </div>
      </section>` : ""}

    <section style="margin-top:44px">
      <h2 class="t-h" style="margin-bottom:4px">${esc(c ? c.title : t.controlId)}</h2>
      <p class="t-meta" style="margin-bottom:22px">
        <span class="mono">${esc(t.controlId)}</span> · the one control with a drafted test</p>

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
            <div class="expect__r"><dt>Sample</dt><dd><b>${t.sampleSize} items</b> — ${esc(t.sampleBasis)}</dd></div>
          </div>
          <p class="t-meta" style="margin-top:10px">The number always shows the firm parameter that
          produced it, never a number the model chose.</p>`)}

        ${stage(3, "Evidence", `
          <p class="t-sub" style="margin-bottom:10px">What to inspect on each selected item:</p>
          <ul class="ticks">${t.attributes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
          <p class="t-meta" style="margin-top:12px">Requested from the client:
            ${t.evidenceToRequest.map(esc).join("; ")}.</p>`)}

        ${stage(4, "Results", `
          <div class="rows">
            ${t.results.map((r) => row({
              lead: dot(r.ok ? "ok" : "alert"),
              title: `<span class="mono">${esc(r.id)}</span>`,
              detail: esc(r.note),
              side: `<span class="t-meta" style="${r.ok ? "color:var(--ok)" : "color:var(--alert)"}">${r.ok ? "attributes met" : "exception"}</span>`,
              mod: r.ok ? "" : "conflict",
            })).join("")}
          </div>
          <p class="t-sub" style="margin-top:14px">
            <b>${ts.corroborated} of ${ts.selected}</b> items met every attribute.
            ${ts.exceptions} exception.</p>`)}

        ${stage(5, "Conclusion", `
          ${callout(`<b>One exception in a sample of five.</b> The consequence is a matter of
            professional judgement: an isolated documentation lapse, or evidence that the control
            does not operate consistently enough to rely on. The platform will not decide that.`)}
          ${more("pynote", "Prior-year consideration", `<div class="meth">
            <p style="color:var(--ink-2);line-height:1.65">${esc(t.priorYearNote)}</p></div>`, S.disclosed.pynote)}
          <div class="q__sug" style="margin-top:22px">
            <span class="l">Auditor conclusion</span>
            <span class="v">${ts.conclusion
              ? esc(ts.conclusion === "rely" ? "Control operates — reliance placed"
                  : ts.conclusion === "no_rely" ? "Not relied upon — substantive response instead"
                  : "Extend the sample")
              : "required"}</span>
          </div>
          <div class="q__acts">
            ${ts.conclusion
              ? btn("Change", "conclude-test", { variant: "plain", data: { d: "" } })
              : `${btn("Extend the sample", "conclude-test", { variant: "go", data: { d: "extend" } })}
                 ${btn("Rely on the control", "conclude-test", { data: { d: "rely" } })}
                 ${btn("Do not rely", "conclude-test", { data: { d: "no_rely" } })}`}
          </div>`, !!ts.conclusion)}
      </div>
    </section>

    <section style="margin-top:40px;border-top:1px solid var(--line);padding-top:28px">
      <div class="acts">
        ${btn("Go to completion", "nav", { variant: ts.conclusion ? "go" : "", data: { href: "#/complete" } })}
      </div>
    </section>
  `;

  return screen("testing", body);
}
