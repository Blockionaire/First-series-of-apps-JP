/* Design-partner demo mode — nine beats, five to ten minutes.

   Each beat sets the route and prepares the state so the point lands without
   the presenter having to hunt for it. */

import { esc, btn } from "./ui.js";
import { S, act, commit } from "./state.js";

export const STEPS = [
  { route: "#/", title: "The auditor's morning",
    say: "Not a dashboard of metrics — a list of things that are waiting on a person. Two of them are blocked by the system on purpose.",
    setup: () => {} },

  { route: "#/revenue", title: "One process, measured",
    say: "Revenue is the only process in scope, and its state is a number rather than a feeling: coverage, facts established, open questions, what needs a source.",
    setup: () => {} },

  { route: "#/coverage", title: "What we still do not know",
    say: "45 coverage items from the firm's methodology pack. Open R5 — Invoicing. The mandatory item R5.3 is only partially covered because one fact is missing: who reviews the price override report.",
    setup: () => { S.expanded = { R5: true, R3: true }; } },

  { route: "#/open-items", title: "The follow-up the auditor would have missed",
    say: "That missing fact became a question automatically, from a deterministic rule in the pack — not from the model's initiative. Above it sits something the model found by comparing two sources: the controller and the commercial director gave different answers about who may change a credit limit.",
    setup: () => {} },

  { route: "#/generate", title: "Nine stages, not one prompt",
    say: "Facts, then narrative, then risks, then controls, then the key-control criteria — and then two deterministic stages that validate and assemble. Watch stage 8.",
    setup: () => { if (!S.generated) S.generating = false; } },

  { route: "#/review", title: "Where did this sentence come from?",
    say: "Section 8, Invoicing. Every claim carries a source chip. Hover one for the quote; click it and the exact passage is pinned on the right. This is the question an auditor has to answer in a file review, and it takes about two seconds.",
    setup: () => { S.generated = true; S.section = "N8"; S.selBlock = "N8.1"; S.pinned = "T:seg-13"; } },

  { route: "#/review", title: "The system stops itself",
    say: "Section 10. This sentence is plausible, well written, and entirely invented — no source in the engagement supports a EUR 5,000 threshold. It is marked Needs source and the section cannot be approved. Open it and the platform shows why the model produced it.",
    setup: () => { S.generated = true; S.section = "N10"; S.selBlock = "N10.2"; S.pinned = null; } },

  { route: "#/risks", title: "AI proposes, the auditor decides",
    say: "Eleven risks mapped to the firm's own library at assertion level, one outside it with a justification, and one that cannot be concluded until the contradiction is resolved. The proposal and the decision are two different fields, and only one of them is the auditor's.",
    setup: () => { S.generated = true; S.riskSel = "R-01"; } },

  { route: "#/signoff", title: "Nothing is signed by the machine",
    say: "Seven gates. An unsupported statement, an unresolved contradiction or an open mandatory item each block sign-off on their own. The file records who prepared and who reviewed — and that AI assistance was used.",
    setup: () => { S.generated = true; } },
];

export function demoBar() {
  if (!S.demo) return "";
  const i = S.demoStep;
  const s = STEPS[i];
  return `<div class="demobar">
    <span class="demobar__n">${i + 1} / ${STEPS.length}</span>
    <div class="demobar__t"><b>${esc(s.title)}</b> — ${esc(s.say)}</div>
    <div class="btn-row">
      ${btn("Back", "demo-prev", { size: "sm", disabled: i === 0 })}
      ${i === STEPS.length - 1
        ? btn("Finish", "demo-exit", { size: "sm", variant: "primary" })
        : btn("Next", "demo-next", { size: "sm", variant: "primary" })}
      ${btn("Exit", "demo-exit", { size: "sm" })}
    </div>
  </div>`;
}

export function demoGo(step) {
  S.demoStep = Math.max(0, Math.min(STEPS.length - 1, step));
  const s = STEPS[S.demoStep];
  s.setup();
  if (location.hash !== s.route) location.hash = s.route;
  else commit();
}

export function demoStart() {
  S.demo = true;
  demoGo(0);
}

export function demoExit() {
  S.demo = false;
  commit();
}
