/* COMPLETE — the gates, the sign-off, and what leaves the building.
   Also holds the matrix (a view, not a destination) and the questionnaire. */

import { esc, cx, act as btn, row, dot, more, empty, callout, chip } from "../ui.js";
import { risks, controls, gaps } from "../data-model.js";
import { client, engagement, user, firm, questionnaire, sources } from "../data-sources.js";
import * as st from "../state.js";
import { screen, idline } from "./shell.js";

const S = st.S;

/* ── Sign-off ────────────────────────────────────────────────────────────── */

export function complete() {
  const gates = st.gateStates();
  const open = gates.filter((g) => !g.ok);
  const ready = st.readyToSign();
  const cov = st.coverageSummary();
  const n = st.narrativeSummary();

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">${ready ? "Ready for sign-off" : "Not ready yet"}</h1>
          <p class="t-lede" style="margin-top:10px">
            ${ready
              ? "Every condition is met. The platform never signs — you do."
              : `${open.length} of ${gates.length} conditions are still open. Each one links to the work that clears it.`}
          </p>
        </div>
        <div style="text-align:right;padding-top:4px">
          <div class="t-num" style="color:${ready ? "var(--ok)" : "var(--ink-4)"}">${gates.length - open.length}/${gates.length}</div>
          <div class="t-meta">conditions met</div>
        </div>
      </div>
    </div>

    <section style="margin-top:40px">
      <div class="rows">
        ${gates.map((g) => row({
          lead: dot(g.ok ? "ok" : "open"),
          title: `<span class="${g.ok ? "" : "b"}">${esc(g.label)}</span>`,
          detail: esc(g.detail),
          side: g.ok ? `<span class="t-meta" style="color:var(--ok)">met</span>`
            : `<span class="t-meta" style="color:var(--warn)">open</span>`,
          ...(g.ok ? {} : { action: "nav", data: { href: gateHref(g.id) } }),
        })).join("")}
      </div>
    </section>

    <section style="margin-top:48px">
      <h2 class="t-h" style="margin-bottom:16px">Sign-off</h2>
      <div class="rows">
        ${row({ title: `<span class="b">${esc(user.name)}</span>`, detail: "Prepared by · audit senior",
          side: ready ? btn("Sign", "sign", { variant: "ok", size: "sm" }) : `<span class="t-meta">waiting</span>` })}
        ${row({ title: `<span class="b">${esc(engagement.team[1].name)}</span>`, detail: "Reviewed by · manager",
          side: `<span class="t-meta">not yet reviewed</span>` })}
        ${row({ title: `<span class="b">${esc(engagement.team[0].name)}</span>`, detail: "Engagement partner",
          side: `<span class="t-meta">not yet reviewed</span>` })}
      </div>
      ${!ready ? `<p class="t-meta" style="margin-top:14px">
        Blocked by ${esc(open.map((g) => g.label.toLowerCase()).join(", "))}.</p>` : ""}
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
          side: btn(ready ? "Generate" : "Draft", "mock", { size: "sm" }),
        })).join("")}
        ${row({ title: `<span style="color:var(--ink-4)">Push to the audit file system</span>`,
          detail: "Caseware, CCH or the firm's own file system",
          side: `<span class="t-meta">not built</span>` })}
      </div>
    </section>

    <section style="margin-top:44px">
      ${more("footer", "What the export footer records", `<div class="meth"><dl>
        <dt>entity</dt><dd>${esc(client.name)}</dd>
        <dt>engagement</dt><dd>${esc(engagement.id)} · FY2026 interim</dd>
        <dt>sources</dt><dd>${Object.keys(sources).length} — transcript, questionnaire, three documents, auditor notes</dd>
        <dt>coverage</dt><dd>${cov.covered} of ${cov.applicable} applicable areas · ${cov.na} not applicable</dd>
        <dt>documentation</dt><dd>${n.approved} sections approved · ${n.rejected} rejected</dd>
        <dt>pack</dt><dd>revenue v0.1.0</dd>
        <dt>ai assistance</dt><dd>Used. Stage models and prompt versions recorded.</dd>
        <dt>prepared by</dt><dd>${esc(user.name)}</dd>
      </dl></div>`, S.disclosed.footer)}
    </section>
  `;

  return screen("complete", body);
}

const gateHref = (id) => ({
  narrative: "#/review", needsSource: "#/review", contradiction: "#/resolve",
  risks: "#/review", controls: "#/review", mandatory: "#/understand", openItems: "#/resolve",
}[id] || "#/review");

/* ── Matrix — a view reached by ⌘K, not a permanent destination ──────────── */

export function matrix() {
  const rows = st.rcmRows();
  const NAT = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent" };

  const body = `
    <div class="head">
      <h1 class="t-title">Risk and control matrix</h1>
      <p class="t-lede" style="margin-top:10px">
        Assembled, not generated. Every line comes from a risk or control you have already seen,
        carrying the decision you recorded. No model produces this view.
      </p>
    </div>

    <div class="rows" style="margin-top:32px">
      ${rows.map(({ risk: r, control: c, gap: g }) => {
        const rd = st.riskDecision(r), cd = c ? st.controlDecision(c) : null;
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
              <div>${rd ? `<span class="state state--ok">${esc(rd)}</span>` : `<span class="t-meta">to conclude</span>`}</div>
              ${c ? `<div class="t-meta" style="margin-top:4px">${cd === "key" ? "key control"
                : cd === "not_key" ? "not key" : cd === "undecided" ? "undecided"
                : `suggested: ${c.keyProposal === true ? "key" : c.keyProposal === false ? "not key" : "unclear"}`}</div>` : ""}
            </span>
          </div>
        </div>`;
      }).join("")}
    </div>

    <div class="acts" style="margin-top:28px">
      ${btn("Export to Excel", "mock")}
      ${btn("Back to review", "nav", { variant: "plain", data: { href: "#/review" } })}
    </div>
  `;

  return screen("complete", body, { width: "wide" });
}

/* ── Client questionnaire — a separate, plainer surface ──────────────────── */

export function clientSurface() {
  const answered = questionnaire.filter((q) => q.a);
  const current = questionnaire.find((q) => !q.a);

  return `<div class="cq">
    <header class="cq__bar">
      <div>
        <div class="b">Revenue — a few questions</div>
        <div class="t-meta" style="margin-top:2px">${esc(firm.name)} · ${esc(client.name)}</div>
      </div>
      <span class="sp"></span>
      <span class="t-meta">${answered.length} of ${questionnaire.length} answered</span>
      ${btn("Back to the auditor view", "nav", { size: "sm", data: { href: "#/understand" } })}
    </header>

    <div class="cq__body">
      <p class="t-lede" style="margin-bottom:40px">
        Bas — these are about how sales get recorded. Answer in your own words; there are no wrong
        answers, and you can stop and come back.
      </p>

      ${current ? `
        <div class="t-meta" style="margin-bottom:12px">Question ${current.n}</div>
        <h2 class="cq__q">${esc(current.q)}</h2>
        <p class="t-sub" style="margin-top:10px">${current.origin === "deterministic_trigger"
          ? "Following up on what you told us about price changes."
          : "Following up on the German distributor you mentioned."}</p>
        <textarea class="field" rows="4" style="margin-top:22px" placeholder="Type your answer…"></textarea>
        <div class="acts" style="margin-top:14px">
          ${btn("Send", "answer-q", { variant: "go" })}
          ${btn("I don't know", "answer-q")}
          ${btn("Rather have a call", "mock", { variant: "plain" })}
        </div>`
        : `<h2 class="cq__q">That's everything — thank you.</h2>
           <p class="t-sub" style="margin-top:8px">Your auditor has been notified.</p>`}

      <div style="margin-top:52px">
        <div class="t-eyebrow" style="margin-bottom:8px">Already answered</div>
        ${[...answered].reverse().slice(0, 5).map((q) => `<div class="cq__done">
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
