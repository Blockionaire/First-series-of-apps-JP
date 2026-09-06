/* Home · Clients · Client · Engagement · Revenue overview · Walkthrough preparation */

import { esc, btn, tag, panel, note, kv, metric, coverageBar, coverageLegend, status, meter, ICON } from "../ui.js";
import { client, engagement, firm, user, sources } from "../data-sources.js";
import { subProcesses } from "../data-model.js";
import * as st from "../state.js";
import { topbar, engCrumbs, wsScreen } from "./chrome.js";

/* ── A. Home / auditor dashboard ─────────────────────────────────────────── */

export function home() {
  const cov = st.coverageSummary();
  const nar = st.narrativeSummary();
  const oi = st.openItemSummary();
  const gen = st.S.generated;

  const needsYou = [
    gen && nar.needsSource.length && {
      tone: "warn", what: `${nar.needsSource.length} statements cannot be supported by any source`,
      where: "Revenue · Documentation", why: "They cannot be approved until you edit them or attach evidence.",
      href: "#/review", cta: "Review",
    },
    oi.contradictions && {
      tone: "alert", what: "Contradictory answers on credit limit authority",
      where: "Revenue · Open items", why: "The controller and the commercial director gave different answers. One control and one risk are blocked.",
      href: "#/open-items", cta: "Resolve",
    },
    cov.mandatoryOpen.length && {
      tone: "warn", what: `${cov.mandatoryOpen.length} mandatory coverage item still open (${cov.mandatoryOpen.map((i) => i.id).join(", ")})`,
      where: "Revenue · Coverage", why: "Sign-off is blocked while an ISA 240 mandatory item is open without a documented reason.",
      href: "#/coverage", cta: "Open coverage",
    },
    oi.sent && {
      tone: "", what: `${oi.sent} questions awaiting a client response`,
      where: "Revenue · Open items", why: "Sent 20 September. No response yet.",
      href: "#/open-items", cta: "View",
    },
    !gen && {
      tone: "", what: "Revenue walkthrough ready to generate",
      where: "Revenue", why: `Coverage is ${cov.pct}% and the mandatory items are addressed. Documentation has not been generated.`,
      href: "#/generate", cta: "Generate",
    },
  ].filter(Boolean);

  return `${topbar([{ label: "Work" }])}
  <div class="scroll"><div class="page">
    <div class="section-head">
      <div>
        <h1 class="h-page">Good morning, ${esc(user.name.split(" ")[0])}</h1>
        <p class="lede" style="margin-top:4px">Two engagements are in interim fieldwork. Everything below is waiting on you.</p>
      </div>
      <div class="small dim nowrap">Saturday 6 September 2026</div>
    </div>

    <div class="stack">
      ${panel("Needs your attention", `<div class="stack-sm">
        ${needsYou.map((n) => `
          <div class="row row--between" style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
            <div style="min-width:0">
              <div class="row" style="gap:8px">
                ${n.tone === "alert" ? status("contradiction", "Contradiction")
                  : n.tone === "warn" ? status("needs_source", "Blocked") : status("draft", "Ready")}
                <span class="strong">${esc(n.what)}</span>
              </div>
              <div class="tiny muted" style="margin-top:3px">${esc(n.where)} — ${esc(n.why)}</div>
            </div>
            ${btn(n.cta, "nav", { size: "sm", data: { href: n.href } })}
          </div>`).join("")}
      </div>`, { sub: `${needsYou.length} items` })}

      <div class="grid grid--main-side">
        ${panel("Active engagements", `
          <table class="tbl">
            <thead><tr><th>Client</th><th>Period</th><th>Phase</th><th>Process</th><th>Coverage</th><th class="r">Open</th></tr></thead>
            <tbody>
              <tr class="is-click" data-act="nav" data-href="#/client">
                <td><span class="strong">${esc(client.short)}</span><div class="tiny dim">${esc(client.seat)}</div></td>
                <td>FY2026</td>
                <td>Interim</td>
                <td>Revenue <span class="tiny dim">· 5 not started</span></td>
                <td style="min-width:120px">
                  <div class="row" style="gap:8px"><span class="num tiny">${cov.pct}%</span>
                  <div style="flex:1">${coverageBar(cov)}</div></div>
                </td>
                <td class="r num">${oi.open}</td>
              </tr>
              <tr class="is-click">
                <td><span class="strong">Meerveld Zorggroep</span><div class="tiny dim">Utrecht</div></td>
                <td>FY2026</td><td>Interim</td><td>Not started</td>
                <td><span class="tiny dim">—</span></td><td class="r num">0</td>
              </tr>
              <tr>
                <td><span class="strong">Brekelmans Bouw B.V.</span><div class="tiny dim">Breda</div></td>
                <td>FY2025</td><td>Completion</td><td>Signed 22 May</td>
                <td><span class="tiny dim">—</span></td><td class="r num">0</td>
              </tr>
            </tbody>
          </table>`, { flush: true })}

        ${panel("Recent activity", `<div class="stack-sm small">
          ${[
            ["20 Sep 09:12", "2 follow-up questions issued to the client", "Revenue · Coverage"],
            ["19 Sep 16:40", "Auditor notes added — call with I. Molenaar", "Revenue · Sources"],
            ["18 Sep 11:05", "Walkthrough transcript imported from Teams", "Revenue · Sources"],
            ["15 Sep 14:22", "Client questionnaire completed by B. Kuipers", "Revenue · Sources"],
            ["12 Sep 08:30", "Access listing received from P. Halsema", "Revenue · Sources"],
          ].map(([t, what, where]) => `
            <div style="padding-bottom:8px;border-bottom:1px solid var(--line-soft)">
              <div>${esc(what)}</div>
              <div class="tiny dim">${esc(t)} · ${esc(where)}</div>
            </div>`).join("")}
        </div>`)}
      </div>

      ${note(`<span class="strong">This is a prototype.</span> All data is fictional and generated locally.
        No model is called, nothing leaves the browser, and no engine code runs.
        See <span class="mono">ux-prototype/UX-PLAN.md</span> for what it does and does not claim.`, "accent")}
    </div>
  </div></div>`;
}

/* ── Clients ─────────────────────────────────────────────────────────────── */

export function clients() {
  const cov = st.coverageSummary();
  return `${topbar([{ label: "Clients" }])}
  <div class="scroll"><div class="page">
    <h1 class="h-page" style="margin-bottom:16px">Clients</h1>
    ${panel("", `<table class="tbl">
      <thead><tr><th>Client</th><th>Sector</th><th>Framework</th><th>Current engagement</th><th>Interim status</th></tr></thead>
      <tbody>
        <tr class="is-click" data-act="nav" data-href="#/client">
          <td><span class="strong">${esc(client.name)}</span><div class="tiny dim">${esc(client.seat)} · ${esc(client.since)}</div></td>
          <td>Industrial machinery</td><td>EU-IFRS</td><td>FY2026 audit</td>
          <td>${status("draft", `Revenue in progress · ${cov.pct}% coverage`)}</td>
        </tr>
        <tr class="is-click"><td><span class="strong">Meerveld Zorggroep</span><div class="tiny dim">Utrecht</div></td>
          <td>Healthcare</td><td>NL GAAP</td><td>FY2026 audit</td><td>${status("draft", "Not started")}</td></tr>
        <tr class="is-click"><td><span class="strong">Brekelmans Bouw B.V.</span><div class="tiny dim">Breda</div></td>
          <td>Construction</td><td>NL GAAP</td><td>FY2025 audit</td><td>${status("approved", "Signed")}</td></tr>
        <tr class="is-click"><td><span class="strong">Hoegaarde Foods N.V.</span><div class="tiny dim">Antwerp</div></td>
          <td>Food processing</td><td>EU-IFRS</td><td>FY2026 audit</td><td>${status("draft", "Planning")}</td></tr>
      </tbody></table>`, { flush: true })}
  </div></div>`;
}

/* ── B. Client overview ──────────────────────────────────────────────────── */

export function clientView() {
  const cov = st.coverageSummary();
  return `${topbar([{ label: "Clients", href: "#/clients" }, { label: client.short }])}
  <div class="scroll"><div class="page">
    <div class="section-head">
      <div>
        <h1 class="h-page">${esc(client.name)}</h1>
        <p class="small muted" style="margin-top:3px">${esc(client.sector)}</p>
      </div>
      ${btn("Open FY2026 engagement", "nav", { variant: "primary", data: { href: "#/engagement" } })}
    </div>

    <div class="stack">
      <div class="grid grid--main-side">
        ${panel("Entity", kv([
          ["Registered seat", esc(client.seat)],
          ["Reporting framework", esc(client.framework)],
          ["Financial year end", esc(client.yearEnd)],
          ["Employees", esc(client.employees)],
          ["Revenue (FY2025)", `EUR ${esc(client.revenuePY)}m`],
          ["Client relationship", esc(client.since)],
        ]) + `<hr class="hr">
          <div class="lbl" style="margin-bottom:8px">Revenue streams</div>
          <table class="tbl tbl--dense"><tbody>
            ${client.streams.map((s) => `<tr><td><span class="strong">${esc(s.name)}</span>
              <div class="tiny dim">${esc(s.basis)}</div></td>
              <td class="r num nowrap">EUR ${esc(s.amount)}m</td></tr>`).join("")}
          </tbody></table>
          <hr class="hr">
          <div class="lbl" style="margin-bottom:8px">Systems</div>
          <table class="tbl tbl--dense"><tbody>
            ${client.systems.map((s) => `<tr><td class="strong">${esc(s.name)}</td>
              <td class="muted">${esc(s.role)}</td></tr>`).join("")}
          </tbody></table>`)}

        <div class="stack">
          ${panel("Engagements", `<table class="tbl tbl--dense"><tbody>
            <tr class="is-click is-sel" data-act="nav" data-href="#/engagement">
              <td><span class="strong">FY2026 statutory audit</span>
              <div class="tiny dim">Interim in progress</div></td></tr>
            <tr><td><span class="muted">FY2025 statutory audit</span>
              <div class="tiny dim">Signed 12 March 2026</div></td></tr>
            <tr><td><span class="muted">FY2024 statutory audit</span>
              <div class="tiny dim">Signed 8 March 2025</div></td></tr>
          </tbody></table>`, { flush: true })}

          ${panel("Client contacts", `<div class="stack-sm">
            ${client.contacts.map((c) => `<div class="row row--between">
              <div><div class="small strong">${esc(c.name)}</div><div class="tiny dim">${esc(c.role)}</div></div>
              ${c.tag ? `<span class="tiny dim nowrap">${esc(c.tag)}</span>` : ""}
            </div>`).join("")}
          </div>`)}

          ${panel("Interim progress", `
            <div class="row row--between" style="margin-bottom:6px">
              <span class="small strong">Revenue</span>
              <span class="small num">${cov.pct}% coverage</span>
            </div>
            ${coverageBar(cov)}
            <div class="tiny dim" style="margin-top:8px">
              ${cov.covered} of ${cov.applicable} applicable coverage items covered.
              Five further processes have not been started.
            </div>`)}
        </div>
      </div>
    </div>
  </div></div>`;
}

/* ── C. Engagement overview ──────────────────────────────────────────────── */

export function engagementView() {
  const cov = st.coverageSummary();
  const oi = st.openItemSummary();
  const nar = st.narrativeSummary();

  return `${topbar([{ label: "Clients", href: "#/clients" }, { label: client.short, href: "#/client" }, { label: "FY2026" }])}
  <div class="scroll"><div class="page">
    <div class="section-head">
      <div>
        <h1 class="h-page">${esc(engagement.title)}</h1>
        <p class="small muted" style="margin-top:3px">${esc(engagement.period)} · Materiality ${esc(engagement.materiality)}</p>
      </div>
    </div>

    <div class="stack">
      ${panel("Audit phases", `<div class="grid grid--4" style="gap:0">
        ${engagement.phases.map((p, i) => `
          <div style="padding:14px 18px;${i ? "border-left:1px solid var(--line-soft)" : ""}">
            <div class="row" style="gap:8px">
              ${p.state === "Complete" ? status("approved", p.name)
                : p.state === "In progress" ? `<span class="st st--live"><i></i>${esc(p.name)}</span>`
                : status("draft", p.name)}
            </div>
            <div class="tiny dim" style="margin-top:5px">${esc(p.detail || p.state)}</div>
          </div>`).join("")}
      </div>`, { flush: true })}

      ${panel("Interim — processes", `
        <table class="tbl">
          <thead><tr><th>Process</th><th>Status</th><th>Coverage</th><th class="r">Risks</th><th class="r">Controls</th><th class="r">Open items</th><th></th></tr></thead>
          <tbody>
            <tr class="is-click" data-act="nav" data-href="#/revenue">
              <td><span class="strong">Revenue / order-to-cash</span>
                <div class="tiny dim">Pack ${esc(firm.packName)} v${esc(firm.packVersion)} · 45 coverage items</div></td>
              <td>${st.S.generated ? status("draft", `In review · ${nar.pct}%`) : status("draft", "Walkthrough complete")}</td>
              <td style="min-width:150px"><div class="row" style="gap:8px">
                <span class="num tiny nowrap">${cov.covered}/${cov.applicable}</span>
                <div style="flex:1">${coverageBar(cov)}</div></div></td>
              <td class="r num">${st.S.generated ? st.riskSummary().total : "—"}</td>
              <td class="r num">${st.S.generated ? st.controlSummary().total : "—"}</td>
              <td class="r num">${oi.open}</td>
              <td class="r">${btn("Open", "nav", { size: "sm", data: { href: "#/revenue" } })}</td>
            </tr>
            ${engagement.processes.filter((p) => p.state === "later").map((p) => `
              <tr style="opacity:.55">
                <td><span class="strong">${esc(p.name)}</span></td>
                <td>${tag("Coming later")}</td>
                <td colspan="5" class="tiny dim">Not part of the current methodology scope</td>
              </tr>`).join("")}
          </tbody>
        </table>`, { flush: true,
          sub: "Only Revenue is in scope for the current methodology pack" })}

      <div class="grid grid--main-side">
        ${panel("Engagement team", `<table class="tbl tbl--dense"><tbody>
          ${engagement.team.map((t) => `<tr>
            <td style="width:36px"><span class="rail__avatar" style="background:var(--surface-sunken);color:var(--ink-600)">${esc(t.initials)}</span></td>
            <td><span class="strong">${esc(t.name)}</span></td>
            <td class="muted">${esc(t.role)}</td></tr>`).join("")}
        </tbody></table>`, { flush: true })}
        ${panel("Scope note", `<p class="small muted" style="line-height:1.6">
          The Revenue process is documented on this platform for FY2026. All other processes
          continue to be documented in the firm's existing working paper templates.
          The methodology pack is pinned at <span class="mono">v${esc(firm.packVersion)}</span> for
          this engagement; a later pack version will not alter documentation already approved.</p>`)}
      </div>
    </div>
  </div></div>`;
}

/* ── D. Revenue process overview ─────────────────────────────────────────── */

export function revenue() {
  const cov = st.coverageSummary();
  const nar = st.narrativeSummary();
  const rs = st.riskSummary();
  const cs = st.controlSummary();
  const oi = st.openItemSummary();
  const gen = st.S.generated;

  const body = `<div class="stack">
    <div class="metrics">
      ${metric(`${cov.covered}`, `of ${cov.applicable} coverage items covered`, "", `/${cov.applicable}`)}
      ${metric(`${cov.facts.known}`, `of ${cov.facts.total} facts established`, "", `/${cov.facts.total}`)}
      ${metric(oi.questions + oi.contradictions, "open questions", oi.contradictions ? "alert" : "")}
      ${metric(gen ? rs.total : "—", "potential risks")}
      ${metric(gen ? cs.total : "—", "controls identified")}
      ${metric(gen ? nar.needsSource.length : "—", "need a source", gen && nar.needsSource.length ? "warn" : "")}
      ${metric(oi.evidence, "evidence requests")}
      ${metric(gen ? `${nar.pct}%` : "—", "review complete", "")}
    </div>

    <div class="grid grid--main-side">
      <div class="stack">
        ${panel("Coverage by sub-process", `
          <div class="stack-sm">
            ${subProcesses.map((sp) => {
              const c = st.coverageCounts(sp.items);
              const p = st.subProcessPct(sp);
              return `<div class="row" style="gap:14px">
                <span class="cov__id" style="width:26px">${esc(sp.id)}</span>
                <span class="small" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sp.name)}</span>
                <div style="width:180px">${coverageBar(c)}</div>
                <span class="small num nowrap" style="width:38px;text-align:right">${p === null ? "n/a" : p + "%"}</span>
              </div>`;
            }).join("")}
          </div>
          <hr class="hr">${coverageLegend()}`,
          { actions: btn("Open coverage", "nav", { size: "sm", data: { href: "#/coverage" } }) })}

        ${gen ? panel("Documentation", `
          <div class="row row--between" style="margin-bottom:10px">
            <span class="small">${nar.approved} approved · ${nar.rejected} rejected · <span class="strong">${nar.pending} awaiting a decision</span></span>
            <span class="small num">${nar.pct}%</span>
          </div>
          ${meter(nar.pct, 100, nar.pct === 100)}
          <hr class="hr">
          <div class="row wrap" style="gap:18px">
            <span class="small">${status("needs_source", `${nar.needsSource.length} need a source`)}</span>
            <span class="small">${status("contradiction", `${nar.contradiction.length} contradictory`)}</span>
            <span class="small">${status("missing", `${nar.missing.length} recorded as not obtained`)}</span>
          </div>`, { actions: btn("Review output", "nav", { variant: "primary", size: "sm", data: { href: "#/review" } }) })
        : panel("Documentation", `
          <div class="empty">
            <div class="empty__t">Not generated yet</div>
            <div class="tiny">Coverage is ${cov.pct}% and the mandatory items are addressed.
            The staged pipeline will produce the narrative, risks, controls and gaps.</div>
            <div style="margin-top:16px">${btn("Generate documentation", "nav", { variant: "primary", data: { href: "#/generate" } })}</div>
          </div>`, { flush: false })}
      </div>

      <div class="stack">
        ${panel("Next actions", `<div class="stack-sm">
          ${[
            gen ? ["Review generated documentation", `${nar.pending} sections awaiting a decision`, "#/review"]
                : ["Generate the documentation", "The walkthrough has sufficient coverage", "#/generate"],
            ["Resolve open items", `${oi.open} unresolved, including ${oi.contradictions} contradiction`, "#/open-items"],
            ["Continue the walkthrough", "Add a source, or send further questions", "#/prepare"],
          ].map(([t, d, h]) => `<button class="radio-card" data-act="nav" data-href="${h}">
            <div style="flex:1"><div class="small strong">${esc(t)}</div><div class="tiny dim">${esc(d)}</div></div>
            <span style="color:var(--ink-300);width:14px">${ICON.chevron}</span>
          </button>`).join("")}
        </div>`)}

        ${panel("Sources", `<div class="stack-sm">
          ${Object.values(sources).map((s) => `<div style="padding-bottom:9px;border-bottom:1px solid var(--line-soft)">
            <div class="row" style="gap:6px">${tag(s.short, "mono")}<span class="small strong">${esc(s.name)}</span></div>
            <div class="tiny dim" style="margin-top:2px">${esc(s.detail)}</div>
          </div>`).join("")}
        </div>`, { actions: btn("Add source", "mock", { size: "sm" }) })}

        ${cov.mandatoryOpen.length ? note(`<span class="strong">${cov.mandatoryOpen.length} mandatory coverage item open.</span>
          ${esc(cov.mandatoryOpen.map((i) => i.id).join(", "))} — the walkthrough cannot be signed off while an
          ISA 240 mandatory item is open without a documented reason.`, "warn") : ""}
      </div>
    </div>
  </div>`;

  return wsScreen("overview", body);
}

/* ── E. Walkthrough preparation ──────────────────────────────────────────── */

export function prepare() {
  const cov = st.coverageSummary();
  const modes = [
    { id: "transcript", t: "Import a transcript", d: "Teams, Zoom or Meet output (VTT or text). The full pipeline runs unattended.", tagT: "Used for this walkthrough" },
    { id: "questionnaire", t: "Client questionnaire", d: "The client answers asynchronously; coverage decides the follow-ups.", tagT: "Used for commercial scope", href: "#/questionnaire" },
    { id: "interview", t: "Auditor-led interview", d: "You conduct the walkthrough; the platform records and observes.", href: "#/interview" },
    { id: "cockpit", t: "Live walkthrough cockpit", d: "Real-time transcript, live coverage and an AI copilot during the meeting.", future: true, href: "#/cockpit" },
  ];

  const body = `<div class="stack">
    <div class="grid grid--main-side">
      <div class="stack">
        ${panel("Scope", `
          ${kv([
            ["Process", "Revenue / order-to-cash"],
            ["Methodology pack", `<span class="mono">${esc(firm.packName)} v${esc(firm.packVersion)}</span> — 12 sub-processes, 45 coverage items`],
            ["Reporting framework", "EU-IFRS (IFRS 15)"],
            ["Scoping note", "Both revenue streams in scope. The German distributor's consignment arrangement was identified during preparation and is included."],
          ])}`)}

        ${panel("How information is gathered", `<div class="stack-sm">
          ${modes.map((m) => `
            <button class="radio-card ${m.future ? "is-future" : ""} ${st.S.mode === m.id ? "is-sel" : ""}"
              data-act="${m.href ? "nav" : "set-mode"}" data-href="${m.href || ""}" data-mode="${m.id}">
              <span class="radio-card__r"></span>
              <span style="flex:1">
                <span class="row wrap" style="gap:8px">
                  <span class="small strong">${esc(m.t)}</span>
                  ${m.future ? tag("Future state", "future") : ""}
                  ${m.tagT ? tag(m.tagT, "ok") : ""}
                </span>
                <span class="tiny dim" style="display:block;margin-top:3px">${esc(m.d)}</span>
              </span>
            </button>`).join("")}
        </div>`, { sub: "Three modes are realistic today. The cockpit is a future-state concept." })}

        ${panel("Tailored interview plan", `
          <p class="small muted" style="margin-bottom:12px">Generated before the meeting from the knowledge base:
            the standard Revenue template, narrowed by what is already known. Items already answered are
            marked <span class="strong">confirm only</span>.</p>
          <table class="tbl tbl--dense">
            <thead><tr><th>Item</th><th>Topic</th><th>Treatment</th></tr></thead>
            <tbody>
              ${[
                ["R1.3", "Non-standard contract terms — consignment, rebates, side letters", "mandatory", "Ask in full"],
                ["R5.3", "How the invoice amount is derived and who can override the price", "mandatory", "Ask in full"],
                ["R6.5", "Whether revenue recognition can be overridden manually", "mandatory", "Ask in full"],
                ["R11.1", "Who can post a manual journal to revenue", "mandatory", "Ask in full"],
                ["R11.3", "Incentives and pressures relating to reported revenue", "mandatory", "Ask in full"],
                ["R10.5", "Van Dijk Logistics — new since the prior year", "change", "Ask in full — process changed"],
                ["R2.1", "Order channels", "", "Confirm only — unchanged from FY2025"],
                ["R8.1", "Cash matching", "", "Confirm only — unchanged from FY2025"],
              ].map(([id, topic, kind, treat]) => `<tr>
                <td class="mono tiny">${esc(id)}</td>
                <td>${esc(topic)} ${kind === "mandatory" ? tag("Mandatory", "mandatory") : kind === "change" ? tag("Changed", "warn") : ""}</td>
                <td class="${treat.startsWith("Confirm") ? "dim" : ""}">${esc(treat)}</td>
              </tr>`).join("")}
            </tbody>
          </table>`, { flush: false })}
      </div>

      <div class="stack">
        ${panel("Knowledge base", `<div class="stack-sm">
          ${Object.values(sources).map((s) => `
            <div style="padding-bottom:10px;border-bottom:1px solid var(--line-soft)">
              <div class="row" style="gap:6px">${tag(s.short, "mono")}
                <span class="small strong" style="flex:1;min-width:0">${esc(s.name)}</span></div>
              <div class="tiny dim" style="margin-top:3px">${esc(s.detail)}</div>
              <div class="tiny" style="margin-top:4px;color:var(--ok)">${esc(s.ingest)}</div>
            </div>`).join("")}
          <div>${btn("Add a document", "mock", { size: "sm" })}
               ${btn("Import a transcript", "mock", { size: "sm" })}</div>
        </div>`)}

        ${panel("Participants", `<div class="stack-sm">
          ${client.contacts.slice(0, 4).map((c) => `<div class="row row--between">
            <div><div class="small strong">${esc(c.name)}</div><div class="tiny dim">${esc(c.role)}</div></div>
            ${c.tag ? `<span class="tiny dim nowrap">${esc(c.tag)}</span>` : btn("Invite", "mock", { size: "sm" })}
          </div>`).join("")}
        </div>`)}

        ${panel("Coverage before the walkthrough", `
          <div class="row row--between" style="margin-bottom:6px">
            <span class="small">Known from prior year and documents</span><span class="small num">${cov.pct}%</span>
          </div>
          ${coverageBar(cov)}
          <p class="tiny dim" style="margin-top:10px">
            Coverage measures completeness of the process understanding against the
            methodology pack. It does not measure completeness of the audit.</p>`)}
      </div>
    </div>
  </div>`;

  return wsScreen("walkthrough", body);
}
