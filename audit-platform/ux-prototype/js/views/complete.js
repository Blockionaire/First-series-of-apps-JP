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

import { esc, cx, act as btn, row, rows, dot, tag, icon, more, empty, callout, chip, card } from "../ui.js";
import { risks, controls, gaps } from "../data-model.js";
import { methodologyConfig, variants } from "../data-process.js";
import { client, engagement, user, firm, questionnaire, sources } from "../data-sources.js";
import * as st from "../state.js";
import { screen, idline } from "./shell.js";
import { portalShell } from "./portal.js";

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
          <h1 class="t-display">${esc(head.t)}</h1>
          <p class="t-lede">${esc(head.d(workOpen.length, workGates.length))}</p>
        </div>
        <div class="tally">
          <div><span class="tally__n" style="color:${done ? "var(--ok)" : "var(--ink-4)"}">${
            workGates.length - workOpen.length}<span class="ink4">/${workGates.length}</span></span>
            <span class="tally__l">conditions met</span></div>
        </div>
      </div>
    </div>

    <div class="lay lay--equal sec">
    <section>
      <div class="sec__h"><h2 class="t-eyebrow">The work</h2></div>
      ${rows(workGates.map((g) => row({
        lead: g.ok ? `<span class="state state--ok">${icon("check", 17)}</span>`
          : `<span class="state state--warn">${icon("gate", 17)}</span>`,
        title: `<span class="${g.ok ? "" : "b"}">${esc(g.label)}</span>`,
        detail: esc(g.detail),
        side: g.ok ? tag("met", "ok") : tag("open", "warn"),
        ...(g.ok ? {} : { action: "nav", data: { href: gateHref(g) } }),
      })).join(""))}
      <p class="t-meta sec__note measure">
        Conditions that do not apply to this engagement are not listed. ${
          methodologyConfig.requiresPartnerReview ? "" : "Partner review, for one: " +
          methodologyConfig.partnerReviewNote.charAt(0).toLowerCase() + methodologyConfig.partnerReviewNote.slice(1)}
      </p>
    </section>

    <section>
      <div class="sec__h"><h2 class="t-h">Sign-off</h2></div>
      <p class="t-sub sec__h measure">
        Signing is what a person does, not what the platform does. Each signature records who and when.</p>

      ${rows(`
        ${row({
          lead: icon("signature", 17),
          title: `<span class="b">${esc(user.name)}</span>`,
          detail: so.preparer === "signed"
            ? "Prepared by · audit senior · signed"
            : done ? "Prepared by · audit senior · ready to sign"
            : "Prepared by · audit senior · waiting on the work",
          side: so.preparer === "signed" ? tag("Signed", "ok", "check")
            : done ? btn("Sign as preparer", "sign-preparer", { variant: "ok", size: "sm" })
            : tag("waiting", "quiet"),
        })}
        ${st.reviewRequired() ? row({
          lead: icon("reviewpoint", 17),
          title: `<span class="b">${esc(st.reviewerName())}</span>`,
          detail: so.review === "approved" ? "Reviewed by · manager · approved"
            : so.review === "reopened" ? "Reviewed by · manager · sent back with review points"
            : so.review === "in_review" ? "Reviewed by · manager · reviewing now"
            : so.review === "submitted" ? "Reviewed by · manager · submitted, not yet opened"
            : so.preparer === "signed" ? "Reviewed by · manager · ready to submit"
            : "Reviewed by · manager · waiting for the preparer",
          side: so.review === "approved" ? tag("Approved", "ok", "check")
            : tag(so.review === "not_submitted" ? "not submitted" : so.review.replace("_", " "),
                so.review === "reopened" ? "alert" : "quiet"),
        }) : ""}
        ${row({
          lead: `<span class="ink5">${icon("signature", 17)}</span>`,
          title: `<span class="ink4">${esc(st.partnerName())}</span>`,
          detail: "Engagement partner",
          side: `<span class="t-meta">${methodologyConfig.requiresPartnerReview ? "review required" : "no review required at process level"}</span>`,
        })}`)}

      ${!done ? `<p class="t-meta sec__note measure">
        Blocked by ${esc(workOpen.map((g) => g.label.toLowerCase()).join(", "))}.</p>` : ""}

      ${done && so.preparer !== "signed" ? `<div class="acts sec">
        ${btn("Sign as preparer", "sign-preparer", { variant: "primary", size: "lg", key: "Enter", ic: "signature" })}
      </div>
      <p class="t-meta sec__note measure">
        Signing does not complete the process. It records that the work is finished and makes it
        ready for review.</p>` : ""}

      ${so.preparer === "signed" && st.reviewRequired() && ["not_submitted", "reopened"].includes(so.review) ? `
        <div class="acts sec">
          ${btn(so.review === "reopened" ? "Resubmit for review" : "Submit for manager review",
            "submit-review", { variant: "primary", size: "lg", key: "Enter", ic: "arrow",
              disabled: !st.canResubmit() })}
        </div>
        ${!st.canResubmit() ? `<p class="t-meta sec__note measure">
          ${st.openReviewPoints().length} review point${st.openReviewPoints().length === 1 ? "" : "s"}
          still ${st.openReviewPoints().length === 1 ? "needs" : "need"} an answer. The file does not
          go back to the reviewer until ${st.openReviewPoints().length === 1 ? "it does" : "they do"}.</p>` : ""}` : ""}

      ${so.review === "reopened" || st.reviewPoints().length ? reviewPointSection() : ""}

      ${["submitted", "in_review"].includes(so.review) ? `
        <div class="s-recessed pad sec">
          <div class="t-eyebrow rail__h">Acting as the reviewer — prototype only</div>
          <p class="t-meta sec__note measure">
            One person plays both roles here. In the product these actions belong to the manager and
            the preparer never sees them.</p>
          <div class="acts sec__note">
            ${so.review === "submitted" ? btn("Open the file for review", "reviewer", { data: { d: "in_review" } }) : ""}
            ${btn("Approve — complete the process", "reviewer", { variant: "ok", ic: "check", data: { d: "approved" } })}
            ${btn("Send back with review points", "reviewer", { data: { d: "reopened" }, ic: "reviewpoint" })}
          </div>
        </div>` : ""}

      ${ps.id === "complete" ? callout(`<b>Complete.</b> The process-level interim work on Revenue is
        finished, reviewed and approved. What it produced is listed below and is now an input to risk
        analysis — which is a different phase and deliberately not part of this product.`, "ok") : ""}
    </section>
    </div>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Export</h2></div>
      <p class="t-sub sec__h measure">
        Only approved content is included. Statements recorded as not obtained <em>are</em> included —
        an incomplete understanding has to look incomplete in the file.</p>
      ${rows(`
        ${[
          ["Process narrative", "DOCX · firm template, sign-off block, sources as footnotes", "document"],
          ["Risk and control matrix", "XLSX · one row per risk-control pair", "control"],
          ["Control deficiencies", "DOCX · the ISA 265 management letter draft", "finding"],
          ["Canonical engagement export", "JSON · every statement with its evidence references", "evidence"],
        ].map(([t, d, ic]) => row({
          lead: icon(ic, 17), title: esc(t), detail: esc(d),
          side: btn(ps.id === "complete" ? "Generate" : "Draft", "mock", { size: "sm" }),
        })).join("")}
        ${row({ lead: `<span class="ink5">${icon("system", 17)}</span>`,
          title: `<span class="ink4">Push to the audit file system</span>`,
          detail: "Caseware, CCH or the firm's own file system",
          side: tag("not built", "quiet") })}`)}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Carried forward to risk analysis</h2></div>
      <p class="t-sub sec__h measure">
        Completing Revenue closes the process-level interim work. It does not assess risks of
        material misstatement — that is the next phase, and these are its inputs.</p>
      ${rows(`
        ${row({ lead: icon("document", 17), title: "<span class=\"b\">Process understanding</span>",
          detail: "The approved narrative, the process map, and the facts behind both",
          side: `<span class="t-meta">${n.approved} sections</span>` })}
        ${row({ lead: icon("control", 17), title: "<span class=\"b\">Risk and control matrix</span>",
          detail: `${st.riskSummary().total} identified risk signals against ${st.controlSummary().total} controls, with provenance`,
          side: `<span class="t-meta">${st.rcmRows().length} rows</span>`,
          action: "nav", data: { href: "#/matrix" } })}
        ${row({ lead: icon("finding", 17), title: "<span class=\"b\">Findings</span>",
          detail: "Deficiencies and observations for the ISA 265 communication to management",
          side: `<span class="t-meta">${st.findingSummary().confirmed} confirmed</span>` })}
        ${row({ lead: icon("walkthrough", 17),
          title: "<span class=\"b\">Line walkthrough results</span>",
          detail: tr.satisfied
            ? `${tr.completed} of ${variants.length} variants walked through · ${tr.exceptions} exception${tr.exceptions === 1 ? "" : "s"} · the rest documented as not requiring one`
            : `${tr.completed} of ${tr.required} required walkthroughs complete`,
          side: `<span class="t-meta">${tr.satisfied ? "settled" : "open"}</span>` })}
        ${row({ lead: icon("clock", 17),
          title: "<span class=\"b\">Matters carried forward</span>",
          detail: st.openItemSummary().carried.length
            ? st.openItemSummary().carried.map((i) => `${esc(i.id)} → ${esc(st.itemCarry(i)?.destination || "unspecified")}`).join(" · ")
            : "Nothing carried forward — every open matter was settled during interim",
          side: `<span class="t-meta">${st.openItemSummary().carried.length}</span>`,
          action: "nav", data: { href: "#/resolve" } })}`)}
    </section>

    <section class="sec--loose">
      ${more("footer", "What the export footer records", `<div class="meth"><dl>
        <dt>entity</dt><dd>${esc(st.activeClient().name)}</dd>
        <dt>engagement</dt><dd>${esc(st.activeEngagement().id)} · ${esc(st.activeEngagement().fy)} interim</dd>
        <dt>process state</dt><dd>${esc(ps.label)}</dd>
        <dt>sources</dt><dd>${Object.keys(sources).length} — transcript, questionnaire, three documents, auditor notes</dd>
        <dt>coverage</dt><dd>${cov.covered} of ${cov.applicable} applicable areas · ${cov.na} not applicable</dd>
        <dt>documentation</dt><dd>${n.approved} sections approved · ${n.rejected} rejected</dd>
        <dt>pack</dt><dd>revenue v0.1.0</dd>
        <dt>ai assistance</dt><dd>Used. Stage models and prompt versions recorded.</dd>
        <dt>prepared by</dt><dd>${esc(user.name)}${so.preparer === "signed" ? " · signed" : " · unsigned"}</dd>
        <dt>reviewed by</dt><dd>${st.reviewRequired()
          ? esc(st.reviewerName()) + (so.review === "approved" ? " · approved" : " · " + so.review.replace("_", " "))
          : "no process-level review required"}</dd>
      </dl></div>`, S.disclosed.footer)}
    </section>
  `;

  return screen("complete", body, { width: "overview" });
}

/* ── Review points ────────────────────────────────────────────────────────
   One worked example, connected for real: reopening raises it, an unanswered
   point blocks resubmission, and answering it releases the file.
   ------------------------------------------------------------------------- */

function reviewPointSection() {
  const pts = st.reviewPoints();
  const open = st.openReviewPoints();

  return `<div class="sec">
    ${callout(`<b>${open.length ? `${open.length} review point${open.length === 1 ? "" : "s"} to answer`
      : "Every review point has been answered"}.</b>
      ${open.length ? "The reviewer sent Revenue back. Answer each point on the file, then resubmit."
        : "The file can go back to the reviewer."}`, open.length ? "alert" : "ok")}

    <div class="sec__note">
      ${pts.map((p) => {
        const isOpen = S.openPoint === p.id;
        const editing = S.editing === `rp:${p.id}`;
        return `<div class="${cx("rp", p.state === "addressed" && "is-done")}">
          <div class="rp__hd">
            <span class="rw__lead">${icon("reviewpoint", 18)}</span>
            <span class="sp">
              <span class="card__t">${esc(p.subject)}</span>
              <span class="rp__meta">${esc(p.reviewer)}, ${esc(p.role)} · ${esc(p.raisedOn)}
                · <span class="mono">${esc(p.id)}</span></span>
            </span>
            ${p.state === "addressed" ? tag("addressed", "ok", "check") : tag("open", "alert")}
          </div>

          ${isOpen ? `<div class="sec__note">
            <div class="rp__q">&ldquo;${esc(p.comment)}&rdquo;</div>
            <p class="t-meta sec__note">Expects: ${esc(p.expects)}</p>
            ${p.response ? `<div class="s-recessed pad-s sec__note">
              <div class="t-eyebrow">Your response · ${esc(p.respondedAt || "")}</div>
              <p class="t-body" style="margin-top:6px">${esc(p.response)}</p>
            </div>` : ""}
            ${editing ? `<div class="sec__note">
              <textarea class="field" id="ans" rows="4" style="font:15px/1.6 var(--sans)"
                placeholder="What you did about it, or why the conclusion stands."></textarea>
              <div class="acts sec__note">
                ${btn("Record and mark addressed", "answer-point", { variant: "primary", size: "sm", data: { id: p.id } })}
                ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
              </div>
            </div>` : `<div class="acts sec__note">
              ${p.target ? btn(`Open ${p.target.id}`, "nav", { size: "sm", ic: "link", data: { href: p.target.href } }) : ""}
              ${p.state === "addressed"
                ? btn("Reopen this point", "reopen-point", { variant: "ghost", size: "sm", data: { id: p.id } })
                : btn("Respond", "answer-point-open", { variant: "primary", size: "sm", data: { id: p.id } })}
            </div>`}
          </div>` : `<div class="acts sec__note">
            ${btn(p.state === "addressed" ? "Show" : "Open the review point", "open-point",
              { variant: p.state === "addressed" ? "ghost" : "primary", size: "sm", data: { id: p.id } })}
          </div>`}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

/* Each gate links to the step that clears it. */
const STEP_HREF = {
  prepare: "#/prepare", interview: "#/interview", understanding: "#/understanding",
  controls: "#/controls", trace: "#/trace", testing: "#/testing", complete: "#/complete",
};
const gateHref = (g) => (g.id === "openItems" ? "#/resolve" : STEP_HREF[g.step] || "#/revenue");

/* ── Matrix — a view reached from step 4, not a destination ──────────────── */

export function matrix() {
  const rows_ = st.rcmRows();
  const NAT = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent" };
  const q = (S.gridQuery || "").toLowerCase();
  const filter = S.gridFilter || "all";

  const shown = rows_.filter(({ risk: r, control: c }) => {
    if (filter === "gaps" && c) return false;
    if (filter === "key" && st.controlDecision(c || {}) !== "key") return false;
    if (filter === "significant" && !r.significant) return false;
    if (!q) return true;
    return (r.title + " " + (c ? c.title + " " + (c.owner || "") : "") + " " + r.id).toLowerCase().includes(q);
  });

  /* Group consecutive rows by risk signal, so a risk with three controls reads
     as one risk rather than three. */
  let lastRisk = null;

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          ${btn("Back to controls and findings", "nav", { variant: "ghost", size: "sm", ic: "back",
            data: { href: "#/controls" } })}
          <h1 class="t-display" style="margin-top:10px">Risk and control matrix</h1>
          <p class="t-lede">
            A view of work recorded elsewhere, not a place where work happens. The controls carry the
            conclusions you recorded in step 4. The risk signals are identified but not assessed.
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n">${rows_.length}</span><span class="tally__l">pairs</span></div>
          <div><span class="tally__n" style="color:var(--danger)">${rows_.filter((x) => !x.control).length}</span>
            <span class="tally__l">without a control</span></div>
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="row sec__h">
        <label class="srch" style="width:280px;height:34px" for="grid-q">
          ${icon("search", 15)}
          <input id="grid-q" class="field" placeholder="Search risks, controls, owners"
            value="${esc(S.gridQuery || "")}"
            style="border:0;box-shadow:none;background:none;padding:0;font-size:13.5px">
        </label>
        <span class="filters">
          ${[["all", "All", rows_.length],
             ["significant", "Significant", rows_.filter((x) => x.risk.significant).length],
             ["key", "Key controls", rows_.filter((x) => x.control && st.controlDecision(x.control) === "key").length],
             ["gaps", "No control", rows_.filter((x) => !x.control).length]].map(([k, label, n]) =>
            `<button class="${cx("fchip", filter === k && "is-on")}" data-act="grid-filter" data-f="${k}">
              ${icon("filter", 13)}${esc(label)}<span class="fchip__n">${n}</span></button>`).join("")}
        </span>
        <span class="sp"></span>
        <span class="t-meta">${shown.length} of ${rows_.length} shown</span>
      </div>

      <div class="gridwrap">
        <table class="agrid">
          <thead><tr>
            <th class="c-risk">Risk signal</th><th>Assertions</th><th class="c-ctl">Control</th>
            <th class="c-owner">Owner</th><th class="c-nature">Nature</th><th class="c-num">Conclusion</th>
          </tr></thead>
          <tbody>
            ${shown.map(({ risk: r, control: c, gap: g }) => {
              const cd = c ? st.controlDecision(c) : null;
              const newRisk = r.id !== lastRisk;
              lastRisk = r.id;
              return `<tr>
                <td class="c-risk">${newRisk ? `${esc(r.title)}
                  <span class="sub">${esc(r.id)} · ${esc(r.rating)} proposed${
                    r.significant ? " · flagged significant" : ""}${r.fraud ? " · fraud" : ""}</span>`
                  : `<span class="ink5">↳ same signal</span>`}</td>
                <td>${newRisk ? `<span class="chipline">${r.assertions.map((a) =>
                  chip(a.replace(/_/g, " "))).join("")}</span>` : ""}</td>
                <td class="c-ctl">${c ? esc(c.title)
                  : `<span class="agrid__none">No control identified${g ? ` — gap ${esc(g.id)}` : ""}</span>`}</td>
                <td class="c-owner">${c ? esc(c.owner || "not established") : "—"}</td>
                <td class="c-nature">${c ? esc(NAT[c.nature]) : "—"}</td>
                <td class="c-num">${c ? (cd === "key" ? tag("key control", "ok", "check")
                  : cd === "not_key" ? tag("not key", "quiet")
                  : cd === "carried_forward" ? tag("carried forward", "warn")
                  : cd === "undecided" ? tag("parked", "warn")
                  : tag(`proposed: ${c.keyProposal === true ? "key" : c.keyProposal === false ? "not key" : "unclear"}`, "quiet"))
                  : tag("gap", "alert")}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <p class="t-meta sec__note measure">
        Risk ratings shown here are the methodology pack's proposals. Nothing on this screen is an
        assessed risk of material misstatement, and nothing on it can be concluded here.</p>

      <div class="acts sec">
        ${btn("Export to Excel", "mock", { ic: "document" })}
        ${btn("Back to controls and findings", "nav", { variant: "ghost", ic: "back", data: { href: "#/controls" } })}
      </div>
    </section>
  `;

  return screen("controls", body, { width: "data" });
}

/* ── Client questionnaire — a separate, plainer surface ──────────────────── */

/* --- Who the questionnaire is for -----------------------------------------
   A task-scoped grant to one client contact. It is not an account, and the
   prototype does not claim to have e-mailed anybody.
   -------------------------------------------------------------------------- */
export function questionnaireRecipient() {
  const to = st.questionnaireTo("revenue");
  const cl = st.activeClient();
  const picking = S.editing === "qto";

  return `<section class="sec--loose">
    <div class="sec__h">
      <h2 class="t-h">Questionnaire recipient</h2>
      <span class="sp"></span>
      ${btn(to ? "Change" : "Assign", picking ? "cancel-edit" : "edit-open",
        { size: "sm", variant: to ? "" : "primary", data: { id: "qto" } })}
    </div>
    <p class="t-sub sec__h measure">
      One client contact gets access to this questionnaire and to nothing else. It does not create
      an Audit AI account for them.</p>

    ${to && to.contact ? rows(row({
      lead: icon("questionnaire", 17),
      title: `<span class="b">${esc(to.contact.name)}</span>`,
      detail: `${esc(to.contact.role)}${to.contact.email ? ` · ${esc(to.contact.email)}` : ""} · assigned ${esc(to.assignedOn)}`,
      side: `${tag(`${st.questionnaireProgress().done} of ${st.questionnaireProgress().total} answered`,
          st.questionnaireProgress().left ? "accent" : "ok")}
        ${btn("Remove", "clear-questionnaire", { variant: "ghost", size: "sm" })}`,
    })) : `<div class="callout callout--warn">
      <b>Nobody assigned.</b> The questionnaire cannot be opened by a client until a contact is
      given access to it.</div>`}

    ${picking ? `<div class="s-surface pad sec__note">
      <div class="t-eyebrow rail__h">Choose a contact at ${esc(cl.short)}</div>
      ${rows(cl.contacts.map((x) => row({
        lead: icon("people", 17),
        title: `<span class="b">${esc(x.name)}</span>`,
        detail: `${esc(x.role)}${x.email ? ` · ${esc(x.email)}` : `  ·  <span style="color:var(--warn)">no e-mail on file</span>`}`,
        side: btn("Assign", "assign-questionnaire", { size: "sm", variant: "primary", data: { id: x.id } }),
      })).join(""))}
      <div class="acts sec__note">
        ${btn("Add a new client contact", "nav", { size: "sm", ic: "plus", data: { href: "#/client" } })}
        ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
      </div>
    </div>` : ""}

    ${to && to.contact ? `<div class="acts sec__note">
      ${btn("Preview the client portal", "portal-preview", { size: "sm", variant: "ghost", ic: "people",
        title: "Prototype: open the task inbox as this contact sees it",
        data: { id: to.contactId } })}
    </div>` : ""}
  </section>`;
}

/* --- What the client owes us, in the client's terms ------------------------
   Auditor-side status for the client tasks, surfaced where the auditor already
   is rather than in a new dashboard. No new object: it reads the same task
   inbox the portal reads.
   -------------------------------------------------------------------------- */
export function clientTaskStatus() {
  const tasks = st.S.clientTasks.filter((t) =>
    t.engagementId === st.S.engId && !t.state && (!t.afterInterview || st.interview().status === "complete"));
  if (!tasks.length) return "";
  const IC = { questionnaire: "questionnaire", live_interview: "people",
               follow_up: "question", document_request: "document" };

  return `<section class="sec--loose">
    <div class="sec__h">
      <h2 class="t-h">With the client</h2>
      <span class="sp"></span>
      ${btn("Preview the client portal", "portal-preview", { variant: "ghost", size: "sm", ic: "people" })}
    </div>
    <p class="t-sub sec__h measure">
      What each contact has been asked for, and where it has got to. They see the task and nothing
      else — no methodology, no controls, no findings.</p>
    ${rows(tasks.map((t) => {
      const c = st.contactById(t.contactId);
      const s = st.taskStateLabel(t);
      return row({
        lead: icon(IC[t.type] || "document", 17),
        title: `<span class="b">${esc(t.title)}</span>`,
        detail: `${esc(c ? c.name : t.contactId)}${c ? ` · ${esc(c.role)}` : ""}${
          st.taskProgress(t) ? ` · ${esc(st.taskProgress(t))}` : ""}`,
        side: tag(s.label, s.tone === "ok" ? "ok" : s.tone === "accent" ? "accent" : "quiet"),
        action: "portal-preview", data: { id: t.contactId },
      });
    }).join(""))}
  </section>`;
}

export function clientSurface() {
  const answeredNow = questionnaire.filter((q) => st.questionState(q) === "answer");
  const outstanding = questionnaire.filter((q) => !["answer"].includes(st.questionState(q)));
  const current = outstanding.find((q) => !S.answers[q.n]) || outstanding[0];
  const handled = questionnaire.filter((q) => S.answers[q.n]);
  const pct = Math.round((answeredNow.length / questionnaire.length) * 100);
  const assigned = st.questionnaireTo("revenue");
  const recipient = assigned && assigned.contact;

  const outcome = (q) => {
    const a = S.answers[q.n];
    if (!a) return "";
    return `<div class="t-meta sec__note">${a.kind === "answer"
      ? "Sent. Your auditor has it."
      : a.kind === "unknown"
      ? "Recorded as unable to answer. Your auditor will find another route — you do not need to do anything."
      : "A call has been requested. Your auditor will get in touch."}</div>`;
  };

  /* The questionnaire is a portal screen: same chrome, same identity, and the
     prototype's "auditor view" switch lives in the dev bar rather than in the
     client's header. Its behaviour below is unchanged. */
  const body = `
    <div class="cq__head">
      <p class="pt__eyebrow">Revenue questionnaire</p>
      <div class="cq__count">${answeredNow.length} <span>of ${questionnaire.length} answered</span></div>
      <div class="cq__prog"><i style="width:${pct}%"></i></div>
    </div>

    <div class="cq__body">
      <p class="t-lede" style="margin-bottom:38px">
        ${esc(recipient ? recipient.name.split(" ")[0] : "Hello")} — these are about how sales get
        recorded. Answer in your own words; there are no wrong answers, and you can stop and come back.
      </p>

      ${current && !S.answers[current.n] ? `
        <div class="t-eyebrow rail__h">Question ${current.n}</div>
        <h2 class="cq__q">${esc(current.q)}</h2>
        <p class="t-sub" style="margin-top:12px">${current.origin === "deterministic_trigger"
          ? "Following up on what you told us about price changes."
          : "Following up on the German distributor you mentioned."}</p>
        <textarea class="field" id="q-${current.n}" rows="5" style="margin-top:26px"
          placeholder="Type your answer…"></textarea>
        <div class="acts" style="margin-top:18px">
          ${btn("Send", "answer-send", { variant: "primary", size: "lg", data: { n: current.n } })}
          ${btn("I don't know", "answer-unknown", { data: { n: current.n } })}
          ${btn("Rather have a call", "answer-call", { variant: "ghost", data: { n: current.n } })}
        </div>
        <p class="t-meta sec--tight measure">
          The three do different things. An answer settles the point. "I don't know" and a call
          request both go back to your auditor as something for them to pick up — nothing is lost
          and nothing is guessed.</p>`
        : `<h2 class="cq__q">That's everything — thank you.</h2>
           <p class="t-sub" style="margin-top:10px">Your auditor has been notified.</p>`}

      ${handled.length ? `<div class="sec--loose">
        <div class="t-eyebrow rail__h">Just now</div>
        ${handled.map((q) => `<div class="cq__done">
          <div class="qq">${esc(q.q)}</div>
          <div class="aa">${esc(S.answers[q.n].text
            || (S.answers[q.n].kind === "unknown" ? "I don't know" : "I'd rather have a call"))}</div>
          ${outcome(q)}
        </div>`).join("")}
      </div>` : ""}

      <div class="sec--loose">
        <div class="t-eyebrow rail__h">Already answered</div>
        ${[...questionnaire.filter((q) => q.a)].reverse().slice(0, 5).map((q) => `<div class="cq__done">
          <div class="qq">${esc(q.q)}</div>
          <div class="aa">${esc(q.a)}</div>
          ${q.flag === "contradiction" ? `<div class="t-meta sec__note">
            Thank you — we'll check this against what the finance team told us.</div>` : ""}
          ${q.flag === "new_topic" ? `<div class="t-meta sec__note">
            One follow-up added about how that stock is treated at the year end.</div>` : ""}
        </div>`).join("")}
      </div>

      <p class="t-meta sec--loose">
        These questions are about process, not about any customer or personal data.
        Only ${esc(firm.name)} can see your answers.
      </p>

      <div class="pt__acts" style="margin-top:32px">
        ${btn("Back to your tasks", "nav", { variant: outstanding.length ? "ghost" : "primary",
          size: "lg", ic: outstanding.length ? "back" : "", data: { href: "#/portal" } })}
      </div>
    </div>`;

  return portalShell(body, { back: { label: "Your tasks", href: "#/portal" }, narrow: true });
}
