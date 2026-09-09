/* Step 2 — Process interview.

   Not one meeting: the whole input flow. The interview transcript, the client
   questionnaire, the documents and the auditor's own notes all land here and
   feed one coverage model.

   The auditor's question is four words — what do we still not know? The
   default answer is plain English; the 45 items, fact keys, triggers and ISA
   references live one disclosure deeper. */

import { esc, cx, act as btn, row, rows, dot, chip, tag, icon, more, bar, callout,
         link, empty, evidence, dependencies } from "../ui.js";
import { subProcesses } from "../data-model.js";
import { sources, ref, refs, client } from "../data-sources.js";

const SRC_IC = { transcript: "transcript", client_answer: "questionnaire", prior_year: "document",
                 access_log: "system", assurance_report: "document", auditor_note: "note" };
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

/* --- one gap, in the auditor's language, with its actions inline ---------- */

function gapRow(g, i) {
  const editing = S.editing === g.item.id;
  const asked = S.coverage[g.item.id]?.asked;
  const isC = g.kind === "contradiction";

  return `<div class="${cx("aqi", isC ? "aqi--alert" : "aqi--warn")}">
    <div class="aqi__top">
      <span class="aqi__n">${String(i + 1).padStart(2, "0")}</span>
      <span class="aqi__k">${icon(isC ? "contradiction" : "question", 13)}${
        isC ? "Contradiction" : g.mandatory ? "Required area" : "Not established"}</span>
      <span class="aqi__ctx">${esc(g.sub.name)}</span>
    </div>
    <div class="aqi__t">${esc(g.plain)}</div>
    <div class="aqi__why">${isC
      ? "Two sources gave different answers. The documentation cannot say both."
      : `${g.unknown.length === 1 ? "One fact is" : `${g.unknown.length} facts are`} not established${
          asked ? ", and the question is with the client" : ""}.${
          g.mandatory ? " The methodology marks this area required." : ""}`}</div>

    ${editing ? `
      <div class="sec--tight">
        <textarea class="field" id="ans" rows="3"
          placeholder="What did you establish, and how? e.g. Confirmed by telephone with I. Molenaar on 19 September."></textarea>
        <div class="acts sec__note">
          ${btn("Record", "save-answer", { variant: "primary", size: "sm",
            data: { item: g.item.id, fact: g.unknown[0]?.key || "note" } })}
          ${btn("Not applicable instead", "save-na", { size: "sm", data: { item: g.item.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
        </div>
      </div>`
    : `<div class="aqi__ft">
        ${isC
          ? btn("Compare the two answers", "resolve-conflict",
              { variant: "primary", size: "sm", data: { claim: "N6.2" }, ic: "contradiction" })
          : asked ? "" : btn("Ask the client", "ask-client", { size: "sm", data: { item: g.item.id }, ic: "questionnaire" })}
        ${btn("Record what I know", "edit-item", { size: "sm", data: { item: g.item.id } })}
        ${isC ? "" : btn("Not applicable", "edit-item", { variant: "ghost", size: "sm", data: { item: g.item.id } })}
        ${asked ? `<span class="tag tag--quiet">${icon("clock", 12)}with the client</span>` : ""}
      </div>`}
  </div>`;
}

/* --- the methodology layer, behind one disclosure ------------------------- */

function methodology() {
  return `<div class="meth">
    <div class="t-meta" style="margin-bottom:16px">
      Methodology pack <span class="mono">revenue v0.1.0</span> — 12 sub-processes,
      45 coverage items, 10 marked required by ISA 240. Coverage measures completeness of the
      process understanding, not of the audit.
    </div>
    ${subProcesses.map((sp) => {
      const c = st.coverageCounts(sp.items);
      return `<div class="meth__row">
        <div class="row" style="margin-bottom:8px">
          <span class="mono ink4" style="width:36px">${esc(sp.id)}</span>
          <span class="b">${esc(sp.name)}</span>
          <span class="sp"></span>
          <span style="width:120px">${bar([
            { k: "ok", n: c.covered }, { k: "part", n: c.partial }, { k: "open", n: c.open + c.na }])}</span>
        </div>
        ${sp.items.map((item) => {
          const stt = st.covState(item);
          const facts = st.covFacts(item);
          return `<div style="padding:8px 0 8px 36px">
            <div class="row row--base" style="gap:10px">
              <span class="mono ink4" style="width:44px">${esc(item.id)}</span>
              <span style="flex:1" class="ink2">${esc(item.q)}</span>
              ${item.mandatory ? tag("required", "quiet") : ""}
              <span class="t-meta" style="width:108px;text-align:right">${
                stt === "covered" ? "established" : stt === "partial" ? "partial"
                : stt === "na" ? "not applicable" : "open"}</span>
            </div>
            ${facts.length ? `<div class="chipline" style="margin:8px 0 0 54px">
              ${facts.map((f) => chip(f.key, f.status === "known" ? "ok"
                : f.status === "contradictory" ? "alert"
                : f.status === "assumed" ? "warn" : "open")).join("")}
            </div>` : ""}
            ${st.covReason(item) ? `<div class="t-meta" style="margin:7px 0 0 54px;max-width:64ch">
              Reason on file: ${esc(st.covReason(item))}</div>` : ""}
          </div>`;
        }).join("")}
      </div>`;
    }).join("")}
  </div>`;
}

/* --- screen ---------------------------------------------------------------- */

export function interview() {
  if (!S.prepared) {
    return screen("interview", `
      ${empty("Preparation has not been confirmed",
        "Step one settles the scope, the participants and what is carried in from planning. The interview starts from that, so it is not asked twice.")}
      <div style="text-align:center;margin-top:-40px">
        ${btn("Go to Prepare", "nav", { variant: "go", data: { href: "#/prepare" } })}
      </div>`);
  }
  const cov = st.coverageSummary();
  const gaps = st.coverageGaps();
  const settled = st.coverageSettled();
  const na = st.allItems().filter((i) => st.covState(i) === "na");
  const sf = st.sessionFacts();

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Process interview</h1>
          <p class="t-lede">
            Everything that tells us how Revenue works arrives here — the interview itself, the
            client questionnaire, the documents and the auditor's own notes.
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n">${cov.pct}<span class="ink4">%</span></span>
            <span class="tally__l">understood</span></div>
          <div><span class="tally__n" style="color:${gaps.length ? "var(--warn)" : "var(--ok)"}">${gaps.length}</span>
            <span class="tally__l">need${gaps.length === 1 ? "s" : ""} clarification</span></div>
        </div>
      </div>
      <div class="sec--tight" style="max-width:420px">${bar([
        { k: "ok", n: cov.covered }, { k: "part", n: cov.partial }, { k: "open", n: cov.open }])}
        <p class="t-meta sec__note">${cov.covered} of ${cov.applicable} areas established from
          ${Object.keys(sources).length} sources · ${cov.partial} partial · ${cov.open} open</p>
      </div>
    </div>

    ${gaps.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">What we still need to understand</h2></div>
        <p class="t-sub sec__h measure">Resolving any of these updates coverage immediately.</p>
        <div class="aq">${gaps.map(gapRow).join("")}</div>
      </section>` : `
      <section class="sec--loose">
        ${callout(`<b>Nothing outstanding.</b> Every applicable area has been established.`, "ok")}
      </section>`}

    ${sf.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Established since the draft</h2></div>
        <p class="t-sub sec__h measure">
          Facts settled after the process understanding was drafted, each with the source it came
          from. Nothing here is an internal override — it is evidence, and anything that later
          rests on it cites this.</p>
        <div class="gap-s">
          ${sf.map((x) => `<div class="card card--ok">
            <div class="card__hd">
              <span class="rw__lead">${icon("check", 17)}</span>
              <span class="sp">
                <span class="card__t">${esc(x.value)}</span>
                <span class="card__d">${esc(x.item ? x.item.plain || x.item.q : x.itemId)}</span>
              </span>
              ${tag(x.via === "client_questionnaire" ? "client questionnaire" : "auditor", "quiet",
                x.via === "client_questionnaire" ? "questionnaire" : "note")}
            </div>
            ${x.refs && x.refs.length ? evidence(refs(x.refs)) : ""}
          </div>`).join("")}
        </div>
      </section>` : ""}

    ${settled.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-eyebrow">Understood</h2></div>
        <p class="inline-list">${settled.map((s) => `<b>${esc(s.name)}</b>`).join(" · ")}</p>
      </section>` : ""}

    ${na.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-eyebrow">Not applicable</h2></div>
        ${na.map((i) => `<p class="t-sub measure"><span class="b ink">Returns</span> — ${esc(st.covReason(i))}</p>`).join("")}
      </section>` : ""}

    <section class="sec--loose">
      ${more("meth", "Show methodology", methodology(), S.disclosed.meth)}
    </section>

    <hr class="rule">
    <section class="sec">
      <div class="sec__h"><h2 class="t-h">Input to this step</h2></div>
      <p class="t-sub sec__h measure">
        Step two is the whole input flow, not one meeting. Each route below feeds the same coverage
        model, and each statement keeps the source it came from.</p>
      ${rows(Object.values(sources).map((s) => row({
        lead: icon(SRC_IC[s.kind] || "document", 17),
        title: esc(s.name),
        detail: esc(s.detail),
        side: `<span class="t-meta">${esc(s.ingest.split(" · ").slice(1).join(" · ") || "indexed")}</span>`,
      })).join(""))}
      <div class="acts sec__h" style="margin-top:18px">
        ${btn("Import a transcript", "mock", { ic: "transcript" })}
        ${btn("Upload a document", "mock", { ic: "document" })}
        ${btn("Open the client questionnaire", "nav", { ic: "questionnaire", data: { href: "#/questionnaire" } })}
        ${btn("Live interview — concept", "nav", { variant: "ghost", ic: "people", data: { href: "#/cockpit" } })}
      </div>
    </section>

    ${!st.S.generated ? `
      <hr class="rule">
      <section class="sec">
        <h2 class="t-h">Ready to draft</h2>
        <p class="t-sub sec__h measure">
          ${cov.mandatoryOpen.length
            ? `${cov.mandatoryOpen.length} required areas are still open. The draft will say so explicitly rather than infer an answer.`
            : "Coverage is sufficient and the required areas are addressed."}
        </p>
        ${btn("Draft the process understanding", "nav", { variant: "primary", size: "lg", ic: "arrow", data: { href: "#/understanding" } })}
        <p class="t-meta sec__note measure">
          Drafting does not complete this step. The interview stays open — a questionnaire answer or a
          second conversation still lands here, and the draft is redone from what is then known.</p>
      </section>` : ""}
  `;

  return screen("interview", body);
}
