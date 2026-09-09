/* RESOLVE — everything still open, ordered by what it blocks. */

import { esc, cx, act as btn, row, rows, dot, chip, tag, icon, more, empty, callout,
         evidence, card, dependencies } from "../ui.js";
import { ref, refs } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

const KIND = { question: "Question", evidence: "Evidence", contradiction: "Contradiction" };

const DESTINATIONS = ["Final audit", "Risk analysis", "Next year's interim", "Group audit team"];

const KIND_IC = { question: "question", evidence: "evidence", contradiction: "contradiction" };

function itemRow(i) {
  const s = st.itemState(i);
  const carried = s === "carried_forward";
  const done = ["resolved", "dismissed"].includes(s) || carried;
  const blocking = i.blocks && i.blocks.length;
  const editing = S.editing === i.id;
  const carrying = S.editing === `carry-item:${i.id}`;
  const carry = st.itemCarry(i);
  const ev = st.itemEvidence(i);

  const badge = carried ? tag("carried forward", "warn", "clock")
    : done ? tag(s === "resolved" ? "resolved" : "dismissed", "ok", "check")
    : s === "sent" ? tag("with the client", "quiet", "questionnaire")
    : tag(KIND[i.kind], i.kind === "contradiction" ? "alert" : "quiet", KIND_IC[i.kind]);

  return `<div class="${cx("card", !done && i.kind === "contradiction" && "card--alert",
      !done && blocking && i.kind !== "contradiction" && "card--warn",
      done && "card--quiet")}">
    <div class="card__hd">
      <span class="rw__lead">${icon(KIND_IC[i.kind] || "question", 18)}</span>
      <span class="sp">
        <span class="card__t">${esc(i.title)}</span>
        <span class="card__d">${esc(i.detail)}</span>
      </span>
      ${badge}
    </div>

    <div class="t-meta">
      ${i.origin === "deterministic_trigger"
        ? `Raised by methodology rule <span class="mono">${esc(i.trigger || i.coverage)}</span>`
        : i.fromQuestionnaire ? "Raised by the client's response"
        : "Proposed from what the sources said"}
      ${i.owner && !done ? ` · ${esc(i.owner)}` : ""}
    </div>

    ${i.blocks && i.blocks.length ? dependencies(i.blocks.map((b) => ({
      icon: b.startsWith("C-") ? "control" : b.startsWith("G-") ? "finding" : "document",
      name: b, state: done ? "cleared" : "cannot be concluded", clear: done })),
      done ? "This released" : "This is blocking", done) : ""}

    ${s === "resolved" && ev.length ? `
      <div class="t-meta sec__note"><b class="ink2">Settled by the client's answer.</b>
        It is on the file as evidence, and anything that rests on it cites this.</div>
      ${evidence(refs(ev))}` : ""}

    ${carried && carry ? `<div class="sec__note">
      <div class="t-meta"><b class="ink2">Carried to ${esc(carry.destination)}.</b> ${esc(carry.reason)}</div>
      <div class="acts sec__note">
        ${btn("Bring it back", "set-item", { variant: "ghost", size: "sm", data: { id: i.id, s: "open" } })}
      </div>
    </div>` : ""}

    ${!done && !editing && !carrying ? `<div class="card__ft">
      ${i.kind === "contradiction"
        ? btn("Compare the two answers", "resolve-conflict", { variant: "primary", size: "sm", data: { claim: "N6.2" } })
        : s === "sent" ? btn("Record the reply", "edit-item-o", { variant: "primary", size: "sm", data: { id: i.id } })
        : btn(i.kind === "evidence" ? "Request it" : "Ask the client", "set-item",
            { variant: "primary", size: "sm", data: { id: i.id, s: "sent" }, ic: "questionnaire" })}
      ${i.kind === "contradiction" ? "" : btn("Resolve", "set-item", { size: "sm", data: { id: i.id, s: "resolved" } })}
      ${btn("Carry forward", "carry-item-open", { variant: "ghost", size: "sm", data: { id: i.id } })}
    </div>` : ""}

    ${editing ? `<div class="sec__note">
      <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans)"
        placeholder="What was established, or why is this being carried forward?"></textarea>
      <div class="acts sec__note">
        ${btn("Record and close", "set-item", { variant: "primary", size: "sm", data: { id: i.id, s: "resolved" } })}
        ${btn("Carry forward instead", "carry-item-open", { size: "sm", data: { id: i.id } })}
        ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
      </div>
    </div>` : ""}

    ${carrying ? `<div class="sec__note">
      <div class="t-eyebrow rail__h">Carry forward</div>
      <p class="t-meta sec__note measure">Carrying forward is a decision, not a way of clearing the
      list. It needs somewhere to go and a reason someone else can act on.</p>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="carry-dest">Where does it go</label>
        <select class="field" id="carry-dest">
          ${DESTINATIONS.map((dst) => `<option value="${esc(dst)}">${esc(dst)}</option>`).join("")}
        </select>
      </div>
      <div class="fgroup">
        <label class="t-eyebrow flabel" for="ans">Why it could not be settled during interim</label>
        <textarea class="field" id="ans" rows="3" style="font:15px/1.6 var(--sans)"
          placeholder="What was attempted, what is still missing, and what the receiving phase has to do."></textarea>
      </div>
      <div class="acts sec__note">
        ${btn("Carry forward", "carry-item", { variant: "primary", size: "sm", data: { id: i.id } })}
        ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
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
          <h1 class="t-display">Open matters</h1>
          <p class="t-lede">
            ${oi.open ? `What is stopping this process from moving forward. ${blocking.length} of
              these are holding up a conclusion somewhere else.`
              : "Nothing is outstanding."}
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n" style="color:${blocking.length ? "var(--danger)" : "var(--ink-4)"}">${blocking.length}</span>
            <span class="tally__l">blocking</span></div>
          <div><span class="tally__n">${oi.sent}</span><span class="tally__l">with the client</span></div>
          <div><span class="tally__n">${carried.length}</span><span class="tally__l">carried forward</span></div>
        </div>
      </div>
    </div>

    ${blocking.length ? `
      <section class="sec">
        <div class="sec__h"><h2 class="t-h">Blocking completion</h2></div>
        <p class="t-sub sec__h measure">A statement, a risk signal or a control cannot be concluded
        until these are settled.</p>
        <div class="gap-s">${blocking.map(itemRow).join("")}</div>
      </section>` : ""}

    ${rest.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Everything else</h2></div>
        <div class="gap-s">${rest.map(itemRow).join("")}</div>
      </section>` : ""}

    ${!live.length ? empty("Nothing open",
      carried.length ? "Everything has been settled or carried forward with a destination and a reason."
        : "Every question, evidence request and contradiction has been settled.") : ""}

    ${carried.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Carried forward</h2></div>
        <p class="t-sub sec__h measure">
          Not closed — handed to a later phase, with a reason. These appear in what Revenue passes on
          at completion.</p>
        <div class="gap-s">${carried.map(itemRow).join("")}</div>
      </section>` : ""}

    ${done.length ? `
      <section class="sec--loose">
        ${more("doneitems", `Show ${done.length} settled`,
          `<div class="gap-s">${done.map(itemRow).join("")}</div>`, S.disclosed.doneitems)}
      </section>` : ""}

  `;

  return screen(null, body);
}
