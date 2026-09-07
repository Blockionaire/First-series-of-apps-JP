/* REVIEW — the surface the product is won or lost on.

   Three modes:
     triage  the routine separated from the judgement, before anything is asked
     focus   one judgement at a time, full width, keyboard-first
     read    the document, with evidence opening inline beneath the claim

   No table, no permanent source panel, no modal. */

import { esc, cx, act as btn, row, dot, chip, more, evidence, empty, callout, link, state } from "../ui.js";
import { narrative, risks, controls, pipeline, subProcesses } from "../data-model.js";
import { ref, sources } from "../data-sources.js";
import * as st from "../state.js";
import { screen } from "./shell.js";

const S = st.S;

/* --- helpers --------------------------------------------------------------- */

/** The claim as prose. Reference markers never reach the page: the whole
 *  sentence is the click target, so the text stays readable. */
export const prose = (b) =>
  st.claimText(b).replace(/\[\[.+?\]\]/g, "").replace(/\s+([.,;])/g, "$1").replace(/\s{2,}/g, " ").trim();

export function claimRefs(b) {
  const out = [];
  const re = /\[\[(.+?)\]\]/g;
  let m;
  while ((m = re.exec(st.claimText(b)))) {
    if (m[1] === "none") continue;
    m[1].replace(/^conflict:/, "").split("|").forEach((id) => { if (!out.includes(id)) out.push(id); });
  }
  return out.map(ref).filter(Boolean);
}

const sectionOfClaim = (id) => narrative.find((s) => s.blocks.some((b) => b.id === id));

/* ── Generation ──────────────────────────────────────────────────────────── */

function generateView() {
  const running = S.generating;
  const cov = st.coverageSummary();

  const body = `
    <div class="head">
      <h1 class="t-title">${running ? "Drafting the documentation" : "Draft the documentation"}</h1>
      <p class="t-lede" style="margin-top:10px">
        Nine stages over ${Object.keys(sources).length} sources. Seven ask a model; two are ordinary
        code. Every stage is validated before the next one runs.
      </p>
    </div>

    ${!running ? `
      <div class="rows" style="margin-top:36px">
        ${row({ title: "Areas established", side: `${cov.covered} of ${cov.applicable}` })}
        ${row({ title: "Process facts", side: `${cov.facts.known} of ${cov.facts.total}` })}
        ${row({ title: "Methodology pack", side: `<span class="mono">revenue v0.1.0</span>` })}
        ${row({ title: "Risk and control libraries", side: "30 and 33 entries" })}
      </div>
      <div style="margin-top:30px">
        ${btn("Start", "run-pipeline", { variant: "go", size: "lg", key: "Enter" })}
      </div>` : `
      <div style="margin-top:36px" class="rows">
        ${pipeline.map((p, i) => {
          const done = i < S.genStage, now = i === S.genStage;
          const warn = p.warn && done;
          return `<div class="rw" style="opacity:${done || now ? 1 : .35};transition:opacity .3s">
            <span class="rw__lead" style="padding-top:4px;width:18px">
              ${done ? `<span style="color:${warn ? "var(--warn)" : "var(--ok)"}">${warn ? "!" : "✓"}</span>`
                : now ? `<span class="dot dot--open"></span>` : `<span class="t-meta">${i + 1}</span>`}</span>
            <span class="rw__main">
              <span class="rw__t">${esc(p.name)}</span>
              <span class="rw__d">${esc(p.desc)}</span>
              ${done ? `<span class="rw__d" style="color:${warn ? "var(--warn)" : "var(--ink-2)"};margin-top:5px">
                ${esc(fill(p.out))}</span>` : ""}
            </span>
            <span class="rw__side mono" style="font-size:11.5px">${esc(p.model)}</span>
          </div>`;
        }).join("")}
      </div>`}
  `;
  return screen("review", body);
}

function fill(t) {
  const cov = st.coverageSummary();
  return t.replace("FACTS_KNOWN", cov.facts.known).replace("FACTS_UNKNOWN", cov.facts.unknown + cov.facts.contradictory)
    .replace("RISK_COUNT", risks.length).replace("CONTROL_COUNT", controls.length)
    .replace("GAP_COUNT", st.controlSummary().gaps).replace("KEY_COUNT", st.controlSummary().suggestedKey)
    .replace("RCM_ROWS", st.rcmRows().length).replace("OPEN_COUNT", 10);
}

/* ── Triage ──────────────────────────────────────────────────────────────── */

function triage() {
  const n = st.narrativeSummary();
  const rs = st.riskSummary();
  const cs = st.controlSummary();
  const queue = st.claimQueue();

  const describe = (b) => {
    const s = st.claimState(b);
    return s === "contradiction" ? "Two sources give different answers"
      : "A statement no source supports";
  };

  const body = `
    <div class="head">
      <h1 class="t-title">Revenue documentation</h1>
      <p class="t-lede" style="margin-top:10px">
        ${n.sections} sections and ${n.blocks} statements, drawn from ${Object.keys(sources).length} sources.
        ${queue.length ? "Most of it is clean." : "Everything is traced."}
      </p>
    </div>

    ${queue.length ? `
      <section class="triage__group">
        <div class="triage__n"><span class="c">${queue.length}</span> need your judgement</div>
        <p class="t-sub" style="margin-bottom:18px">
          Contradictions first, then statements the drafting could not support.</p>
        <div class="rows">
          ${queue.map(({ b, sec }) => row({
            lead: dot(st.claimState(b) === "contradiction" ? "alert" : "warn"),
            title: esc(sec.heading), detail: describe(b),
            side: `<span class="t-meta">${esc(b.id)}</span>`,
            action: "focus-claim", data: { claim: b.id },
            mod: st.claimState(b) === "contradiction" ? "conflict" : "attn",
          })).join("")}
        </div>
        <div class="acts" style="margin-top:20px">
          ${btn("Start", "start-focus", { variant: "go", data: { kind: "claims" }, key: "Enter" })}
        </div>
      </section>` : `
      <section class="triage__group">
        <div class="triage__n">All judgements made</div>
        <p class="t-sub">Nothing in the documentation is unsupported or contradictory.</p>
      </section>`}

    ${n.cleanReady.length ? `
      <section class="triage__group">
        <div class="triage__n"><span class="c">${n.cleanReady.length}</span> sections are clean</div>
        <p class="t-sub" style="margin-bottom:16px">
          Every statement traced to a source, nothing contradictory, nothing edited.</p>
        <p class="inline-list" style="margin-bottom:18px">
          ${n.cleanReady.map((s) => `<b>${esc(s.heading)}</b>`).join(" · ")}</p>
        <div class="acts">
          ${btn(`Accept all ${n.cleanReady.length}`, "accept-clean", { variant: "ok" })}
          ${btn("Read them first", "read-mode", { variant: "plain" })}
        </div>
      </section>` : ""}

    ${rs.pending ? `
      <section class="triage__group">
        <div class="triage__n"><span class="c">${rs.pending}</span> risks to conclude</div>
        <p class="t-sub" style="margin-bottom:18px">
          ${rs.significant} proposed as significant · ${rs.fraud} fraud-related ·
          ${rs.newRisks} outside the firm's library${rs.blocked.length ? ` · ${rs.blocked.length} blocked by an open item` : ""}
        </p>
        <div class="acts">
          ${btn("Review recommendations", "start-focus", { variant: "go", data: { kind: "risks" } })}
        </div>
      </section>` : ""}

    ${cs.pending ? `
      <section class="triage__group">
        <div class="triage__n"><span class="c">${cs.pending}</span> controls to conclude</div>
        <p class="t-sub" style="margin-bottom:18px">
          ${cs.suggestedKey} suggested as key controls · ${cs.unassessable} where the criteria could not
          be established · ${cs.gaps} control gaps recorded
        </p>
        <div class="acts">
          ${btn("Review recommendations", "start-focus", { variant: "go", data: { kind: "controls" } })}
        </div>
      </section>` : ""}

    ${!queue.length && !n.cleanReady.length && !rs.pending && !cs.pending ? `
      <section class="triage__group">
        <div class="triage__n">Review complete</div>
        <p class="t-sub" style="margin-bottom:18px">
          ${n.approved} sections approved, ${st.riskSummary().decided} risks and
          ${st.controlSummary().decided} controls concluded.</p>
        <div class="acts">
          ${btn("Read the working paper", "read-mode", { variant: "go" })}
          ${btn("Go to sign-off", "nav", { data: { href: "#/complete" } })}
        </div>
      </section>` : ""}

    <div style="margin-top:36px" class="acts">
      ${btn("Read the working paper", "read-mode", { variant: "plain" })}
      ${btn("Risk and control matrix", "nav", { variant: "plain", data: { href: "#/matrix" } })}
    </div>
  `;

  return screen("review", body);
}

/* ── Focus: one judgement at a time ──────────────────────────────────────── */

const focusBar = (i, len, label) => `<div class="focus__bar">
  <button class="b-act b-act--plain b-act--sm" data-act="exit-focus">← Back</button>
  <span class="sp"></span>
  <span>${esc(label)}</span>
  <span class="idline__sep">·</span>
  <span><b style="color:var(--ink-2)">${i + 1}</b> of ${len}</span>
</div>`;

function claimFocus() {
  const queue = st.claimQueue();
  if (!queue.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, queue.length - 1);
  const { b, sec } = queue[ix];
  const isConflict = st.claimState(b) === "contradiction";
  const idx = sec.blocks.indexOf(b);
  const before = sec.blocks[idx - 1], after = sec.blocks[idx + 1];

  const ctx = (x) => x && !st.claimBlocking(x)
    ? `<div class="focus__ctx">${esc(prose(x))}</div>` : "";

  const body = `<div class="focus">
    ${focusBar(ix, queue.length, sec.heading)}
    <div class="focus__body"><div class="focus__in">

      <h1 class="t-h" style="margin-bottom:20px">${esc(sec.heading)}</h1>
      ${ctx(before)}
      <div class="${cx("focus__item", isConflict && "focus__item--alert")}">${esc(prose(b))}</div>
      ${ctx(after)}

      ${isConflict ? conflictBody(b) : unsupportedBody(b)}

    </div></div>
  </div>`;

  return screen("review", body, { raw: true });
}

function unsupportedBody(b) {
  return `
    <div class="focus__why">
      <h4>No source supports this</h4>
      <p>Searched 38 transcript segments, 12 questionnaire answers and 134 document chunks across
      six sources. ${esc(b.why || "")}</p>
    </div>

    <div class="suggest">
      <div class="suggest__l">What the evidence actually supports</div>
      <div class="suggest__t">${esc((b.suggestion || "").replace(/\[\[.+?\]\]/g, "").trim())}</div>
    </div>

    ${S.editing === b.id ? `
      <div style="margin-top:20px">
        <textarea class="field" id="claim-edit" rows="4">${esc(prose(b))}</textarea>
        <div class="acts" style="margin-top:12px">
          ${btn("Save", "save-claim", { variant: "go", data: { claim: b.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "plain" })}
        </div>
      </div>`
    : `<div class="focus__acts">
        ${btn("Use this", "use-suggestion", { variant: "go", data: { claim: b.id }, key: "Enter" })}
        ${btn("Write my own", "edit-claim", { data: { claim: b.id }, key: "E" })}
        ${btn("Ask the client", "ask-about", { data: { claim: b.id }, key: "A" })}
        ${btn("Reject", "reject-claim", { data: { claim: b.id }, key: "R" })}
      </div>`}

    ${more("gr", "Show what the validator checked", `<div class="meth">
      <dl>
        <dt>rule 1</dt><dd>Every statement carries at least one evidence reference — <span style="color:var(--warn)">failed</span></dd>
        <dt>rule 2</dt><dd>Each reference resolves inside this engagement — not reached</dd>
        <dt>rule 3</dt><dd>The quoted text occurs in the referenced source — not reached</dd>
        <dt>rule 4</dt><dd>Library references exist in pack revenue v0.1.0 — passed</dd>
      </dl>
      <p class="t-meta" style="margin-top:12px">Validation runs in code, not in the model. A failure sets
      <span class="mono">grounding = needs_source</span> and raises a flag — never a silent drop.</p>
    </div>`, S.disclosed.gr)}
  `;
}

function conflictBody(b) {
  const a = ref("T:seg-17"), c = ref("Q:6"), d = ref("D:note-1");
  const card = (r, cls, who) => `<div class="vs ${cls}">
    <div class="vs__who">${esc(who)}</div>
    <div class="vs__meta">${esc(r.sourceName)} · ${esc(r.locator)}</div>
    <div class="vs__q">&ldquo;${esc(r.quote)}&rdquo;</div>
  </div>`;

  return `
    <div class="focus__why">
      <h4>Two sources give different answers</h4>
      <p>Until this is settled, control <span class="mono">C-02</span> cannot be assessed and risk
      <span class="mono">R-07</span> cannot be concluded.</p>
    </div>

    <div class="versus">
      ${card(a, "vs--a", "Financial controller")}
      ${card(c, "vs--b", "Commercial Director")}
    </div>
    <div style="margin-top:14px">${card(d, "vs--a", "Credit control, on a follow-up call")}</div>

    <div class="focus__acts" style="flex-direction:column;align-items:stretch;gap:10px">
      ${(b.options || []).map((o, i) => `
        <button class="rw" data-act="pick-conflict" data-claim="${esc(b.id)}"
          data-choice="${esc(o.choice)}" data-text="${esc(o.text)}"
          style="border-bottom:1px solid var(--line)">
          <span class="rw__lead"><span class="chip">${i + 1}</span></span>
          <span class="rw__main">
            <span class="rw__t">${esc(o.label)}</span>
            <span class="rw__d">${esc(o.detail)}</span>
          </span>
        </button>`).join("")}
    </div>`;
}

function riskFocus() {
  const q = st.riskSummary().queue;
  if (!q.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, q.length - 1);
  const r = q[ix];
  const linked = controls.filter((c) => c.risks.includes(r.id));
  const refs = claimRefsFrom(r.refs);

  const body = `<div class="focus">
    ${focusBar(ix, q.length, "Risks")}
    <div class="focus__body"><div class="q">
      <h1 class="q__t">${esc(r.title)}</h1>
      <p class="q__d">${esc(r.desc)}</p>

      <div class="q__block">
        <h4>Why this was identified here</h4>
        <p>${esc(r.drivers)}</p>
      </div>

      ${r.newJustification ? `<div class="q__flag">
        <b>Not in the firm's risk library.</b> ${esc(r.newJustification)}</div>` : ""}

      <dl class="q__facts">
        <div class="q__fact"><dt>Assertions</dt><dd>${r.assertions.map((a) => esc(a.replace(/_/g, " "))).join(", ")}</dd></div>
        <div class="q__fact"><dt>Risk factors</dt><dd>${r.factors.map((a) => esc(a.replace(/_/g, " "))).join(", ")}</dd></div>
        <div class="q__fact"><dt>Sub-process</dt><dd>${esc(subProcesses.find((s) => s.id === r.sub)?.name || r.sub)}</dd></div>
        ${linked.length ? `<div class="q__fact"><dt>Addressed by</dt><dd>${linked.map((c) => esc(c.title)).join("; ")}</dd></div>`
          : `<div class="q__fact"><dt>Addressed by</dt><dd style="color:var(--alert)">No control identified</dd></div>`}
      </dl>

      ${more("rsrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.rsrc)}

      <div class="q__sug">
        <span class="l">Suggested</span>
        <span class="v">${r.rating === "higher" ? "Higher" : r.rating === "moderate" ? "Moderate" : "Lower"} inherent risk${
          r.significant ? " · significant risk" : ""}</span>
      </div>
      <div class="q__acts">
        ${btn("Accept", "decide-risk", { variant: "go", data: { id: r.id, d: "accepted" }, key: "Enter" })}
        ${btn("Accept as modified", "decide-risk", { data: { id: r.id, d: "modified" }, key: "M" })}
        ${btn("Reject", "decide-risk", { data: { id: r.id, d: "rejected" }, key: "R" })}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "plain" })}
      </div>
    </div></div>
  </div>`;

  return screen("review", body, { raw: true });
}

const CRIT = {
  addresses_rmm: "Addresses an assessed risk at assertion level",
  precision: "Precise enough to detect a material misstatement",
  evidence_of_operation: "Evidence exists that it operated",
  owner_competence_authority: "Owner has the authority to act on exceptions",
  it_dependencies_identified: "IT dependencies and information used are identified",
  not_redundant: "Not redundant with a stronger control",
};

function controlFocus() {
  const q = st.controlSummary().queue;
  if (!q.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, q.length - 1);
  const c = q[ix];
  const refs = claimRefsFrom(c.refs);
  const linked = risks.filter((r) => c.risks.includes(r.id));
  const unmet = Object.entries(c.criteria).filter(([, v]) => v !== "met");

  const NAT = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent manual" };
  const FRQ = { per_transaction: "Per transaction", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
    quarterly: "Quarterly", annual: "Annual", event_driven: "Event-driven" };

  const body = `<div class="focus">
    ${focusBar(ix, q.length, "Controls")}
    <div class="focus__body"><div class="q">
      <h1 class="q__t">${esc(c.title)}</h1>
      <p class="q__d">${esc(c.desc)}</p>

      <div class="q__block">
        <h4>${c.keyProposal === true ? "Why this may be a key control"
          : c.keyProposal === false ? "Why this is probably not a key control"
          : "Why this cannot be assessed"}</h4>
        <p>${esc(c.rationale)}</p>
      </div>

      <dl class="q__facts">
        <div class="q__fact"><dt>Owner</dt><dd>${esc(c.owner || "Not established")}</dd></div>
        <div class="q__fact"><dt>Type</dt><dd>${c.type === "preventive" ? "Preventive" : "Detective"} · ${esc(NAT[c.nature])} · ${esc(FRQ[c.frequency])}</dd></div>
        <div class="q__fact"><dt>Addresses</dt><dd>${linked.length ? linked.map((r) => esc(r.title)).join("; ") : "No assessed risk linked"}</dd></div>
        <div class="q__fact"><dt>Evidence it operated</dt><dd>${c.evidenceOfOperation ? esc(c.evidenceOfOperation)
          : `<span style="color:var(--warn)">Not established</span>`}</dd></div>
        ${c.ipe ? `<div class="q__fact"><dt>Information used</dt><dd>${esc(c.ipe)}${
          c.ipeNote ? `<div class="t-meta" style="margin-top:3px">${esc(c.ipeNote)}</div>` : ""}</dd></div>` : ""}
      </dl>

      ${more("csrc", `Supported by ${refs.length} sources`, evidence(refs), S.disclosed.csrc)}

      ${c.blocked ? `<div class="q__flag q__flag--alert"><b>Blocked.</b> ${esc(c.blocked)}</div>` : ""}
      ${!c.blocked && unmet.length ? `<div class="q__flag">
        <b>${unmet.length === 1 ? "One criterion is not met" : `${unmet.length} criteria are not met`}.</b>
        ${unmet.map(([k]) => esc(CRIT[k].toLowerCase())).join("; ")}.
        ${c.followUp ? " " + esc(c.followUp) : ""}</div>` : ""}

      ${more("crit", "Show the six criteria", `<div class="meth">
        ${Object.entries(c.criteria).map(([k, v]) => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="flex:1;color:var(--ink-2)">${esc(CRIT[k])}</span>
          ${v === "met" ? state("approved", "Met") : v === "not_met" ? state("rejected", "Not met") : state("needs_source", "Unknown")}
        </div>`).join("")}
        <p class="t-meta" style="margin-top:12px">A criterion that cannot be established produces a
        follow-up question, never a lower-confidence conclusion.</p>
      </div>`, S.disclosed.crit)}

      <div class="q__sug">
        <span class="l">Suggested</span>
        <span class="v">${c.keyProposal === true ? "Key control"
          : c.keyProposal === false ? "Not a key control" : "Cannot be assessed"}</span>
      </div>
      <div class="q__acts">
        ${btn(c.keyProposal === true ? "Accept — key control" : c.keyProposal === false ? "Accept — not key" : "Leave undecided",
          "decide-control", { variant: "go", key: "Enter",
          data: { id: c.id, d: c.keyProposal === true ? "key" : c.keyProposal === false ? "not_key" : "undecided" } })}
        ${c.keyProposal !== true ? btn("Key control", "decide-control", { data: { id: c.id, d: "key" }, key: "K" }) : ""}
        ${c.keyProposal !== false ? btn("Not key", "decide-control", { data: { id: c.id, d: "not_key" }, key: "N" }) : ""}
        ${c.keyProposal !== null ? btn("Undecided", "decide-control", { data: { id: c.id, d: "undecided" }, key: "U" }) : ""}
        <span class="sp"></span>
        ${btn("Skip", "focus-next", { variant: "plain" })}
      </div>
    </div></div>
  </div>`;

  return screen("review", body, { raw: true });
}

const claimRefsFrom = (ids) => ids.map(ref).filter(Boolean);

/* ── Read: the document ──────────────────────────────────────────────────── */

function claimView(b, sec) {
  const s = st.claimState(b);
  const open = S.openClaim === b.id;
  const refs = claimRefs(b);
  const decided = st.sectionDecision(sec);
  const mod = s === "needs_source" ? "warn" : s === "contradiction" ? "alert"
    : s === "absent" ? "absent" : s === "rejected" ? "gone" : s === "edited" ? "edited" : "";

  if (S.editing === b.id) {
    return `<div class="claim is-open" style="cursor:default">
      <textarea class="field" id="claim-edit" rows="4">${esc(prose(b))}</textarea>
      <div class="acts" style="margin-top:12px">
        ${btn("Save", "save-claim", { variant: "go", size: "sm", data: { claim: b.id } })}
        ${btn("Cancel", "cancel-edit", { variant: "plain", size: "sm" })}
      </div>
    </div>`;
  }

  const note =
    s === "needs_source" ? `<div class="claim__note"><span class="state state--warn">
        <i class="dot dot--warn"></i>No source supports this</span>
        ${btn("Resolve", "focus-claim", { size: "sm", data: { claim: b.id } })}</div>`
    : s === "contradiction" ? `<div class="claim__note"><span class="state state--alert">
        <i class="dot dot--alert"></i>Two sources disagree</span>
        ${btn("Compare", "focus-claim", { size: "sm", data: { claim: b.id } })}</div>`
    : s === "absent" ? `<div class="claim__note"><i class="dot dot--open"></i>
        Recorded as not obtained — this is documentation, not an error</div>`
    : s === "edited" ? `<div class="claim__note"><i class="dot"></i>Edited by you</div>`
    : s === "rejected" ? `<div class="claim__note"><i class="dot"></i>Removed from the working paper</div>`
    : "";

  return `<div class="${cx("claim", mod && "claim--" + mod, open && "is-open")}"
      data-act="toggle-claim" data-claim="${esc(b.id)}">
      ${esc(prose(b))}${note}
    </div>
    ${open ? evidence(refs, {
      footer: `${refs.length ? `<span class="t-meta">${refs.length} source${refs.length === 1 ? "" : "s"}</span>` : ""}
        <span class="sp"></span>
        ${decided ? "" : btn("Edit", "edit-claim", { variant: "plain", size: "sm", data: { claim: b.id } })}
        ${decided ? "" : btn("Reject", "reject-claim", { variant: "plain", size: "sm", data: { claim: b.id } })}
        ${btn("Open full source", "mock", { variant: "plain", size: "sm" })}`,
    }) : ""}`;
}

function readView() {
  const n = st.narrativeSummary();

  const railHtml = `<aside class="rail">
    <div class="t-eyebrow" style="margin-bottom:10px">Sections</div>
    ${narrative.map((sec) => {
      const s = st.sectionState(sec);
      const attn = s === "needs_source" || s === "contradiction";
      const tick = s === "approved" ? "ok" : s === "contradiction" ? "alert"
        : s === "needs_source" ? "warn" : s === "rejected" ? "gone" : "";
      return `<button class="${cx("rail__i", S.section === sec.id && "is-on", !attn && s !== "approved" && "rail__i--quiet")}"
        data-act="go-section" data-id="${esc(sec.id)}">
        <span class="${cx("rail__tick", tick && "rail__tick--" + tick)}"></span>
        <span>${esc(sec.heading)}</span>
      </button>`;
    }).join("")}
    <div class="t-meta" style="margin-top:16px">${n.decided} of ${n.sections} decided</div>
  </aside>`;

  const docHtml = `<div class="reader__doc"><div class="doc">
    ${narrative.map((sec) => {
      const s = st.sectionState(sec);
      const decided = st.sectionDecision(sec);
      const blockers = st.sectionBlockers(sec);
      return `<section class="doc__sec" id="sec-${esc(sec.id)}">
        <div class="doc__h">
          <span class="n">${esc(sec.n)}</span>${esc(sec.heading)}
          <span class="sp"></span>
          ${decided === "approved" ? `<span class="state state--ok"><i class="dot dot--ok"></i>Approved</span>`
            : decided === "rejected" ? `<span class="state"><i class="dot"></i>Rejected</span>`
            : blockers.length ? `<span class="state state--${s === "contradiction" ? "alert" : "warn"}">
                <i class="dot dot--${s === "contradiction" ? "alert" : "warn"}"></i>${blockers.length} to resolve</span>`
            : btn("Approve", "approve-section", { variant: "ok", size: "sm", data: { id: sec.id }, key: "A" })}
          ${decided ? btn("Reopen", "reopen-section", { variant: "plain", size: "sm", data: { id: sec.id } }) : ""}
        </div>
        ${sec.blocks.map((b) => claimView(b, sec)).join("")}
      </section>`;
    }).join("")}
    <div style="margin-top:60px;padding-top:26px;border-top:1px solid var(--line)" class="acts">
      ${btn("Back to review", "triage-mode", { variant: "plain" })}
      ${n.pending === 0 ? btn("Go to sign-off", "nav", { variant: "go", data: { href: "#/complete" } }) : ""}
    </div>
  </div></div>`;

  const body = `<div class="wrap wrap--wide" style="padding-top:24px">
    <div class="reader">${railHtml}${docHtml}</div>
  </div>`;

  return screen("review", body, { raw: true });
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function review() {
  if (!S.generated) return generateView();
  if (S.reviewMode === "focus") {
    if (S.focusKind === "risks") return riskFocus();
    if (S.focusKind === "controls") return controlFocus();
    return claimFocus();
  }
  if (S.reviewMode === "read") return readView();
  return triage();
}
