/* REVIEW — the surface the product is won or lost on.

   Three modes:
     triage  the routine separated from the judgement, before anything is asked
     focus   one judgement at a time, full width, keyboard-first
     read    the document, with evidence opening inline beneath the claim

   No table, no permanent source panel, no modal. */

import { esc, cx, act as btn, row, rows, dot, chip, tag, icon, more, evidence, empty,
         callout, link, state, dependencies, card } from "../ui.js";
import { narrative, risks, controls, gaps, pipeline, subProcesses } from "../data-model.js";
import { processMap, mapLegend, mapDetail } from "./map.js";
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

const PHASES = [
  { n: "Understanding the sources", from: 0, to: 3, ic: "transcript" },
  { n: "Structuring the process",   from: 3, to: 5, ic: "map" },
  { n: "Drafting the narrative",    from: 4, to: 6, ic: "document" },
  { n: "Checking every statement",  from: 6, to: 8, ic: "evidence" },
  { n: "Preparing the workpaper",   from: 8, to: 9, ic: "check" },
];

function generateView() {
  const running = S.generating;
  const done = S.generated && !S.genSeen;
  const cov = st.coverageSummary();
  const stage = S.genStage;

  const phase = (ph, i) => {
    const fin = stage >= ph.to;
    const now = running && stage >= ph.from && stage < ph.to;
    return `<div class="rw ${fin || now ? "" : "rw--done"}" style="opacity:${fin || now ? 1 : .4}">
      <span class="rw__lead">${fin ? `<span class="state state--ok">${icon("check", 17)}</span>`
        : now ? `<span class="state">${icon(ph.ic, 17)}</span>`
        : `<span class="ink5">${icon(ph.ic, 17)}</span>`}</span>
      <span class="rw__main">
        <span class="rw__t">${esc(ph.n)}</span>
        ${now ? `<span class="rw__d">${esc(pipeline[Math.min(stage, pipeline.length - 1)].name.toLowerCase())}…</span>` : ""}
      </span>
      <span class="rw__side">${fin ? tag("done", "ok") : now ? tag("running", "accent") : ""}</span>
    </div>`;
  };

  const body = `
    <div class="head">
      <h1 class="t-display">${done ? "Draft ready" : running ? "Drafting the process understanding"
        : "Draft the process understanding"}</h1>
      <p class="t-lede">
        This step establishes <em>how the process works</em> and nothing else. What controls it and
        what is wrong with it is step 4, and it runs against this understanding once you have
        reviewed it.
      </p>
    </div>

    ${!running && !done ? `
      ${rows(`
        ${row({ lead: icon("check", 17), title: "Areas established",
          side: `<span class="b ink2">${cov.covered} of ${cov.applicable}</span>` })}
        ${row({ lead: icon("evidence", 17), title: "Process facts",
          side: `<span class="b ink2">${cov.facts.known} of ${cov.facts.total}</span>` })}
        ${row({ lead: icon("document", 17), title: "Methodology pack",
          side: `<span class="mono t-meta">revenue v0.1.0</span>` })}
        ${row({ lead: icon("transcript", 17), title: "Sources indexed",
          side: `<span class="b ink2">${Object.keys(sources).length}</span>` })}`)}
      <div class="acts sec">
        ${btn("Start", "run-pipeline", { variant: "primary", size: "lg", key: "Enter", ic: "arrow" })}
      </div>
      <p class="t-meta sec__note measure">
        Nine stages, five of which ask a model. Every stage is validated before the next one runs,
        and nothing is concluded.</p>` : `
      <div class="sec">${rows(PHASES.map(phase).join(""))}</div>
      ${done ? `
        <div class="sec">
          ${callout(`<b>Three statements could not be supported.</b> Every statement has to cite a
            source, and the quote has to occur in it. Three did not, so they are in the draft marked
            <b>needs support</b> and cannot be approved until you deal with them. Nothing was dropped
            quietly.`, "warn")}
          <div class="acts sec">
            ${btn("Review the draft", "read-gen", { variant: "primary", size: "lg", key: "Enter", ic: "arrow" })}
          </div>
          <p class="t-meta sec__note measure">
            Nothing has been concluded. No control identified, no finding proposed and no risk signal
            raised — that analysis is step 4, and it needs an understanding you have accepted.</p>
        </div>` : ""}
      <div class="sec--loose">
        ${more("genstages", "Show the technical stages", `<div class="meth">
          ${pipeline.map((p, i) => `<div class="meth__row">
            <div class="row row--base">
              <span class="mono ink4" style="width:34px">${esc(p.id)}</span>
              <span class="b">${esc(p.name)}</span>
              <span class="sp"></span>
              <span class="mono t-meta">${esc(p.model)}</span>
            </div>
            <p class="t-sub" style="margin:6px 0 0 34px">${esc(p.desc)}</p>
            ${i < S.genStage ? `<p class="t-meta" style="margin:5px 0 0 34px;color:${
              p.warn ? "var(--warn)" : "var(--ink-3)"}">${esc(fill(p.out))}</p>` : ""}
          </div>`).join("")}
        </div>`, S.disclosed.genstages)}
      </div>`}
  `;
  return screen("understanding", body, { width: "narrow" });
}

function fill(t) {
  const cov = st.coverageSummary();
  return t.replace("FACTS_KNOWN", cov.facts.known).replace("FACTS_UNKNOWN", cov.facts.unknown + cov.facts.contradictory)
    .replace("COV_COVERED", cov.covered).replace("COV_APPLICABLE", cov.applicable)
    .replace("MANDATORY_OPEN", cov.mandatoryOpen.length)
    .replace("RISK_COUNT", risks.length).replace("CONTROL_COUNT", controls.length)
    .replace("FINDING_COUNT", gaps.length + 1)
    .replace("GAP_COUNT", gaps.length).replace("KEY_COUNT", controls.filter((c) => c.keyProposal === true).length)
    .replace("RCM_ROWS", 15).replace("OPEN_COUNT", 10);
}

/* ── Triage: the Attention Queue ─────────────────────────────────────────── */

/** What a blocking claim holds up — the line that makes an auditor click. */
const BLOCKS = {
  contradiction: [
    { icon: "document", name: "Process understanding · Credit management", state: "needs judgement" },
    { icon: "control", name: "Control C-02 · Credit limit release", state: "cannot conclude" },
    { icon: "gate", name: "Completion · No unresolved contradictions", state: "gate unmet" },
  ],
  needs_source: [
    { icon: "document", name: "The section it sits in", state: "cannot approve" },
  ],
};

function triage() {
  const n = st.narrativeSummary();
  const queue = st.claimQueue();

  const item = ({ b, sec }, i) => {
    const isC = st.claimState(b) === "contradiction";
    const blocks = BLOCKS[isC ? "contradiction" : "needs_source"];
    return `<button class="${cx("aqi", isC ? "aqi--alert" : "aqi--warn")}"
        data-act="focus-claim" data-claim="${esc(b.id)}">
      <span class="aqi__top">
        <span class="aqi__n">${String(i + 1).padStart(2, "0")}</span>
        <span class="aqi__k">${icon(isC ? "contradiction" : "evidence", 13)}${
          isC ? "Contradiction" : "Unsupported"}</span>
        <span class="aqi__ctx">${esc(sec.heading)}</span>
      </span>
      <span class="aqi__t">${esc(prose(b))}</span>
      <span class="aqi__why">${isC
        ? "Two sources give different answers. The documentation cannot say both."
        : esc(b.why || "No source in the engagement supports this statement.")}</span>
      <span class="aqi__ft">
        <span class="blocks">${icon("link", 13)}<b>Blocks</b>${
          blocks.map((x) => `<span class="blocks__i">${esc(x.name.split(" · ").pop())}</span>`).join("")}</span>
        <span class="aqi__go">Review${icon("chevron", 14)}</span>
      </span>
    </button>`;
  };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Process understanding</h1>
          <p class="t-lede">
            ${n.blocks} statements drawn from ${Object.keys(sources).length} sources, each one
            checked against the source it cites.
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n" style="color:var(--ok)">${n.blocks - queue.length}</span>
            <span class="tally__l">ready</span></div>
          <div><span class="tally__n" style="color:${queue.length ? "var(--danger)" : "var(--ok)"}">${queue.length}</span>
            <span class="tally__l">need you</span></div>
        </div>
      </div>
    </div>

    ${queue.length ? `
      <section class="sec">
        <div class="sec__h">
          <h2 class="t-h">${queue.length} need your judgement</h2>
          <span class="sp"></span>
          ${btn("Start the queue", "start-focus", { variant: "primary", data: { kind: "claims" }, key: "Enter" })}
        </div>
        <p class="t-sub sec__h measure">
          Contradictions first, then statements the drafting could not support. Everything else is
          already traced.</p>
        <div class="aq">${queue.map(item).join("")}</div>
      </section>` : `
      <section class="sec">
        ${callout(`<b>Every judgement is made.</b> Nothing in the documentation is unsupported or
          contradictory.`, "ok")}
      </section>`}

    ${n.cleanReady.length ? `
      <section class="sec--loose">
        <div class="sec__h">
          <h2 class="t-h">${n.cleanReady.length} sections are clean</h2>
          <span class="sp"></span>
          ${btn(`Accept all ${n.cleanReady.length}`, "accept-clean", { variant: "ok", ic: "check" })}
          ${btn("Read them first", "read-mode", { variant: "ghost" })}
        </div>
        <p class="t-sub sec__h measure">
          Every statement traced to a source, nothing contradictory, nothing edited.</p>
        <p class="inline-list">${n.cleanReady.map((x) => `<b>${esc(x.heading)}</b>`).join(" · ")}</p>
      </section>` : ""}

    ${!queue.length && !n.cleanReady.length ? `
      <section class="sec--loose">
        <div class="sec__h"><h2 class="t-h">Understanding approved</h2></div>
        <p class="t-sub sec__h measure">
          ${n.approved} sections approved. Step 4 now analyses what controls this process and what is
          wrong with it, against the understanding you accepted.</p>
        <div class="acts">
          ${btn("Analyse controls and findings", "nav", { variant: "primary", ic: "arrow", data: { href: "#/controls" } })}
          ${btn("Read the working paper", "read-mode", { ic: "document" })}
        </div>
      </section>` : ""}

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-eyebrow">The process as understood</h2>
        <span class="sp"></span>${mapLegend("plain")}
      </div>
      ${processMap("plain", { selected: S.mapStep })}
      ${S.mapStep ? mapDetail(S.mapStep) : `<p class="t-meta sec__note">
        Built from the same facts as the narrative. Click a step to see where it came from.</p>`}
    </section>

    <div class="acts sec--loose">
      ${btn("Read the working paper", "read-mode", { ic: "document" })}
    </div>
  `;

  return screen("understanding", body, { width: "wide" });
}

/* ── Decision Workspace: one judgement at a time ─────────────────────────── */

export const dwBar = (i, len, label, back = "exit-focus") => `<div class="dw__bar">
  ${btn("Back", back, { variant: "ghost", size: "sm", ic: "back" })}
  <span class="sp"></span>
  <span>${esc(label)}</span>
  <span class="dw__prog">${Array.from({ length: Math.min(len, 9) }, (_, k) =>
    `<i class="${k < i ? "is-done" : k === i ? "is-on" : ""}"></i>`).join("")}</span>
  <span><b class="ink2">${i + 1}</b> of ${len}</span>
</div>`;

function claimFocus() {
  const queue = st.claimQueue();
  if (!queue.length) { S.reviewMode = "triage"; return triage(); }
  const ix = Math.min(S.focusIx, queue.length - 1);
  const { b, sec } = queue[ix];
  const isConflict = st.claimState(b) === "contradiction";

  const body = `<div class="dw">
    ${dwBar(ix, queue.length, sec.heading)}
    <div class="dw__body"><div class="dw__in">
      <div class="dw__ctx">${icon(isConflict ? "contradiction" : "evidence", 15)}
        <span class="t-eyebrow">${isConflict ? "Contradiction" : "Unsupported statement"}</span>
        <span>·</span><b>${esc(sec.heading)}</b></div>
      <h1 class="dw__t dw__t--doc">${esc(prose(b))}</h1>
      ${isConflict ? conflictBody(b) : unsupportedBody(b)}
    </div></div>
  </div>`;

  return screen("understanding", body, { raw: true });
}

function unsupportedBody(b) {
  return `
    <div class="dw__blk">
      <h4>No source supports this</h4>
      <p>Searched 38 transcript segments, 12 questionnaire answers and 134 document chunks across
      six sources. ${esc(b.why || "")}</p>
    </div>

    ${dependencies([{ icon: "document", name: "The section it sits in", state: "cannot be approved" }])}

    <div class="proposal">
      <span class="proposal__l">${icon("evidence", 14)}What the evidence actually supports</span>
    </div>
    <p class="t-doc measure" style="margin-top:14px">${esc((b.suggestion || "").replace(/\[\[.+?\]\]/g, "").trim())}</p>

    ${S.editing === b.id ? `
      <div class="sec">
        <textarea class="field" id="claim-edit" rows="4">${esc(prose(b))}</textarea>
        <div class="acts sec__note">
          ${btn("Save", "save-claim", { variant: "primary", data: { claim: b.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
        </div>
      </div>`
    : `<div class="dock"><div class="dock__in">
        ${btn("Use this wording", "use-suggestion", { variant: "primary", data: { claim: b.id }, key: "⏎" })}
        ${btn("Write my own", "edit-claim", { data: { claim: b.id }, key: "E" })}
        ${btn("Ask the client", "ask-about", { data: { claim: b.id }, key: "A" })}
        ${btn("Remove statement", "reject-claim", { variant: "ghost", data: { claim: b.id }, key: "R" })}
      </div></div>`}

    ${more("gr", "Show what the check looked for", `<div class="meth">
      <dl>
        <dt>rule 1</dt><dd>Every statement carries at least one evidence reference — <span style="color:var(--warn)">failed</span></dd>
        <dt>rule 2</dt><dd>Each reference resolves inside this engagement — not reached</dd>
        <dt>rule 3</dt><dd>The quoted text occurs in the referenced source — not reached</dd>
        <dt>rule 4</dt><dd>Library references exist in pack revenue v0.1.0 — passed</dd>
      </dl>
      <p class="t-meta" style="margin-top:12px">This check runs in code, not in the model. A failure
      marks the statement <b>needs support</b> and raises a flag — never a silent drop.</p>
    </div>`, S.disclosed.gr)}
  `;
}

function conflictBody(b) {
  const a = ref("T:seg-17"), c = ref("Q:6"), d = ref("D:note-1");
  const vs = (r, cls, who, mark) => `<div class="vs ${cls}">
    <div class="vs__hd">${icon(r.kind === "client_answer" ? "questionnaire" : r.kind === "auditor_note" ? "note" : "transcript", 15)}
      <span class="vs__who">${esc(who)}</span></div>
    <div class="vs__meta">${esc(r.sourceName)} · ${esc(r.locator)}</div>
    <div class="vs__q">&ldquo;${markIn(r.quote, mark)}&rdquo;</div>
  </div>`;

  return `
    <div class="dw__blk">
      <h4>Two sources give different answers</h4>
      <p>The documentation cannot say both, and until it says one, the control over credit limits
      cannot be concluded.</p>
    </div>

    <div class="versus">
      ${vs(a, "vs--a", "Financial controller", "only credit control")}
      ${vs(c, "vs--b", "Commercial Director", "up to fifty thousand")}
    </div>
    <div class="sec--tight">${vs(d, "vs--a", "Credit control, on a follow-up call", "not aware of anyone outside credit control")}</div>

    ${dependencies(BLOCKS.contradiction, "This decision affects")}

    <div class="dock"><div class="dock__in" style="flex-direction:column;align-items:stretch">
      ${(b.options || []).map((o, i) => `
        <button class="card card--flat" data-act="pick-conflict" data-claim="${esc(b.id)}"
          data-choice="${esc(o.choice)}" data-text="${esc(o.text)}">
          <span class="card__hd">
            <span class="rw__lead"><span class="chip">${i + 1}</span></span>
            <span class="sp">
              <span class="card__t">${esc(o.label)}</span>
              <span class="card__d">${esc(o.detail)}</span>
            </span>
            <span class="rw__side">${icon("chevron", 16)}</span>
          </span>
        </button>`).join("")}
      <p class="dock__note">Press <span class="mono">1</span>, <span class="mono">2</span> or
        <span class="mono">3</span>. Whichever you choose, both source statements stay on the file.</p>
    </div></div>`;
}

/** Mark a phrase inside a quote — case-insensitive, first occurrence. */
function markIn(quote, phrase) {
  if (!phrase) return esc(quote);
  const i = quote.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return esc(quote);
  return esc(quote.slice(0, i)) + "<mark>" + esc(quote.slice(i, i + phrase.length)) +
         "</mark>" + esc(quote.slice(i + phrase.length));
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
        ${btn("Save", "save-claim", { variant: "primary", size: "sm", data: { claim: b.id } })}
        ${btn("Cancel", "cancel-edit", { variant: "ghost", size: "sm" })}
      </div>
    </div>`;
  }

  const note =
    s === "needs_source" ? `<div class="claim__note"><span class="state state--warn">
        ${icon("evidence", 14)}No source supports this</span>
        ${btn("Resolve", "focus-claim", { size: "sm", data: { claim: b.id } })}</div>`
    : s === "contradiction" ? `<div class="claim__note"><span class="state state--alert">
        ${icon("contradiction", 14)}Two sources disagree</span>
        ${btn("Compare", "focus-claim", { size: "sm", data: { claim: b.id } })}</div>`
    : s === "absent" ? `<div class="claim__note"><i class="dot dot--open"></i>
        Recorded as not obtained — this is documentation, not an error</div>`
    : s === "edited" ? `<div class="claim__note">${icon("check", 14)}Edited by you</div>`
    : s === "rejected" ? `<div class="claim__note"><i class="dot"></i>Removed from the working paper</div>`
    : "";

  /* Source Lens: the claim stays exactly where it is; the evidence opens
     beneath it on a recessed surface. The eye never leaves the line. */
  /* A div, not a button: the state note nests its own actions, and nested
     buttons are invalid HTML that the parser silently un-nests. */
  return `<div class="${cx("claim", mod && "claim--" + mod, open && "is-open")}"
      data-act="toggle-claim" data-claim="${esc(b.id)}" role="button" tabindex="0"
      aria-expanded="${open}">
      ${esc(prose(b))}<span class="claim__n">${refs.length
        ? `${refs.length} source${refs.length === 1 ? "" : "s"}` : "no source"}</span>${note}
    </div>
    ${open ? evidence(refs.map((r) => ({ ...r, tone: r.conflict ? "alert" : "" })), {
      none: `<b>Nothing in the engagement supports this statement.</b> It is in the file marked
        <b>needs support</b> and cannot be approved until you deal with it.`,
      footer: `${refs.length ? `<span class="t-meta">${refs.length === 1 ? "One source"
          : `${refs.length} sources, corroborating`}</span>` : ""}
        <span class="sp"></span>
        ${decided ? "" : btn("Edit", "edit-claim", { variant: "ghost", size: "sm", data: { claim: b.id } })}
        ${decided ? "" : btn("Remove", "reject-claim", { variant: "ghost", size: "sm", data: { claim: b.id } })}
        ${btn("Open full source", "mock", { variant: "ghost", size: "sm", ic: "link" })}`,
    }) : ""}`;
}

function readView() {
  const n = st.narrativeSummary();

  const railHtml = `<aside class="rail">
    <div class="t-eyebrow rail__h">Working paper</div>
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
    <div class="t-meta rail__h" style="margin-top:16px;padding-left:8px">${n.decided} of ${n.sections} sections decided</div>
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
          ${decided === "approved" ? tag("Approved", "ok", "check")
            : decided === "rejected" ? tag("Rejected", "quiet")
            : blockers.length ? tag(`${blockers.length} to resolve`,
                s === "contradiction" ? "alert" : "warn",
                s === "contradiction" ? "contradiction" : "evidence")
            : btn("Approve", "approve-section", { variant: "ok", size: "sm", data: { id: sec.id }, key: "A" })}
          ${decided ? btn("Reopen", "reopen-section", { variant: "ghost", size: "sm", data: { id: sec.id } }) : ""}
        </div>
        ${sec.blocks.map((b) => claimView(b, sec)).join("")}
      </section>`;
    }).join("")}
    <hr class="rule">
    <div class="acts sec">
      ${btn("Back to the queue", "triage-mode", { variant: "ghost", ic: "back" })}
      ${n.pending === 0 ? btn("Analyse controls and findings", "nav",
        { variant: "primary", ic: "arrow", data: { href: "#/controls" } }) : ""}
    </div>
  </div></div>`;

  const body = `<div class="wrap wrap--wide page-in" style="padding-top:32px">
    <div class="reader">${railHtml}${docHtml}</div>
  </div>`;

  return screen("understanding", body, { raw: true });
}

/* ── Entry ───────────────────────────────────────────────────────────────── */

export function understanding() {
  if (!S.generated || !S.genSeen) return generateView();
  if (S.reviewMode === "focus" && S.focusKind === "claims") return claimFocus();
  if (S.reviewMode === "read") return readView();
  return triage();
}
