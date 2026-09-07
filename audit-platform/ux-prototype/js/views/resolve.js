/* RESOLVE — everything still open, ordered by what it blocks. */

import { esc, cx, act as btn, row, dot, chip, more, empty, callout, evidence } from "../ui.js";
import { openItems, gaps, risks } from "../data-model.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

const KIND = { question: "Question", evidence: "Evidence", contradiction: "Contradiction" };

function itemRow(i) {
  const s = st.itemState(i);
  const done = ["resolved", "dismissed"].includes(s);
  const blocking = i.blocks && i.blocks.length;
  const editing = S.editing === i.id;

  return `<div class="${cx("rw", !done && i.kind === "contradiction" && "rw--conflict",
      !done && blocking && i.kind !== "contradiction" && "rw--attn")}"
    style="display:block;${done ? "opacity:.5" : ""}">
    <div class="row row--top" style="gap:20px">
      <span class="rw__lead" style="padding-top:5px">
        ${dot(done ? "ok" : i.kind === "contradiction" ? "alert" : blocking ? "warn" : "open")}</span>
      <span class="rw__main">
        <span class="rw__t">${esc(i.title)}</span>
        <span class="rw__d">${esc(i.detail)}</span>
        <span class="rw__d" style="margin-top:6px">
          ${i.origin === "deterministic_trigger"
            ? `Raised by methodology rule <span class="mono">${esc(i.trigger || i.coverage)}</span>`
            : `Proposed from what the sources said`}
          ${blocking ? ` · blocks <span class="mono">${esc(i.blocks.join(", "))}</span>` : ""}
        </span>
      </span>
      <span class="rw__side">
        ${done ? `<span class="state state--ok">${s === "resolved" ? "Resolved" : "Dismissed"}</span>`
          : s === "sent" ? `<span class="state">With the client</span><div class="t-meta" style="margin-top:2px">${esc(i.owner)}</div>`
          : `<span class="t-meta">${esc(KIND[i.kind])}</span>`}
      </span>
    </div>

    ${!done && !editing ? `<div class="acts" style="margin:11px 0 2px 37px">
      ${i.kind === "contradiction"
        ? btn("Compare the two answers", "resolve-conflict", { variant: "go", size: "sm", data: { claim: "N6.2" } })
        : s === "sent" ? btn("Record the reply", "edit-item-o", { variant: "go", size: "sm", data: { id: i.id } })
        : btn(i.kind === "evidence" ? "Request it" : "Ask the client", "set-item",
            { variant: "go", size: "sm", data: { id: i.id, s: "sent" } })}
      ${i.kind === "contradiction" ? "" : btn("Resolve", "set-item", { size: "sm", data: { id: i.id, s: "resolved" } })}
      ${btn("Carry forward", "edit-item-o", { variant: "plain", size: "sm", data: { id: i.id } })}
    </div>` : ""}

    ${editing ? `<div style="margin:14px 0 4px 37px;max-width:600px">
      <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans)"
        placeholder="What was established, or why is this being carried forward?"></textarea>
      <div class="acts" style="margin-top:10px">
        ${btn("Record and close", "set-item", { variant: "go", size: "sm", data: { id: i.id, s: "resolved" } })}
        ${btn("Carry to final", "set-item", { size: "sm", data: { id: i.id, s: "dismissed" } })}
        ${btn("Cancel", "cancel-edit", { variant: "plain", size: "sm" })}
      </div>
    </div>` : ""}
  </div>`;
}

export function resolve() {
  const oi = st.openItemSummary();
  const live = oi.live;
  const blocking = live.filter((i) => i.blocks && i.blocks.length);
  const rest = live.filter((i) => !(i.blocks && i.blocks.length));
  const done = openItems.filter((i) => ["resolved", "dismissed"].includes(st.itemState(i)));

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Open items</h1>
          <p class="t-lede" style="margin-top:10px">
            ${oi.open ? `${blocking.length} of these are holding up a conclusion somewhere else.`
              : "Nothing is outstanding."}
          </p>
        </div>
        <div style="text-align:right;padding-top:4px">
          <div class="t-num">${oi.open}</div>
          <div class="t-meta">open</div>
        </div>
      </div>
    </div>

    ${blocking.length ? `
      <section style="margin-top:40px">
        <h2 class="t-h" style="margin-bottom:4px">Blocking something</h2>
        <p class="t-meta" style="margin-bottom:16px">A statement, a risk or a control cannot be concluded until these are settled.</p>
        <div class="rows">${blocking.map(itemRow).join("")}</div>
      </section>` : ""}

    ${rest.length ? `
      <section style="margin-top:44px">
        <h2 class="t-h" style="margin-bottom:16px">Everything else</h2>
        <div class="rows">${rest.map(itemRow).join("")}</div>
      </section>` : ""}

    ${!live.length ? empty("Nothing open", "Every question, evidence request and contradiction has been settled.") : ""}

    ${done.length ? `
      <section style="margin-top:44px">
        ${more("doneitems", `Show ${done.length} settled`, `<div class="rows">${done.map(itemRow).join("")}</div>`, S.disclosed.doneitems)}
      </section>` : ""}

    <section style="margin-top:52px;border-top:1px solid var(--line);padding-top:32px">
      <h2 class="t-h" style="margin-bottom:4px">Control gaps</h2>
      <p class="t-meta" style="margin-bottom:16px">
        Raw material for the ISA 265 communication to management. Severity is your judgement.</p>
      <div class="rows">
        ${gaps.map((g) => {
          const r = risks.find((x) => x.id === g.risk);
          return `<div class="rw" style="display:block">
            <div class="row row--top" style="gap:20px">
              <span class="rw__lead" style="padding-top:5px">${dot(g.severity === "deficiency" ? "warn" : "alert")}</span>
              <span class="rw__main">
                <span class="rw__t">${esc(g.desc)}</span>
                <span class="rw__d" style="margin-top:5px">${esc(g.impact)}</span>
              </span>
              <span class="rw__side"><span class="t-meta">${g.severity === "deficiency"
                ? "Deficiency" : "Significant — candidate"}</span></span>
            </div>
            ${more("gap" + g.id, "Suggested remediation", `<div class="meth" style="margin-left:37px">
              <p style="color:var(--ink-2);line-height:1.65">${esc(g.remediation)}</p>
              <p class="t-meta" style="margin-top:10px">Related risk: ${esc(r ? r.title : g.risk)}</p>
            </div>`, S.disclosed["gap" + g.id])}
          </div>`;
        }).join("")}
      </div>
    </section>
  `;

  return screen("resolve", body);
}
