/* Guided demo — twelve beats over the corrected workflow.

   The beats follow the seven steps in order, and stop where the product
   stops. Each `setup` puts the prototype into the state the beat describes,
   so a beat can be entered directly without playing the ones before it. */

import { esc, act as btn } from "./ui.js";
import { S, commit, act } from "./state.js";
import { pipeline } from "./data-model.js";
import { txnById } from "./data-process.js";

/** Corroborate the first n steps of a transaction, keyed the way state does. */
const preTrace = (txnId, n) => {
  const t = txnById(txnId);
  if (!t) return;
  t.steps.slice(0, n).forEach((s) => { S.traceDecisions[`${txnId}::${s.id}`] = "corroborated"; });
};

export const STEPS = [
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

  { route: "#/understanding", title: "Step three — the routine, separated from the judgement",
    say: "Nine stages, two of them ordinary code. Validation checks that every statement cites a source and that the quote occurs in it — three did not. Then: four statements need a person, ten sections are clean and go in one action.",
    setup: () => { S.prepared = true; S.reviewMode = "triage"; } },

  { route: "#/understanding", title: "The contradiction comes first",
    say: "Two sources disagree about who can change a credit limit. Press 1, 2 or 3 to choose a resolution — the numbers are on the options. Whichever you pick updates the statement, the fact behind it, the coverage area and the open item together. Then Enter clears the three unsupported claims.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "focus"; S.focusKind = "claims"; S.focusIx = 0; } },

  { route: "#/understanding", title: "Where did this sentence come from?",
    say: "Click any sentence and the evidence opens directly beneath it — speaker, timestamp, exact words. No side panel, no navigation, the eye never leaves the line.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "read"; S.section = "N8"; S.openClaim = "N8.1"; } },

  { route: "#/controls", title: "Step four — controls, and undecided is not a conclusion",
    say: "The same map, now annotated: which step each control sits on, and which steps have something wrong with them. Enter accepts the proposal, K and N conclude, C carries one forward with a reason. Parking a control leaves it in the queue — the gate still counts it as outstanding.",
    setup: () => { S.generated = true; S.genSeen = true; S.reviewMode = "triage"; S.mapStep = null; } },

  { route: "#/trace", title: "Step five — which variants need a walkthrough",
    say: "A machine sale tells you nothing about how a spare-part order behaves. So the requirement is decided per variant, and 'not required' is a real answer that carries a reason. Service contracts do not need one; the two goods variants do.",
    setup: () => {
      S.generated = true; S.genSeen = true; S.traceTxn = null;
      S.lwRequirements = {}; S.reviewMode = "triage";
    } },

  { route: "#/trace", title: "The walkthrough finds the model wrong",
    say: "The invoice went out on 15 September. The customer signed acceptance on 22 September. Revenue was recognised seven days before the performance obligation was satisfied — found by comparing two dates, not by anything anyone said in an interview.",
    setup: () => {
      S.generated = true; S.genSeen = true;
      S.lwRequirements = { V1: { state: "required", reason: null } };
      S.traceTxn = "SO-24188"; S.traceStarted["SO-24188"] = true;
      preTrace("SO-24188", 4);
      S.focusKind = "trace"; S.focusIx = 0; S.reviewMode = "focus";
    } },

  { route: "#/testing", title: "Step six — identifying a control is not testing it",
    say: "Conditional, and marked as a future concept. First a scope decision per key control: tested, or not tested with a reason on file. Then population, selection, evidence, results. Extending the sample is not a conclusion — only rely or do not rely closes the test.",
    setup: () => { S.generated = true; S.genSeen = true; } },

  { route: "#/complete", title: "Step seven — complete closes the process, not the audit",
    say: "Ready for review is not the same as complete: the preparer signs, the manager approves, and only then is the process closed. What it hands forward is the process understanding, the matrix, the findings, the walkthrough results and anything carried forward. Risk analysis is the next phase and deliberately not in this product.",
    setup: () => { S.generated = true; S.genSeen = true; } },
];

export function demoBar() {
  if (!S.demo) return "";
  const i = S.demoStep, s = STEPS[i];
  return `<div class="demo">
    <span class="demo__n">${i + 1}/${STEPS.length}</span>
    <div class="demo__t"><b>${esc(s.title)}</b> — ${esc(s.say)}</div>
    <div class="acts">
      ${btn("Back", "demo-prev", { variant: "plain", size: "sm", disabled: i === 0 })}
      ${i === STEPS.length - 1
        ? btn("Finish", "demo-exit", { variant: "go", size: "sm" })
        : btn("Next", "demo-next", { variant: "go", size: "sm", key: "→" })}
      ${btn("Exit", "demo-exit", { variant: "plain", size: "sm" })}
    </div>
  </div>`;
}

/** The beat that first reaches step three runs the pipeline for real. */
const PIPELINE_BEAT = 4;

export function demoGo(step) {
  S.demoStep = Math.max(0, Math.min(STEPS.length - 1, step));
  const s = STEPS[S.demoStep];
  if (S.demoStep === PIPELINE_BEAT && !S.generated && !S.generating) {
    S.prepared = true;
    location.hash = s.route;
    setTimeout(() => act.startGeneration(pipeline), 260);
    return;
  }
  s.setup();
  if (location.hash !== s.route) location.hash = s.route; else commit();
}

export function demoStart() { S.demo = true; demoGo(0); }
export function demoExit() { S.demo = false; commit(); }
