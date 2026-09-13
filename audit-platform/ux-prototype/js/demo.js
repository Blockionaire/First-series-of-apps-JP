/* Guided demo — twelve beats over the corrected workflow.

   The beats follow the seven steps in order, and stop where the product
   stops. Each `setup` puts the prototype into the state the beat describes,
   so a beat can be entered directly without playing the ones before it. */

import { esc, act as btn } from "./ui.js";
import { S, commit, act } from "./state.js";
import * as st from "./state.js";
import { pipeline, analysisPipeline, narrative } from "./data-model.js";
import { txnById } from "./data-process.js";

/** Corroborate the first n steps of a transaction, keyed the way state does. */
const preTrace = (txnId, n) => {
  const t = txnById(txnId);
  if (!t) return;
  t.steps.slice(0, n).forEach((s) => { S.traceDecisions[`${txnId}::${s.id}`] = "corroborated"; });
};

export const STEPS = [
  { route: "#/clients", title: "The hierarchy above Revenue is real",
    say: "Firms manage clients here, and a client carries its contacts, its systems and one engagement per financial year. Creating a client, creating FY2027, assigning the team and scoping the processes all happen above the workflow — for the demo we walk into an engagement already in progress.",
    setup: () => { act.selectEngagement("ENG-2026-0142"); } },

  { route: "#/engagement", title: "Interim sits inside an engagement",
    say: "Client, financial year, the four audit phases, and six processes inside interim. Revenue is one process among several — this is not a Revenue application, it is where process-level interim work happens.",
    setup: () => {} },

  { route: "#/revenue", title: "Seven steps, three variants, one map",
    say: "The whole interim workflow for one process: prepare, interview, understanding, controls and findings, line walkthrough, control testing, complete. And Revenue is not one process — machines, spare parts and service contracts are three paths that converge at revenue posting.",
    setup: () => { S.prepared = false; S.mapStep = null; } },

  { route: "#/prepare", title: "Step one starts with what is already known",
    say: "Nothing here is asked twice. The inherent risk factors, the systems, the prior-year narrative and last year's management letter all come in from planning. Confirming preparation is what starts the interview.",
    setup: () => { S.prepared = false; } },

  { route: "#/interview", title: "Step two — what we still don't know",
    say: "Plain English, not methodology: three things need clarification. The 45 coverage areas, the fact keys and the ISA references are one disclosure away when a methodology partner asks for them.",
    setup: () => { S.prepared = true; S.disclosed.meth = false; } },

  { route: "#/understanding", title: "Step three — how the process works, and nothing more",
    say: "Nine stages, four of them ordinary code — and every one of them about how the process works. It documents the process and stops there: no control identified, no finding proposed, no risk signal raised. Validation checks that every statement cites a source and that the quote occurs in it — three did not. Then four statements need a person and ten sections go in one action.",
    setup: () => { S.prepared = true; S.reviewMode = "triage"; } },

  { route: "#/understanding", title: "The contradiction comes first",
    say: "Two sources disagree about who can change a credit limit. Press 1, 2 or 3 to choose a resolution — the numbers are on the options. Whichever you pick updates the statement, the fact behind it, the coverage area and the open item together. Then Enter clears the three unsupported claims.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "focus"; S.focusKind = "claims"; S.focusIx = 0; } },

  { route: "#/understanding", title: "Where did this sentence come from?",
    say: "Click any sentence and the evidence opens directly beneath it — speaker, timestamp, exact words. No side panel, no navigation, the eye never leaves the line.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "read"; S.section = "N8"; S.openClaim = "N8.1"; } },

  { route: "#/controls", title: "Step four is its own analysis",
    say: "Only now does anything get proposed about controls. Seven stages against the understanding you just approved — controls, gaps, risk signals, the key-control criteria, the matrix. Proposing any of this from a draft nobody had read would put the analysis ahead of the judgement it depends on.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "triage"; S.mapStep = null; } },

  { route: "#/controls", title: "Controls, and undecided is not a conclusion",
    say: "The same map, now annotated: which step each control sits on, and which steps have something wrong with them. Enter accepts the proposal, K and N conclude, C carries one forward with a reason. Parking a control leaves it in the queue — the gate still counts it as outstanding.",
    setup: () => { S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true;
                   S.reviewMode = "triage"; S.mapStep = null; } },

  { route: "#/trace", title: "Step five — which variants need a walkthrough",
    say: "A machine sale tells you nothing about how a spare-part order behaves. So the requirement is decided per variant, and 'not required' is a real answer that carries a reason. Service contracts do not need one; the two goods variants do.",
    setup: () => {
      S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true;
      S.traceTxn = null; S.lwRequirements = {}; S.reviewMode = "triage";
    } },

  { route: "#/trace", title: "The walkthrough finds the model wrong",
    say: "The invoice went out on 15 September. The customer signed acceptance on 22 September. Revenue was recognised seven days before the performance obligation was satisfied — found by comparing two dates, not by anything anyone said in an interview.",
    setup: () => {
      S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true;
      S.lwRequirements = { V1: { state: "required", reason: null } };
      S.traceTxn = "SO-24188"; S.traceStarted["SO-24188"] = true;
      preTrace("SO-24188", 4);
      S.focusKind = "trace"; S.focusIx = 0; S.reviewMode = "focus";
    } },

  { route: "#/testing", title: "Step six — identifying a control is not testing it",
    say: "Conditional, and marked as a future concept. First a scope decision per key control: tested, or not tested with a reason on file. Then population, selection, evidence, results. Extending the sample is not a conclusion — and concluding one control's test says nothing about any other one.",
    setup: () => { S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true; } },

  { route: "#/complete", title: "Step seven — reviewed, not just finished",
    say: "Ready for review is not the same as complete. The preparer signs, the manager reviews — and if it comes back, it comes back with a review point that has to be answered before the file can go anywhere. Only the reviewer's approval closes the process.",
    setup: () => { S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true; } },

  { route: "#/complete", title: "What interim hands forward",
    say: "The process understanding, the matrix, the findings, the walkthrough results and anything carried forward with its destination and its reason. Risk analysis is the next phase, reads all of this, and is deliberately not in this product.",
    setup: () => { S.generated = true; S.genSeen = true; S.analysed = true; S.anaSeen = true;
                   S.disclosed.footer = true; } },
];

/* ── The client-side demo ─────────────────────────────────────────────────
   A separate, shorter track: two or three minutes answering the question
   "what does the client actually experience?". It is kept apart from the
   auditor tour because it is a different product for a different person.
   ──────────────────────────────────────────────────────────────────────── */

export const CLIENT_STEPS = [
  { route: "#/interview", title: "The auditor asks",
    say: "The questionnaire is assigned to one named client contact. That is a task-scoped grant, not an account — Bas Kuipers can open this questionnaire and nothing else in the product.",
    setup: () => { S.prepared = true; act.assignQuestionnaire("CC-02"); S.toast = null; } },

  { route: "#/portal", title: "What the client sees",
    say: "A task inbox, and nothing else. No process journey, no coverage, no controls, no findings, no methodology. Four questions only: what do you need, why, what next, am I done. Bas sees his two tasks and not his colleague's interview.",
    setup: () => { act.portalAs("CC-02"); } },

  { route: "#/portal/questionnaire", title: "One question at a time",
    say: "The same questionnaire the auditor assigned, in the portal's chrome. Answer in your own words — or say you don't know, or ask for a call. All three go somewhere; none of them is guessed.",
    setup: () => { act.portalAs("CC-02"); } },

  { route: "#/portal", title: "Back to the inbox",
    say: "Progress updates on the task. The auditor's process interview screen shows the same number, because there is one questionnaire and not two.",
    setup: () => { act.portalAs("CC-02"); } },

  { route: "#/portal/interview", title: "An interview is a task too",
    say: "Now as Ruud Timmermans, the financial controller. When, how long, with whom, what will be discussed, and what he needs to prepare — nothing.",
    setup: () => { act.portalAs("CC-01"); S.interview.status = "scheduled"; S.interview.turn = 6; } },

  { route: "#/portal/interview/waiting", title: "The waiting room",
    say: "Not a video-conferencing product. What this is, who is in it, and one plain sentence about transcription that the client has to acknowledge before joining.",
    setup: () => { act.portalAs("CC-01"); S.interview.status = "waiting"; S.interview.consent = false; } },

  { route: "#/portal/interview/live", title: "The conversation is the product",
    say: "The client sees who said what, and the subject. No coverage bar, no suggested question, no contradiction flag, no evidence request, no AI thinking out loud. All of that belongs to the auditor.",
    setup: () => { act.portalAs("CC-01"); S.interview.consent = true; S.interview.status = "live";
                   S.interview.turn = Math.max(S.interview.turn, 9); } },

  { route: "#/cockpit", title: "The same interview, the other side",
    say: "One interview, two radically different interfaces. Same turn, same words — plus the coverage filling in live, the contradiction with the commercial director's questionnaire answer, and the next question worth asking. Advance a turn here and the client's screen moves with it.",
    setup: () => { S.interview.status = "live"; } },

  { route: "#/portal/interview/done", title: "Thank you, and nothing more",
    say: "No coverage percentage, no contradictions found, no controls identified. The client is told the thing that concerns them: it is finished, and somebody may follow up.",
    setup: () => { act.portalAs("CC-01"); act.interviewEnd(); S.toast = null; } },

  { route: "#/portal", title: "The interview created a follow-up",
    say: "Back as Bas. The controller described the credit limits differently to the way Bas did in the questionnaire, so one question goes back to Bas — in his words, not the auditor's. No engine, no new surface: the same question screen.",
    setup: () => { act.portalAs("CC-02"); S.interview.status = "complete"; } },

  { route: "#/interview", title: "And the auditor sees where everything is",
    say: "Contextually, where the auditor already is — not in a new dashboard. Who was asked for what, and how far it has got. The complexity stays on this side.",
    setup: () => { S.prepared = true; } },
];

export function demoBar() {
  if (!S.demo) return "";
  const track = S.demoTrack === "client" ? CLIENT_STEPS : STEPS;
  const i = Math.min(S.demoStep, track.length - 1), s = track[i];
  return `<div class="demo">
    <span class="demo__n">${i + 1}/${track.length}</span>
    <div class="demo__t"><b>${esc(s.title)}</b> — ${esc(s.say)}</div>
    <div class="acts">
      ${btn("Back", "demo-prev", { variant: "ghost", size: "sm", disabled: i === 0 })}
      ${i === track.length - 1
        ? btn("Finish", "demo-exit", { variant: "primary", size: "sm" })
        : btn("Next", "demo-next", { variant: "primary", size: "sm", key: "→" })}
      ${btn("Exit", "demo-exit", { variant: "ghost", size: "sm" })}
    </div>
  </div>`;
}

/** Two beats run a pipeline for real: step 3 documents, step 4 analyses. */
const UNDERSTANDING_BEAT = 5;
const ANALYSIS_BEAT = 8;

export function demoGo(step) {
  /* The client track is linear: no pipeline to run, nothing to pre-resolve. */
  if (S.demoTrack === "client") {
    S.demoStep = Math.max(0, Math.min(CLIENT_STEPS.length - 1, step));
    const c = CLIENT_STEPS[S.demoStep];
    c.setup();
    if (location.hash !== c.route) location.hash = c.route; else commit();
    return;
  }
  S.demoStep = Math.max(0, Math.min(STEPS.length - 1, step));
  const s = STEPS[S.demoStep];
  if (S.demoStep === UNDERSTANDING_BEAT && !S.generated && !S.generating) {
    S.prepared = true;
    location.hash = s.route;
    setTimeout(() => act.startGeneration(pipeline), 260);
    return;
  }
  if (S.demoStep === ANALYSIS_BEAT && !S.analysed && !S.analysing) {
    // Step 4 runs against a *reviewed* understanding, so if the presenter
    // skipped the review beats, take the proposed resolution for each item.
    S.generated = true; S.genSeen = true;
    st.claimQueue().forEach(({ b }) => {
      if (st.claimState(b) === "contradiction" && b.options?.[0]) {
        act.resolveConflict(b.id, b.options[0].choice, b.options[0].text);
      } else {
        act.saveClaim(b.id, b.suggestion || b.text);
      }
    });
    act.acceptClean();
    narrative.forEach((sec) => { if (st.sectionApprovable(sec)) act.approveSection(sec.id); });
    S.reviewMode = "triage"; S.focusKind = null;
    location.hash = s.route;
    setTimeout(() => act.startAnalysis(analysisPipeline), 260);
    return;
  }
  s.setup();
  if (location.hash !== s.route) location.hash = s.route; else commit();
}

/** The guided demo is a tour of the populated file, so it says so and moves
 *  there explicitly — the demo bar names the engagement it is showing. */
export function demoStart() {
  S.demo = true;
  S.demoTrack = "auditor";
  act.selectEngagement("ENG-2026-0142");
  demoGo(0);
}

/** The client-experience tour. Separate track, separate question. */
export function demoStartClient() {
  S.demo = true;
  S.demoTrack = "client";
  act.selectEngagement("ENG-2026-0142");
  demoGo(0);
}
export function demoExit() { S.demo = false; commit(); }
