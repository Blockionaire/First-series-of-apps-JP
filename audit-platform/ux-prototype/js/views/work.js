/* Work — across engagements. One question, not a dashboard.

   Density: calm. The next action owns the screen; everything else is a quiet
   list beneath it. There are no metric tiles here and there never will be. */

import { esc, act as btn, row, rows, dot, icon, empty, callout, nextAction, tag } from "../ui.js";
import { client, user, engagement } from "../data-sources.js";
import * as st from "../state.js";
import { header } from "./shell.js";

export function work() {
  /* The queue below belongs to the engagement that is open. Audit work is
     engagement-scoped, so an engagement with no loaded process file shows its
     own honest status rather than somebody else's step 4. */
  const hasWork = st.processWorkspaceAvailable();
  const next = hasWork ? st.nextAction() : engagementNext();
  const n = st.narrativeSummary();
  const oi = st.openItemSummary();
  const cov = st.coverageSummary();
  const cs = st.controlSummary();
  const fs = st.findingSummary();
  const tr = st.traceSummary();
  const prog = st.processProgress();

  const waiting = !hasWork ? [] : [
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

    <div class="lay lay--equal sec--loose">
    <section>
      <div class="sec__h"><h2 class="t-eyebrow">Also waiting</h2></div>
      ${waiting.length ? rows(waiting.map((x) => row({
        lead: icon(x.ic, 17),
        title: esc(x.t), detail: esc(x.d),
        side: `<span class="t-meta">${esc(st.activeClient().short)} · Revenue</span>`,
        action: "nav", data: { href: x.href },
        mod: x.tone === "alert" ? "conflict" : x.tone === "warn" ? "attn" : "",
      })).join(""))
        : hasWork
        ? empty("Nothing else is waiting", "Everything that needed you has been dealt with.", "check")
        : empty(`Nothing is waiting on ${st.activeClient().short} ${st.activeEngagement().fy}`,
            "No process work has been started on this engagement.", "check")}
    </section>

    <section>
      <div class="sec__h">
        <h2 class="t-eyebrow">Engagements</h2>
        <span class="sp"></span>
        ${btn("All clients", "nav", { variant: "ghost", size: "sm", data: { href: "#/clients" } })}
      </div>
      ${rows(st.allEngagements().map((e) => {
        const c = st.clientById(e.clientId);
        // Only an engagement that has its own loaded process file may show
        // process progress. Everything else shows engagement-level status.
        const live = st.processWorkspaceAvailable(e, "revenue");
        const active = e.id === st.S.engId;
        return row({
          lead: icon("process", 17),
          title: `<span class="${live || active ? "b" : "b ink3"}">${esc(c ? c.name : e.clientId)}</span>`,
          detail: `${esc(e.fy)} · ${esc(e.type)} · ${
            e.phase === "complete" ? "completed"
            : live ? `Interim · Revenue — ${esc(prog.current.name)}`
            : e.phase === "interim" ? "Interim · Revenue not started"
            : `${esc(e.phase)} in progress`}`,
          side: live
            ? `<span class="b ink2">Step ${prog.current.n} of 7</span>
               <div class="t-meta">${cov.pct}% understood</div>`
            : `<span class="t-meta">${e.phase === "complete" ? "closed"
                : active ? "open" : "—"}</span>`,
          action: "open-engagement", data: { id: e.id },
        });
      }).join(""))}
    </section>
    </div>

    <section class="sec--loose">
      ${callout(`<b>This is a prototype.</b> Fictional client, mock data, no model call and no
        network request. Press <span class="mono">⌘K</span> to search or jump anywhere,
        <span class="mono">?</span> for the shortcuts, and
        <button class="lnk" data-act="demo-start">start the guided demo</button>
        for the full walkthrough — or
        <button class="lnk" data-act="demo-client">see the client's experience</button>
        in three minutes.`)}
    </section>
  `;

  return `${header(null)}<div class="canvas"><div class="wrap wrap--overview page-in">${body}</div></div>`;
}

/** What comes next on an engagement with no loaded process file. Engagement
 *  level, never a step number borrowed from another engagement. */
function engagementNext() {
  const e = st.activeEngagement();
  const c = st.activeClient();
  const inScope = (e?.processes || []).includes("revenue");
  if (e?.phase === "complete") {
    return { t: `${c.short} ${e.fy} is closed`,
      d: "Nothing is outstanding. Open another engagement to carry on.", href: "#/engagement" };
  }
  return {
    t: `Open ${c.short} ${e.fy}`,
    d: inScope
      ? "Revenue is in scope and has not been started on this engagement."
      : "Set the scope for interim on this engagement.",
    href: "#/engagement",
  };
}
