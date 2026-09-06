/* F. Client questionnaire · G. Auditor-assisted walkthrough · H. Live cockpit (future) */

import { esc, cx, btn, tag, panel, note, status, meter, coverageBar, ICON } from "../ui.js";
import { client, transcript, questionnaire, firm } from "../data-sources.js";
import { subProcesses } from "../data-model.js";
import * as st from "../state.js";
import { topbar, engCrumbs, wsScreen } from "./chrome.js";

const S = st.S;

/* ── F. Client questionnaire ─────────────────────────────────────────────── */
/* A separate, deliberately plain client surface. Not the auditor's UI. */

export function clientQuestionnaire() {
  const answered = questionnaire.filter((q) => q.a);
  const current = questionnaire.find((q) => !q.a);
  const done = answered.length;
  const pctDone = Math.round((done / questionnaire.length) * 100);

  return `<div class="client-shell">
    <header class="client-bar">
      <div>
        <div class="h-sub">Revenue process — information request</div>
        <div class="tiny dim" style="margin-top:2px">${esc(firm.name)} · ${esc(client.name)} · FY2026 audit</div>
      </div>
      <div class="row" style="gap:16px">
        <div style="text-align:right">
          <div class="tiny dim">Progress</div>
          <div class="small num">${done} of ${questionnaire.length} answered</div>
        </div>
        <div style="width:120px">${meter(pctDone)}</div>
        ${btn("Back to the auditor view", "nav", { size: "sm", data: { href: "#/prepare" } })}
      </div>
    </header>

    <div class="client-body"><div class="client-card">
      <p class="lede" style="margin-bottom:24px">
        Bas — these questions are about how sales are recorded. Answer in your own words; there are no
        wrong answers, and you can stop and come back at any time.
      </p>

      ${current ? `
        <div class="qa">
          <div class="lbl" style="margin-bottom:10px">Question ${current.n} of ${questionnaire.length}</div>
          <div class="qa__q">${esc(current.q)}</div>
          <div class="qa__hint">${current.origin === "deterministic_trigger"
            ? "Follow-up to your earlier answer."
            : "Follow-up on something you mentioned about the German distributor."}</div>
          <textarea class="textarea" style="margin-top:18px" rows="4" placeholder="Type your answer…"></textarea>
          <div class="btn-row" style="margin-top:14px">
            ${btn("Send answer", "answer-q", { variant: "primary" })}
            ${btn("I don't know", "answer-q")}
            ${btn("Ask me on a call instead", "mock", { variant: "ghost" })}
          </div>
        </div>` : `
        <div class="qa">
          <div class="qa__q">All questions answered</div>
          <div class="qa__hint">Thank you. Your auditor has been notified.</div>
        </div>`}

      <div style="margin-top:28px">
        <div class="lbl" style="margin-bottom:10px">Already answered</div>
        ${[...answered].reverse().slice(0, 6).map((q) => `
          <div class="qa qa--done">
            <div class="qa__q">${esc(q.q)}</div>
            <div class="qa__a">${esc(q.a)}</div>
            ${q.flag === "contradiction" ? `<div class="qa__follow">
              Thank you — we will check this against what the finance team told us.</div>` : ""}
            ${q.flag === "new_topic" ? `<div class="qa__follow">
              Follow-up added: how the consignment stock is treated at the year end.</div>` : ""}
          </div>`).join("")}
      </div>

      <div class="note" style="margin-top:24px">
        This questionnaire covers how sales are processed. It does not ask for any customer or
        personal data. ${esc(firm.name)} can see your answers; nobody else at ${esc(client.short)} can.
      </div>
    </div></div>
  </div>`;
}

/* ── G. Auditor-assisted walkthrough ─────────────────────────────────────── */

const SUGGESTIONS = [
  { kind: "Suggested follow-up", priority: "high", t: "Who reviews the price override report, how often, and what evidence is there that they did?",
    why: "Coverage item R5.3 is mandatory and the fact override_report_reviewer is not established. The controller said the report exists but is not run.",
    origin: "Deterministic trigger R5.3.T2" },
  { kind: "Potential missing fact", priority: "high", t: "No control has been identified over the completeness of the Van Dijk despatch file.",
    why: "The ISAE 3402 report names this reconciliation as a complementary user entity control. Nothing said so far indicates the entity performs it.",
    origin: "Coverage model" },
  { kind: "Possible risk", priority: "medium", t: "Manual journals to revenue are approved reciprocally by the only two people who can post them.",
    why: "Maps to RSK-REV-030 — management override. ISA 240 requires this to be addressed in every engagement.",
    origin: "Risk library match" },
  { kind: "Evidence to request", priority: "medium", t: "Example of a signed customer acceptance protocol, and where it is retained.",
    why: "Machine revenue is recognised on acceptance. The document has not been seen and the date route into the ledger is unclear.",
    origin: "Coverage model" },
  { kind: "Contradiction", priority: "high", t: "Credit limit authority conflicts with the commercial director's questionnaire answer.",
    why: "The controller says credit control only. The questionnaire says the commercial director may raise a limit by up to EUR 50,000.",
    origin: "Cross-source check" },
];

export function interview() {
  const cov = st.coverageSummary();

  const body = `<div class="stack">
    ${note(`<span class="strong">Auditor-led mode.</span> You conduct the walkthrough and record what you
      hear. The platform observes: it updates coverage, and it offers suggestions in the side panel.
      It never interrupts, and nothing it proposes enters the file until you act on it.`, "accent")}

    <div class="grid grid--main-side">
      <div class="stack">
        ${panel("Walkthrough notes", `
          <div class="row row--between" style="margin-bottom:12px">
            <span class="small muted">Revenue · R. Timmermans (Financial Controller) · 18 September 2026</span>
            <span class="st st--live"><i></i>Recording notes</span>
          </div>
          <div style="max-height:420px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:16px">
            ${transcript.slice(0, 14).map((seg) => `<div class="turn">
              <div class="turn__who"><b>${esc(seg.who === "Sanne Bakker" ? "You" : seg.who)}</b>
                <span class="mono">${esc(seg.t)}</span></div>
              <div class="turn__t">${esc(seg.text)}</div>
            </div>`).join("")}
          </div>
          <textarea class="textarea" style="margin-top:12px" rows="3"
            placeholder="Type what you heard, or paste from your notes…"></textarea>
          <div class="btn-row" style="margin-top:10px">
            ${btn("Record note", "mock", { variant: "primary" })}
            ${btn("Mark coverage item covered", "mock")}
            ${btn("End walkthrough", "nav", { data: { href: "#/coverage" } })}
          </div>`)}
      </div>

      <div class="stack">
        ${panel("Coverage, live", `
          <div class="row row--between" style="margin-bottom:8px">
            <span class="small">Revenue understanding</span><span class="small num">${cov.pct}%</span>
          </div>
          ${coverageBar(cov)}
          <div class="stack-sm" style="margin-top:14px">
            ${subProcesses.slice(0, 6).map((sp) => {
              const p = st.subProcessPct(sp);
              return `<div class="row" style="gap:10px">
                <span class="cov__id" style="width:26px">${esc(sp.id)}</span>
                <span class="tiny" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sp.name)}</span>
                <span class="tiny num">${p === null ? "n/a" : p + "%"}</span></div>`;
            }).join("")}
            <div class="tiny dim">…and 6 more</div>
          </div>`)}

        ${panel("The platform noticed", `<div>
          ${SUGGESTIONS.map((s) => `<div class="insight insight--${s.priority === "high" ? "high" : "med"}">
            <div class="insight__k">${esc(s.kind)}</div>
            <div class="insight__t">${esc(s.t)}</div>
            <div class="insight__w">${esc(s.why)}</div>
            <div class="row" style="gap:6px;margin-top:8px">
              ${btn("Ask now", "mock", { size: "sm" })}
              ${btn("Park", "mock", { size: "sm", variant: "ghost" })}
              ${btn("Dismiss", "mock", { size: "sm", variant: "ghost" })}
            </div>
            <div class="tiny dim" style="margin-top:6px">${esc(s.origin)}</div>
          </div>`).join("")}
        </div>`, { flush: false, sub: "Provisional. Nothing here is documentation." })}
      </div>
    </div>
  </div>`;

  return wsScreen("walkthrough", body);
}

/* ── H. Live walkthrough cockpit — FUTURE STATE ──────────────────────────── */

const COCKPIT_INSIGHTS = [
  { after: 3, kind: "Ask this next", pr: "high", t: "How would you know if an order a customer sent never reached the system?",
    why: "R2.1 · capture_completeness_control not established" },
  { after: 5, kind: "Ask this next", pr: "high", t: "When someone overrides the price, is that approved or reviewed anywhere?",
    why: "Trigger R2.2.T2 fired · who_can_override_price stated, what_happens_on_override missing" },
  { after: 7, kind: "Spotted — potential risk", pr: "med", t: "Unauthorised price overrides (RSK-REV-021)",
    why: "\"Sales can change the line price on an order\" · 09:40" },
  { after: 8, kind: "Request", pr: "med", t: "Price override report — configuration and one month of output",
    why: "Needed before any control over overrides could be relied upon" },
  { after: 10, kind: "Spotted — potential control", pr: "low", t: "Discount block above 12% (CTL-REV-008)",
    why: "\"That is a hard block in the system\" · 11:05" },
  { after: 11, kind: "Contradiction", pr: "high", t: "Credit limit authority conflicts with the questionnaire",
    why: "Controller: credit control only. Questionnaire (B. Kuipers): may raise up to EUR 50,000" },
  { after: 12, kind: "Ask this next", pr: "high", t: "Does anyone check that the Van Dijk despatch file is complete?",
    why: "R10.5 · the ISAE 3402 report names this as a complementary user entity control" },
];

export function cockpit() {
  const turn = S.cockpitTurn;
  const shown = transcript.slice(0, turn);
  const insights = COCKPIT_INSIGHTS.filter((i) => i.after <= turn).reverse();
  const covered = Math.min(45, 6 + turn * 2);

  return `${topbar(engCrumbs([{ label: "Live walkthrough cockpit" }]))}
  <div class="future-band">
    ${tag("Future state", "future")}
    <span>This screen is a design concept, not part of the current build. There is no audio, no speech
    recognition and no real-time model here — the transcript below is a scripted replay.
    In the roadmap this is Product 3, after the engine is proven.</span>
  </div>

  <div class="wsbar">
    <span class="st st--live"><i></i>Recording · 11:24</span>
    <span class="dim">·</span>
    <span>Revenue walkthrough — R. Timmermans</span>
    <span class="dim">·</span>
    <span>Consent recorded 09:31</span>
    <span class="wsbar__spacer"></span>
    ${btn(S.cockpitPlaying ? "Pause replay" : "Play replay", "cockpit-play", { size: "sm", variant: S.cockpitPlaying ? "" : "primary" })}
    ${btn("Next turn", "cockpit-next", { size: "sm" })}
    ${btn("End walkthrough", "nav", { size: "sm", data: { href: "#/coverage" } })}
  </div>

  <div class="cockpit">
    <div class="cockpit__pane cockpit__pane--left">
      <div class="cockpit__ph"><span class="lbl">Live transcript</span>
        <span class="tiny dim num">${shown.length} turns</span></div>
      <div class="cockpit__pb">
        ${shown.map((seg, i) => `<div class="turn ${i === shown.length - 1 ? "is-new" : ""}">
          <div class="turn__who"><b>${esc(seg.who)}</b><span>${esc(seg.role)}</span><span class="mono">${esc(seg.t)}</span></div>
          <div class="turn__t">${esc(seg.text)}</div>
        </div>`).join("")}
        ${turn < 14 ? `<div class="turn"><div class="turn__t dim pulse">…</div></div>` : ""}
      </div>
    </div>

    <div class="cockpit__pane">
      <div class="cockpit__ph"><span class="lbl">Coverage</span>
        <span class="tiny num">${covered} of 45</span></div>
      <div class="cockpit__pb">
        <div style="margin-bottom:16px">${coverageBar({ covered, partial: 4, open: 45 - covered - 4, na: 0 })}</div>
        ${subProcesses.map((sp, idx) => {
          // The walkthrough moves through the sub-processes in order, so the ones
          // already discussed are further along than the ones still to come.
          const p = Math.max(0, Math.min(100, turn * 14 - idx * 16 + 20));
          const active = p > 0;
          return `<div style="padding:7px 0;border-bottom:1px solid var(--line-soft);${active ? "" : "opacity:.4"}">
            <div class="row" style="gap:10px">
              <span class="cov__id" style="width:26px">${esc(sp.id)}</span>
              <span class="small" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sp.name)}</span>
              <span class="tiny num dim">${active ? p + "%" : "—"}</span>
            </div>
            ${active ? `<div style="margin-top:5px">${meter(p, 100, p > 85)}</div>` : ""}
          </div>`;
        }).join("")}
        <p class="tiny dim" style="margin-top:14px;line-height:1.6">
          The middle pane answers the question that today only becomes clear during write-up:
          have we asked enough?</p>
      </div>
    </div>

    <div class="cockpit__pane cockpit__pane--right">
      <div class="cockpit__ph"><span class="lbl">Copilot</span>
        <span class="tiny dim">${insights.length} items · refreshes every ~15s</span></div>
      <div class="cockpit__pb">
        ${insights.length === 0 ? `<p class="tiny dim">Listening. Suggestions appear as the conversation
          reaches a coverage item.</p>` : ""}
        ${insights.map((i) => `<div class="insight insight--${i.pr === "high" ? "high" : i.pr === "med" ? "med" : "low"}">
          <div class="insight__k">${esc(i.kind)}</div>
          <div class="insight__t">${esc(i.t)}</div>
          <div class="insight__w">${esc(i.why)}</div>
          <div class="row" style="gap:6px;margin-top:8px">
            ${btn("Ask", "mock", { size: "sm" })}${btn("Park", "mock", { size: "sm", variant: "ghost" })}
          </div>
        </div>`).join("")}
        <p class="tiny dim" style="margin-top:16px;line-height:1.6">
          Ranked, capped at six, and never modal. A suggestion that would interrupt the conversation
          is worse than no suggestion at all.</p>
      </div>
    </div>
  </div>`;
}
