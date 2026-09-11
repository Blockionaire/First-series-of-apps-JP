/* The engagement layer, and the Revenue process home.

   Two levels of navigation in the whole product: the engagement, and the
   process. The process home is the map plus the journey — one screen that
   answers "where is this process?". */

import { esc, cx, act as btn, row, rows, dot, icon, tag, callout, empty,
         nextAction, card, more } from "../ui.js";
import { client, engagement, sources } from "../data-sources.js";
import { processCatalogue, PARTICIPANT_ROLES, PHASES } from "../data-firm.js";
import { journey, carriedContext, variants } from "../data-process.js";
import * as st from "../state.js";
import { idline, engContext, engScreen, screen } from "./shell.js";
import { processMap, mapLegend, mapDetail } from "./map.js";

const S = st.S;

/* ── Engagement layer ────────────────────────────────────────────────────── */

export function engagementView() {
  const e = st.activeEngagement();
  const c = st.activeClient();
  const prog = st.processProgress();
  const cov = st.coverageSummary();
  const hasWork = st.processWorkspaceAvailable(e, "revenue");
  const inScope = st.engProcesses(e);

  const procRow = (p) => {
    const isRevenue = p.id === "revenue";
    const live = isRevenue && hasWork;
    return row({
      lead: icon("process", 17),
      title: live ? `<span class="b">${esc(p.name)}</span>`
        : `<span class="${isRevenue ? "b" : "ink3"}">${esc(p.name)}</span>`,
      detail: live ? `${esc(prog.current.name)} — ${esc(prog.current.blurb)}`
        : isRevenue ? "In scope · no sources loaded for this engagement in the prototype"
        : esc(p.blurb),
      side: live
        ? `<span class="b ink2">Step ${prog.current.n} of 7</span>
           <div class="t-meta">${cov.pct}% understood</div>`
        : isRevenue ? tag("not started", "quiet") : tag("no methodology pack", "quiet"),
      ...(live ? { action: "nav", data: { href: "#/revenue" } }
        : isRevenue ? { action: "nav", data: { href: "#/revenue" } } : {}),
    });
  };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">${esc(c.name)}</h1>
          <p class="t-lede">
            ${esc(e.fy)} ${esc(e.type.toLowerCase())} · period end ${esc(e.periodEnd)} ·
            ${esc(e.framework)}${e.materiality ? ` · materiality ${esc(e.materiality)}` : ""}
          </p>
        </div>
        <div class="acts">
          ${btn("Client profile", "nav", { size: "sm", ic: "process", data: { href: "#/client" } })}
        </div>
      </div>
    </div>

    ${!hasWork ? `<section class="sec">${callout(`<b>Process work belongs to this engagement.</b>
      Period, team and scope are real records here, and nothing is carried in from another
      engagement. The prototype ships one loaded process file — <b>Vandersteen FY2026 Revenue</b> —
      so the processes below open as not started.
      <div class="acts sec__note">
        ${btn("Open the populated demo engagement", "open-engagement",
          { size: "sm", data: { id: "ENG-2026-0142" } })}
      </div>`)}</section>` : ""}

    <section class="sec">
      <div class="sec__h"><h2 class="t-eyebrow">Audit phases</h2></div>
      <div class="phases">
        ${st.phaseStates(e).map((p) => `
          <div class="${cx("phase", "is-" + p.state)}">
            <div class="phase__n">${esc(p.name)}</div>
            <div class="phase__d">${esc(p.detail ||
              (p.state === "on" && hasWork && p.id === "interim"
                ? `Revenue · step ${prog.current.n} of 7` : p.state === "done" ? "Complete" : "Not started"))}</div>
          </div>`).join("")}
      </div>
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Interim — processes in scope</h2></div>
      <p class="t-sub sec__h measure">
        ${inScope.length} of ${processCatalogue.length} processes are in scope. Each is carried
        through the full interim workflow independently.</p>
      ${rows(inScope.map(procRow).join(""))}
      ${inScope.length < processCatalogue.length ? `<p class="t-meta sec__note">
        Not in scope: ${esc(processCatalogue.filter((p) => !inScope.some((x) => x.id === p.id))
          .map((p) => p.name).join(", "))}.</p>` : ""}
    </section>

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-h">Audit team</h2>
        <span class="sp"></span>
        ${btn("Firm people", "nav", { variant: "ghost", size: "sm", data: { href: "#/people" } })}
      </div>
      ${st.engTeam(e).length ? rows(st.engTeam(e).map((t) => row({
        lead: icon("people", 17),
        title: `<span class="b">${esc(t.user.name)}</span>${t.user.isMe ? ` <span class="t-meta">you</span>` : ""}`,
        detail: `Firm role ${esc(t.user.role)} · ${esc(t.user.email)}`,
        side: `${tag(t.role, t.role === "Partner" ? "accent" : "quiet")}
          <div class="t-meta" style="margin-top:4px">on this engagement</div>`,
      })).join(""))
      : empty("No team assigned", "Somebody has to prepare and review the file.", "people")}
    </section>

    <section class="sec--loose">
      ${callout(`<b>Where this sits.</b> Interim comes after the entity and process understanding and
        the inherent risk factors, and before risk analysis and the final audit. This product covers
        the interim work on a process. Risk analysis is the next phase and is deliberately outside it.`)}
    </section>
  `;

  return engScreen(body, { width: "reading" });
}

/* ── The process workspace, on an engagement that has no process work ──────
   Audit work is engagement-scoped. Only one engagement in the prototype ships
   with a loaded Revenue file, so every other engagement gets this — a valid
   new-engagement state, not an error. It answers three questions: where am I,
   what is the state, and what can I do.
   ───────────────────────────────────────────────────────────────────────── */

export function processUnavailable() {
  const e = st.activeEngagement();
  const c = st.activeClient();
  const proc = processCatalogue.find((p) => p.id === st.WORKSPACE_PROCESS);
  const inScope = (e?.processes || []).includes(st.WORKSPACE_PROCESS);
  const phase = (PHASES.find((p) => p.id === e?.phase) || {}).name || "Planning";

  const body = `
    <div class="head">
      ${btn(`${c ? c.short : "Client"} ${e ? e.fy : ""}`, "nav",
        { variant: "ghost", size: "sm", ic: "back", data: { href: "#/engagement" } })}
      <div class="head__row" style="margin-top:10px">
        <div>
          <h1 class="t-display">${esc(proc ? proc.name.split(" / ")[0] : "Revenue")}</h1>
          <p class="t-lede">
            ${esc(c ? c.name : "")} · ${esc(e ? e.fy : "")} · ${esc(phase)}
          </p>
        </div>
        ${inScope ? tag("in scope · not started", "quiet") : tag("not in scope", "quiet")}
      </div>
    </div>

    <section class="sec--loose">
      ${empty(
        inScope ? "No Revenue work has been started yet"
                : "Revenue is not in scope for this engagement",
        inScope
          ? "Revenue is in scope for this engagement, but no process evidence has been loaded in this prototype."
          : "Put it in scope on the engagement before any process work can begin.",
        "process")}
      <div class="acts" style="justify-content:center">
        ${inScope ? btn("Start process work — prototype placeholder", "mock", { variant: "primary" }) : ""}
        ${btn("Open the populated demo engagement", "open-engagement",
          { data: { id: "ENG-2026-0142" } })}
        ${btn("Back to the engagement", "nav", { variant: "ghost", data: { href: "#/engagement" } })}
      </div>
      <p class="t-meta sec__note measure" style="margin:18px auto 0;text-align:center">
        The full Revenue demo dataset is available on Vandersteen FY2026. Audit work belongs to one
        engagement and is never shared between them.</p>
    </section>
  `;

  return engScreen(body, { width: "reading" });
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
            Order-to-cash, ${esc(st.activeClient().short)} ${esc(st.activeEngagement().fy)} interim.
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
  const cl = st.activeClient();
  const eng = st.activeEngagement();
  const parts = st.procParticipants("revenue");
  const psys = st.procSystemsFor("revenue");
  const KIND_IC = { "Inherent risk factor": "finding", "Entity-level": "process",
                    "Systems in scope": "system", "Prior year": "clock" };

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Prepare</h1>
          <p class="t-lede">
            What we already know about Revenue at ${esc(st.activeClient().short)}, and who we need to speak to.
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
        ${row({ lead: icon("process", 17), title: "Engagement",
          detail: `${esc(eng.fy)} ${esc(eng.type.toLowerCase())} · period end ${esc(eng.periodEnd)} · ${esc(eng.framework)}`,
          side: tag("interim", "accent"), action: "nav", data: { href: "#/engagement" } })}
        ${row({ lead: icon("map", 17), title: "Process",
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
      <div class="sec__h">
        <h2 class="t-h">People relevant to Revenue</h2>
        <span class="sp"></span>
        ${btn("Client profile", "nav", { variant: "ghost", size: "sm", data: { href: "#/client" } })}
      </div>
      <p class="t-sub sec__h measure">
        Selected from ${esc(cl.short)}'s client contacts. The client record is the source of truth —
        this chooses who matters to this process, and what they are to it.</p>

      ${parts.length ? rows(parts.map((p) => row({
        lead: icon("people", 17),
        title: `<span class="b">${esc(p.contact.name)}</span>`,
        detail: `${esc(p.contact.role)}${p.contact.email ? ` · ${esc(p.contact.email)}` : ""}`,
        side: `${S.editing === `pr:${p.contactId}`
          ? `<select class="field" id="pr-role" data-role-for="${esc(p.contactId)}" style="width:210px">
              ${PARTICIPANT_ROLES.map((r) => `<option${r === p.role ? " selected" : ""}>${esc(r)}</option>`).join("")}
            </select>`
          : `<button class="tag tag--quiet" data-act="edit-open" data-id="pr:${esc(p.contactId)}">${esc(p.role)}</button>`}
          ${btn("Remove", "toggle-participant", { variant: "ghost", size: "sm", data: { id: p.contactId } })}`,
      })).join(""))
      : empty("Nobody selected yet", "Choose from the client's contacts below.", "people")}

      ${more("addpeople", `Add someone from ${cl.short}'s contacts`, `<div class="meth">
        ${cl.contacts.filter((x) => !parts.some((p) => p.contactId === x.id)).length
          ? cl.contacts.filter((x) => !parts.some((p) => p.contactId === x.id)).map((x) => `
            <div class="row meth__row">
              <span class="ink4">${icon("people", 16)}</span>
              <span style="flex:1"><b>${esc(x.name)}</b> <span class="t-meta">${esc(x.role)}</span></span>
              ${btn("Add to Revenue", "toggle-participant", { size: "sm", data: { id: x.id } })}
            </div>`).join("")
          : `<p class="t-meta">Every contact on the client record is already on this process.</p>`}
        <div class="acts" style="margin-top:14px">
          ${btn("Add a new client contact", "nav", { size: "sm", ic: "plus", data: { href: "#/client" } })}
        </div>
        <p class="t-meta" style="margin-top:10px">A new contact is added to the client profile, not
        to this process only — one person, one record.</p>
      </div>`, S.disclosed.addpeople)}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-h">Systems relevant to Revenue</h2></div>
      <p class="t-sub sec__h measure">
        From the systems on the client record. Revenue does not need all of them.</p>
      ${psys.length ? rows(psys.map((x) => row({
        lead: icon("system", 17),
        title: `<span class="b">${esc(x.name)}</span>`,
        detail: `${esc(x.role)}${x.note ? ` · ${esc(x.note)}` : ""}`,
        side: btn("Remove", "toggle-proc-system", { variant: "ghost", size: "sm", data: { id: x.id } }),
      })).join(""))
      : empty("No systems selected", "Choose from the client's systems below.", "system")}

      ${more("addsys", `Add a system from the client profile`, `<div class="meth">
        ${cl.systems.filter((x) => !psys.some((p) => p.id === x.id)).length
          ? cl.systems.filter((x) => !psys.some((p) => p.id === x.id)).map((x) => `
            <div class="row meth__row">
              <span class="ink4">${icon("system", 16)}</span>
              <span style="flex:1"><b>${esc(x.name)}</b> <span class="t-meta">${esc(x.role)}</span></span>
              ${btn("Add to Revenue", "toggle-proc-system", { size: "sm", data: { id: x.id } })}
            </div>`).join("")
          : `<p class="t-meta">Every system on the client record is already on this process.</p>`}
        <div class="acts" style="margin-top:14px">
          ${btn("Add a new client system", "nav", { size: "sm", ic: "plus", data: { href: "#/client" } })}
        </div>
      </div>`, S.disclosed.addsys)}
    </section>

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-h">Audit team on this engagement</h2>
        <span class="sp"></span>
        ${btn("Engagement", "nav", { variant: "ghost", size: "sm", data: { href: "#/engagement" } })}
      </div>
      <p class="t-sub sec__h measure">Auditors, not client people. The two never mix.</p>
      <p class="inline-list">${st.engTeam().map((t) =>
        `<b>${esc(t.user.name)}</b> <span class="t-meta">${esc(t.role)}</span>`).join(" · ")}</p>
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
