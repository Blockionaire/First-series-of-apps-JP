/* Step 7 — COMPLETE. The gates, the sign-off, and what leaves the building.
   Also holds the matrix (a view, not a destination) and the questionnaire.

   Corrections in this pass:
   · Sign-off is stateful. Ready for review, signed, submitted, in review,
     approved and reopened are six different things, and the process is only
     complete at the end of that sequence.
   · Gates are conditional. A gate that does not apply to this engagement is
     not shown as an unmet condition.
   · Being finished with the work is not the same as the process being
     complete. */

import { esc, cx, act as btn, row, dot, more, empty, callout, chip } from "../ui.js";
import { risks, controls, gaps } from "../data-model.js";
import { methodologyConfig, variants } from "../data-process.js";
import { client, engagement, user, firm, questionnaire, sources } from "../data-sources.js";
import * as st from "../state.js";
import { screen, idline } from "./shell.js";

const S = st.S;

/* ── Sign-off ────────────────────────────────────────────────────────────── */

const HEAD = {
  wip:       { t: "Revenue is not complete", d: (o, g) => `${o} of ${g} conditions are still open. Each links to the step that clears it.` },
  ready:     { t: "Revenue is ready to sign", d: () => "Every condition on the process-level interim work is met. The platform never signs — you do." },
  signed:    { t: "Revenue is ready for review", d: () => "Signed by the preparer. Ready for review is not the same as complete: the process closes when the reviewer approves it." },
  submitted: { t: "Revenue is with the reviewer", d: () => "Submitted for manager review. Nothing is expected from the preparer until the reviewer responds." },
  in_review: { t: "Revenue is being reviewed", d: () => "The reviewer has opened the file." },
  reopened:  { t: "Revenue has review points", d: () => "The reviewer sent it back. Clear the points, then resubmit — the preparer signature stands." },
  complete:  { t: "Revenue is complete", d: () => "Reviewed, approved and handed forward to risk analysis. The interim work on this process is closed." },
};

export function complete() {
  const gates = st.gateStates();
  const open = gates.filter((g) => !g.ok);
  const workGates = gates.filter((g) => !g.signature);
  const workOpen = workGates.filter((g) => !g.ok);
  const so = st.signOff();
  const ps = st.processState();
  const head = HEAD[ps.id] || HEAD.wip;
  const n = st.narrativeSummary();
  const cov = st.coverageSummary();
  const tr = st.traceSummary();
  const done = st.workComplete();

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">${esc(head.t)}</h1>
          <p class="t-lede" style="margin-top:10px">${esc(head.d(workOpen.length, workGates.length))}</p>
        </div>
        <div style="text-align:right;padding-top:4px">
          <div class="t-num" style="color:${done ? "var(--ok)" : "var(--ink-4)"}">${workGates.length - workOpen.length}/${workGates.length}</div>
          <div class="t-meta">conditions met</div>
        </div>
      </div>
    </div>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">The work</h2>
      <div class="rows">
        ${workGates.map((g) => row({
          lead: dot(g.ok ? "ok" : "open"),
          title: `<span class="${g.ok ? "" : "b"}">${esc(g.label)}</span>`,
          detail: esc(g.detail),
          side: g.ok ? `<span class="t-meta" style="color:var(--ok)">met</span>`
            : `<span class="t-meta" style="color:var(--warn)">open</span>`,
          ...(g.ok ? {} : { action: "nav", data: { href: gateHref(g) } }),
        })).join("")}
      </div>
      <p class="t-meta" style="margin-top:12px">
        Conditions that do not apply to this engagement are not listed. ${
          methodologyConfig.requiresPartnerReview ? "" : "Partner review, for one: " +
          methodologyConfig.partnerReviewNote.charAt(0).toLowerCase() + methodologyConfig.partnerReviewNote.slice(1)}
      </p>
    </section>

    <section style="margin-top:48px">
      <h2 class="t-h" style="margin-bottom:4px">Sign-off</h2>
      <p class="t-meta" style="margin-bottom:16px">
        Signing is what a person does, not what the platform does. Each signature records who and when.</p>

      <div class="rows">
        ${row({
          lead: dot(so.preparer === "signed" ? "ok" : "open"),
          title: `<span class="b">${esc(user.name)}</span>`,
          detail: so.preparer === "signed"
            ? "Prepared by · audit senior · signed"
            : done ? "Prepared by · audit senior · ready to sign"
            : "Prepared by · audit senior · waiting on the work",
          side: so.preparer === "signed"
            ? `<span class="state state--ok"><i class="dot dot--ok"></i>Signed</span>`
            : done ? btn("Sign as preparer", "sign-preparer", { variant: "ok", size: "sm" })
            : `<span class="t-meta">waiting</span>`,
        })}
        ${st.reviewRequired() ? row({
          lead: dot(so.review === "approved" ? "ok" : so.review === "reopened" ? "alert" : "open"),
          title: `<span class="b">${esc(engagement.team[1].name)}</span>`,
          detail: so.review === "approved" ? "Reviewed by · manager · approved"
            : so.review === "reopened" ? "Reviewed by · manager · sent back with review points"
            : so.review === "in_review" ? "Reviewed by · manager · reviewing now"
            : so.review === "submitted" ? "Reviewed by · manager · submitted, not yet opened"
            : so.preparer === "signed" ? "Reviewed by · manager · ready to submit"
            : "Reviewed by · manager · waiting for the preparer",
          side: so.review === "approved"
            ? `<span class="state state--ok"><i class="dot dot--ok"></i>Approved</span>`
            : `<span class="t-meta">${so.review === "not_submitted" ? "not submitted" : esc(so.review.replace("_", " "))}</span>`,
        }) : ""}
        ${row({
          lead: dot(""),
          title: `<span style="color:var(--ink-4)">${esc(engagement.team[0].name)}</span>`,
          detail: "Engagement partner",
          side: `<span class="t-meta">${methodologyConfig.requiresPartnerReview ? "review required" : "no review required at process level"}</span>`,
        })}
      </div>

      ${!done ? `<p class="t-meta" style="margin-top:14px">
        Blocked by ${esc(workOpen.map((g) => g.label.toLowerCase()).join(", "))}.</p>` : ""}

      ${done && so.preparer !== "signed" ? `<div class="acts" style="margin-top:20px">
        ${btn("Sign as preparer", "sign-preparer", { variant: "go", size: "lg", key: "Enter" })}
      </div>
      <p class="t-meta" style="margin-top:10px;max-width:64ch">
        Signing does not complete the process. It records that the work is finished and makes it
        ready for review.</p>` : ""}

      ${so.preparer === "signed" && st.reviewRequired() && ["not_submitted", "reopened"].includes(so.review) ? `
        <div class="acts" style="margin-top:20px">
          ${btn(so.review === "reopened" ? "Resubmit for review" : "Submit for manager review",
            "submit-review", { variant: "go", size: "lg", key: "Enter" })}
        </div>` : ""}

      ${so.review === "reopened" ? callout(`<b>Sent back with review points.</b> In the product the
        points would be listed here as their own queue, each attached to the statement, control or
        finding it concerns. Clearing them and resubmitting is the same loop as any other queue in
        this file.`, "alert") : ""}

      ${["submitted", "in_review"].includes(so.review) ? `
        <div style="margin-top:26px;padding-top:20px;border-top:1px dashed var(--line-2)">
          <div class="t-eyebrow" style="margin-bottom:8px">Acting as the reviewer — prototype only</div>
          <p class="t-meta" style="margin-bottom:12px;max-width:64ch">
            One person plays both roles here. In the product these actions belong to the manager and
            the preparer never sees them.</p>
          <div class="acts">
            ${so.review === "submitted" ? btn("Open the file for review", "reviewer", { data: { d: "in_review" } }) : ""}
            ${btn("Approve — complete the process", "reviewer", { variant: "ok", data: { d: "approved" } })}
            ${btn("Send back with review points", "reviewer", { data: { d: "reopened" } })}
          </div>
        </div>` : ""}

      ${ps.id === "complete" ? callout(`<b>Complete.</b> The process-level interim work on Revenue is
        finished, reviewed and approved. What it produced is listed below and is now an input to risk
        analysis — which is a different phase and deliberately not part of this product.`, "ok") : ""}
    </section>

    <section style="margin-top:48px">
      <h2 class="t-h" style="margin-bottom:4px">Export</h2>
      <p class="t-meta" style="margin-bottom:16px">
        Only approved content is included. Statements recorded as not obtained <em>are</em> included —
        an incomplete understanding has to look incomplete in the file.</p>
      <div class="rows">
        ${[
          ["Process narrative", "DOCX · firm template, sign-off block, sources as footnotes"],
          ["Risk and control matrix", "XLSX · one row per risk-control pair"],
          ["Control deficiencies", "DOCX · the ISA 265 management letter draft"],
          ["Canonical engagement export", "JSON · every statement with its evidence references"],
        ].map(([t, d]) => row({
          title: esc(t), detail: esc(d),
          side: btn(ps.id === "complete" ? "Generate" : "Draft", "mock", { size: "sm" }),
        })).join("")}
        ${row({ title: `<span style="color:var(--ink-4)">Push to the audit file system</span>`,
          detail: "Caseware, CCH or the firm's own file system",
          side: `<span class="t-meta">not built</span>` })}
      </div>
    </section>

    <section style="margin-top:48px">
      <h2 class="t-h" style="margin-bottom:4px">Carried forward to risk analysis</h2>
      <p class="t-meta" style="margin-bottom:16px">
        Completing Revenue closes the process-level interim work. It does not assess risks of
        material misstatement — that is the next phase, and these are its inputs.</p>
      <div class="rows">
        ${row({ lead: dot(n.pending ? "open" : "ok"), title: "<span class=\"b\">Process understanding</span>",
          detail: "The approved narrative, the process map, and the facts behind both",
          side: `<span class="t-meta">${n.approved} sections</span>` })}
        ${row({ lead: dot("ok"), title: "<span class=\"b\">Risk and control matrix</span>",
          detail: `${st.riskSummary().total} identified risk signals against ${st.controlSummary().total} controls, with provenance`,
          side: `<span class="t-meta">${st.rcmRows().length} rows</span>`,
          action: "nav", data: { href: "#/matrix" } })}
        ${row({ lead: dot(st.findingSummary().pending.length ? "open" : "ok"), title: "<span class=\"b\">Findings</span>",
          detail: "Deficiencies and observations for the ISA 265 communication to management",
          side: `<span class="t-meta">${st.findingSummary().confirmed} confirmed</span>` })}
        ${row({ lead: dot(tr.exceptions ? "alert" : tr.satisfied ? "ok" : "open"),
          title: "<span class=\"b\">Line walkthrough results</span>",
          detail: tr.satisfied
            ? `${tr.completed} of ${variants.length} variants walked through · ${tr.exceptions} exception${tr.exceptions === 1 ? "" : "s"} · the rest documented as not requiring one`
            : `${tr.completed} of ${tr.required} required walkthroughs complete`,
          side: `<span class="t-meta">${tr.satisfied ? "settled" : "open"}</span>` })}
        ${row({ lead: dot(st.openItemSummary().carried.length ? "warn" : "ok"),
          title: "<span class=\"b\">Matters carried forward</span>",
          detail: st.openItemSummary().carried.length
            ? st.openItemSummary().carried.map((i) => `${esc(i.id)} → ${esc(st.itemCarry(i)?.destination || "unspecified")}`).join(" · ")
            : "Nothing carried forward — every open matter was settled during interim",
          side: `<span class="t-meta">${st.openItemSummary().carried.length}</span>`,
          action: "nav", data: { href: "#/resolve" } })}
      </div>
    </section>

    <section style="margin-top:44px">
      ${more("footer", "What the export footer records", `<div class="meth"><dl>
        <dt>entity</dt><dd>${esc(client.name)}</dd>
        <dt>engagement</dt><dd>${esc(engagement.id)} · FY2026 interim</dd>
        <dt>process state</dt><dd>${esc(ps.label)}</dd>
        <dt>sources</dt><dd>${Object.keys(sources).length} — transcript, questionnaire, three documents, auditor notes</dd>
        <dt>coverage</dt><dd>${cov.covered} of ${cov.applicable} applicable areas · ${cov.na} not applicable</dd>
        <dt>documentation</dt><dd>${n.approved} sections approved · ${n.rejected} rejected</dd>
        <dt>pack</dt><dd>revenue v0.1.0</dd>
        <dt>ai assistance</dt><dd>Used. Stage models and prompt versions recorded.</dd>
        <dt>prepared by</dt><dd>${esc(user.name)}${so.preparer === "signed" ? " · signed" : " · unsigned"}</dd>
        <dt>reviewed by</dt><dd>${st.reviewRequired()
          ? esc(engagement.team[1].name) + (so.review === "approved" ? " · approved" : " · " + so.review.replace("_", " "))
          : "no process-level review required"}</dd>
      </dl></div>`, S.disclosed.footer)}
    </section>
  `;

  return screen("complete", body);
}

/* Each gate links to the step that clears it. */
const STEP_HREF = {
  prepare: "#/prepare", interview: "#/interview", understanding: "#/understanding",
  controls: "#/controls", trace: "#/trace", testing: "#/testing", complete: "#/complete",
};
const gateHref = (g) => (g.id === "openItems" ? "#/resolve" : STEP_HREF[g.step] || "#/revenue");

/* ── Matrix — a view reached from step 4, not a destination ──────────────── */

export function matrix() {
  const rows = st.rcmRows();
  const NAT = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent" };

  const body = `
    <div class="head">
      <button class="b-link" data-act="nav" data-href="#/controls">← Back to controls and findings</button>
      <h1 class="t-title" style="margin-top:10px">Risk and control matrix</h1>
      <p class="t-lede" style="margin-top:10px">
        A view of work recorded elsewhere, not a place where work happens. The controls carry the
        conclusions you recorded in step 4. The risk signals are identified but not assessed —
        assessing them is risk analysis, which reads this matrix rather than being done inside it.
      </p>
    </div>

    <div class="rows" style="margin-top:32px">
      ${rows.map(({ risk: r, control: c, gap: g }) => {
        const cd = c ? st.controlDecision(c) : null;
        return `<div class="rw" style="display:block">
          <div class="row row--top" style="gap:20px">
            <span class="rw__lead" style="padding-top:5px">${dot(
              c ? (cd === "key" ? "ok" : "") : "alert")}</span>
            <span class="rw__main">
              <span class="rw__t">${esc(r.title)}</span>
              <span class="rw__d" style="margin-top:5px">
                ${c ? esc(c.title) : `<span style="color:var(--alert)">No control identified — gap ${esc(g?.id || "")}</span>`}
              </span>
              <span class="rw__d" style="margin-top:6px">
                ${r.assertions.map((a) => `<span class="chip">${esc(a.replace(/_/g, " "))}</span>`).join(" ")}
                ${c ? `<span class="chip">${esc(NAT[c.nature])}</span>` : ""}
                ${c && c.owner ? `<span class="chip">${esc(c.owner)}</span>` : ""}
              </span>
            </span>
            <span class="rw__side">
              <div class="t-meta">${esc(r.rating)} — proposed${r.significant ? ", flagged significant" : ""}</div>
              ${c ? `<div class="t-meta" style="margin-top:4px">${cd === "key" ? "key control"
                : cd === "not_key" ? "not key"
                : cd === "carried_forward" ? "carried forward undecided"
                : cd === "undecided" ? "parked, not concluded"
                : `proposed: ${c.keyProposal === true ? "key" : c.keyProposal === false ? "not key" : "unclear"}`}</div>` : ""}
            </span>
          </div>
        </div>`;
      }).join("")}
    </div>

    <p class="t-meta" style="margin-top:18px;max-width:74ch">
      Risk ratings shown here are the methodology pack's proposals. Nothing on this screen is an
      assessed risk of material misstatement, and nothing on it can be concluded here.</p>

    <div class="acts" style="margin-top:28px">
      ${btn("Export to Excel", "mock")}
      ${btn("Back to controls and findings", "nav", { variant: "plain", data: { href: "#/controls" } })}
    </div>
  `;

  return screen("complete", body, { width: "wide" });
}

/* ── Client questionnaire — a separate, plainer surface ──────────────────── */

export function clientSurface() {
  const answeredNow = questionnaire.filter((q) => st.questionState(q) === "answer");
  const outstanding = questionnaire.filter((q) => !["answer"].includes(st.questionState(q)));
  const current = outstanding.find((q) => !S.answers[q.n]) || outstanding[0];
  const handled = questionnaire.filter((q) => S.answers[q.n]);

  const outcome = (q) => {
    const a = S.answers[q.n];
    if (!a) return "";
    return a.kind === "answer"
      ? `<div class="t-meta" style="margin-top:8px">Sent. Your auditor has it.</div>`
      : a.kind === "unknown"
      ? `<div class="t-meta" style="margin-top:8px">Recorded as unable to answer. Your auditor will find another route — you do not need to do anything.</div>`
      : `<div class="t-meta" style="margin-top:8px">A call has been requested. Your auditor will get in touch.</div>`;
  };

  return `<div class="cq">
    <header class="cq__bar">
      <div>
        <div class="b">Revenue — a few questions</div>
        <div class="t-meta" style="margin-top:2px">${esc(firm.name)} · ${esc(client.name)}</div>
      </div>
      <span class="sp"></span>
      <span class="t-meta">${answeredNow.length} of ${questionnaire.length} answered</span>
      ${btn("Back to the auditor view", "nav", { size: "sm", data: { href: "#/interview" } })}
    </header>

    <div class="cq__body">
      <p class="t-lede" style="margin-bottom:40px">
        Bas — these are about how sales get recorded. Answer in your own words; there are no wrong
        answers, and you can stop and come back.
      </p>

      ${current && !S.answers[current.n] ? `
        <div class="t-meta" style="margin-bottom:12px">Question ${current.n}</div>
        <h2 class="cq__q">${esc(current.q)}</h2>
        <p class="t-sub" style="margin-top:10px">${current.origin === "deterministic_trigger"
          ? "Following up on what you told us about price changes."
          : "Following up on the German distributor you mentioned."}</p>
        <textarea class="field" id="q-${current.n}" rows="4" style="margin-top:22px" placeholder="Type your answer…"></textarea>
        <div class="acts" style="margin-top:14px">
          ${btn("Send", "answer-send", { variant: "go", data: { n: current.n } })}
          ${btn("I don't know", "answer-unknown", { data: { n: current.n } })}
          ${btn("Rather have a call", "answer-call", { variant: "plain", data: { n: current.n } })}
        </div>
        <p class="t-meta" style="margin-top:14px;max-width:60ch">
          The three do different things. An answer settles the point. "I don't know" and a call
          request both go back to your auditor as something for them to pick up — nothing is lost
          and nothing is guessed.</p>`
        : `<h2 class="cq__q">That's everything — thank you.</h2>
           <p class="t-sub" style="margin-top:8px">Your auditor has been notified.</p>`}

      ${handled.length ? `<div style="margin-top:52px">
        <div class="t-eyebrow" style="margin-bottom:8px">Just now</div>
        ${handled.map((q) => `<div class="cq__done">
          <div class="qq">${esc(q.q)}</div>
          <div class="aa">${esc(S.answers[q.n].text || (S.answers[q.n].kind === "unknown" ? "I don't know" : "I'd rather have a call"))}</div>
          ${outcome(q)}
        </div>`).join("")}
      </div>` : ""}

      <div style="margin-top:52px">
        <div class="t-eyebrow" style="margin-bottom:8px">Already answered</div>
        ${[...questionnaire.filter((q) => q.a)].reverse().slice(0, 5).map((q) => `<div class="cq__done">
          <div class="qq">${esc(q.q)}</div>
          <div class="aa">${esc(q.a)}</div>
          ${q.flag === "contradiction" ? `<div class="t-meta" style="margin-top:8px">
            Thank you — we'll check this against what the finance team told us.</div>` : ""}
          ${q.flag === "new_topic" ? `<div class="t-meta" style="margin-top:8px">
            One follow-up added about how that stock is treated at the year end.</div>` : ""}
        </div>`).join("")}
      </div>

      <p class="t-meta" style="margin-top:40px">
        These questions are about process, not about any customer or personal data.
        Only ${esc(firm.name)} can see your answers.
      </p>
    </div>
  </div>`;
}
