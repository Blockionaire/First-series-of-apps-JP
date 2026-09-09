/* Work — across engagements. One question, not a dashboard.

   Density: calm. The next action owns the screen; everything else is a quiet
   list beneath it. There are no metric tiles here and there never will be. */

import { esc, act as btn, row, rows, dot, icon, empty, callout, nextAction, tag } from "../ui.js";
import { client, user, engagement } from "../data-sources.js";
import * as st from "../state.js";
import { header } from "./shell.js";

const ENGAGEMENTS = [
  { name: "Meerveld Zorggroep", detail: "FY2026 · Interim not started", side: "—", act: "mock" },
  { name: "Brekelmans Bouw B.V.", detail: "FY2025 · Signed 22 May 2026", side: "closed", act: "mock" },
];

export function work() {
  const next = st.nextAction();
  const n = st.narrativeSummary();
  const oi = st.openItemSummary();
  const cov = st.coverageSummary();
  const cs = st.controlSummary();
  const fs = st.findingSummary();
  const tr = st.traceSummary();
  const prog = st.processProgress();

  const waiting = [
    oi.contradictions && {
      tone: "alert", ic: "contradiction",
      t: "Two sources disagree about who can change a credit limit",
      d: "Blocks a statement, a control and a coverage area at once", href: "#/resolve",
    },
    st.S.generated && n.needsSource.length && {
      tone: "warn", ic: "evidence", t: `${n.needsSource.length} statements have no support`,
      d: "They cannot be approved until you deal with them", href: "#/understanding",
    },
    cov.mandatoryOpen.length && {
      tone: "warn", ic: "question", t: `${cov.mandatoryOpen.length} required areas are still open`,
      d: cov.mandatoryOpen[0].plain || cov.mandatoryOpen[0].q, href: "#/interview",
    },
    st.S.generated && !st.S.analysed && !n.pending && {
      tone: "", ic: "control", t: "Controls and findings have not been analysed",
      d: "The understanding is reviewed; step 4 runs against it", href: "#/controls",
    },
    st.S.analysed && fs.fromTraceOpen.length && {
      tone: "alert", ic: "walkthrough", t: "The line walkthrough raised a finding",
      d: "Tracing a real transaction changed the documented understanding", href: "#/controls",
    },
    st.S.analysed && cs.pending && {
      tone: "", ic: "control", t: `${cs.pending} controls to conclude`,
      d: `${cs.suggestedKey} are suggested as key controls`, href: "#/controls",
    },
    st.S.analysed && !tr.satisfied && {
      tone: "", ic: "walkthrough",
      t: tr.undecided ? "Some Revenue variants have no walkthrough decision"
        : "A required line walkthrough is outstanding",
      d: "The walkthrough tests the process model against reality", href: "#/trace",
    },
    st.openReviewPoints().length && {
      tone: "alert", ic: "reviewpoint",
      t: `${st.openReviewPoints().length} review point${st.openReviewPoints().length === 1 ? "" : "s"} to answer`,
      d: "The reviewer sent Revenue back", href: "#/complete",
    },
    oi.sent && {
      tone: "", ic: "questionnaire", t: `${oi.sent} questions are with the client`,
      d: "Sent 20 September · no response yet", href: "#/resolve",
    },
  ].filter(Boolean).filter((x) => x.href !== next.href || x.t !== next.t).slice(0, 4);

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Good morning, ${esc(user.name.split(" ")[0])}</h1>
          <p class="t-lede">One engagement in interim fieldwork.</p>
        </div>
        <span class="t-meta nowrap">Saturday 6 September 2026</span>
      </div>
    </div>

    ${nextAction(next)}

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Also waiting</h2></div>
      ${waiting.length ? rows(waiting.map((x) => row({
        lead: icon(x.ic, 17),
        title: esc(x.t), detail: esc(x.d),
        side: `<span class="t-meta">${esc(client.short)} · Revenue</span>`,
        action: "nav", data: { href: x.href },
        mod: x.tone === "alert" ? "conflict" : x.tone === "warn" ? "attn" : "",
      })).join(""))
        : empty("Nothing else is waiting", "Everything that needed you has been dealt with.", "check")}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Engagements</h2></div>
      ${rows(`
        ${row({
          lead: icon("process", 17),
          title: `<span class="b">${esc(client.name)}</span>`,
          detail: `FY2026 · Interim · Revenue — ${esc(prog.current.name)}`,
          side: `<span class="b ink2">Step ${prog.current.n} of 7</span>
                 <div class="t-meta">${cov.pct}% understood</div>`,
          action: "nav", data: { href: "#/engagement" },
        })}
        ${ENGAGEMENTS.map((e) => row({
          lead: icon("process", 17),
          title: `<span class="b ink3">${esc(e.name)}</span>`,
          detail: esc(e.detail),
          side: `<span class="t-meta">${esc(e.side)}</span>`,
          action: e.act,
        })).join("")}`)}
    </section>

    <section class="sec--loose">
      ${callout(`<b>This is a prototype.</b> Fictional client, mock data, no model call and no
        network request. Press <span class="mono">⌘K</span> to search or jump anywhere,
        <span class="mono">?</span> for the shortcuts, and
        <button class="lnk" data-act="demo-start">start the guided demo</button>
        for the full walkthrough.`)}
    </section>
  `;

  return `${header(null)}<div class="canvas"><div class="wrap wrap--narrow page-in">${body}</div></div>`;
}
