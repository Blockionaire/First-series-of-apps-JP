/* The live walkthrough cockpit — a future-state concept, marked as one.
   No audio, no speech recognition, no real-time model: a scripted replay. */

import { esc, cx, act as btn, callout, bar } from "../ui.js";
import { transcript } from "../data-sources.js";
import { subProcesses } from "../data-model.js";
import * as st from "../state.js";
import { idline, engContext } from "./shell.js";

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

  return `${idline(engContext())}
  <div class="callout callout--future" style="border-radius:0;margin:0;padding:12px 24px;font-size:13.5px">
    <b>Future concept.</b> Not part of the current build. No audio, no speech recognition and no
    real-time model — the transcript below is a scripted replay. This is where the product goes once
    the engine is proven, not where it starts.
  </div>

  <div class="idline" style="border-bottom:1px solid var(--line);height:auto;padding:10px 24px">
    <span class="state state--ok"><i class="dot dot--ok"></i>Recording · 11:24</span>
    <span class="idline__sep">·</span>
    <span>R. Timmermans, financial controller</span>
    <span class="idline__sp"></span>
    ${btn(S.cockpitPlaying ? "Pause" : "Play", "cockpit-play", { size: "sm", variant: S.cockpitPlaying ? "" : "go" })}
    ${btn("Next turn", "cockpit-next", { size: "sm" })}
    ${btn("End", "nav", { size: "sm", variant: "plain", data: { href: "#/interview" } })}
  </div>

  <div class="ck">
    <div class="ck__p ck__p--l">
      <div class="ck__h"><span class="t-eyebrow">Conversation</span></div>
      <div class="ck__b">
        ${shown.map((s, i) => `<div class="turn ${i === shown.length - 1 ? "is-new" : ""}">
          <div class="turn__w"><b>${esc(s.who)}</b> · ${esc(s.t)}</div>
          <div class="turn__x">${esc(s.text)}</div>
        </div>`).join("")}
        ${turn < 14 ? `<div class="turn__x" style="color:var(--ink-5)">…</div>` : ""}
      </div>
    </div>

    <div class="ck__p">
      <div class="ck__h"><span class="t-eyebrow">Understanding, live</span></div>
      <div class="ck__b">
        ${subProcesses.map((sp, idx) => {
          const p = Math.max(0, Math.min(100, turn * 14 - idx * 16 + 20));
          return `<div style="padding:9px 0;border-bottom:1px solid var(--line);${p ? "" : "opacity:.35"}">
            <div class="row" style="gap:12px">
              <span style="flex:1;font-size:14px;color:var(--ink-2)">${esc(sp.name)}</span>
              <span class="t-meta">${p ? p + "%" : "—"}</span>
            </div>
            ${p ? `<div style="margin-top:6px">${bar([{ k: "ok", n: p }, { k: "open", n: 100 - p }])}</div>` : ""}
          </div>`;
        }).join("")}
        <p class="t-meta" style="margin-top:16px;line-height:1.6">
          The middle pane answers the question that today only becomes clear during write-up:
          have we asked enough?</p>
      </div>
    </div>

    <div class="ck__p ck__p--r">
      <div class="ck__h"><span class="t-eyebrow">Suggestions</span></div>
      <div class="ck__b">
        ${cues.length ? cues.map((c) => `<div class="${cx("cue", c.p === "hi" && "cue--hi", c.p === "md" && "cue--md")}">
          <div class="cue__k">${esc(c.k)}</div>
          <div class="cue__t">${esc(c.t)}</div>
          <div class="cue__w">${esc(c.w)}</div>
          <div class="acts" style="margin-top:9px">
            ${btn("Ask", "mock", { size: "sm" })}${btn("Park", "mock", { variant: "plain", size: "sm" })}
          </div>
        </div>`).join("")
        : `<p class="t-meta">Listening. Suggestions appear as the conversation reaches an area
           that is not yet understood.</p>`}
        <p class="t-meta" style="margin-top:20px;line-height:1.6">
          Ranked, capped at six, never modal. A suggestion that interrupts the conversation is worse
          than no suggestion.</p>
      </div>
    </div>
  </div>`;
}
