/* Work — the cross-engagement view. Not a dashboard: a short answer to
   "what needs me?", led by the single most useful next action. */

import { esc, act as btn, row, dot, empty, callout } from "../ui.js";
import { client, user, engagement } from "../data-sources.js";
import * as st from "../state.js";
import { idline } from "./shell.js";

export function work() {
  const next = st.nextAction();
  const n = st.narrativeSummary();
  const oi = st.openItemSummary();
  const cov = st.coverageSummary();
  const rs = st.riskSummary();
  const cs = st.controlSummary();

  const needs = [
    oi.contradictions && {
      tone: "alert", t: "Two sources disagree about who can change a credit limit",
      d: "Blocks one statement, one control and one risk", href: "#/resolve",
    },
    st.S.generated && n.needsSource.length && {
      tone: "warn", t: `${n.needsSource.length} statements have no support`,
      d: "They cannot be approved until you resolve them", href: "#/understanding",
    },
    cov.mandatoryOpen.length && {
      tone: "warn", t: `${cov.mandatoryOpen.length} required areas are still open`,
      d: `${cov.mandatoryOpen.map((i) => i.plain || i.q).slice(0, 1)}`, href: "#/interview",
    },
    st.S.generated && cs.pending && {
      tone: "", t: `${cs.pending} controls to conclude`,
      d: `${cs.suggestedKey} are suggested as key controls`, href: "#/controls",
    },
    st.S.generated && st.findingSummary().fromTraceOpen.length && {
      tone: "alert", t: "The line walkthrough raised a finding",
      d: "Tracing a real transaction changed the documented understanding", href: "#/controls",
    },
    st.S.generated && !st.traceSummary().satisfied && {
      tone: "", t: st.traceSummary().undecided
        ? "Some Revenue variants have no line-walkthrough decision"
        : "A required line walkthrough is outstanding",
      d: "The line walkthrough tests the process model against reality", href: "#/trace",
    },
    oi.sent && {
      tone: "", t: `${oi.sent} questions are with the client`,
      d: "Sent 20 September · no response yet", href: "#/resolve",
    },
  ].filter(Boolean);

  return `${idline()}
  <div class="canvas"><div class="wrap">

    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Good morning, ${esc(user.name.split(" ")[0])}</h1>
          <p class="t-sub" style="margin-top:6px">One engagement in interim fieldwork.</p>
        </div>
        <span class="t-meta nowrap" style="padding-top:12px">Saturday 6 September 2026</span>
      </div>
    </div>

    <button class="rw" data-act="nav" data-href="${esc(next.href)}"
      style="border-top:1px solid var(--line);padding:26px 4px">
      <span class="rw__main">
        <span class="t-eyebrow">Start here</span>
        <span class="t-h" style="display:block;margin:8px 0 5px">${esc(next.t)}</span>
        <span class="t-sub" style="display:block">${esc(next.d)}</span>
      </span>
      <span class="rw__side" style="padding-top:26px;font-size:19px;color:var(--ink-5)">›</span>
    </button>

    <div style="margin-top:52px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Also waiting</h2>
      ${needs.length ? `<div class="rows">${needs.slice(1).map((x) => row({
        lead: dot(x.tone === "alert" ? "alert" : x.tone === "warn" ? "warn" : "open"),
        title: esc(x.t), detail: esc(x.d),
        side: `${esc(client.short)} · Revenue`,
        action: "nav", data: { href: x.href },
      })).join("")}</div>`
        : empty("Nothing else is waiting", "Everything that needed you has been dealt with.")}
    </div>

    <div style="margin-top:52px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Engagements</h2>
      <div class="rows">
        ${row({
          title: `<span class="b">${esc(client.name)}</span>`,
          detail: `FY2026 · Interim · Revenue — ${st.processProgress().current.name}`,
          side: `<span class="b" style="color:var(--ink-2)">step ${st.processProgress().current.n} of 7</span><div class="t-meta">${cov.pct}% understood</div>`,
          action: "nav", data: { href: "#/engagement" },
        })}
        ${row({
          title: `<span class="b">Meerveld Zorggroep</span>`,
          detail: "FY2026 · Interim not started", side: `<span class="t-meta">—</span>`,
          action: "mock",
        })}
        ${row({
          title: `<span class="b">Brekelmans Bouw B.V.</span>`,
          detail: "FY2025 · Signed 22 May 2026", side: `<span class="t-meta">closed</span>`,
          action: "mock",
        })}
      </div>
    </div>

    <div style="margin-top:52px">
      ${callout(`<b>This is a prototype.</b> Fictional client, mock data, no model call and no
        network request. Press <span class="mono">⌘K</span> to search or jump anywhere,
        <span class="mono">?</span> for the shortcuts, and
        <button class="b-link" data-act="demo-start">start the guided demo</button>
        for the five-minute walkthrough.`)}
    </div>

  </div></div>`;
}
