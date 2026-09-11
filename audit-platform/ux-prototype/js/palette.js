/* ⌘K — the navigation.

   Everything not on the four-stage spine is two keystrokes away: sections,
   risks, controls, coverage areas, sources, open items, other engagements,
   and actions. This is how the target user already navigates. */

import { esc, cx, icon } from "./ui.js";
import { narrative, risks, controls, subProcesses } from "./data-model.js";
import { processSteps, variants } from "./data-process.js";
import { sources, client } from "./data-sources.js";
import * as st from "./state.js";

const S = st.S;

function index() {
  const items = [];
  const add = (group, name, hint, run, ic) => items.push({ group, name, hint, run, ic });

  const STEP_IC = { prepare: "document", interview: "questionnaire", understanding: "document",
                    controls: "control", trace: "walkthrough", testing: "test", complete: "signature" };
  st.journeyStates().forEach((s) =>
    add("Steps", `${s.n}. ${s.name}`, s.c, () => { location.hash = s.href; }, STEP_IC[s.id] || "step"));

  add("Go to", "Revenue process home", "the map and the journey", () => { location.hash = "#/revenue"; }, "map");
  add("Go to", "Engagement", "client, year, processes", () => { location.hash = "#/engagement"; }, "process");
  add("Go to", "Open matters", `${st.openItemSummary().open} open`, () => { location.hash = "#/resolve"; }, "question");
  add("Go to", "Read the working paper", "the full narrative",
    () => { S.reviewMode = "read"; location.hash = "#/understanding"; }, "document");
  add("Go to", "Risk and control matrix", "assembled view", () => { location.hash = "#/matrix"; }, "control");
  add("Go to", "Client questionnaire", "client-facing surface", () => { location.hash = "#/questionnaire"; }, "questionnaire");
  add("Go to", "Live interview cockpit", "future concept", () => { location.hash = "#/cockpit"; }, "people");

  if (st.S.generated) {
    const n = st.narrativeSummary();
    if (n.cleanReady.length)
      add("Do", `Accept ${n.cleanReady.length} clean sections`, "everything traced and unedited",
        () => st.act.acceptClean());
    if (st.claimQueue().length)
      add("Do", "Start the judgement queue", `${st.claimQueue().length} statements need you`,
        () => st.act.startFocus("claims"));
    if (!st.S.analysed && !st.narrativeSummary().pending)
      add("Do", "Analyse controls and findings", "step 4, against the reviewed understanding",
        () => { location.hash = "#/controls"; });
    if (st.controlSummary().pending)
      add("Do", "Review control recommendations", `${st.controlSummary().pending} to conclude`,
        () => { location.hash = "#/controls"; st.act.startFocus("controls"); });
    if (st.findingSummary().queue.length)
      add("Do", "Review findings", `${st.findingSummary().queue.length} to conclude`,
        () => { location.hash = "#/controls"; st.act.startFocus("findings"); });
    const tr = st.traceSummary();
    if (!tr.satisfied)
      add("Do", "Line walkthrough", tr.undecided
        ? `${tr.undecided} variants have no walkthrough decision`
        : `${tr.completed} of ${tr.required} required walkthroughs complete`,
        () => { location.hash = "#/trace"; });
    if (st.controlSummary().keyControls.length && !st.testingSatisfied())
      add("Do", "Control testing", st.testingScope().scopeDecided
        ? "conclude the scoped test" : "decide which key controls to test",
        () => { location.hash = "#/testing"; });
  }
  add("Do", "Guided demo", "the five-minute walkthrough", () => window.__demoStart());
  add("Do", "Keyboard shortcuts", "?", () => st.act.sheet("keys"));
  add("Do", "Reset the prototype", "back to the beginning", () => st.act.reset());

  processSteps.forEach((p) =>
    add("Process steps", p.name, `${p.actor} · ${p.system}`, () => {
      S.mapStep = p.id; location.hash = st.S.generated ? "#/controls" : "#/revenue";
    }));

  if (st.S.generated) narrative.forEach((sec) =>
    add("Sections", sec.heading, st.sectionState(sec).replace("_", " "), () => {
      S.reviewMode = "read"; S.section = sec.id; S.scrollTo = sec.id; location.hash = "#/understanding";
    }));

  if (st.S.analysed) controls.forEach((c) =>
    add("Controls", c.title, `${c.id} · ${c.owner || "no owner"}`, () => {
      const q = st.controlSummary().queue; const i = q.findIndex((x) => x.id === c.id);
      if (i >= 0) { S.focusKind = "controls"; S.focusIx = i; S.reviewMode = "focus"; }
      location.hash = "#/controls";
    }));

  if (st.S.analysed) st.allFindings().forEach((f) =>
    add("Findings", f.title, `${f.id}${f.fromTrace ? " · from the line walkthrough" : ""}`,
      () => { location.hash = "#/controls"; st.act.startFocus("findings"); }));

  if (st.S.analysed) risks.forEach((r) =>
    add("Risk signals (carried forward)", r.title, `${r.id} · ${r.lib || "new"}`,
      () => { location.hash = "#/matrix"; }));

  subProcesses.forEach((sp) => sp.items.forEach((it) =>
    add("Coverage", it.q, `${it.id} · ${sp.name}`, () => {
      S.disclosed.meth = true; location.hash = "#/interview";
    })));

  st.allOpenItems().forEach((i) =>
    add("Open items", i.title, `${i.id} · ${st.itemState(i).replace("_", " ")}`,
      () => { location.hash = "#/resolve"; }));

  variants.forEach((v) =>
    add("Process variants", v.name, `${v.value} · ${v.recognition}`,
      () => { location.hash = "#/trace"; }));

  Object.values(sources).forEach((s) =>
    add("Sources", s.name, s.detail, () => { location.hash = "#/interview"; }));

  add("Go to", "Clients", `${st.allClients().length} clients`, () => { location.hash = "#/clients"; }, "process");
  add("Go to", "Firm people", `${st.firmUsers().length} colleagues`, () => { location.hash = "#/people"; }, "people");
  add("Do", "New client", "create a client profile", () => { location.hash = "#/client/new"; }, "plus");
  add("Do", "New engagement", "a financial year for a client", () => { location.hash = "#/engagement/new"; }, "plus");

  st.allEngagements().forEach((e) => {
    const c = st.clientById(e.clientId);
    add("Engagements", `${c ? c.short : e.clientId} · ${e.fy}`,
      `${e.type}${e.id === st.S.engId ? " · open" : ""}`,
      () => { st.act.selectEngagement(e.id); location.hash = "#/engagement"; }, "process");
  });

  st.allClients().forEach((c) =>
    add("Clients", c.name, `${c.city || c.country} · ${c.sectorShort || ""}`,
      () => { st.act.openClient(c.id); location.hash = "#/client"; }, "process"));

  st.firmUsers().forEach((u) =>
    add("Firm people", u.name, `${u.role} · ${u.access}`, () => { location.hash = "#/people"; }, "people"));

  return items;
}

/** Subsequence match with a light score: prefix and word-start hits rank first. */
function score(q, text) {
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 1000;
  const at = t.indexOf(q);
  if (at === 0) return 900;
  if (at > 0) return 700 - at + (/\s/.test(t[at - 1]) ? 120 : 0);
  let i = 0;
  for (const ch of t) { if (ch === q[i]) i++; if (i === q.length) return 200; }
  return 0;
}

export function matches() {
  const q = S.palQuery.trim().toLowerCase();
  const scored = index()
    .map((it) => ({ it, s: Math.max(score(q, it.name), score(q, it.hint || "") * 0.6) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, q ? 24 : 12).map((x) => x.it);
}

const GROUP_IC = {
  Clients: "process", "Firm people": "people",
  Steps: "step", "Go to": "arrow", Do: "check", "Process steps": "map", Sections: "document",
  Controls: "control", Findings: "finding", "Risk signals (carried forward)": "finding",
  Coverage: "question", "Open items": "question", "Process variants": "variant",
  Sources: "transcript", Engagements: "process",
};

export function palette() {
  if (!S.palette) return "";
  const list = matches();
  let group = null;
  const rows = list.map((it, i) => {
    const head = it.group !== group ? `<div class="pal__g">${esc(it.group)}</div>` : "";
    group = it.group;
    return `${head}<button class="${cx("pal__i", i === S.palIx && "is-on")}"
      data-act="pal-run" data-ix="${i}">
      ${icon(it.ic || GROUP_IC[it.group] || "chevron", 16)}
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.name)}</span>
      ${it.hint ? `<span class="s">${esc(it.hint)}</span>` : ""}
    </button>`;
  }).join("");

  return `<div class="scrim" data-act="close-palette"></div>
  <div class="pal">
    <div class="pal__hd">${icon("search", 18)}
      <input class="pal__in" id="pal-in" autocomplete="off" spellcheck="false"
        placeholder="Search anything, or type a command"
        value="${esc(S.palQuery)}"></div>
    <div class="pal__list">${list.length ? rows : `<div class="pal__none">Nothing matches that.</div>`}</div>
    <div class="pal__ft">
      <span><span class="k">↑↓</span> move</span><span><span class="k">⏎</span> open</span>
      <span><span class="k">esc</span> close</span>
      <span class="sp" style="flex:1"></span><span>${list.length} results</span>
    </div>
  </div>`;
}

export function runPalette(ix) {
  const list = matches();
  const it = list[ix];
  if (!it) return;
  S.palette = false;
  it.run();
  st.commit();
}
