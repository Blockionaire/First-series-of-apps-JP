/* I. Coverage and missing information   ·   J. Generation */

import { esc, cx, btn, tag, panel, note, status, metric, coverageBar, coverageLegend, drawer, empty } from "../ui.js";
import { subProcesses, pipeline, openItems } from "../data-model.js";
import { firm, ref } from "../data-sources.js";
import * as st from "../state.js";
import { wsScreen } from "./chrome.js";

const S = st.S;

const FACT_LABEL = { known: "known", unknown: "not established", contradictory: "contradictory", assumed: "assumed" };

/* ── I. Coverage ─────────────────────────────────────────────────────────── */

function itemRow(item) {
  const state = st.covState(item);
  const facts = st.covFacts(item);
  const unknown = facts.filter((f) => f.status === "unknown");
  const contra = facts.filter((f) => f.status === "contradictory");
  const naOv = S.coverage[item.id]?.naReason || item.naReason;

  return `<div class="covitem">
    <div class="covitem__head">
      <span class="cov__id" style="width:38px">${esc(item.id)}</span>
      <div style="flex:1;min-width:0">
        <div class="row wrap" style="gap:8px">
          <span class="covitem__q">${esc(item.q)}</span>
          ${item.mandatory ? tag("Mandatory", "mandatory") : ""}
        </div>
        ${facts.length ? `<div class="tags" style="margin-top:8px">
          ${facts.map((f) => `<span class="fact fact--${f.status}" title="${esc(f.value || FACT_LABEL[f.status])}">
            ${esc(f.key)}${f.status === "known" ? " ✓" : f.status === "contradictory" ? " ⚠" : f.status === "assumed" ? " ~" : " ✗"}
          </span>`).join("")}
        </div>` : ""}
        ${naOv ? `<div class="note" style="margin-top:10px">
          <span class="lbl">Not applicable — reason recorded in the documentation</span>
          <div style="margin-top:4px">${esc(naOv)}</div></div>` : ""}
        ${item.refs?.length ? `<div class="tags" style="margin-top:8px">
          ${item.refs.map((r) => { const e = ref(r); return e ? `<button class="src" data-act="pin-source" data-ref="${esc(r)}"
            data-quote="${esc(e.quote)}" data-meta="${esc(e.sourceName + " · " + e.locator)}">${esc(e.short)}</button>` : ""; }).join("")}
        </div>` : ""}
      </div>
      <div style="width:200px;text-align:right">
        ${status(state === "covered" ? "approved" : state === "na" ? "rejected"
          : state === "partial" ? "draft" : "missing",
          state === "covered" ? "Covered" : state === "partial" ? "Partially covered"
          : state === "na" ? "Not applicable" : "Open")}
        ${(unknown.length || contra.length) && state !== "na" ? `
          <div class="btn-row" style="justify-content:flex-end;margin-top:8px">
            ${contra.length ? btn("Resolve contradiction", "resolve-conflict", { size: "sm", variant: "danger", data: { block: "N6.2" } }) : ""}
            ${unknown.length ? btn("Ask client", "mock", { size: "sm" }) : ""}
            ${unknown.length ? btn("Record answer", "record-answer", { size: "sm", data: { item: item.id, fact: unknown[0].key } }) : ""}
            ${btn("Mark N/A", "mark-na", { size: "sm", data: { item: item.id } })}
          </div>` : ""}
      </div>
    </div>
  </div>`;
}

export function coverage() {
  const cov = st.coverageSummary();

  const body = `<div class="stack">
    <div class="metrics">
      ${metric(`${cov.covered}/${cov.applicable}`, "applicable items covered")}
      ${metric(`${cov.pct}%`, "coverage", cov.pct >= 85 ? "ok" : "")}
      ${metric(cov.facts.known, `of ${cov.facts.total} facts established`)}
      ${metric(cov.facts.unknown, "facts not established", cov.facts.unknown ? "warn" : "")}
      ${metric(cov.facts.contradictory, "contradictory", cov.facts.contradictory ? "alert" : "")}
      ${metric(cov.na, "not applicable")}
    </div>

    ${cov.mandatoryOpen.length ? panel("Mandatory items still open", `
      <p class="small muted" style="margin-bottom:12px">
        ISA 240 items cannot be quietly left open. The walkthrough cannot be signed off while one of
        these is open without a documented reason for not obtaining the information.</p>
      ${cov.mandatoryOpen.map((i) => itemRow(i)).join("")}`,
      { sub: "ISA 240 · methodology pack marks these mandatory" }) : ""}

    ${panel("Coverage by sub-process", `
      <div>
        ${subProcesses.map((sp) => {
          const c = st.coverageCounts(sp.items);
          const p = st.subProcessPct(sp);
          const open = c.open + c.partial;
          const isOpen = S.expanded[sp.id];
          return `<div>
            <div class="${cx("cov__row", isOpen && "is-open")}" data-act="toggle-expand" data-id="${esc(sp.id)}">
              <span class="cov__id">${esc(sp.id)}</span>
              <span class="cov__name">${esc(sp.name)}
                ${sp.items.some((i) => i.mandatory) ? `<span class="tiny dim"> · contains mandatory items</span>` : ""}</span>
              <div>${coverageBar(c)}</div>
              <span class="small ${open ? "" : "dim"}">${open ? `${open} to resolve` : "complete"}</span>
              <span class="cov__pct">${p === null ? "n/a" : p + "%"}</span>
            </div>
            ${isOpen ? `<div class="cov__detail">${sp.items.map(itemRow).join("")}</div>` : ""}
          </div>`;
        }).join("")}
      </div>
      <div style="padding:14px 20px">${coverageLegend()}</div>`,
      { flush: true,
        actions: `<span class="tiny dim">Pack <span class="mono">${esc(firm.packName)} v${esc(firm.packVersion)}</span> · ${cov.total} items</span>` })}

    ${note(`<span class="strong">What this number means.</span> Coverage measures the completeness of the
      process <em>understanding</em> against the methodology pack — not the completeness of the audit.
      ${cov.covered} of ${cov.applicable} applicable items are covered; ${cov.na} item is marked not
      applicable with a documented reason.`)}
  </div>`;

  return wsScreen("coverage", body);
}

/* ── J. Generation ───────────────────────────────────────────────────────── */

function fill(text) {
  const cov = st.coverageSummary();
  return text
    .replace("FACTS_KNOWN", cov.facts.known)
    .replace("FACTS_UNKNOWN", cov.facts.unknown + cov.facts.contradictory)
    .replace("RISK_COUNT", st.riskSummary().total)
    .replace("CONTROL_COUNT", st.controlSummary().total)
    .replace("GAP_COUNT", st.controlSummary().gaps)
    .replace("KEY_COUNT", st.controlSummary().proposedKey)
    .replace("RCM_ROWS", st.rcmRows().length)
    .replace("OPEN_COUNT", openItems.length);
}

export function generate() {
  const cov = st.coverageSummary();
  const running = S.generating;
  const done = S.generated;

  const body = `<div class="stack" style="max-width:860px">
    ${!running && !done ? `
      <div class="section-head">
        <div>
          <h2 class="h-sec">Generate the Revenue documentation</h2>
          <p class="lede" style="margin-top:6px">Nine stages run over the evidence base. Seven call a model;
          two are deterministic code. Each stage's output is validated before the next one runs.</p>
        </div>
      </div>
      ${panel("Inputs", `
        <table class="tbl tbl--dense"><tbody>
          <tr><td>Sources</td><td class="r num">6</td></tr>
          <tr><td>Coverage items covered or partially covered</td><td class="r num">${cov.covered + cov.partial} of ${cov.applicable}</td></tr>
          <tr><td>Process facts established</td><td class="r num">${cov.facts.known}</td></tr>
          <tr><td>Methodology pack</td><td class="r mono">${esc(firm.packName)} v${esc(firm.packVersion)}</td></tr>
          <tr><td>Risk library / control library</td><td class="r num">30 / 33 entries</td></tr>
        </tbody></table>`)}
      ${cov.mandatoryOpen.length
        ? note(`<span class="strong">${cov.mandatoryOpen.length} mandatory coverage item is still open.</span>
            Generation will proceed, and the affected sections will be produced with an explicit
            "not obtained" statement rather than an inferred answer.`, "warn")
        : ""}
      <div>${btn("Run the pipeline", "run-pipeline", { variant: "primary", size: "lg" })}</div>
    ` : ""}

    ${running || done ? panel(done ? "Generation complete" : "Generating…", `
      <div class="pipe">
        ${pipeline.map((p, i) => {
          const state = done || i < S.genStage ? "done" : i === S.genStage ? "active" : "";
          const warn = p.warn && (done || i < S.genStage);
          return `<div class="${cx("pipe__stage", state && "is-" + state, warn && "is-warn")}">
            <div class="pipe__dot">${warn ? "!" : state === "done" ? "✓" : state === "active" ? `<span class="spin"></span>` : i + 1}</div>
            <div>
              <div class="pipe__t">${esc(p.name)}</div>
              <div class="pipe__d">${esc(p.desc)}</div>
              ${state === "done" ? `<div class="${cx("pipe__out", warn && "pipe__out--warn")}">${esc(fill(p.out))}</div>` : ""}
            </div>
            <div class="pipe__meta">${esc(p.model)}</div>
          </div>`;
        }).join("")}
      </div>`, { sub: done ? "9 stages · 2 deterministic · 41 narrative blocks produced" : "" }) : ""}

    ${done ? `
      ${note(`<span class="strong">Three statements could not be grounded.</span> The validation stage found
        no source for them. They are in the working paper marked <span class="strong">Needs source</span>
        and cannot be approved until you resolve them. Nothing was dropped silently.`, "warn")}
      <div class="btn-row">
        ${btn("Review the documentation", "nav", { variant: "primary", size: "lg", data: { href: "#/review" } })}
        ${btn("Back to Revenue", "nav", { size: "lg", data: { href: "#/revenue" } })}
      </div>` : ""}
  </div>`;

  return wsScreen("overview", body);
}

/* --- Coverage drawers ------------------------------------------------------ */

export function naDrawer(itemId) {
  const item = st.allItems().find((i) => i.id === itemId);
  return drawer({
    title: `Mark ${itemId} not applicable`,
    sub: esc(item.q),
    body: `${note(`The reason you give becomes part of the documentation. Marking an item not
      applicable removes it from the coverage denominator, so the reason has to stand on its own
      in the file.`, "accent")}
      <label class="field" style="margin-top:18px">
        <span class="lbl">Reason</span>
        <textarea class="textarea" id="na-reason" rows="4"
          placeholder="Why does this coverage item not apply to this entity?"></textarea>
      </label>`,
    foot: `<div class="btn-row">
      ${btn("Mark not applicable", "save-na", { variant: "primary", data: { item: itemId } })}
      ${btn("Cancel", "close-drawer")}</div>`,
  });
}

export function answerDrawer(itemId, factKey) {
  const item = st.allItems().find((i) => i.id === itemId);
  return drawer({
    title: "Record an auditor response",
    sub: `${esc(itemId)} · fact <span class="mono">${esc(factKey)}</span>`,
    body: `<p class="small muted" style="line-height:1.6">${esc(item.q)}</p>
      ${note(`A response recorded here is auditor input, not model output. It is marked as such in
        the provenance index and never requires model grounding — but you remain accountable for it.`)}
      <label class="field" style="margin-top:18px">
        <span class="lbl">What was established, and how</span>
        <textarea class="textarea" id="answer-text" rows="4"
          placeholder="e.g. Confirmed by telephone with I. Molenaar on 19 September 2026 that…"></textarea>
      </label>`,
    foot: `<div class="btn-row">
      ${btn("Record response", "save-answer", { variant: "primary", data: { item: itemId, fact: factKey } })}
      ${btn("Cancel", "close-drawer")}</div>`,
  });
}
