/* RESOLVE — everything still open, ordered by what it blocks. */

import { esc, cx, act as btn, row, dot, chip, more, empty, callout, evidence } from "../ui.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

const KIND = { question: "Question", evidence: "Evidence", contradiction: "Contradiction" };

const DESTINATIONS = [
  "Final audit",
  "Risk analysis",
  "Next year's interim",
  "Group audit team",
];

function itemRow(i) {
  const s = st.itemState(i);
  const carried = s === "carried_forward";
  const done = ["resolved", "dismissed"].includes(s) || carried;
  const blocking = i.blocks && i.blocks.length;
  const editing = S.editing === i.id;
  const carrying = S.editing === `carry-item:${i.id}`;
  const carry = st.itemCarry(i);

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
        ${carried ? `<span class="state"><i class="dot dot--warn"></i>Carried forward</span>`
          : done ? `<span class="state state--ok">${s === "resolved" ? "Resolved" : "Dismissed"}</span>`
          : s === "sent" ? `<span class="state">With the client</span><div class="t-meta" style="margin-top:2px">${esc(i.owner)}</div>`
          : `<span class="t-meta">${esc(KIND[i.kind])}</span>`}
      </span>
    </div>

    ${carried && carry ? `<div style="margin:10px 0 2px 37px;max-width:74ch">
      <div class="t-meta"><b style="color:var(--ink-2)">Carried to ${esc(carry.destination)}.</b>
        ${esc(carry.reason)}</div>
      <div class="acts" style="margin-top:8px">
        ${btn("Bring it back", "set-item", { variant: "plain", size: "sm", data: { id: i.id, s: "open" } })}
      </div>
    </div>` : ""}

    ${!done && !editing && !carrying ? `<div class="acts" style="margin:11px 0 2px 37px">
      ${i.kind === "contradiction"
        ? btn("Compare the two answers", "resolve-conflict", { variant: "go", size: "sm", data: { claim: "N6.2" } })
        : s === "sent" ? btn("Record the reply", "edit-item-o", { variant: "go", size: "sm", data: { id: i.id } })
        : btn(i.kind === "evidence" ? "Request it" : "Ask the client", "set-item",
            { variant: "go", size: "sm", data: { id: i.id, s: "sent" } })}
      ${i.kind === "contradiction" ? "" : btn("Resolve", "set-item", { size: "sm", data: { id: i.id, s: "resolved" } })}
      ${btn("Carry forward", "carry-item-open", { variant: "plain", size: "sm", data: { id: i.id } })}
    </div>` : ""}

    ${carrying ? `<div style="margin:14px 0 4px 37px;max-width:640px">
      <div class="t-eyebrow" style="margin-bottom:8px">Carry forward</div>
      <p class="t-meta" style="margin-bottom:10px">Carrying forward is a decision, not a way of
      clearing the list. It needs somewhere to go and a reason someone else can act on.</p>
      <label class="t-eyebrow" for="carry-dest">Where does it go</label>
      <select class="field" id="carry-dest" style="margin:6px 0 12px">
        ${DESTINATIONS.map((dst) => `<option value="${esc(dst)}">${esc(dst)}</option>`).join("")}
      </select>
      <label class="t-eyebrow" for="ans">Why it could not be settled during interim</label>
      <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans);margin-top:6px"
        placeholder="What was attempted, what is still missing, and what the receiving phase has to do."></textarea>
      <div class="acts" style="margin-top:10px">
        ${btn("Carry forward", "carry-item", { variant: "go", size: "sm", data: { id: i.id } })}
        ${btn("Cancel", "cancel-edit", { variant: "plain", size: "sm" })}
      </div>
    </div>` : ""}

    ${editing ? `<div style="margin:14px 0 4px 37px;max-width:600px">
      <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans)"
        placeholder="What was established, or why is this being carried forward?"></textarea>
      <div class="acts" style="margin-top:10px">
        ${btn("Record and close", "set-item", { variant: "go", size: "sm", data: { id: i.id, s: "resolved" } })}
        ${btn("Carry forward instead", "carry-item-open", { size: "sm", data: { id: i.id } })}
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
  const all = st.allOpenItems();
  const carried = all.filter((i) => st.itemState(i) === "carried_forward");
  const done = all.filter((i) => ["resolved", "dismissed"].includes(st.itemState(i)));

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

    ${!live.length ? empty("Nothing open",
      carried.length ? "Everything has been settled or carried forward with a destination and a reason."
        : "Every question, evidence request and contradiction has been settled.") : ""}

    ${carried.length ? `
      <section style="margin-top:44px">
        <h2 class="t-h" style="margin-bottom:4px">Carried forward</h2>
        <p class="t-meta" style="margin-bottom:16px">
          Not closed — handed to a later phase, with a reason. These appear in what Revenue passes on
          at completion.</p>
        <div class="rows">${carried.map(itemRow).join("")}</div>
      </section>` : ""}

    ${done.length ? `
      <section style="margin-top:44px">
        ${more("doneitems", `Show ${done.length} settled`, `<div class="rows">${done.map(itemRow).join("")}</div>`, S.disclosed.doneitems)}
      </section>` : ""}

  `;

  return screen(null, body);
}
