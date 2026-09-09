/* The live walkthrough cockpit — a future-state concept, marked as one.
   No audio, no speech recognition, no real-time model: a scripted replay. */

import { esc, cx, act as btn, callout, bar, icon, tag } from "../ui.js";
import { transcript } from "../data-sources.js";
import { subProcesses } from "../data-model.js";
import * as st from "../state.js";
import { header } from "./shell.js";

const S = st.S;

const CUES = [
  { after: 3, k: "Ask this next", p: "hi", t: "How would you know if an order a customer sent never reached the system?",
    w: "Order entry · nothing yet establishes how complete order capture is" },
  { after: 5, k: "Ask this next", p: "hi", t: "When someone overrides the price, is that approved or reviewed anywhere?",
    w: "Methodology rule R2.2.T2 · who can override is stated, what happens next is not" },
  { after: 7, k: "Noticed", p: "md", t: "Unauthorised price overrides",
    w: "\"Sales can change the line price on an order\" · 09:40" },
  { after: 8, k: "Worth requesting", p: "", t: "The price override report — its configuration and a month of output",
    w: "Nothing could be relied on without seeing what it captures" },
  { after: 10, k: "Noticed", p: "", t: "Discount block above twelve per cent",
    w: "\"That is a hard block in the system\" · 11:05" },
  { after: 11, k: "Conflict", p: "hi", t: "This contradicts the commercial director's questionnaire answer",
    w: "He said he can raise a credit limit by up to EUR 50,000 himself" },
  { after: 12, k: "Ask this next", p: "hi", t: "Does anyone check the despatch file from Van Dijk is complete?",
    w: "Their assurance report names this as the user entity's own control" },
];

export function cockpit() {
  const turn = S.cockpitTurn;
  const shown = transcript.slice(0, turn);
  const cues = CUES.filter((c) => c.after <= turn).reverse();

  return `${header()}
  <div class="callout callout--future" style="border-radius:0;margin:0;padding:12px 24px;box-shadow:none;border-bottom:1px solid var(--line)">
    <b>Future concept.</b> Not part of the current build. No audio, no speech recognition and no
    real-time model — the transcript below is a scripted replay. This is where the product goes once
    the engine is proven, not where it starts.
  </div>

  <div class="hdr" style="height:52px">
    <span class="state state--alert"><i class="dot dot--alert"></i>Recording · 11:24</span>
    <span class="t-meta">R. Timmermans, financial controller</span>
    <span class="sp"></span>
    ${btn(S.cockpitPlaying ? "Pause" : "Play", "cockpit-play",
      { size: "sm", variant: S.cockpitPlaying ? "" : "primary" })}
    ${btn("Next turn", "cockpit-next", { size: "sm" })}
    ${btn("End", "nav", { size: "sm", variant: "ghost", data: { href: "#/interview" } })}
  </div>

  <div class="ck">
    <div class="ck__main">
      <div class="ck__conv"><div class="ck__conv-in">
        ${shown.map((s, i) => `<div class="turn ${i === shown.length - 1 ? "is-new" : ""}">
          <div class="turn__w"><b>${esc(s.who)}</b> · ${esc(s.t)}</div>
          <div class="turn__x">${esc(s.text)}</div>
        </div>`).join("")}
        ${turn < 14 ? `<div class="turn__x ink5">…</div>` : ""}
      </div></div>
    </div>

    <div class="ck__side">
      <div class="ck__sh">
        <div class="t-eyebrow">Understanding, live</div>
      </div>
      <div class="ck__sb">
        ${subProcesses.slice(0, 8).map((sp, idx) => {
          const p = Math.max(0, Math.min(100, turn * 14 - idx * 16 + 20));
          return `<div class="covrow" style="${p ? "" : "opacity:.4"}">
            <span class="covrow__n">${esc(sp.name)}</span>
            <span class="covrow__b">${p ? bar([{ k: "ok", n: p }, { k: "open", n: 100 - p }]) : ""}</span>
            <span class="covrow__p">${p ? p + "%" : "—"}</span>
          </div>`;
        }).join("")}

        <div class="t-eyebrow rail__h" style="margin-top:26px">Suggestions</div>
        ${cues.length ? cues.map((c) => `<div class="${cx("cue", c.p === "hi" && "cue--hi", c.p === "md" && "cue--md")}">
          <div class="cue__k">${icon(c.k === "Conflict" ? "contradiction" : c.k === "Noticed" ? "finding"
            : c.k === "Worth requesting" ? "evidence" : "question", 12)}${esc(c.k)}</div>
          <div class="cue__t">${esc(c.t)}</div>
          <div class="cue__w">${esc(c.w)}</div>
          <div class="acts" style="margin-top:10px">
            ${btn("Ask", "mock", { size: "sm" })}${btn("Park", "mock", { variant: "ghost", size: "sm" })}
          </div>
        </div>`).join("")
        : `<p class="t-meta">Listening. Suggestions appear as the conversation reaches an area
           that is not yet understood.</p>`}

        <p class="t-meta" style="margin-top:22px;line-height:1.6">
          The conversation leads. Everything else is a quiet layer beside it, because the auditor is
          talking to a person — a suggestion that interrupts is worse than no suggestion.</p>
      </div>
    </div>
  </div>`;
}
