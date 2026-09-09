/* ⌘K — the navigation.

   Everything not on the four-stage spine is two keystrokes away: sections,
   risks, controls, coverage areas, sources, open items, other engagements,
   and actions. This is how the target user already navigates. */

import { esc, cx } from "./ui.js";
import { narrative, risks, controls, subProcesses, openItems } from "./data-model.js";
import { processSteps, lineWalk } from "./data-process.js";
import { sources, client } from "./data-sources.js";
import * as st from "./state.js";

const S = st.S;

function index() {
  const items = [];
  const add = (group, name, hint, run, keep) => items.push({ group, name, hint, run, keep });

  st.journeyStates().forEach((s) =>
    add("Steps", `${s.n}. ${s.name}`, s.c, () => { location.hash = s.href; }));

  add("Go to", "Revenue process home", "the map and the journey", () => { location.hash = "#/revenue"; });
  add("Go to", "Engagement", "client, year, processes", () => { location.hash = "#/engagement"; });
  add("Go to", "Open items", `${st.openItemSummary().open} open`, () => { location.hash = "#/resolve"; });
  add("Go to", "Read the working paper", "the full narrative",
    () => { S.reviewMode = "read"; location.hash = "#/understanding"; });
  add("Go to", "Risk and control matrix", "assembled view", () => { location.hash = "#/matrix"; });
  add("Go to", "Client questionnaire", "client-facing surface", () => { location.hash = "#/questionnaire"; });
  add("Go to", "Live walkthrough cockpit", "future concept", () => { location.hash = "#/cockpit"; });

  if (st.S.generated) {
    const n = st.narrativeSummary();
    if (n.cleanReady.length)
      add("Do", `Accept ${n.cleanReady.length} clean sections`, "everything traced and unedited",
        () => st.act.acceptClean());
    if (st.claimQueue().length)
      add("Do", "Start the judgement queue", `${st.claimQueue().length} statements need you`,
        () => st.act.startFocus("claims"));
    if (st.controlSummary().pending)
      add("Do", "Review control recommendations", `${st.controlSummary().pending} to conclude`,
        () => { location.hash = "#/controls"; st.act.startFocus("controls"); });
    if (st.findingSummary().queue.length)
      add("Do", "Review findings", `${st.findingSummary().queue.length} to conclude`,
        () => { location.hash = "#/controls"; st.act.startFocus("findings"); });
    if (!st.traceSummary().concluded)
      add("Do", "Line walkthrough", st.traceSummary().started
        ? `${st.traceSummary().done} of ${st.traceSummary().expected} steps traced` : "trace a transaction",
        () => { location.hash = "#/trace"; });
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

  if (st.S.generated) controls.forEach((c) =>
    add("Controls", c.title, `${c.id} · ${c.owner || "no owner"}`, () => {
      const q = st.controlSummary().queue; const i = q.findIndex((x) => x.id === c.id);
      if (i >= 0) { S.focusKind = "controls"; S.focusIx = i; S.reviewMode = "focus"; }
      location.hash = "#/controls";
    }));

  if (st.S.generated) st.allFindings().forEach((f) =>
    add("Findings", f.title, `${f.id}${f.fromTrace ? " · from the line walkthrough" : ""}`,
      () => { location.hash = "#/controls"; st.act.startFocus("findings"); }));

  if (st.S.generated) risks.forEach((r) =>
    add("Risks (carried forward)", r.title, `${r.id} · ${r.lib || "new"}`,
      () => { location.hash = "#/matrix"; }));

  subProcesses.forEach((sp) => sp.items.forEach((it) =>
    add("Coverage", it.q, `${it.id} · ${sp.name}`, () => {
      S.disclosed.meth = true; location.hash = "#/walkthrough";
    })));

  openItems.forEach((i) =>
    add("Open items", i.title, `${i.id} · ${st.itemState(i)}`, () => { location.hash = "#/resolve"; }));

  Object.values(sources).forEach((s) =>
    add("Sources", s.name, s.detail, () => { location.hash = "#/walkthrough"; }));

  add("Engagements", client.name, "FY2026 interim · Revenue", () => { location.hash = "#/engagement"; });
  add("Engagements", "Meerveld Zorggroep", "FY2026 · not started", () => { location.hash = "#/"; });
  add("Engagements", "Brekelmans Bouw B.V.", "FY2025 · signed", () => { location.hash = "#/"; });

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

export function palette() {
  if (!S.palette) return "";
  const list = matches();
  let group = null;
  const rows = list.map((it, i) => {
    const head = it.group !== group ? `<div class="pal__g">${esc(it.group)}</div>` : "";
    group = it.group;
    return `${head}<button class="${cx("pal__i", i === S.palIx && "is-on")}"
      data-act="pal-run" data-ix="${i}">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.name)}</span>
      ${it.hint ? `<span class="s">${esc(it.hint)}</span>` : ""}
    </button>`;
  }).join("");

  return `<div class="pal-scrim" data-act="close-palette"></div>
  <div class="pal">
    <input class="pal__in" id="pal-in" autocomplete="off" spellcheck="false"
      placeholder="Search sections, risks, controls, areas, sources — or type a command"
      value="${esc(S.palQuery)}">
    <div class="pal__list">${list.length ? rows : `<div class="pal__none">Nothing matches that.</div>`}</div>
    <div class="pal__foot">
      <span>↑↓ move</span><span>Enter opens</span><span>esc close</span>
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
