/* Guided demo — nine beats over the redesigned product. */

import { esc, act as btn } from "./ui.js";
import { S, commit } from "./state.js";
import { pipeline } from "./data-model.js";

export const STEPS = [
  { route: "#/", title: "One question, not a dashboard",
    say: "No sidebar, no tabs, no metric tiles. The product opens by telling the auditor the single most useful thing to do next, and what else is waiting.",
    setup: () => {} },

  { route: "#/understand", title: "What we still don't know",
    say: "Plain English, not methodology. Three things need clarification, each with its actions on the row. The 45 coverage items, fact keys and ISA references are one disclosure away — open 'Show methodology' if anyone asks.",
    setup: () => { S.disclosed.meth = false; } },

  { route: "#/review", title: "Nine stages, not one prompt",
    say: "Facts, narrative, risks, controls, the key-control criteria — then two stages of ordinary code that validate and assemble. Watch the validation stage.",
    setup: () => {} },

  { route: "#/review", title: "The routine, separated from the judgement",
    say: "This is the core promise on one screen. Four things need a person. Ten sections are clean and can be accepted in a single action. The product has already done the sorting.",
    setup: () => { S.generated = true; S.reviewMode = "triage"; } },

  { route: "#/review", title: "One judgement at a time",
    say: "Full width, no sidebar, no modal. The statement stays in its paragraph, the problem is one sentence, and the recommended fix is written and one keystroke away. Press Enter to accept it.",
    setup: () => { S.generated = true; S.focusKind = "claims"; S.focusIx = 0; S.reviewMode = "focus"; } },

  { route: "#/review", title: "Where did this sentence come from?",
    say: "Click any sentence and the evidence opens directly beneath it — speaker, timestamp, exact words. The eye never leaves the line. No permanent panel, no navigation.",
    setup: () => { S.generated = true; S.reviewMode = "read"; S.section = "N8"; S.openClaim = "N8.1"; } },

  { route: "#/review", title: "Seven decisions in under a minute",
    say: "Not fourteen table rows. One recommendation at a time, with the reasoning in prose and the six criteria behind a disclosure. Enter accepts, N marks it not key, and it advances by itself.",
    setup: () => { S.generated = true; S.focusKind = "controls"; S.focusIx = 0; S.reviewMode = "focus"; } },

  { route: "#/resolve", title: "What is holding things up",
    say: "Open items ordered by what they block, not by type. The contradiction at the top is stopping a statement, a control and a risk at once.",
    setup: () => {} },

  { route: "#/complete", title: "Nothing is signed by the machine",
    say: "Seven conditions, each linking to the work that clears it. Sign-off is the one place in the product with a deliberate stop — everywhere else, undo replaced the confirmation dialog.",
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
  // Beat 3 shows the pipeline; run it if it has not been run.
  if (S.demoStep === 2 && !S.generated && !S.generating) {
    location.hash = s.route;
    setTimeout(() => {
      import("./state.js").then((m) => m.act.startGeneration(pipeline));
    }, 260);
    return;
  }
  s.setup();
  if (location.hash !== s.route) location.hash = s.route; else commit();
}

export function demoStart() { S.demo = true; demoGo(0); }
export function demoExit() { S.demo = false; commit(); }
