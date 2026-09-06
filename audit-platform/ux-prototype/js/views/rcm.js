/* M. Risks · N. Controls · O. Risk & control matrix · P. Open items */

import { esc, cx, btn, tag, panel, note, status, metric, drawer, empty, proposalDecision } from "../ui.js";
import { risks, controls, gaps, openItems, subProcesses } from "../data-model.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";
import { wsScreen } from "./chrome.js";
import { notGenerated } from "./review.js";

const S = st.S;
const spName = (id) => subProcesses.find((s) => s.id === id)?.name || id;
const chips = (ids) => `<div class="tags">${ids.map((id) => {
  const e = ref(id); if (!e) return "";
  return `<button class="src" data-act="pin-source" data-ref="${esc(id)}"
    data-quote="${esc(e.quote)}" data-meta="${esc(e.sourceName + " · " + e.locator)}">${esc(e.short)}</button>`;
}).join("")}</div>`;

const RATING = { lower: "Lower", moderate: "Moderate", higher: "Higher" };
const NATURE = { manual: "Manual", automated: "Automated", it_dependent_manual: "IT-dependent manual" };
const FREQ = { per_transaction: "Per transaction", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  quarterly: "Quarterly", annual: "Annual", event_driven: "Event-driven" };
const CRITERION = {
  addresses_rmm: "Addresses an assessed risk at assertion level",
  precision: "Sufficiently precise to detect a material misstatement",
  evidence_of_operation: "Evidence exists that it operated",
  owner_competence_authority: "Owner has the authority and competence to act",
  it_dependencies_identified: "IT dependencies and IPE identified",
  not_redundant: "Not redundant with a stronger control",
};

/* ── M. Risks ────────────────────────────────────────────────────────────── */

export function risksView() {
  if (!S.generated) return notGenerated("risks");
  const rs = st.riskSummary();
  const sel = risks.find((r) => r.id === S.riskSel) || risks[0];

  const body = `<div class="stack">
    <div class="metrics">
      ${metric(rs.total, "risks identified")}
      ${metric(rs.decided, "concluded by the auditor", rs.decided === rs.total ? "ok" : "")}
      ${metric(rs.significant, "proposed as significant risks")}
      ${metric(rs.fraud, "fraud-related (ISA 240)")}
      ${metric(rs.newRisks, "outside the library")}
      ${metric(rs.blocked, "blocked by an open item", rs.blocked ? "alert" : "")}
    </div>

    ${panel("Identified risks", `
      <table class="tbl">
        <thead><tr><th style="width:72px">Risk</th><th>Description</th><th style="width:150px">Assertions</th>
          <th style="width:96px">Inherent risk</th><th style="width:210px">Auditor conclusion</th></tr></thead>
        <tbody>
          ${risks.map((r) => {
            const d = st.riskDecision(r);
            return `<tr class="${cx("is-click", S.riskSel === r.id && "is-sel")}" data-act="select-risk" data-id="${esc(r.id)}">
              <td class="nowrap">
                <span class="mono strong">${esc(r.id)}</span>
                <div class="tiny dim mono" style="margin-top:2px">${r.lib ? esc(r.lib) : "NEW"}</div>
              </td>
              <td>
                <div class="strong">${esc(r.title)}</div>
                <div class="tiny dim" style="margin-top:2px">${esc(r.sub)} · ${esc(spName(r.sub))}
                  ${r.fraud ? " · " : ""}${r.fraud ? `<span style="color:var(--alert)">fraud-related</span>` : ""}</div>
              </td>
              <td><div class="tags">${r.assertions.map((a) => tag(a.replace(/_/g, " "))).join("")}</div></td>
              <td>${status(r.rating === "higher" ? "contradiction" : r.rating === "moderate" ? "needs_source" : "draft",
                    RATING[r.rating])}
                ${r.significant ? `<div class="tiny dim" style="margin-top:2px">significant candidate</div>` : ""}</td>
              <td>
                ${r.blocked && !d ? status("contradiction", "Blocked — open item OI-01")
                  : d ? status(d === "rejected" ? "rejected" : "approved",
                      d === "accepted" ? "Accepted as proposed" : d === "modified" ? "Modified by the auditor" : "Rejected")
                  : `<div class="btn-row">
                      ${btn("Accept", "decide-risk", { size: "sm", data: { id: r.id, d: "accepted" } })}
                      ${btn("Modify", "open-risk", { size: "sm", data: { id: r.id } })}
                      ${btn("Reject", "decide-risk", { size: "sm", data: { id: r.id, d: "rejected" } })}
                    </div>`}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`, { flush: true,
        actions: btn(`Accept ${risks.filter((r) => !st.riskDecision(r) && !r.blocked).length} unblocked risks as proposed`,
          "accept-all-risks", { size: "sm", disabled: !risks.some((r) => !st.riskDecision(r) && !r.blocked) }) })}

    ${sel ? riskDetail(sel) : ""}
  </div>`;

  return wsScreen("risks", body);
}

function riskDetail(r) {
  const d = st.riskDecision(r);
  const linked = controls.filter((c) => c.risks.includes(r.id));
  const gap = gaps.find((g) => g.risk === r.id);

  return panel(`${r.id} — detail`, `
    <div class="grid grid--main-side">
      <div class="stack-sm">
        <div><div class="lbl">Risk</div>
          <p style="font-size:14px;line-height:1.65;margin-top:4px">${esc(r.title)}</p></div>
        <div><div class="lbl">What could go wrong</div>
          <p class="small muted" style="line-height:1.65;margin-top:4px">${esc(r.desc)}</p></div>
        <div><div class="lbl">Why it was identified for this entity</div>
          <p class="small muted" style="line-height:1.65;margin-top:4px">${esc(r.drivers)}</p></div>
        ${r.newJustification ? note(`<span class="strong">Not in the risk library.</span> ${esc(r.newJustification)}`, "accent") : ""}
        <div><div class="lbl" style="margin-bottom:6px">Sources</div>${chips(r.refs)}</div>
        ${linked.length ? `<div><div class="lbl" style="margin-bottom:6px">Addressed by</div>
          <div class="tags">${linked.map((c) => `<button class="tag tag--accent" data-act="nav" data-href="#/controls">${esc(c.id)} · ${esc(c.title.slice(0, 54))}…</button>`).join("")}</div></div>` : ""}
        ${gap ? note(`<span class="strong">Control gap ${esc(gap.id)}.</span> ${esc(gap.desc)}`, "warn") : ""}
      </div>
      <div class="stack-sm">
        <div><div class="lbl">Assertions</div><div class="tags" style="margin-top:5px">${r.assertions.map((a) => tag(a.replace(/_/g, " "))).join("")}</div></div>
        <div><div class="lbl">Inherent risk factors</div><div class="tags" style="margin-top:5px">${r.factors.map((a) => tag(a.replace(/_/g, " "))).join("")}</div></div>
        <hr class="hr" style="margin:12px 0">
        ${proposalDecision(
          `Inherent risk <span class="strong">${RATING[r.rating]}</span>${r.significant ? " · significant risk candidate" : ""}${r.fraud ? " · fraud-related" : ""}`,
          d ? status(d === "rejected" ? "rejected" : "approved",
              d === "accepted" ? "Accepted as proposed" : d === "modified" ? "Modified" : "Rejected") + `
              <div style="margin-top:8px">${btn("Change", "clear-risk", { size: "sm", data: { id: r.id } })}</div>`
            : r.blocked
              ? `${note(`This risk cannot be concluded while open item <span class="mono">OI-01</span> is unresolved.`, "alert")}
                 <div style="margin-top:8px">${btn("Resolve the contradiction", "resolve-conflict", { size: "sm", variant: "primary", data: { block: "N6.2" } })}</div>`
              : `<div class="btn-row">
                  ${btn("Accept", "decide-risk", { size: "sm", variant: "ok", data: { id: r.id, d: "accepted" } })}
                  ${btn("Accept as modified", "decide-risk", { size: "sm", data: { id: r.id, d: "modified" } })}
                  ${btn("Reject", "decide-risk", { size: "sm", variant: "danger", data: { id: r.id, d: "rejected" } })}
                </div>`,
          !!d)}
      </div>
    </div>`);
}

/* ── N. Controls ─────────────────────────────────────────────────────────── */

export function controlsView() {
  if (!S.generated) return notGenerated("controls");
  const cs = st.controlSummary();
  const sel = controls.find((c) => c.id === S.controlSel) || controls[0];

  const body = `<div class="stack">
    <div class="metrics">
      ${metric(cs.total, "controls identified")}
      ${metric(cs.proposedKey, "proposed as key")}
      ${metric(cs.agreedKey, "agreed as key by the auditor", cs.agreedKey ? "ok" : "")}
      ${metric(cs.unassessable, "criteria could not be established", cs.unassessable ? "warn" : "")}
      ${metric(cs.gaps, "control gaps", "alert")}
      ${metric(cs.decided, `of ${cs.total} concluded`)}
    </div>

    ${panel("Identified controls", `
      <table class="tbl">
        <thead><tr><th style="width:84px">Control</th><th>Control</th><th style="width:130px">Type</th>
          <th style="width:110px">Frequency</th><th style="width:196px">Key control</th></tr></thead>
        <tbody>
          ${controls.map((c) => {
            const d = st.controlDecision(c);
            return `<tr class="${cx("is-click", S.controlSel === c.id && "is-sel")}" data-act="select-control" data-id="${esc(c.id)}">
              <td class="nowrap"><span class="mono strong">${esc(c.id)}</span>
                <div class="tiny dim mono" style="margin-top:2px">${esc(c.lib)}</div></td>
              <td><div class="strong">${esc(c.title)}</div>
                <div class="tiny dim" style="margin-top:2px">${esc(c.sub)} · ${esc(c.owner || "owner not established")}
                ${c.designIssue ? ` · <span style="color:var(--alert)">design deficiency</span>` : ""}</div></td>
              <td><div class="small">${esc(NATURE[c.nature])}</div>
                <div class="tiny dim">${c.type === "preventive" ? "Preventive" : "Detective"}</div></td>
              <td class="small">${esc(FREQ[c.frequency])}</td>
              <td>
                <div class="tiny dim" style="margin-bottom:3px">AI: ${c.keyProposal === true ? "likely key"
                  : c.keyProposal === false ? "not key" : "cannot assess"}</div>
                ${d ? status(d === "key" ? "approved" : d === "not_key" ? "rejected" : "draft",
                      d === "key" ? "Key control" : d === "not_key" ? "Not key" : "Undecided")
                  : `<div class="btn-row">
                      ${btn("Key", "decide-control", { size: "sm", data: { id: c.id, d: "key" } })}
                      ${btn("Not key", "decide-control", { size: "sm", data: { id: c.id, d: "not_key" } })}
                    </div>`}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`, { flush: true })}

    ${sel ? controlDetail(sel) : ""}

    ${panel("Control gaps", `
      <table class="tbl">
        <thead><tr><th style="width:56px">Gap</th><th>Description</th><th style="width:170px">Severity</th><th style="width:56px">Risk</th></tr></thead>
        <tbody>
          ${gaps.map((g) => `<tr class="is-click" data-act="open-gap" data-id="${esc(g.id)}">
            <td class="mono strong">${esc(g.id)}</td>
            <td><div>${esc(g.desc)}</div>
              <div class="tiny dim" style="margin-top:4px">${esc(g.sub)} · ${esc(spName(g.sub))}</div></td>
            <td>${status(g.severity === "deficiency" ? "needs_source" : "contradiction",
                  g.severity === "deficiency" ? "Deficiency"
                  : g.severity === "significant_deficiency_candidate" ? "Significant deficiency — candidate"
                  : "Material weakness — candidate")}</td>
            <td class="mono">${esc(g.risk)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`, { flush: true,
        sub: "Raw material for the ISA 265 communication to management and those charged with governance" })}
  </div>`;

  return wsScreen("controls", body);
}

function controlDetail(c) {
  const d = st.controlDecision(c);
  const met = Object.values(c.criteria).filter((v) => v === "met").length;

  return panel(`${c.id} — detail`, `
    <div class="grid grid--main-side">
      <div class="stack-sm">
        <div><div class="lbl">Control</div>
          <p style="font-size:14px;line-height:1.65;margin-top:4px">${esc(c.title)}</p></div>
        <div><div class="lbl">Description</div>
          <p class="small muted" style="line-height:1.65;margin-top:4px">${esc(c.desc)}</p></div>
        <table class="tbl tbl--dense" style="margin-top:8px"><tbody>
          <tr><td class="dim" style="width:180px">Control owner</td><td>${esc(c.owner || "Not established")}</td></tr>
          <tr><td class="dim">Type / nature</td><td>${c.type === "preventive" ? "Preventive" : "Detective"} · ${esc(NATURE[c.nature])}</td></tr>
          <tr><td class="dim">Frequency</td><td>${esc(FREQ[c.frequency])}</td></tr>
          <tr><td class="dim">Evidence of operation</td><td>${c.evidenceOfOperation ? esc(c.evidenceOfOperation) : `<span style="color:var(--warn)">Not established</span>`}</td></tr>
          <tr><td class="dim">Information used (IPE)</td><td>${c.ipe ? esc(c.ipe) : `<span class="dim">None</span>`}
            ${c.ipeNote ? `<div class="tiny" style="color:var(--warn);margin-top:3px">${esc(c.ipeNote)}</div>` : ""}</td></tr>
          <tr><td class="dim">IT dependencies</td><td>${c.itDependencies.length ? esc(c.itDependencies.join("; ")) : `<span class="dim">None</span>`}</td></tr>
          <tr><td class="dim">Risks addressed</td><td class="mono">${c.risks.length ? esc(c.risks.join(", ")) : `<span class="dim">None linked</span>`}</td></tr>
          <tr><td class="dim">Assertions</td><td><div class="tags">${c.assertions.map((a) => tag(a.replace(/_/g, " "))).join("")}</div></td></tr>
        </tbody></table>
        <div><div class="lbl" style="margin-bottom:6px">Sources</div>${chips(c.refs)}</div>
      </div>

      <div class="stack-sm">
        <div class="lbl">Key-control criteria — ${met} of 6 met</div>
        <table class="tbl tbl--dense"><tbody>
          ${Object.entries(c.criteria).map(([k, v]) => `<tr>
            <td class="small">${esc(CRITERION[k])}</td>
            <td class="r" style="width:74px">${v === "met" ? status("approved", "Met")
              : v === "not_met" ? status("rejected", "Not met") : status("needs_source", "Unknown")}</td>
          </tr>`).join("")}
        </tbody></table>
        <p class="tiny dim" style="line-height:1.6">${esc(c.rationale)}</p>
        ${c.followUp ? note(`<span class="strong">Follow-up generated.</span> ${esc(c.followUp)}`, "warn") : ""}
        ${c.blocked ? note(esc(c.blocked), "alert") : ""}
        <hr class="hr" style="margin:10px 0">
        ${proposalDecision(
          c.keyProposal === true ? "Likely a key control" : c.keyProposal === false
            ? "Not a key control" : "Cannot be assessed — two criteria are unknown",
          d ? status(d === "key" ? "approved" : d === "not_key" ? "rejected" : "draft",
                d === "key" ? "Key control" : d === "not_key" ? "Not a key control" : "Undecided") + `
              <div style="margin-top:8px">${btn("Change", "clear-control", { size: "sm", data: { id: c.id } })}</div>`
            : `<div class="btn-row">
                ${btn("Key control", "decide-control", { size: "sm", variant: "ok", data: { id: c.id, d: "key" } })}
                ${btn("Not key", "decide-control", { size: "sm", data: { id: c.id, d: "not_key" } })}
                ${btn("Undecided", "decide-control", { size: "sm", data: { id: c.id, d: "undecided" } })}
              </div>`,
          !!d)}
      </div>
    </div>`);
}

/* ── O. Risk & control matrix ────────────────────────────────────────────── */

export function rcm() {
  if (!S.generated) return notGenerated("matrix");
  const rows = st.rcmRows();

  const body = `<div class="stack">
    ${note(`This matrix is <span class="strong">assembled, not generated</span>. Every cell comes from a
      risk or control you have already seen, with the decision you recorded against it. No model call
      produces this view.`, "accent")}

    ${panel("Risk and control matrix", `
      <div style="overflow-x:auto">
      <table class="tbl tbl--dense" style="min-width:1180px">
        <thead><tr>
          <th>Sub-process</th><th>Risk</th><th>Assertions</th><th>IR</th>
          <th>Control</th><th>Type</th><th>Nature</th><th>Frequency</th><th>Owner</th>
          <th>Key</th><th>Sources</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${rows.map((row) => {
            const r = row.risk, c = row.control;
            const rd = st.riskDecision(r);
            const cd = c ? st.controlDecision(c) : null;
            return `<tr>
              <td class="mono tiny">${esc(r.sub)}</td>
              <td style="max-width:280px"><span class="mono tiny dim">${esc(r.id)}</span> ${esc(r.title)}</td>
              <td><div class="tags">${r.assertions.map((a) => tag(a.slice(0, 4))).join("")}</div></td>
              <td>${esc(RATING[r.rating])}${r.significant ? ` <span class="tiny" style="color:var(--alert)">SR</span>` : ""}</td>
              <td style="max-width:270px">${c ? `<span class="mono tiny dim">${esc(c.id)}</span> ${esc(c.title)}`
                : `<span style="color:var(--alert)">No control identified — gap ${esc(row.gap?.id || "")}</span>`}</td>
              <td>${c ? (c.type === "preventive" ? "Prev" : "Det") : "—"}</td>
              <td>${c ? esc(NATURE[c.nature]) : "—"}</td>
              <td>${c ? esc(FREQ[c.frequency]) : "—"}</td>
              <td>${c ? esc(c.owner || "—") : "—"}</td>
              <td>${c ? (cd === "key" ? status("approved", "Key") : cd === "not_key" ? `<span class="dim">No</span>`
                : cd === "undecided" ? `<span class="dim">TBD</span>`
                : `<span class="tiny dim">AI: ${c.keyProposal === true ? "likely" : c.keyProposal === false ? "no" : "?"}</span>`) : "—"}</td>
              <td class="num">${r.refs.length + (c ? c.refs.length : 0)}</td>
              <td>${rd ? status(rd === "rejected" ? "rejected" : "approved", rd === "accepted" ? "Concluded" : rd === "modified" ? "Modified" : "Rejected")
                : status("draft", "Draft")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`, { flush: true,
        sub: `${rows.length} rows · one per risk-control pair · an unmitigated risk gets a row with a gap flag`,
        actions: btn("Export to Excel", "nav", { size: "sm", data: { href: "#/export" } }) })}
  </div>`;

  return wsScreen("rcm", body, { wide: true });
}

/* ── P. Open items ───────────────────────────────────────────────────────── */

export function openItemsView() {
  const oi = st.openItemSummary();
  const KIND = { question: "Question", evidence: "Evidence request", contradiction: "Contradiction" };

  const body = `<div class="stack">
    <div class="metrics">
      ${metric(oi.open, "unresolved", oi.open ? "warn" : "ok")}
      ${metric(oi.contradictions, "contradictions", oi.contradictions ? "alert" : "")}
      ${metric(oi.questions, "open questions")}
      ${metric(oi.evidence, "evidence requests")}
      ${metric(oi.sent, "awaiting a client response")}
      ${metric(oi.resolved, "resolved", oi.resolved ? "ok" : "")}
    </div>

    ${note(`This list is what makes the platform useful even where the AI could not complete the
      documentation. Every item names what is missing, what it blocks, and what to do about it.`)}

    ${panel("Open items", `
      <table class="tbl">
        <thead><tr><th style="width:56px">Item</th><th>Matter</th><th style="width:110px">Coverage</th>
          <th style="width:150px">Blocks</th><th style="width:110px">Priority</th><th style="width:230px">Status / action</th></tr></thead>
        <tbody>
          ${openItems.map((i) => {
            const s = st.itemState(i);
            const done = ["resolved", "dismissed"].includes(s);
            return `<tr class="${cx(done && "")}" style="${done ? "opacity:.55" : ""}">
              <td><span class="mono strong">${esc(i.id)}</span>
                <div class="tiny dim" style="margin-top:2px">${esc(KIND[i.kind])}</div></td>
              <td>
                <div class="strong">${esc(i.title)}</div>
                <div class="tiny dim" style="margin-top:3px;line-height:1.55">${esc(i.detail)}</div>
                <div class="tiny dim" style="margin-top:4px">
                  ${i.origin === "deterministic_trigger"
                    ? `<span class="tag tag--mono">rule ${esc(i.trigger || "coverage")}</span> raised by a deterministic trigger`
                    : `<span class="tag tag--mono">model</span> proposed by the model`}
                </div>
              </td>
              <td class="mono tiny">${esc(i.coverage)}</td>
              <td class="mono tiny">${i.blocks.length ? esc(i.blocks.join(", ")) : `<span class="dim">—</span>`}</td>
              <td>${i.priority === "mandatory" ? tag("Mandatory", "mandatory")
                : i.priority === "high" ? status("contradiction", "High") : status("draft", "Medium")}</td>
              <td>
                ${done ? status(s === "resolved" ? "approved" : "rejected", s === "resolved" ? "Resolved" : "Dismissed")
                  : s === "sent" ? `${status("draft", "Sent to the client")}
                      <div class="tiny dim" style="margin-top:3px">${esc(i.owner)}</div>`
                  : `<div class="tiny dim" style="margin-bottom:5px">${esc(i.owner)}</div>
                     <div class="btn-row">
                       ${i.kind === "contradiction"
                         ? btn("Resolve", "resolve-conflict", { size: "sm", variant: "primary", data: { block: "N6.2" } })
                         : btn(i.kind === "evidence" ? "Request" : "Ask client", "set-item", { size: "sm", variant: "primary", data: { id: i.id, s: "sent" } })}
                       ${btn("Resolve", "set-item", { size: "sm", data: { id: i.id, s: "resolved" } })}
                       ${btn("Dismiss", "dismiss-item", { size: "sm", data: { id: i.id } })}
                     </div>`}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`, { flush: true })}
  </div>`;

  return wsScreen("open", body, { wide: true });
}

/* --- Drawers --------------------------------------------------------------- */

export function gapDrawer(id) {
  const g = gaps.find((x) => x.id === id);
  const r = risks.find((x) => x.id === g.risk);
  return drawer({
    title: `${g.id} — control gap`,
    sub: `${esc(g.sub)} · ${esc(spName(g.sub))} · risk <span class="mono">${esc(g.risk)}</span>`,
    body: `
      <div class="lbl">The gap</div>
      <p class="small" style="line-height:1.7;margin:5px 0 18px">${esc(g.desc)}</p>
      <div class="lbl">Potential impact</div>
      <p class="small muted" style="line-height:1.7;margin:5px 0 18px">${esc(g.impact)}</p>
      <div class="lbl">Suggested remediation — AI proposed, for the management letter</div>
      <p class="small muted" style="line-height:1.7;margin:5px 0 18px">${esc(g.remediation)}</p>
      <div class="lbl" style="margin-bottom:6px">Sources</div>${chips(g.refs)}
      <hr class="hr">
      ${note(`<span class="strong">Severity is the auditor's judgement.</span> The proposal is
        <span class="strong">${g.severity === "deficiency" ? "deficiency" : "significant deficiency — candidate"}</span>.
        ISA 265 requires deficiencies to be communicated; whether this one is significant is a
        conclusion you record, not one the model reaches.`, "accent")}
      ${r ? `<div style="margin-top:16px"><div class="lbl">Related risk</div>
        <p class="small" style="margin-top:4px">${esc(r.id)} — ${esc(r.title)}</p></div>` : ""}`,
    foot: `<div class="btn-row">
      ${btn("Confirm as deficiency", "mock", { variant: "primary" })}
      ${btn("Confirm as significant deficiency", "mock")}
      ${btn("Close", "close-drawer")}</div>`,
  });
}

export function dismissDrawer(id) {
  const i = openItems.find((x) => x.id === id);
  return drawer({
    title: `Dismiss ${id}`,
    sub: esc(i.title),
    body: `${note(`Dismissing an open item requires a reason, and the reason lands in the file.
      Where the item is a mandatory coverage item, the reason is the documented explanation for
      not obtaining the information.`, "warn")}
      <label class="field" style="margin-top:18px">
        <span class="lbl">Reason for dismissal</span>
        <textarea class="textarea" id="dismiss-reason" rows="4"
          placeholder="Why is this no longer required?"></textarea>
      </label>`,
    foot: `<div class="btn-row">
      ${btn("Dismiss with reason", "confirm-dismiss", { variant: "primary", data: { id } })}
      ${btn("Cancel", "close-drawer")}</div>`,
  });
}
