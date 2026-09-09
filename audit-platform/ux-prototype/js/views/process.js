/* The engagement layer, and the Revenue process home.

   Two levels of navigation in the whole product: the engagement, and the
   process. The process home is the map plus the journey — one screen that
   answers "where is this process?". */

import { esc, cx, act as btn, row, dot, callout, empty } from "../ui.js";
import { client, engagement, sources } from "../data-sources.js";
import { journey } from "../data-process.js";
import * as st from "../state.js";
import { idline, engContext, engScreen, screen } from "./shell.js";
import { processMap, mapLegend, mapDetail } from "./map.js";

const S = st.S;

/* ── Engagement layer ────────────────────────────────────────────────────── */

export function engagementView() {
  const prog = st.processProgress();
  const cov = st.coverageSummary();

  const later = [
    ["Purchasing", "Purchase-to-pay"], ["Payroll", "Hire-to-retire"],
    ["Inventory", "Stock and costing"], ["Treasury", "Cash and financing"],
    ["Financial close", "Close and reporting"],
  ];

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">${esc(client.name)}</h1>
          <p class="t-lede" style="margin-top:10px">
            ${esc(engagement.period)} · ${esc(client.framework)} · materiality ${esc(engagement.materiality)}
          </p>
        </div>
      </div>
    </div>

    <section style="margin-top:36px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Engagement</h2>
      <div class="phases">
        ${[["Planning", "done", "Signed 4 July 2026"],
           ["Interim", "on", `Revenue · step ${prog.current.n} of 7`],
           ["Final", "later", "From 12 January 2027"],
           ["Completion", "later", ""]].map(([n, s, d]) => `
          <div class="${cx("phase", "is-" + s)}">
            <div class="phase__n">${esc(n)}</div>
            <div class="phase__d">${esc(d || "Not started")}</div>
          </div>`).join("")}
      </div>
    </section>

    <section style="margin-top:44px">
      <h2 class="t-h" style="margin-bottom:4px">Interim — processes</h2>
      <p class="t-meta" style="margin-bottom:16px">
        Each process is carried through the full interim workflow independently.
        Only Revenue is in scope for the current methodology pack.</p>
      <div class="rows">
        ${row({
          lead: dot("ok"),
          title: `<span class="b">Revenue / order-to-cash</span>`,
          detail: `${prog.current.name} — ${esc(prog.current.blurb)}`,
          side: `<span class="b" style="color:var(--ink-2)">step ${prog.current.n} of 7</span>
                 <div class="t-meta">${cov.pct}% understood</div>`,
          action: "nav", data: { href: "#/revenue" },
        })}
        ${later.map(([n, d]) => row({
          lead: dot("open"),
          title: `<span style="color:var(--ink-3)">${esc(n)}</span>`,
          detail: esc(d),
          side: `<span class="t-meta">not started</span>`,
        })).join("")}
      </div>
    </section>

    <section style="margin-top:44px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Team</h2>
      <p class="inline-list">${engagement.team.map((t) =>
        `<b>${esc(t.name)}</b> <span class="t-meta">${esc(t.role)}</span>`).join(" · ")}</p>
    </section>

    ${callout(`<b>Where this sits.</b> Interim comes after the entity and process understanding and
      the inherent risk factors, and before risk analysis and the final audit. This product covers
      the interim work on a process. Risk analysis is the next phase and is deliberately outside it.`)}
  `;

  return engScreen(body);
}

/* ── Revenue process home ────────────────────────────────────────────────── */

export function processHome() {
  const steps = st.journeyStates();
  const next = st.nextAction();
  const tr = st.traceSummary();
  const mode = tr.started ? "trace" : S.generated ? "annotated" : "plain";

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Revenue</h1>
          <p class="t-lede" style="margin-top:10px">
            Order-to-cash, ${esc(client.short)} FY2026 interim.
            ${S.generated ? "The process as we understand it, and how far the work has got."
              : "The process as described so far. It fills in as the walkthrough progresses."}
          </p>
        </div>
        <div style="text-align:right;padding-top:4px">
          <div class="t-num">${st.processProgress().done}<span style="color:var(--ink-4)">/7</span></div>
          <div class="t-meta">steps done</div>
        </div>
      </div>
    </div>

    <section style="margin-top:32px">
      <div class="row" style="margin-bottom:12px">
        <h2 class="t-eyebrow">Process understanding map</h2>
        <span class="sp"></span>
        ${mapLegend(mode)}
      </div>
      ${processMap(mode, { selected: S.mapStep })}
      ${S.mapStep ? mapDetail(S.mapStep) : `<p class="t-meta" style="margin-top:12px">
        Click a step to see its controls, findings and sources.</p>`}
    </section>

    <section style="margin-top:48px">
      <h2 class="t-h" style="margin-bottom:4px">The interim workflow</h2>
      <p class="t-meta" style="margin-bottom:16px">Seven steps. You can look ahead at any time.</p>
      <div class="rows">
        ${steps.map((j) => row({
          lead: j.s === "done" ? dot("ok") : j.s === "open" ? dot(j.tone === "warn" ? "warn" : "") : dot("open"),
          title: `<span class="${j.s === "later" ? "" : "b"}" style="${j.s === "later" ? "color:var(--ink-4)" : ""}">${j.n}. ${esc(j.name)}</span>`,
          detail: j.s === "later" && j.why ? esc(j.why) : esc(j.blurb),
          side: `<span class="t-meta ${j.tone === "warn" ? "" : ""}" style="${j.tone === "warn" ? "color:var(--warn)" : j.s === "done" ? "color:var(--ok)" : ""}">${esc(j.c)}</span>`,
          action: "nav", data: { href: j.href },
        })).join("")}
      </div>
    </section>

    <section style="margin-top:40px">
      <button class="rw" data-act="nav" data-href="${esc(next.href)}"
        style="border-top:1px solid var(--line);padding:24px 4px">
        <span class="rw__main">
          <span class="t-eyebrow">Next</span>
          <span class="t-h" style="display:block;margin:8px 0 5px">${esc(next.t)}</span>
          <span class="t-sub" style="display:block">${esc(next.d)}</span>
        </span>
        <span class="rw__side" style="padding-top:24px;font-size:19px;color:var(--ink-5)">›</span>
      </button>
    </section>
  `;

  return screen(null, body, { width: "wide" });
}

/* ── Step 1 — Prepare ────────────────────────────────────────────────────── */

export function prepare() {
  const cov = st.coverageSummary();

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-title">Prepare</h1>
          <p class="t-lede" style="margin-top:10px">
            What we already know about Revenue at ${esc(client.short)}, and who we need to speak to.
            Everything here came from the prior year, the engagement file or documents already supplied.
          </p>
        </div>
        ${S.prepared ? `<span class="state state--ok" style="padding-top:12px"><i class="dot dot--ok"></i>Confirmed</span>` : ""}
      </div>
    </div>

    <section style="margin-top:36px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Scope</h2>
      <div class="rows">
        ${row({ title: "Process", detail: "Revenue / order-to-cash — both streams", side: `<span class="t-meta">in scope</span>` })}
        ${row({ title: "Machines and spare parts", detail: "EUR 41.2m · recognised on customer acceptance", side: `<span class="t-meta">point in time</span>` })}
        ${row({ title: "Service and maintenance contracts", detail: "EUR 7.4m · straight-line over the contract term", side: `<span class="t-meta">over time</span>` })}
        ${row({ title: "Methodology pack", detail: "12 sub-processes, 45 coverage areas, 10 required by ISA 240", side: `<span class="mono t-meta">revenue v0.1.0</span>` })}
      </div>
    </section>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Systems</h2>
      <div class="rows">
        ${client.systems.map((s) => row({
          title: `<span class="b">${esc(s.name)}</span>`, detail: esc(s.role) })).join("")}
      </div>
    </section>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Process owners and participants</h2>
      <div class="rows">
        ${client.contacts.map((c) => row({
          lead: dot(c.tag ? "ok" : "open"),
          title: `<span class="b">${esc(c.name)}</span>`,
          detail: esc(c.role),
          side: `<span class="t-meta">${esc(c.tag || "not yet contacted")}</span>`,
        })).join("")}
      </div>
    </section>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">What we already have</h2>
      <div class="rows">
        ${Object.values(sources).map((s) => row({
          lead: dot("ok"), title: esc(s.name), detail: esc(s.detail),
        })).join("")}
      </div>
      <div class="acts" style="margin-top:16px">
        ${btn("Add a document", "mock")}
        ${btn("Import a transcript", "mock")}
      </div>
    </section>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Known changes since last year</h2>
      <div class="rows">
        ${row({ lead: dot("warn"),
          title: "Warehousing and despatch outsourced to Van Dijk Logistics in March 2026",
          detail: "Performed in-house at Eindhoven in FY2025. A new service organisation in the middle of the revenue process.",
          side: `<span class="t-meta">process change</span>` })}
        ${row({ lead: dot("warn"),
          title: "Service revenue has grown since the 2024 maintenance acquisition",
          detail: "A second recognition basis, and a second system feeding the ledger.",
          side: `<span class="t-meta">scale</span>` })}
      </div>
    </section>

    <section style="margin-top:40px">
      <h2 class="t-eyebrow" style="margin-bottom:14px">Already outstanding</h2>
      <p class="t-sub" style="max-width:66ch">
        ${cov.mandatoryOpen.length
          ? `${cov.mandatoryOpen.length} required areas were not established by the documents alone and need to be covered in the walkthrough.`
          : "Nothing outstanding from the preparation."}
      </p>
    </section>

    <section style="margin-top:44px;border-top:1px solid var(--line);padding-top:28px">
      ${S.prepared
        ? `<div class="acts">
            ${btn("Go to the walkthrough", "nav", { variant: "go", size: "lg", data: { href: "#/walkthrough" } })}
          </div>`
        : `<h2 class="t-h">Ready to speak to the client?</h2>
           <p class="t-sub" style="margin:6px 0 18px;max-width:62ch">
             Confirming preparation records that the scope, participants and prior information were
             considered before the walkthrough — which is what the file has to show.</p>
           <div class="acts">
             ${btn("Confirm and continue", "prepare-done", { variant: "go", size: "lg", key: "Enter" })}
           </div>`}
    </section>
  `;

  return screen("prepare", body);
}
