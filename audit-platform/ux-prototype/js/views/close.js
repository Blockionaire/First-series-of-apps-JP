/* Q. Approval and sign-off · R. Export */

import { esc, btn, tag, panel, note, status, metric, kv, meter } from "../ui.js";
import { client, engagement, firm, user } from "../data-sources.js";
import * as st from "../state.js";
import { wsScreen } from "./chrome.js";

const S = st.S;

/* ── Q. Sign-off ─────────────────────────────────────────────────────────── */

export function signoff() {
  const gates = st.gateStates();
  const ready = st.readyToSign();
  const cov = st.coverageSummary();
  const nar = st.narrativeSummary();
  const open = gates.filter((g) => !g.ok);

  const body = `<div class="stack" style="max-width:960px">
    <div class="section-head">
      <div>
        <h2 class="h-sec">Revenue — readiness for sign-off</h2>
        <p class="lede" style="margin-top:6px">Every gate below is a condition the file has to meet.
        None of them is satisfied by the platform on your behalf.</p>
      </div>
      ${ready ? status("approved", "Ready for sign-off") : status("needs_source", `${open.length} gates not met`)}
    </div>

    ${panel("Readiness gates", `
      <table class="tbl">
        <tbody>
          ${gates.map((g) => `<tr>
            <td style="width:30px">${g.ok ? status("approved", "") : status("needs_source", "")}</td>
            <td><div class="strong">${esc(g.label)}</div>
              <div class="tiny dim" style="margin-top:2px">${esc(g.detail)}</div></td>
            <td class="r" style="width:190px">
              <div class="small ${g.ok ? "" : "strong"}" style="${g.ok ? "color:var(--ok)" : "color:var(--warn)"}">
                ${g.ok ? "Met" : "Not met"}</div>
              <div class="tiny dim">${esc(g.detail.length > 44 ? "" : "")}</div>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>`, { flush: true })}

    <div class="grid grid--main-side">
      ${panel("Summary of the work", `
        ${kv([
          ["Process", "Revenue / order-to-cash"],
          ["Methodology pack", `<span class="mono">${esc(firm.packName)} v${esc(firm.packVersion)}</span>`],
          ["Coverage", `${cov.covered} of ${cov.applicable} applicable items (${cov.pct}%) · ${cov.na} not applicable`],
          ["Process facts established", `${cov.facts.known} of ${cov.facts.total}`],
          ["Narrative", `${nar.sections} sections · ${nar.approved} approved · ${nar.rejected} rejected · ${nar.pending} outstanding`],
          ["Risks", `${st.riskSummary().total} identified · ${st.riskSummary().decided} concluded`],
          ["Controls", `${st.controlSummary().total} identified · ${st.controlSummary().agreedKey} agreed as key`],
          ["Control gaps", `${st.controlSummary().gaps} recorded for ISA 265 communication`],
          ["Open items", `${st.openItemSummary().open} unresolved`],
        ])}`)}

      <div class="stack">
        ${panel("Sign-off", `
          <div class="stack-sm">
            <div style="padding-bottom:12px;border-bottom:1px solid var(--line-soft)">
              <div class="lbl">Prepared by</div>
              <div class="small strong" style="margin-top:3px">${esc(user.name)}</div>
              <div class="tiny dim">${esc(user.role)} · ${nar.approved ? "in progress" : "not started"}</div>
            </div>
            <div style="padding-bottom:12px;border-bottom:1px solid var(--line-soft)">
              <div class="lbl">Reviewed by</div>
              <div class="small strong" style="margin-top:3px">${esc(engagement.team[1].name)}</div>
              <div class="tiny dim">${esc(engagement.team[1].role)} · not yet reviewed</div>
            </div>
            <div>
              <div class="lbl">Engagement partner</div>
              <div class="small strong" style="margin-top:3px">${esc(engagement.team[0].name)}</div>
              <div class="tiny dim">${esc(engagement.team[0].role)} · not yet reviewed</div>
            </div>
          </div>
          <hr class="hr">
          <div class="btn-row">
            ${btn(ready ? "Sign as preparer" : "Sign as preparer", "mock",
              { variant: ready ? "primary" : "", disabled: !ready, size: "lg" })}
          </div>
          ${!ready ? `<p class="tiny dim" style="margin-top:10px">
            Blocked by: ${esc(open.map((g) => g.label.toLowerCase()).join(", "))}.</p>` : ""}`)}

        ${note(`<span class="strong">The platform never signs.</span> The file records who prepared the
          work and who reviewed it, and states that AI assistance was used, with the pack and model
          versions. Preparation, review and the conclusion on reliance remain the auditor's, as
          ISA 230 and ISA 220 require.`, "accent")}
      </div>
    </div>
  </div>`;

  return wsScreen("signoff", body);
}

/* ── R. Export ───────────────────────────────────────────────────────────── */

const OUTPUTS = [
  { id: "docx", t: "Process narrative and flow", f: "DOCX", d: "Firm Word template, headers and footers, review sign-off block, source references as footnotes.", ready: true },
  { id: "xlsx", t: "Risk and control matrix", f: "XLSX", d: "One row per risk-control pair, firm column order, filters preset by sub-process and assertion.", ready: true },
  { id: "gaps", t: "Control deficiencies (ISA 265)", f: "DOCX", d: "The control gaps with severity, impact and proposed remediation — the management letter draft.", ready: true },
  { id: "json", t: "Canonical engagement export", f: "JSON", d: "The full working paper with every evidence reference, for downstream systems and for the audit file.", ready: true },
  { id: "caseware", t: "Push to the audit file system", f: "Integration", d: "Caseware, CCH or the firm's own file system.", ready: false },
];

export function exportView() {
  const ready = st.readyToSign();
  const nar = st.narrativeSummary();
  const gates = st.gateStates().filter((g) => !g.ok);

  const body = `<div class="stack" style="max-width:960px">
    <div class="section-head">
      <div>
        <h2 class="h-sec">Export</h2>
        <p class="lede" style="margin-top:6px">Exports carry only approved content. Anything still in
        draft, needing a source, or rejected is excluded, and the export states what was excluded.</p>
      </div>
    </div>

    ${!ready ? note(`<span class="strong">Export is limited while ${gates.length} readiness
      gates are unmet.</span> You can produce a draft for internal discussion, but the working paper
      cannot be finalised. Outstanding: ${esc(gates.map((g) => g.label.toLowerCase()).join(", "))}.`, "warn")
      : note(`<span class="strong">All gates met.</span> ${nar.approved} approved sections,
        ${st.riskSummary().decided} concluded risks and ${st.controlSummary().decided} concluded controls
        will be included.`, "accent")}

    ${panel("Outputs", `
      <table class="tbl">
        <tbody>
          ${OUTPUTS.map((o) => `<tr>
            <td style="width:74px">${tag(o.f, o.ready ? "" : "future")}</td>
            <td><div class="strong">${esc(o.t)}</div>
              <div class="tiny dim" style="margin-top:2px">${esc(o.d)}</div></td>
            <td class="r" style="width:210px">
              ${o.ready
                ? `<div class="btn-row" style="justify-content:flex-end">
                    ${btn(ready ? "Generate" : "Generate draft", "mock", { size: "sm", variant: ready ? "primary" : "" })}
                    ${btn("Preview", "mock", { size: "sm" })}</div>`
                : `<span class="tiny dim">Mocked — no integration is built</span>`}
            </td>
          </tr>`).join("")}
        </tbody>
      </table>`, { flush: true })}

    <div class="grid grid--2">
      ${panel("What the export footer records", `
        <table class="tbl tbl--dense"><tbody>
          <tr><td class="dim" style="width:150px">Entity</td><td>${esc(client.name)}</td></tr>
          <tr><td class="dim">Engagement</td><td>${esc(engagement.id)} · FY2026</td></tr>
          <tr><td class="dim">Process</td><td>Revenue / order-to-cash</td></tr>
          <tr><td class="dim">Sources</td><td>6 · transcript, questionnaire, 3 documents, auditor notes</td></tr>
          <tr><td class="dim">Methodology pack</td><td class="mono">revenue v0.1.0</td></tr>
          <tr><td class="dim">AI assistance</td><td>Used. Stage models and prompt versions recorded.</td></tr>
          <tr><td class="dim">Prepared by</td><td>${esc(user.name)}</td></tr>
          <tr><td class="dim">Reviewed by</td><td class="dim">Not yet reviewed</td></tr>
        </tbody></table>`)}

      ${panel("What is excluded", `
        <div class="stack-sm">
          <div class="row row--between"><span class="small">Sections still in draft</span>
            <span class="num small">${nar.pending}</span></div>
          <div class="row row--between"><span class="small">Statements needing a source</span>
            <span class="num small" style="color:var(--warn)">${nar.needsSource.length}</span></div>
          <div class="row row--between"><span class="small">Unresolved contradictions</span>
            <span class="num small" style="color:var(--alert)">${nar.contradiction.length}</span></div>
          <div class="row row--between"><span class="small">Rejected statements</span>
            <span class="num small">${Object.values(S.blocks).filter((b) => b.rejected).length}</span></div>
        </div>
        <hr class="hr">
        <p class="tiny dim" style="line-height:1.6">Statements recorded as
          <span class="strong">not obtained</span> are <span class="strong">included</span> — an
          incomplete understanding has to look incomplete in the file, not be quietly dropped.</p>`)}
    </div>

    ${note(`<span class="strong">Prototype.</span> No file is produced. Word, Excel and JSON generation and
      any audit-system integration are out of scope for this UX track.`)}
  </div>`;

  return wsScreen("export", body);
}

/* ── Settings (deliberately thin) ────────────────────────────────────────── */

export function settings() {
  return `<header class="topbar"><div class="crumbs"><span class="cur">Settings</span></div>
    <div class="topbar__actions">${btn("Reset demo", "reset", { variant: "ghost", size: "sm" })}</div></header>
  <div class="scroll"><div class="page" style="max-width:760px">
    <h1 class="h-page" style="margin-bottom:16px">Settings</h1>
    <div class="stack">
      ${panel("Methodology", kv([
        ["Firm methodology", esc(firm.methodology)],
        ["Revenue pack", `<span class="mono">revenue v0.1.0</span> — 12 sub-processes, 45 coverage items, 10 mandatory`],
        ["Risk library", "30 entries"],
        ["Control library", "33 entries"],
        ["Pack pinning", "Pinned per engagement. A new pack version never alters approved documentation."],
      ]))}
      ${panel("Firm", kv([
        ["Firm", esc(firm.name)],
        ["Document language", "English (interviews may be conducted in Dutch)"],
        ["House style", "K&B working paper template 2026"],
      ]))}
      ${note(`Settings are deliberately thin in this prototype. Firm configuration, sample-size
        parameter tables, user administration and templates are real requirements and are out of
        scope for the UX track — see <span class="mono">UX-PLAN.md §12</span>.`)}
    </div>
  </div></div>`;
}
