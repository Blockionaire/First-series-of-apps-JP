/* Guided demo — nine beats over the redesigned product. */

import { esc, act as btn } from "./ui.js";
import { S, commit, act } from "./state.js";
import { pipeline } from "./data-model.js";
import { lineWalk } from "./data-process.js";

export const STEPS = [
  { route: "#/engagement", title: "Interim sits inside an engagement",
    say: "Client, financial year, the four audit phases, and six processes inside interim. Revenue is one process among several — the product is not a Revenue application, it is where process-level interim work happens.",
    setup: () => {} },

  { route: "#/revenue", title: "Seven steps, and a map of the process",
    say: "This is the whole interim workflow for one process. The map is the process as we understand it; it fills in with controls and findings as the work progresses, and gets tested against a real transaction at step five.",
    setup: () => { S.prepared = true; S.mapStep = null; } },

  { route: "#/walkthrough", title: "What we still don't know",
    say: "Step two. Plain English, not methodology — three things need clarification. The 45 coverage areas, fact keys and ISA references are one disclosure away if a methodology partner asks.",
    setup: () => { S.disclosed.meth = false; } },

  { route: "#/understanding", title: "The routine, separated from the judgement",
    say: "Step three. Four statements need a person; ten sections are clean and accepted in one action. Press Enter four times to clear the queue — the contradiction first, then three unsupported claims, each with the correction already written.",
    setup: () => { S.generated = true; S.reviewMode = "triage"; } },

  { route: "#/understanding", title: "Where did this sentence come from?",
    say: "Click any sentence and the evidence opens directly beneath it — speaker, timestamp, exact words. No side panel, no navigation, the eye never leaves the line.",
    setup: () => { S.generated = true; S.reviewMode = "read"; S.section = "N8"; S.openClaim = "N8.1"; } },

  { route: "#/controls", title: "Controls and findings, on the process",
    say: "Step four. The same map, now annotated: which step each control sits on, and which steps have something wrong with them. Fourteen controls reviewed one at a time, Enter to accept, N for not key.",
    setup: () => { S.generated = true; S.reviewMode = "triage"; S.mapStep = null; } },

  { route: "#/trace", title: "Now test the model against reality",
    say: "Step five, and the step that changes what this product is. Pick a real transaction and trace it end to end through the process we just documented. Expected step, expected control, expected evidence — against what actually happened.",
    setup: () => { S.generated = true; S.traceTxn = null; S.reviewMode = "triage"; } },

  { route: "#/trace", title: "The walkthrough finds the model wrong",
    say: "The invoice went out on 15 September. The customer signed acceptance on 22 September. Revenue was recognised seven days before the performance obligation was satisfied — found by comparing two dates, not by anything anyone said in an interview.",
    setup: () => {
      S.generated = true; S.traceTxn = "SO-24188";
      lineWalk.steps.slice(0, 4).forEach((t) => { S.traceDecisions[t.id] = "corroborated"; });
      S.focusKind = "trace"; S.focusIx = 0; S.reviewMode = "focus";
    } },

  { route: "#/testing", title: "Identifying a control is not testing it",
    say: "Step six, clearly marked as a future concept. Control, test setup, population and selection, evidence, results, conclusion — with the sample size always showing the firm parameter that produced it. The auditor concludes; the platform does not.",
    setup: () => { S.generated = true; } },

  { route: "#/complete", title: "Complete closes the process, not the audit",
    say: "Ten conditions, each linking to the step that clears it. And then what interim hands forward: the process understanding, the matrix, the findings, the walkthrough result. Risk analysis is the next phase — deliberately not in this product.",
    setup: () => { S.generated = true; } },
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

export function demoGo(step) {
  S.demoStep = Math.max(0, Math.min(STEPS.length - 1, step));
  const s = STEPS[S.demoStep];
  // The understanding beat runs the pipeline the first time it is reached.
  if (S.demoStep === 3 && !S.generated && !S.generating) {
    location.hash = s.route;
    setTimeout(() => act.startGeneration(pipeline), 260);
    return;
  }
  s.setup();
  if (location.hash !== s.route) location.hash = s.route; else commit();
}

export function demoStart() { S.demo = true; demoGo(0); }
export function demoExit() { S.demo = false; commit(); }
