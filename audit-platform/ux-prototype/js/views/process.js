/* The engagement layer, and the Revenue process home.

   Two levels of navigation in the whole product: the engagement, and the
   process. The process home is the map plus the journey — one screen that
   answers "where is this process?". */

import { esc, cx, act as btn, row, rows, dot, icon, tag, callout, empty,
         nextAction, card } from "../ui.js";
import { client, engagement, sources } from "../data-sources.js";
import { journey, carriedContext, variants } from "../data-process.js";
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
          <h1 class="t-display">${esc(client.name)}</h1>
          <p class="t-lede">
            ${esc(engagement.period)} · ${esc(client.framework)} · materiality ${esc(engagement.materiality)}
          </p>
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="sec__h"><h2 class="t-eyebrow">Audit phases</h2></div>
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

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Interim — processes</h2></div>
      <p class="t-sub sec__h">
        Each process is carried through the full interim workflow independently.
        Only Revenue is in scope for the current methodology pack.</p>
      ${rows(`
        ${row({
          lead: icon("process", 17),
          title: `<span class="b">Revenue / order-to-cash</span>`,
          detail: `${esc(prog.current.name)} — ${esc(prog.current.blurb)}`,
          side: `<span class="b ink2">Step ${prog.current.n} of 7</span>
                 <div class="t-meta">${cov.pct}% understood</div>`,
          action: "nav", data: { href: "#/revenue" },
        })}
        ${later.map(([n, d]) => row({
          lead: icon("process", 17),
          title: `<span class="ink3">${esc(n)}</span>`,
          detail: esc(d),
          side: `<span class="t-meta">not started</span>`,
        })).join("")}`)}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Team</h2></div>
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
  const prog = st.processProgress();
  const cov = st.coverageSummary();
  const mode = tr.active ? "trace" : S.analysed ? "annotated" : "plain";

  const vstate = (v) => v.state === "completed"
      ? { t: `Walkthrough complete${v.progress?.exceptions ? ` · ${v.progress.exceptions} exception` : ""}`,
          tone: v.progress?.exceptions ? "warn" : "ok" }
    : v.state === "not_required" ? { t: "No walkthrough required", tone: "" }
    : v.state === "in_progress" ? { t: `${v.progress.done} of ${v.progress.expected} steps traced`, tone: "warn" }
    : v.state === "not_decided" ? { t: "Walkthrough not decided", tone: "" }
    : { t: "Walkthrough not started", tone: "" };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Revenue</h1>
          <p class="t-lede">
            Order-to-cash, ${esc(client.short)} FY2026 interim.
            ${S.analysed ? "The process as we understand it, and how far the work has got."
              : "The process as described so far. It fills in as the work progresses."}
          </p>
        </div>
        <div class="tally">
          <div><span class="tally__n">${prog.done}<span class="ink4">/7</span></span>
            <span class="tally__l">steps done</span></div>
          <div><span class="tally__n">${cov.pct}<span class="ink4">%</span></span>
            <span class="tally__l">understood</span></div>
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="sec__h">
        <h2 class="t-eyebrow">Process understanding map</h2>
        <span class="sp"></span>
        ${mapLegend(mode)}
      </div>
      ${processMap(mode, { selected: S.mapStep })}
      ${S.mapStep ? mapDetail(S.mapStep) : `<p class="t-meta sec__note">
        Three variants, sharing most of their steps and converging at revenue posting.
        Click a step to see its controls, findings and sources.</p>`}
    </section>

    <section class="sec--loose">
      ${nextAction(next, "Next")}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Process variants</h2></div>
      <p class="t-sub sec__h">Line walkthroughs are decided and tracked per variant.</p>
      <div class="cards cards--3">
        ${tr.variants.map((v) => {
          const vs = vstate(v);
          return card({
            title: esc(v.variant.name),
            detail: `${esc(v.variant.value)} · ${esc(v.variant.recognition.toLowerCase())}`,
            body: `<div class="card__ft">
              ${tag(vs.t, vs.tone, v.state === "completed" ? "check" : "walkthrough")}
              <span class="sp"></span>
              <span class="t-meta">${st.stepsForVariantCount(v.variant.id)} steps</span>
            </div>`,
            action: "nav", data: { href: "#/trace" },
          });
        }).join("")}
      </div>
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">The interim workflow</h2></div>
      <p class="t-sub sec__h">Seven steps. You can look ahead at any time.</p>
      ${rows(steps.map((j) => row({
        lead: j.s === "done" ? `<span class="state state--ok">${icon("check", 17)}</span>`
          : j.s === "later" ? `<span class="ink5">${icon("clock", 17)}</span>`
          : icon("step", 17),
        title: `<span class="${j.s === "later" ? "ink4" : "b"}">${j.n}. ${esc(j.name)}</span>`,
        detail: j.s === "later" && j.why ? esc(j.why) : esc(j.blurb),
        side: j.c ? tag(j.c, j.s === "done" ? "ok" : j.tone === "alert" ? "alert"
          : j.tone === "warn" ? "warn" : "quiet") : "",
        action: "nav", data: { href: j.href },
      })).join(""))}
    </section>
  `;

  return screen(null, body, { width: "wide" });
}

/* ── Step 1 — Prepare ────────────────────────────────────────────────────── */

export function prepare() {
  const cov = st.coverageSummary();
  const KIND_IC = { "Inherent risk factor": "finding", "Entity-level": "process",
                    "Systems in scope": "system", "Prior year": "clock" };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Prepare</h1>
          <p class="t-lede">
            What we already know about Revenue at ${esc(client.short)}, and who we need to speak to.
            Everything here came from the prior year, the engagement file or documents already
            supplied — interim receives this work, it does not redo it.
          </p>
        </div>
        ${S.prepared ? `<span class="tag tag--ok">${icon("check", 12)}Confirmed</span>` : ""}
      </div>
    </div>

    <section class="sec">
      <div class="sec__h"><h2 class="t-eyebrow">Scope</h2></div>
      ${rows(`
        ${row({ lead: icon("process", 17), title: "Process",
          detail: "Revenue — three process variants across two revenue streams",
          side: tag("in scope", "accent") })}
        ${variants.map((v) => row({
          lead: icon("variant", 17), title: esc(v.name),
          detail: `${esc(v.value)} · ${esc(v.recognition.toLowerCase())}`,
          side: `<span class="t-meta">${v.recognition.startsWith("Over") ? "over time" : "point in time"}</span>` })).join("")}
        ${row({ lead: icon("document", 17), title: "Methodology pack",
          detail: "12 sub-processes, 45 coverage areas, 10 required by ISA 240",
          side: `<span class="mono t-meta">revenue v0.1.0</span>` })}`)}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Context carried into interim</h2></div>
      <p class="t-sub sec__h measure">
        From client acceptance, entity understanding and the inherent risk factors identified in
        planning. Read-only here.</p>
      <div class="cards cards--2">
        ${carriedContext.map((c) => card({
          mod: "quiet",
          title: esc(c.t), detail: esc(c.d),
          side: tag(c.kind, "quiet", KIND_IC[c.kind] || "document"),
        })).join("")}
      </div>
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Known changes since last year</h2></div>
      <div class="cards cards--2">
        ${card({ mod: "warn",
          title: "Warehousing outsourced to Van Dijk Logistics in March 2026",
          detail: "Performed in-house at Eindhoven in FY2025. A new service organisation sits in the middle of the revenue process.",
          side: tag("process change", "warn") })}
        ${card({ mod: "warn",
          title: "Service revenue has grown since the 2024 maintenance acquisition",
          detail: "A second recognition basis, and a second system feeding the ledger.",
          side: tag("scale", "warn") })}
      </div>
    </section>

    <section class="sec--loose">
      <div class="grid2">
        <div>
          <div class="sec__h"><h2 class="t-eyebrow">Systems</h2></div>
          ${rows(client.systems.map((sy) => row({
            lead: icon("system", 17),
            title: `<span class="b">${esc(sy.name)}</span>`, detail: esc(sy.role) })).join(""))}
        </div>
        <div>
          <div class="sec__h"><h2 class="t-eyebrow">People</h2></div>
          ${rows(client.contacts.map((c) => row({
            lead: icon("people", 17),
            title: `<span class="b">${esc(c.name)}</span>`, detail: esc(c.role),
            side: c.tag ? tag(c.tag, "ok", "check") : `<span class="t-meta">not yet contacted</span>` })).join(""))}
        </div>
      </div>
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">What we already have</h2></div>
      ${rows(Object.values(sources).map((sy) => row({
        lead: icon(SRC_IC[sy.kind] || "document", 17),
        title: esc(sy.name), detail: esc(sy.detail) })).join(""))}
      <div class="acts sec__note">
        ${btn("Add a document", "mock", { size: "sm", ic: "document" })}
        ${btn("Import a transcript", "mock", { size: "sm", ic: "transcript" })}
      </div>
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Still outstanding</h2></div>
      <p class="t-body measure">
        ${cov.mandatoryOpen.length
          ? `${cov.mandatoryOpen.length} required areas were not established by the documents alone
             and need to be covered in the interview.`
          : "Nothing outstanding from the preparation."}
      </p>
    </section>

    <hr class="rule">
    <section class="sec">
      ${S.prepared
        ? `<div class="row">
            <span class="state state--ok">${icon("check", 16)}Preparation confirmed</span>
            <span class="sp"></span>
            ${btn("Edit preparation", "prepare-reopen", { variant: "ghost" })}
            ${btn("Go to the process interview", "nav", { variant: "primary", data: { href: "#/interview" }, ic: "arrow" })}
          </div>`
        : `<h2 class="t-h">Ready to speak to the client?</h2>
           <p class="t-sub sec__h measure">
             Confirming records that the scope, the participants, the carried context and the prior
             information were considered before the interview — which is what the file has to show.
             You are taken straight to step 2.</p>
           <div class="acts">
             ${btn("Confirm and start the process interview", "prepare-done",
               { variant: "primary", size: "lg", key: "Enter" })}
           </div>`}
    </section>
  `;

  return screen("prepare", body);
}

const SRC_IC = { transcript: "transcript", client_answer: "questionnaire", prior_year: "document",
                 access_log: "system", assurance_report: "document", auditor_note: "note" };
