/* Shared workspace chrome: the engagement header and the Revenue tab bar.
   Nine of the seventeen screens are tabs of one workspace — that is the IA
   decision that keeps the primary journey almost navigation-free. */

import { esc, tabs, crumbs, btn } from "../ui.js";
import { client, engagement, firm } from "../data-sources.js";
import * as st from "../state.js";

export function topbar(items, actions = "") {
  return `<header class="topbar">
    ${crumbs(items)}
    <div class="topbar__actions">
      ${actions}
      ${btn("Reset demo", "reset", { variant: "ghost", size: "sm" })}
    </div>
  </header>`;
}

export const engCrumbs = (tail) => [
  { label: "Clients", href: "#/clients" },
  { label: client.short, href: "#/client" },
  { label: "FY2026 · Interim", href: "#/engagement" },
  ...(tail || []),
];

export function wsHeader(activeTab) {
  const cov = st.coverageSummary();
  const nar = st.narrativeSummary();
  const rs = st.riskSummary();
  const cs = st.controlSummary();
  const oi = st.openItemSummary();

  const t = [
    { id: "overview", label: "Overview", href: "#/revenue" },
    { id: "walkthrough", label: "Walkthrough", href: "#/prepare" },
    { id: "coverage", label: "Coverage", href: "#/coverage", count: cov.open + cov.partial, tone: cov.mandatoryOpen.length ? "warn" : "" },
    { id: "documentation", label: "Documentation", href: "#/review", count: st.S.generated ? nar.pending : 0, tone: nar.needsSource.length ? "warn" : "" },
    { id: "risks", label: "Risks", href: "#/risks", count: st.S.generated ? rs.pending : 0 },
    { id: "controls", label: "Controls", href: "#/controls", count: st.S.generated ? cs.pending : 0 },
    { id: "rcm", label: "Matrix", href: "#/rcm" },
    { id: "open", label: "Open items", href: "#/open-items", count: oi.open, tone: oi.contradictions ? "alert" : "" },
    { id: "signoff", label: "Sign-off", href: "#/signoff" },
    { id: "export", label: "Export", href: "#/export" },
  ];

  return `<div class="wshead">
    <div class="wshead__row">
      <div>
        <div class="h-page">Revenue</div>
        <div class="small muted" style="margin-top:2px">
          Order-to-cash · ${esc(client.name)} · ${esc(engagement.interimAt)}
          · <span class="mono tiny">pack ${esc(firm.packName)} v${esc(firm.packVersion)}</span>
        </div>
      </div>
      <div class="btn-row">
        ${st.S.generated
          ? btn("Continue review", "nav", { variant: "primary", data: { href: "#/review" } })
          : btn("Generate documentation", "nav", { variant: "primary", data: { href: "#/generate" } })}
      </div>
    </div>
  </div>
  ${tabs(t, activeTab)}`;
}

/** Screens that live inside the workspace share this outer frame. */
export function wsScreen(activeTab, body, opts = {}) {
  return `${topbar(engCrumbs([{ label: "Revenue" }]))}
    ${wsHeader(activeTab)}
    ${opts.raw ? body : `<div class="scroll"><div class="${opts.wide ? "page page--wide" : "page"}">${body}</div></div>`}`;
}
