/* K + L. Review workspace — the screen the product is won or lost on.

   Three columns: section navigator, document, source panel. Approval happens at
   section level (14 decisions, not ~90), but status is tracked per block so one
   ungrounded sentence blocks its section. */

import { esc, cx, btn, tag, panel, note, status, meter, toggle, drawer, sourceChip, empty } from "../ui.js";
import { ref, sources, transcript, questionnaire } from "../data-sources.js";
import { narrative } from "../data-model.js";
import * as st from "../state.js";
import { wsScreen } from "./chrome.js";

const S = st.S;

/* --- Inline provenance parsing --------------------------------------------
   [[T:seg-13|D:doc-py-3]] · [[none]] · [[conflict:T:seg-17|Q:6]]
   -------------------------------------------------------------------------- */

export function blockRefs(b) {
  const out = [];
  const text = st.blockText(b);
  const re = /\[\[(.+?)\]\]/g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[1];
    if (body === "none") continue;
    body.replace(/^conflict:/, "").split("|").forEach((id) => { if (!out.includes(id)) out.push(id); });
  }
  const rt = S.blocks[b.id];
  if (rt?.resolution?.refId && !out.includes(rt.resolution.refId)) out.push(rt.resolution.refId);
  return out;
}

function renderText(b) {
  const text = st.blockText(b);
  return esc(text).replace(/\[\[(.+?)\]\]/g, (_, body) => {
    if (body === "none") {
      return `<button class="src src--none" data-act="resolve-source" data-block="${esc(b.id)}"
        title="No source could be validated for this statement">no source</button>`;
    }
    const conflict = body.startsWith("conflict:");
    const ids = body.replace(/^conflict:/, "").split("|");
    const first = ref(ids[0]);
    if (!first) return "";
    const chip = sourceChip({ ...first, conflict }, { pinned: S.pinned === first.id, extra: ids.length - 1 });
    return conflict
      ? `${chip}<button class="src src--conflict" data-act="resolve-conflict" data-block="${esc(b.id)}">resolve</button>`
      : chip;
  });
}

/* --- Section navigator ----------------------------------------------------- */

function navigator_() {
  const n = st.narrativeSummary();
  return `<div class="ws__nav">
    <div style="padding:0 16px 10px">
      <div class="lbl">Sections</div>
      <div class="tiny dim" style="margin-top:2px">${n.approved + n.rejected} of ${n.sections} decided</div>
    </div>
    ${st.visibleSections().map((sec) => {
      const s = st.sectionState(sec);
      const blocking = st.sectionBlocking(sec).length;
      const missing = sec.blocks.filter((b) => st.blockState(b) === "missing").length;
      const mark = s === "approved" ? `<span class="st st--approved"><i></i></span>`
        : s === "rejected" ? `<span class="st st--rejected"><i></i></span>`
        : s === "needs_source" ? `<span class="st st--needssource"><i></i></span>`
        : s === "contradiction" ? `<span class="st st--contradiction"><i></i></span>`
        : s === "edited" ? `<span class="st st--edited"><i></i></span>`
        : `<span class="st st--draft"><i></i></span>`;
      return `<button class="${cx("navitem", S.section === sec.id && "is-active")}"
        data-act="select-section" data-id="${esc(sec.id)}">
        ${mark}
        <span class="navitem__t">${esc(sec.n)}. ${esc(sec.heading)}</span>
        ${blocking ? `<span class="tab__c tab__c--${s === "contradiction" ? "alert" : "warn"}">${blocking}</span>`
          : missing ? `<span class="tab__c">${missing}</span>` : ""}
      </button>`;
    }).join("")}
    ${st.visibleSections().length === 0
      ? `<div style="padding:24px 16px" class="tiny dim">Every section has been decided.</div>` : ""}
  </div>`;
}

/* --- Document -------------------------------------------------------------- */

function blockView(b, sec) {
  const s = st.blockState(b);
  const sel = S.selBlock === b.id;
  const decided = st.sectionDecision(sec);
  const rt = S.blocks[b.id] || {};

  const flag =
    s === "needs_source" ? `<div class="doc__flag">${status("needs_source")}
        <span class="dim">·</span><span class="dim">No source in this engagement supports this statement. It cannot be approved.</span>
        ${btn("Resolve", "resolve-source", { size: "sm", data: { block: b.id } })}</div>`
    : s === "contradiction" ? `<div class="doc__flag">${status("contradiction")}
        <span class="dim">·</span><span class="dim">Two sources give different answers. A decision is required.</span>
        ${btn("Resolve", "resolve-conflict", { size: "sm", data: { block: b.id } })}</div>`
    : s === "missing" ? `<div class="doc__flag">${status("missing")}
        <span class="dim">·</span><span class="dim">Recorded as not obtained — this is documentation, not an error.</span></div>`
    : s === "edited" ? `<div class="doc__flag">${status("edited", rt.resolution ? "Resolved by the auditor" : "Edited by the auditor")}</div>`
    : s === "rejected" ? `<div class="doc__flag">${status("rejected")}</div>` : "";

  const actions = sel && !decided && s !== "rejected"
    ? `<div class="doc__flag" style="margin-top:8px">
        ${btn("Edit", "edit-block", { size: "sm", data: { block: b.id } })}
        ${btn("Reject statement", "reject-block", { size: "sm", variant: "danger", data: { block: b.id } })}
        ${btn("Regenerate", "mock", { size: "sm" })}
        <span class="tiny dim">${blockRefs(b).length} source${blockRefs(b).length === 1 ? "" : "s"}</span>
      </div>` : "";

  return `<div class="${cx("doc__blk", `doc__blk--${s}`, sel && "is-sel")}"
    data-act="select-block" data-block="${esc(b.id)}">
    ${renderText(b)}${flag}${actions}
  </div>`;
}

function document_() {
  const secs = st.visibleSections();
  if (!secs.length) {
    return `<div class="ws__main"><div style="padding:40px">
      ${empty("Nothing unresolved", "Turn off the filter to see the approved sections.")}</div></div>`;
  }
  return `<div class="ws__main" id="doc-scroll"><div class="doc">
    ${secs.map((sec) => {
      const s = st.sectionState(sec);
      const decided = st.sectionDecision(sec);
      const blocking = st.sectionBlocking(sec);
      return `<section class="${cx("doc__sec", decided === "approved" && "is-approved")}" id="sec-${esc(sec.id)}">
        <header class="doc__sechead">
          <div class="row" style="gap:10px">
            <span class="doc__hn">${esc(sec.n)}</span>
            <span class="doc__h">${esc(sec.heading)}</span>
            ${status(s === "approved" ? "approved" : s === "rejected" ? "rejected"
              : s === "needs_source" ? "needs_source" : s === "contradiction" ? "contradiction"
              : s === "edited" ? "edited" : "draft",
              s === "draft" ? "AI draft" : undefined)}
          </div>
          <div class="btn-row">
            ${decided
              ? btn("Reopen", "unapprove-section", { size: "sm", variant: "ghost", data: { id: sec.id } })
              : blocking.length
                ? btn(`Blocked — ${blocking.length} to resolve`, null, { size: "sm", disabled: true,
                    title: "A section cannot be approved while it contains an unsupported or contradictory statement" })
                : btn("Approve section", "approve-section", { size: "sm", variant: "ok", data: { id: sec.id } })}
            ${decided ? "" : btn("Reject", "reject-section", { size: "sm", data: { id: sec.id } })}
          </div>
        </header>
        <div class="doc__body">
          ${sec.blocks.map((b) => blockView(b, sec)).join("")}
        </div>
      </section>`;
    }).join("")}
  </div></div>`;
}

/* --- Source panel ---------------------------------------------------------- */

function sourcePanel() {
  const sec = narrative.find((s) => s.id === S.section) || narrative[0];
  const block = sec.blocks.find((b) => b.id === S.selBlock);
  const target = block || sec.blocks[0];
  const ids = target ? blockRefs(target) : [];
  const bs = target ? st.blockState(target) : "draft";

  return `<aside class="ws__side">
    <div class="srcpanel__head">
      <div class="lbl">Sources</div>
      <div class="tiny dim" style="margin-top:2px">
        ${target ? `Statement ${esc(target.id)} · ${ids.length} source${ids.length === 1 ? "" : "s"}` : "Select a statement"}
      </div>
    </div>
    ${bs === "needs_source" ? `<div style="padding:16px 20px">
      ${note(`<span class="strong">No validated source.</span> The grounding validator could not
        find this statement in any ingested source. It cannot be approved until it is edited,
        supported, or rejected.<div style="margin-top:8px">
        ${btn("Why was this generated?", "explain-nosource", { size: "sm", data: { block: target.id } })}</div>`, "warn")}
    </div>` : ""}
    ${ids.length === 0 && bs !== "needs_source"
      ? `<div style="padding:20px" class="tiny dim">This statement carries no source reference.</div>` : ""}
    ${ids.map((id) => {
      const r = ref(id);
      if (!r) return "";
      const pinned = S.pinned === id;
      return `<div class="${cx("srccard", pinned && "is-pinned")}" data-act="pin-source" data-ref="${esc(id)}">
        <div class="srccard__meta">
          ${tag(r.short, "mono")}
          <span class="srccard__kind">${esc(r.sourceName)}</span>
          ${r.conflict ? tag("Conflicting", "alert") : ""}
        </div>
        ${r.speaker ? `<div class="srccard__loc" style="margin-bottom:6px">${esc(r.speaker)} · ${esc(r.locator)}</div>` : ""}
        ${r.question ? `<div class="tiny dim" style="margin-bottom:4px">Q: ${esc(r.question)}</div>` : ""}
        <div class="srccard__q">${esc(r.quote)}</div>
        <div class="srccard__ctx">
          ${btn("Open full source", "open-source", { size: "sm", variant: "ghost", data: { src: r.sourceId, ref: id } })}
        </div>
      </div>`;
    }).join("")}
  </aside>`;
}

/* --- Screen ---------------------------------------------------------------- */

export function review() {
  if (!S.generated) return notGenerated("documentation");
  const n = st.narrativeSummary();

  const bar = `<div class="wsbar">
    <span><span class="strong">${n.pending}</span> of ${n.sections} sections need a decision</span>
    <span class="dim">·</span>
    ${n.needsSource.length ? `<span>${status("needs_source", `${n.needsSource.length} need a source`)}</span>` : ""}
    ${n.contradiction.length ? `<span>${status("contradiction", `${n.contradiction.length} contradictory`)}</span>` : ""}
    ${n.missing.length ? `<span>${status("missing", `${n.missing.length} not obtained`)}</span>` : ""}
    <span class="wsbar__spacer"></span>
    <span style="width:110px">${meter(n.pct, 100, n.pct === 100)}</span>
    <span class="num tiny">${n.pct}%</span>
    ${toggle("Show unresolved only", S.unresolvedOnly, "toggle-unresolved")}
    ${btn(`Approve ${n.bulkReady.length} grounded sections`, "bulk-approve",
      { size: "sm", variant: n.bulkReady.length ? "primary" : "", disabled: !n.bulkReady.length })}
  </div>`;

  return wsScreen("documentation",
    `${bar}<div class="ws">${navigator_()}${document_()}${sourcePanel()}</div>`,
    { raw: true });
}

export function notGenerated(what) {
  return wsScreen("documentation", `
    ${empty(`No ${what} yet`, "Run the generation pipeline from the Revenue overview first.")}
    <div style="text-align:center;margin-top:-32px">
      ${btn("Generate documentation", "nav", { variant: "primary", data: { href: "#/generate" } })}
    </div>`);
}

/* --- Drawers --------------------------------------------------------------- */

const findBlock = (id) => {
  for (const sec of narrative) { const b = sec.blocks.find((x) => x.id === id); if (b) return { b, sec }; }
  return null;
};

export function editDrawer(id) {
  const { b } = findBlock(id);
  return drawer({
    title: "Edit statement",
    sub: `Statement <span class="mono">${esc(b.id)}</span> · your edit is never overwritten by regeneration`,
    body: `<textarea class="editarea" id="edit-text" rows="7">${esc(st.blockText(b))}</textarea>
      <p class="tiny dim" style="margin-top:10px">
        Source references stay in the text as <span class="mono">[[…]]</span> markers. Removing a marker
        removes the reference. Editing a statement marks it as auditor-authored, and it no longer
        requires model grounding.</p>`,
    foot: `<div class="btn-row">
      ${btn("Save edit", "save-edit", { variant: "primary", data: { block: b.id } })}
      ${btn("Cancel", "close-drawer")}</div>`,
  });
}

export function resolveSourceDrawer(id) {
  const { b, sec } = findBlock(id);
  const suggestion = b.id === "N10.2"
    ? "Credit notes are raised by sales administration and approved by the sales manager. No value threshold requiring finance approval was identified. [[T:seg-26|D:doc-py-5]]"
    : b.id === "N11.2"
    ? "Receipts that do not match automatically are placed on a suspense list which credit control clears. No ageing threshold or escalation route for unapplied cash was established. [[T:seg-30]]"
    : "The reports used in this review are produced by Business Central. We did not establish how their completeness and accuracy is confirmed. [[T:seg-37]]";

  return drawer({
    title: "This statement has no source",
    sub: `Statement <span class="mono">${esc(b.id)}</span> in <span class="strong">${esc(sec.heading)}</span>`,
    wide: true,
    body: `
      ${note(`<div class="strong" style="margin-bottom:6px">What the draft says</div>
        <div style="font-family:var(--font-doc);font-size:14px;line-height:1.6">
          ${esc(st.blockText(b).replace(/\[\[.+?\]\]/g, "").trim())}</div>`, "warn")}

      <div style="margin-top:18px">
        <div class="lbl" style="margin-bottom:6px">Why the model produced it</div>
        <p class="small muted" style="line-height:1.6">${esc(b.why || "")}</p>
      </div>

      <div style="margin-top:20px">
        <div class="lbl" style="margin-bottom:6px">Search the evidence base</div>
        <input class="input" value="credit note approval threshold" readonly>
        <div class="empty" style="margin-top:10px;padding:22px">
          <div class="empty__t">No source supports this statement</div>
          <div class="tiny">Searched 38 transcript segments, 12 questionnaire answers and 134 document
            chunks across ${Object.keys(sources).length} sources.</div>
        </div>
      </div>

      <hr class="hr">
      <div class="lbl" style="margin-bottom:10px">Resolve</div>
      <div class="stack-sm">
        <button class="radio-card" data-act="accept-suggestion" data-block="${esc(b.id)}"
          data-text="${esc(suggestion)}">
          <span class="radio-card__r"></span>
          <span style="flex:1">
            <span class="small strong">Replace with what the evidence supports</span>
            <span class="tiny dim" style="display:block;margin-top:4px;font-family:var(--font-doc);font-size:13px">
              ${esc(suggestion.replace(/\[\[.+?\]\]/g, "").trim())}</span>
          </span>
        </button>
        <button class="radio-card" data-act="edit-block" data-block="${esc(b.id)}">
          <span class="radio-card__r"></span>
          <span style="flex:1"><span class="small strong">Write it myself</span>
          <span class="tiny dim" style="display:block">The statement becomes auditor-authored.</span></span>
        </button>
        <button class="radio-card" data-act="raise-item" data-block="${esc(b.id)}">
          <span class="radio-card__r"></span>
          <span style="flex:1"><span class="small strong">Ask the client and keep it open</span>
          <span class="tiny dim" style="display:block">Creates an open item; the section stays blocked until it is answered.</span></span>
        </button>
        <button class="radio-card" data-act="reject-block" data-block="${esc(b.id)}">
          <span class="radio-card__r"></span>
          <span style="flex:1"><span class="small strong">Reject the statement</span>
          <span class="tiny dim" style="display:block">Removed from the working paper. The rejection is recorded.</span></span>
        </button>
      </div>`,
  });
}

export function resolveConflictDrawer(id) {
  const { b } = findBlock(id);
  const a = ref("T:seg-17"), c = ref("Q:6"), d = ref("D:note-1");
  const card = (r, label) => `<div class="srccard" style="border:1px solid var(--line);border-radius:6px;margin-bottom:10px">
    <div class="srccard__meta">${tag(r.short, "mono")}<span class="srccard__kind">${esc(label)}</span></div>
    <div class="srccard__loc" style="margin-bottom:6px">${esc(r.speaker)} · ${esc(r.locator)}</div>
    <div class="srccard__q">${esc(r.quote)}</div>
  </div>`;

  const optA = "Only credit control may change a customer credit limit, with the agreement of the CFO above EUR 250,000. [[T:seg-17|D:note-1]]";
  const optB = "Credit limits are set by credit control, with CFO agreement above EUR 250,000. The Commercial Director is additionally able to raise a limit by up to EUR 50,000 where an order is blocked. [[T:seg-17|Q:6]]";
  const optC = "The authority to change a customer credit limit could not be established. Two sources give different answers and the difference has been raised with the entity. [[conflict:T:seg-17|Q:6]]";

  return drawer({
    title: "Resolve contradiction",
    sub: "Coverage item <span class='mono'>R3.1</span> · fact <span class='mono'>limit_change_owner</span>",
    wide: true,
    body: `
      ${note(`Two sources give different answers to the same question. Until this is resolved,
        control <span class="mono">C-02</span> cannot be assessed and risk <span class="mono">R-07</span>
        cannot be concluded.`, "alert")}
      <div style="margin-top:18px">
        ${card(a, "Walkthrough — financial controller")}
        ${card(d, "Auditor notes — credit control")}
        ${card(c, "Questionnaire — commercial director")}
      </div>
      <hr class="hr">
      <div class="lbl" style="margin-bottom:10px">Auditor decision</div>
      <div class="stack-sm">
        <button class="radio-card" data-act="pick-conflict" data-block="${esc(b.id)}" data-choice="controller" data-text="${esc(optA)}">
          <span class="radio-card__r"></span><span style="flex:1">
          <span class="small strong">The controller and credit control are correct</span>
          <span class="tiny dim" style="display:block;margin-top:3px">Two corroborating sources against one. The commercial director's answer is recorded as inconsistent.</span></span>
        </button>
        <button class="radio-card" data-act="pick-conflict" data-block="${esc(b.id)}" data-choice="both" data-text="${esc(optB)}">
          <span class="radio-card__r"></span><span style="flex:1">
          <span class="small strong">Both are true — record the additional route</span>
          <span class="tiny dim" style="display:block;margin-top:3px">The commercial director has an override the controller was unaware of. This weakens control C-02.</span></span>
        </button>
        <button class="radio-card" data-act="pick-conflict" data-block="${esc(b.id)}" data-choice="unresolved" data-text="${esc(optC)}">
          <span class="radio-card__r"></span><span style="flex:1">
          <span class="small strong">Leave unresolved and document the difference</span>
          <span class="tiny dim" style="display:block;margin-top:3px">Records the contradiction as an audit finding and keeps the open item live.</span></span>
        </button>
      </div>`,
  });
}

export function bulkDrawer() {
  const n = st.narrativeSummary();
  const excluded = narrative.filter((s) => !st.sectionDecision(s) && !n.bulkReady.includes(s));
  return drawer({
    title: `Approve ${n.bulkReady.length} sections`,
    sub: "Bulk approval never sweeps up a problem — that is what makes it safe to offer",
    body: `
      <div class="lbl" style="margin-bottom:8px">Will be approved — grounded and unedited</div>
      <div class="stack-sm" style="margin-bottom:20px">
        ${n.bulkReady.map((s) => `<div class="row" style="gap:8px">${status("grounded", "")}
          <span class="small">${esc(s.n)}. ${esc(s.heading)}</span>
          <span class="tiny dim">${s.blocks.length} statements</span></div>`).join("")}
      </div>
      ${excluded.length ? `<div class="lbl" style="margin-bottom:8px">Excluded — a decision is required</div>
      <div class="stack-sm">
        ${excluded.map((s) => {
          const bs = st.sectionState(s);
          return `<div class="row" style="gap:8px">
            ${status(bs === "contradiction" ? "contradiction" : bs === "needs_source" ? "needs_source" : "edited", "")}
            <span class="small">${esc(s.n)}. ${esc(s.heading)}</span>
            <span class="tiny dim">${bs === "contradiction" ? "contains a contradiction"
              : bs === "needs_source" ? "contains an unsupported statement" : "you have edited it"}</span>
          </div>`;
        }).join("")}
      </div>` : ""}`,
    foot: `<div class="btn-row">
      ${btn(`Approve ${n.bulkReady.length} sections`, "confirm-bulk", { variant: "ok" })}
      ${btn("Cancel", "close-drawer")}</div>`,
  });
}

export function sourceDrawer(srcId, refId) {
  const s = sources[srcId];
  const r = refId ? ref(refId) : null;
  let body = "";
  if (srcId === "SRC-1") {
    body = transcript.map((seg) => {
      const hit = r && r.segId === seg.id;
      return `<div class="turn" ${hit ? 'id="hit"' : ""}>
        <div class="turn__who"><b>${esc(seg.who)}</b><span>${esc(seg.role)}</span><span class="mono">${esc(seg.t)}</span></div>
        <div class="turn__t">${hit ? `<mark style="background:#fdf0c8">${esc(seg.text)}</mark>` : esc(seg.text)}</div>
      </div>`;
    }).join("");
  } else if (srcId === "SRC-2") {
    body = questionnaire.map((q) => `<div class="turn">
      <div class="turn__who"><b>Question ${q.n}</b><span class="mono">${esc(q.coverage)}</span></div>
      <div class="turn__t" style="font-weight:500">${esc(q.q)}</div>
      <div class="turn__t" style="margin-top:4px;padding-left:12px;border-left:2px solid var(--line-strong)">
        ${q.a ? esc(q.a) : `<span class="dim">Awaiting response — sent ${esc(q.sentOn)}</span>`}</div>
    </div>`).join("");
  } else {
    body = `<div class="turn"><div class="turn__t">${esc(r ? r.quote : "")}</div></div>
      <p class="tiny dim" style="margin-top:16px">Document rendering is mocked in this prototype.
      In the product the page image is shown with the cited span highlighted.</p>`;
  }
  return drawer({
    title: s.name, sub: `${esc(s.detail)}<br>${esc(s.participants)}`, wide: true, body,
  });
}

export function explainDrawer(blockId) {
  const found = blockId ? findBlock(blockId) : null;
  const b = found?.b;
  return drawer({
    title: "Why this was flagged",
    sub: "Grounding validation runs in code, not in the model",
    body: `
      <p class="small" style="line-height:1.7">Every generated statement must cite at least one source,
      and the quote it cites must actually occur in that source after normalisation. This statement
      cited nothing that could be validated, so it was marked
      <span class="strong">Needs source</span> rather than dropped silently.</p>
      ${b?.why ? `<div style="margin-top:16px">${note(`<span class="strong">Most likely origin.</span> ${esc(b.why)}`, "warn")}</div>` : ""}
      <hr class="hr">
      <div class="lbl" style="margin-bottom:8px">The rules that ran</div>
      <table class="tbl tbl--dense"><tbody>
        ${[
          ["Every object carries at least one evidence reference", "failed"],
          ["Each reference resolves inside this engagement", "n/a"],
          ["The quoted text occurs in the referenced source", "n/a"],
          ["Library references exist in pack revenue v0.1.0", "passed"],
          ["A new risk carries a justification", "passed"],
        ].map(([rule, res]) => `<tr><td>${esc(rule)}</td>
          <td class="r">${res === "failed" ? status("needs_source", "Failed")
            : res === "passed" ? status("approved", "Passed") : `<span class="tiny dim">not reached</span>`}</td></tr>`).join("")}
      </tbody></table>
      <p class="tiny dim" style="margin-top:14px">This is the mechanism described in
      <span class="mono">06 §6.3</span>: validator failures set
      <span class="mono">grounding = 'needs_source'</span> and raise a flag — never a silent drop.</p>`,
    foot: b ? `<div class="btn-row">${btn("Resolve this statement", "resolve-source", { variant: "primary", data: { block: b.id } })}</div>` : "",
  });
}
