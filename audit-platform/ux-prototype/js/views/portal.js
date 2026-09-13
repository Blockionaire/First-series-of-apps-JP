/* ============================================================================
   The client portal — the other half of the product.

   The auditor sees the complexity. The client sees the next thing they need
   to do. This file therefore shares Audit AI's identity — the warm ground, the
   mineral-green ink, the type, the buttons — and almost nothing else. No
   process journey, no attention queue, no decision workspace, no methodology,
   no controls, no findings, no risk signals, no coverage, no reviewer, no
   completion gates. A Financial Controller should be able to use this without
   anyone explaining it.

   Density is deliberately low and type is deliberately larger than the auditor
   side. This is a professional service portal, not audit software.

   PROTOTYPE: there is no authentication here. `portalAs` is a demo switch.
   The interview has no microphone, no recording and no transcription behind
   it — see data-client.js.
   ========================================================================== */

import { esc, cx, act as btn, icon } from "../ui.js";
import { firm } from "../data-sources.js";
import * as st from "../state.js";

/* --- The client shell -------------------------------------------------------
   One row. Who you are, whose audit this is, and the way out. Nothing else.
   -------------------------------------------------------------------------- */

const initials = (n) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const mark = () => `
  <button class="pt__mark" data-act="nav" data-href="#/portal">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1.6" y="1.6" width="16.8" height="16.8" rx="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.6 10.4l2.8 2.8 6-6.4" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Audit AI</span>
  </button>`;

/** The prototype view switch. Deliberately quiet, deliberately labelled: it is
 *  a demo affordance and must never read as a production control. */
function devbar() {
  const c = st.activeClient();
  const me = st.portalContact();
  const others = (c?.contacts || []).filter((x) =>
    st.S.clientTasks.some((t) => t.contactId === x.id && t.engagementId === st.S.engId));
  return `<div class="pt__dev">
    <span class="pt__dev-k">Prototype view</span>
    ${others.map((x) => `<button class="${cx("pt__dev-b", x.id === st.S.portalAs && "is-on")}"
      data-act="portal-as" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join("")}
    <span class="pt__dev-s"></span>
    <button class="pt__dev-b" data-act="nav" data-href="#/interview">Auditor side</button>
  </div>`;
}

export function portalShell(body, o = {}) {
  const c = st.activeClient();
  const e = st.activeEngagement();
  const me = st.portalContact();
  return `<div class="pt">
    <header class="pt__bar">
      ${mark()}
      <span class="pt__ctx">
        <b>${esc(c ? c.short : "")}</b>
        <span>${esc(e ? e.fy : "")}</span>
      </span>
      <span class="sp"></span>
      ${o.back ? btn(o.back.label, "nav", { size: "sm", variant: "ghost", ic: "back",
        data: { href: o.back.href } }) : ""}
      <button class="pt__help" data-act="mock">Help</button>
      <span class="pt__me" title="${esc(me ? me.name : "")}">${esc(me ? initials(me.name) : "")}</span>
    </header>
    ${devbar()}
    <div class="pt__canvas"><div class="${cx("pt__wrap", o.wide && "pt__wrap--wide",
      o.narrow && "pt__wrap--narrow")}">${body}</div></div>
  </div>`;
}

/* ══ Portal home — the task inbox ════════════════════════════════════════ */

const TASK_IC = { questionnaire: "questionnaire", live_interview: "people",
                  follow_up: "question", document_request: "document" };

function taskCard(t) {
  const state = st.taskState(t);
  const label = st.taskStateLabel(t);
  const prog = st.taskProgress(t);
  const done = state === "completed";
  const withUser = t.withUserId ? st.firmUser(t.withUserId) : null;

  return `<article class="${cx("ptask", done && "ptask--done")}">
    <div class="ptask__hd">
      <span class="ptask__ic">${icon(TASK_IC[t.type] || "document", 20)}</span>
      <div class="ptask__t">
        <h2>${esc(t.title)}</h2>
        <span class="${cx("ptag", label.tone && "ptag--" + label.tone)}">${esc(label.label)}</span>
      </div>
    </div>
    <p class="ptask__w">${esc(t.why)}</p>
    ${withUser ? `<p class="ptask__m">With ${esc(withUser.name)}, ${esc(withUser.role.toLowerCase())} at ${esc(firm.name)}</p>` : ""}
    ${prog ? `<p class="ptask__m">${esc(prog)}</p>` : ""}
    ${t.due && !done ? `<p class="ptask__m">Needed by ${esc(t.due)}</p>` : ""}
    ${t.href && !done ? `<div class="ptask__go">
      ${btn(t.cta || "Open", "nav", { variant: "primary", size: "lg", data: { href: t.href } })}
    </div>` : ""}
  </article>`;
}

export function portalHome() {
  const me = st.portalContact();
  const open = st.portalOpenTasks();
  const done = st.portalDoneTasks();
  const first = me ? me.name.split(" ")[0] : "there";

  const body = `
    <header class="pt__head">
      <p class="pt__eyebrow">${esc(firm.name)} · ${esc(st.activeEngagement().fy)} audit</p>
      <h1>Good afternoon, ${esc(first)}</h1>
      <p class="pt__lede">${open.length
        ? open.length === 1 ? "There is one thing we need from you."
          : `There are ${open.length} things we need from you.`
        : "Nothing is waiting on you at the moment."}</p>
    </header>

    ${open.length ? `<section class="pt__sec">
      ${open.map(taskCard).join("")}
    </section>` : `<section class="pt__sec">
      <div class="pt__empty">
        <span>${icon("check", 28)}</span>
        <h2>${done.length ? "You're all caught up" : "Nothing has been sent to you yet"}</h2>
        <p>${done.length
          ? "We'll let you know here if we need anything else."
          : "This is the prototype's worked example; only the Vandersteen FY2026 audit has client tasks in it."}</p>
      </div>
    </section>`}

    ${done.length ? `<section class="pt__sec">
      <h2 class="pt__sh">Done</h2>
      ${done.map((t) => `<div class="pdone">
        <span>${icon("check", 17)}</span>
        <div><b>${esc(t.title)}</b>
        <span>${esc(st.taskProgress(t) || t.done || "Completed")}</span></div>
      </div>`).join("")}
    </section>` : ""}

    <p class="pt__trust">
      Your answers go to the ${esc(firm.name)} team working on this audit. This is a prototype —
      nothing you enter is sent or stored anywhere.
    </p>
  `;
  return portalShell(body);
}

/* ══ Document request — one screen, deliberately shallow ═════════════════ */

export function portalDocument() {
  const t = st.taskById("CT-03");
  if (!t) return portalHome();
  const up = st.S.uploads[t.id];

  const body = `
    <header class="pt__head">
      <p class="pt__eyebrow">Document request</p>
      <h1>${esc(t.title)}</h1>
      <p class="pt__lede">${esc(t.why)}</p>
    </header>

    <section class="pt__sec">
      ${up ? `<div class="pt__ok">
        <span>${icon("check", 22)}</span>
        <div>
          <b>${esc(up.name)}</b>
          <span>Received ${esc(up.at)}. Nothing else is needed.</span>
        </div>
      </div>
      <div class="pt__acts">
        ${btn("Back to your tasks", "nav", { variant: "primary", size: "lg", data: { href: "#/portal" } })}
      </div>`
      : `<div class="pt__drop">
        <span>${icon("document", 26)}</span>
        <p>Any format is fine — a spreadsheet, a PDF or a screenshot.</p>
        ${btn("Choose a file", "upload-doc", { variant: "primary", size: "lg", data: { id: t.id } })}
        <span class="pt__note">Mocked in this prototype. No file is read, uploaded or stored.</span>
      </div>`}
    </section>
  `;
  return portalShell(body, { back: { label: "Your tasks", href: "#/portal" }, narrow: true });
}

/* ══ Follow-up — one question, the questionnaire surface ═════════════════ */

export function portalFollowUp() {
  const q = st.theFollowUpQuestion();
  const a = st.S.followUp;

  const body = a ? `
    <header class="pt__head">
      <h1>Thank you</h1>
      <p class="pt__lede">${a.kind === "answer"
        ? "Your answer has gone to the audit team."
        : a.kind === "unknown"
        ? "Recorded. Your auditor will find another route — you do not need to do anything."
        : "A call has been requested. Your auditor will get in touch."}</p>
    </header>
    <section class="pt__sec">
      <div class="pq__was">
        <span>${esc(q.q)}</span>
        <p>${esc(a.text || (a.kind === "unknown" ? "I don't know" : "I'd rather have a call"))}</p>
      </div>
      <div class="pt__acts">
        ${btn("Back to your tasks", "nav", { variant: "primary", size: "lg", data: { href: "#/portal" } })}
      </div>
    </section>`
  : `
    <header class="pt__head">
      <p class="pt__eyebrow">One more question</p>
      <h1 class="pq__q">${esc(q.q)}</h1>
      <p class="pt__lede">${esc(q.why)}</p>
    </header>
    <section class="pt__sec">
      <textarea class="field pq__in" id="fu" rows="5" placeholder="Type your answer…"></textarea>
      <div class="pt__acts">
        ${btn("Send", "follow-send", { variant: "primary", size: "lg" })}
        ${btn("I don't know", "follow-unknown", { size: "lg" })}
        ${btn("Rather have a call", "follow-call", { variant: "ghost", size: "lg" })}
      </div>
      <p class="pt__note">
        The three do different things. An answer settles the point. The other two go back to your
        auditor as something for them to pick up — nothing is lost and nothing is guessed.</p>
    </section>`;

  return portalShell(body, { back: { label: "Your tasks", href: "#/portal" }, narrow: true });
}

/* ══ The live interview, from the client's side ══════════════════════════
   The same interview the auditor cockpit shows, read from `S.interview`. What
   differs is everything the client does not need: no coverage bar, no
   suggested question, no contradiction flag, no evidence request, no risk
   signal, no "AI is analysing". The conversation is the product here.

   PROTOTYPE: no WebRTC, no microphone, no camera, no recording, no
   transcription. Mic state and the clock are mocked; the transcript is
   scripted.
   ═══════════════════════════════════════════════════════════════════════ */

/* --- The task detail: what this is, when, and with whom ------------------- */

export function portalInterview() {
  const t = st.interviewTask();
  if (!t) return portalHome();
  const iv = st.interview();
  const room = st.interviewRoom();
  const lead = st.firmUser(t.withUserId);
  const over = iv.status === "complete";

  const body = `
    <header class="pt__head">
      <p class="pt__eyebrow">Process interview</p>
      <h1>${esc(t.title)}</h1>
      <p class="pt__lede">${esc(t.why)}</p>
    </header>

    <section class="pt__sec">
      <div class="pfacts">
        <div><span>When</span><b>${esc(t.when || "To be scheduled")}</b></div>
        <div><span>How long</span><b>About ${t.minutes} minutes</b></div>
        <div><span>With</span><b>${esc(lead ? lead.name : "your audit team")}</b>
          ${lead ? `<i>${esc(lead.role)} · ${esc(firm.name)}</i>` : ""}</div>
      </div>
    </section>

    <section class="pt__sec">
      <h2 class="pt__sh">What we'll talk about</h2>
      <ul class="ptopics">
        ${(t.topics || []).map((x) => `<li>${icon("check", 15)}${esc(x)}</li>`).join("")}
      </ul>
      <p class="pt__note">You don't need to prepare anything. Just explain the process the way you
      normally would.</p>
    </section>

    <section class="pt__sec">
      <h2 class="pt__sh">Who'll be there</h2>
      ${[...room.firm.map((u) => ({ n: u.name, r: `${u.role} · ${firm.name}` })),
         ...room.client.map((c) => ({ n: c.name, r: c.role }))]
        .map((p) => `<div class="pwho"><span>${esc(initials(p.n))}</span>
          <div><b>${esc(p.n)}</b><span>${esc(p.r)}</span></div></div>`).join("")}
    </section>

    <div class="pt__acts">
      ${over
        ? `${btn("Back to your tasks", "nav", { variant: "primary", size: "lg", data: { href: "#/portal" } })}`
        : btn("Join interview", "iv-enter", { variant: "primary", size: "lg" })}
    </div>
    ${over ? `<p class="pt__note">This interview has finished.</p>` : ""}
  `;
  return portalShell(body, { back: { label: "Your tasks", href: "#/portal" }, narrow: true });
}

/* --- The waiting room ---------------------------------------------------- */

export function portalWaiting() {
  const t = st.interviewTask();
  const iv = st.interview();
  const lead = st.firmUser(t?.withUserId);

  const body = `
    <header class="pt__head pt__head--centre">
      <p class="pt__eyebrow">Revenue process interview</p>
      <h1>You're meeting ${esc(lead ? lead.name.split(" ")[0] : "your auditor")}</h1>
      <p class="pt__lede">${esc(t?.when || "")} · about ${t?.minutes || 30} minutes</p>
    </header>

    <section class="pt__sec">
      <div class="pready">
        <div class="pready__r">
          <span class="pready__i">${icon("people", 18)}</span>
          <div><b>Microphone</b><span>Ready</span></div>
          <span class="pdot pdot--ok"></span>
        </div>
        <div class="pready__r">
          <span class="pready__i">${icon("transcript", 18)}</span>
          <div><b>Transcript</b>
            <span>Audit AI can write down what is said, so the audit team does not have to take
            notes while you talk. They stay responsible for what goes in the file.</span></div>
        </div>
      </div>

      <label class="pconsent${iv.consent ? " is-on" : ""}" for="iv-consent">
        <input type="checkbox" id="iv-consent" ${iv.consent ? "checked" : ""}>
        <span>I understand that this conversation may be transcribed for audit documentation.</span>
      </label>

      <div class="pt__acts">
        ${btn("Join interview", "iv-join", { variant: "primary", size: "lg", disabled: !iv.consent })}
        ${btn("Not now", "nav", { variant: "ghost", size: "lg", data: { href: "#/portal" } })}
      </div>
      ${!iv.consent ? `<p class="pt__note">Tick the box above to join.</p>` : ""}
      <p class="pt__note">
        Prototype: no microphone, camera or recording is used. The conversation that follows is a
        worked example.</p>
    </section>
  `;
  return portalShell(body, { back: { label: "Your tasks", href: "#/portal" }, narrow: true });
}

/* --- Live: the conversation, and almost nothing else --------------------- */

export function portalLive() {
  const iv = st.interview();
  if (iv.status === "complete") return portalDone();
  const t = st.interviewTask();
  const lead = st.firmUser(t?.withUserId);
  const turns = st.interviewTurns();
  const last = turns[turns.length - 1];

  return `<div class="pt pt--live">
    <header class="plive__bar">
      <span class="pdot pdot--rec"></span>
      <div class="plive__t">
        <b>Revenue process interview</b>
        <span>${esc(lead ? lead.name : "")} · ${esc(firm.name)}</span>
      </div>
      <span class="sp"></span>
      <span class="plive__clock">${esc(iv.elapsed)}</span>
    </header>

    <div class="plive__topic">
      <span>Now talking about</span><b>${esc(st.interviewTopic())}</b>
    </div>

    <div class="plive__body" id="plive-body">
      <div class="plive__in">
        ${turns.length ? turns.map((x, i) => `
          <div class="${cx("pturn", x.mine && "pturn--me", i === turns.length - 1 && "is-new")}">
            <div class="pturn__w">${esc(x.mine ? "You" : x.who)}</div>
            <div class="pturn__x">${esc(x.text)}</div>
          </div>`).join("")
        : `<p class="pt__note">The conversation will appear here as it happens.</p>`}
        ${st.interviewOver() ? "" : `<div class="pturn__dots"><i></i><i></i><i></i></div>`}
      </div>
    </div>

    <footer class="plive__foot">
      <button class="${cx("pmic", iv.mic === "muted" && "is-off")}" data-act="iv-mic">
        ${icon("people", 17)}${iv.mic === "muted" ? "Microphone off" : "Microphone on"}
      </button>
      <span class="sp"></span>
      ${st.interviewOver()
        ? ""
        : btn("Continue the conversation", "iv-next", { size: "sm", variant: "ghost",
            title: "Prototype: steps through the scripted conversation" })}
      ${btn("Leave interview", "iv-end", { size: "sm" })}
    </footer>
  </div>`;
}

/* --- Done ---------------------------------------------------------------- */

export function portalDone() {
  const me = st.portalContact();
  const fu = st.followUpTask();
  const first = me ? me.name.split(" ")[0] : "";

  const body = `
    <header class="pt__head pt__head--centre">
      <span class="pt__tick">${icon("check", 30)}</span>
      <h1>Interview complete</h1>
      <p class="pt__lede">Thank you${first ? `, ${esc(first)}` : ""}. Your auditor may follow up if
      anything needs clarification.</p>
    </header>
    <div class="pt__acts pt__acts--centre">
      ${btn("Return to your tasks", "nav", { variant: "primary", size: "lg", data: { href: "#/portal" } })}
    </div>
  `;
  return portalShell(body, { narrow: true });
}
