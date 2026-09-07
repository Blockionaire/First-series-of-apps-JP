/* UNDERSTAND — what we know and what we still don't.

   The auditor's question is four words. The default answer is plain English;
   the 45 items, fact keys, triggers and ISA references live one disclosure
   deeper. */

import { esc, cx, act as btn, row, dot, chip, more, bar, callout, link } from "../ui.js";
import { subProcesses } from "../data-model.js";
import { sources, ref, client } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

/* --- one gap, in the auditor's language, with its actions inline ---------- */

function gapRow(g) {
  const editing = S.editing === g.item.id;
  const asked = S.coverage[g.item.id]?.asked;
  const isC = g.kind === "contradiction";

  return `<div class="${cx("rw", isC ? "rw--conflict" : "rw--attn")}" style="display:block">
    <div class="row row--top" style="gap:20px">
      <span class="rw__lead" style="padding-top:5px">${dot(isC ? "alert" : "warn")}</span>
      <span class="rw__main">
        <span class="rw__t">${esc(g.plain)}</span>
        <span class="rw__d">${esc(g.sub.name)}${g.mandatory ? " · required area" : ""}${
          asked ? " · asked, awaiting a reply" : ""}</span>
      </span>
      <span class="rw__side">${isC ? `<span class="state state--alert">two answers</span>`
        : `<span class="t-meta">${g.unknown.length} to establish</span>`}</span>
    </div>

    ${editing ? `
      <div style="margin:14px 0 4px 37px;max-width:600px">
        <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans)"
          placeholder="What did you establish, and how? e.g. Confirmed by telephone with I. Molenaar on 19 September."></textarea>
        <div class="acts" style="margin-top:10px">
          ${btn("Record", "save-answer", { variant: "go", size: "sm", data: { item: g.item.id, fact: g.unknown[0]?.key || "note" } })}
          ${btn("Not applicable instead", "save-na", { size: "sm", data: { item: g.item.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "plain", size: "sm" })}
        </div>
      </div>`
    : `<div class="acts" style="margin:11px 0 2px 37px">
        ${isC
          ? btn("Compare the two answers", "resolve-conflict", { variant: "go", size: "sm", data: { claim: "N6.2" } })
          : asked ? "" : btn("Ask the client", "ask-client", { size: "sm", data: { item: g.item.id } })}
        ${btn("Record what I know", "edit-item", { size: "sm", data: { item: g.item.id } })}
        ${isC ? "" : btn("Not applicable", "edit-item", { variant: "plain", size: "sm", data: { item: g.item.id } })}
      </div>`}
  </div>`;
}

/* --- the methodology layer, behind one disclosure ------------------------- */

function methodology() {
  return `<div class="meth">
    <div class="t-meta" style="margin-bottom:14px">
      Methodology pack <span class="mono">revenue v0.1.0</span> — 12 sub-processes,
      45 coverage items, 10 marked required by ISA 240. Coverage measures completeness of the
      process understanding, not of the audit.
    </div>
    ${subProcesses.map((sp) => {
      const c = st.coverageCounts(sp.items);
      return `<div style="padding:14px 0;border-top:1px solid var(--line)">
        <div class="row" style="margin-bottom:8px">
          <span class="mono" style="color:var(--ink-4);width:34px">${esc(sp.id)}</span>
          <span class="b">${esc(sp.name)}</span>
          <span class="sp"></span>
          <span style="width:110px">${bar([
            { k: "ok", n: c.covered }, { k: "part", n: c.partial }, { k: "open", n: c.open + c.na }])}</span>
        </div>
        ${sp.items.map((item) => {
          const stt = st.covState(item);
          const facts = st.covFacts(item);
          return `<div style="padding:7px 0 7px 34px">
            <div class="row" style="align-items:baseline;gap:10px">
              <span class="mono" style="color:var(--ink-4);width:42px">${esc(item.id)}</span>
              <span style="flex:1;color:var(--ink-2)">${esc(item.q)}</span>
              ${item.mandatory ? `<span class="chip">required</span>` : ""}
              <span class="t-meta" style="width:104px;text-align:right">${
                stt === "covered" ? "established" : stt === "partial" ? "partial"
                : stt === "na" ? "not applicable" : "open"}</span>
            </div>
            ${facts.length ? `<div class="chipline" style="margin:6px 0 0 52px">
              ${facts.map((f) => chip(f.key, f.status === "known" ? "ok"
                : f.status === "contradictory" ? "alert"
                : f.status === "assumed" ? "warn" : "open")).join("")}
            </div>` : ""}
            ${st.covReason(item) ? `<div class="t-meta" style="margin:6px 0 0 52px;max-width:64ch">
              Reason on file: ${esc(st.covReason(item))}</div>` : ""}
          </div>`;
        }).join("")}
      </div>`;
    }).join("")}
  </div>`;
}

/* --- screen ---------------------------------------------------------------- */

export function understand() {
  const cov = st.coverageSummary();
  const gaps = st.coverageGaps();
  const settled = st.coverageSettled();
  const na = st.allItems().filter((i) => st.covState(i) === "na");

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Revenue understanding</h1>
          <p class="t-lede" style="margin-top:10px">
            ${cov.covered} of ${cov.applicable} areas established from ${Object.keys(sources).length} sources.
            ${gaps.length ? `${gaps.length} still need clarification.` : "Nothing outstanding."}
          </p>
        </div>
        <div style="text-align:right;padding-top:4px">
          <div class="t-num">${cov.pct}%</div>
          <div class="t-meta">understood</div>
        </div>
      </div>
      <div style="margin-top:22px;max-width:340px">${bar([
        { k: "ok", n: cov.covered }, { k: "part", n: cov.partial }, { k: "open", n: cov.open }])}</div>
    </div>

    ${gaps.length ? `
      <section style="margin-top:44px">
        <h2 class="t-h" style="margin-bottom:4px">Needs clarification</h2>
        <p class="t-meta" style="margin-bottom:16px">Resolving any of these updates coverage immediately.</p>
        <div class="rows">${gaps.map(gapRow).join("")}</div>
      </section>` : `
      <section style="margin-top:44px">
        <h2 class="t-h">Nothing outstanding</h2>
        <p class="t-sub" style="margin-top:6px">Every applicable area has been established.</p>
      </section>`}

    ${settled.length ? `
      <section style="margin-top:48px">
        <h2 class="t-h" style="margin-bottom:10px">Understood</h2>
        <p class="inline-list">${settled.map((s) => `<b>${esc(s.name)}</b>`).join(" · ")}</p>
      </section>` : ""}

    ${na.length ? `
      <section style="margin-top:44px">
        <h2 class="t-h" style="margin-bottom:10px">Not applicable</h2>
        ${na.map((i) => `<p class="t-sub" style="max-width:66ch">
          <span class="b" style="color:var(--ink)">Returns</span> — ${esc(st.covReason(i))}</p>`).join("")}
      </section>` : ""}

    <section style="margin-top:44px">
      ${more("meth", "Show methodology", methodology(), S.disclosed.meth)}
    </section>

    <section style="margin-top:56px;border-top:1px solid var(--line);padding-top:32px">
      <h2 class="t-h" style="margin-bottom:14px">Where this came from</h2>
      <div class="rows">
        ${Object.values(sources).map((s) => row({
          lead: dot("ok"),
          title: esc(s.name),
          detail: esc(s.detail),
          side: `<span class="t-meta">${esc(s.ingest.split(" · ").slice(1).join(" · ") || "indexed")}</span>`,
        })).join("")}
      </div>
      <div class="acts" style="margin-top:18px">
        ${btn("Import a transcript", "mock")}
        ${btn("Send a questionnaire", "nav", { data: { href: "#/questionnaire" } })}
        ${btn("Record a walkthrough", "nav", { data: { href: "#/cockpit" } })}
      </div>
    </section>

    ${!st.S.generated ? `
      <section style="margin-top:56px;border-top:1px solid var(--line);padding-top:32px">
        <h2 class="t-h">Ready to draft</h2>
        <p class="t-sub" style="margin:6px 0 18px;max-width:62ch">
          ${cov.mandatoryOpen.length
            ? `${cov.mandatoryOpen.length} required areas are still open. The draft will say so explicitly rather than infer an answer.`
            : "Coverage is sufficient and the required areas are addressed."}
        </p>
        ${btn("Draft the documentation", "nav", { variant: "go", size: "lg", data: { href: "#/review" } })}
      </section>` : ""}
  `;

  return screen("understand", body);
}
