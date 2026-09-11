/* ============================================================================
   The setup layer: clients, engagements and firm people.

   This is the parent of everything else in the product — how a firm gets from
   a new client to an active Revenue interim engagement. It uses the same V3
   surfaces as the workflow, because it is the same product: no admin portal,
   no settings aesthetic, no card soup.

   The one thing this layer exists to keep straight is that firm users, client
   contacts and task-scoped client access are three different objects.
   ========================================================================== */

import { esc, cx, act as btn, row, rows, tag, icon, card, callout, empty, dot } from "../ui.js";
import { AUDIT_ROLES, ACCESS_LEVELS, ENGAGEMENT_TYPES, FRAMEWORKS, COUNTRIES,
         processCatalogue, fyFromPeriodEnd } from "../data-firm.js";
import { firm } from "../data-sources.js";
import * as st from "../state.js";
import { header, breadcrumb } from "./shell.js";

const S = st.S;

/** A setup screen: header with a shallow breadcrumb, no process journey. */
const setupScreen = (crumbs, body, width = "") =>
  `${header(crumbs)}<div class="canvas"><div class="${cx("wrap", width && "wrap--" + width, "page-in")}">${body}</div></div>`;

const crumb = (parts) => `<nav class="crumb" aria-label="Where you are">
  ${parts.map(([label, href, here], i) => `${i ? `<span class="crumb__s">${icon("chevron", 12)}</span>` : ""}
    ${href ? `<button class="${cx("crumb__i", here && "is-here")}" data-act="nav" data-href="${esc(href)}">${esc(label)}</button>`
      : `<span class="crumb__i is-here">${esc(label)}</span>`}`).join("")}
</nav>`;

/* --- Shared form pieces ---------------------------------------------------- */

const field = (id, label, o = {}) => {
  const { type = "text", value = "", placeholder = "", hint = "", options } = o;
  return `<div class="fgroup">
    <label class="t-eyebrow flabel" for="${esc(id)}">${esc(label)}</label>
    ${options
      ? `<select class="field" id="${esc(id)}" data-draft="${esc(id)}">
          ${options.map((op) => {
            const [v, l] = Array.isArray(op) ? op : [op, op];
            return `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`;
          }).join("")}
        </select>`
      : type === "textarea"
      ? `<textarea class="field" id="${esc(id)}" data-draft="${esc(id)}" rows="3"
          placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input class="field" id="${esc(id)}" data-draft="${esc(id)}" type="${esc(type)}"
          value="${esc(value)}" placeholder="${esc(placeholder)}">`}
    ${hint ? `<p class="t-meta sec__note">${esc(hint)}</p>` : ""}
  </div>`;
};

const pair = (a, b) => `<div class="grid2">${a}${b}</div>`;

const engStatus = (e) => {
  if (e.phase === "complete") return tag("completed", "quiet", "check");
  if (e.phase === "interim") return tag("interim in progress", "accent", "process");
  if (e.phase === "final") return tag("final in progress", "accent", "process");
  return tag("planning", "quiet");
};

/* ══ Clients ═════════════════════════════════════════════════════════════ */

export function clientsView() {
  const q = (S.clientQuery || "").toLowerCase();
  const all = st.allClients();
  const shown = all.filter((c) => !q ||
    (c.name + " " + c.city + " " + c.sectorShort).toLowerCase().includes(q));

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Clients</h1>
          <p class="t-lede">${esc(firm.name)} · ${all.length} clients, ${st.allEngagements().length} engagements.</p>
        </div>
        <div class="acts">
          ${btn("New client", "nav", { variant: "primary", ic: "plus", data: { href: "#/client/new" } })}
        </div>
      </div>
    </div>

    <section class="sec">
      <div class="row sec__h">
        <label class="srch" style="width:320px;height:34px" for="client-q">
          ${icon("search", 15)}
          <input id="client-q" class="field" placeholder="Search clients, cities, sectors"
            value="${esc(S.clientQuery || "")}"
            style="border:0;box-shadow:none;background:none;padding:0;font-size:13.5px">
        </label>
        <span class="sp"></span>
        <span class="t-meta">${shown.length} of ${all.length}</span>
      </div>

      ${shown.length ? rows(shown.map((c) => {
        const engs = st.engagementsFor(c.id);
        const live = engs.find((e) => e.phase !== "complete") || engs[0];
        return row({
          lead: icon("process", 17),
          title: `<span class="b">${esc(c.name)}</span>`,
          detail: `${esc(c.city ? c.city + " · " : "")}${esc(c.sectorShort || c.sector)} · ${esc(c.framework)}`,
          side: live
            ? `${engStatus(live)}<div class="t-meta" style="margin-top:4px">${esc(live.fy)} ${esc(live.type.toLowerCase())}</div>`
            : tag("no engagement yet", "warn"),
          action: "open-client", data: { id: c.id },
        });
      }).join(""))
      : empty("No client matches that", "Try a different name, city or sector.", "search")}
    </section>
  `;
  return setupScreen(crumb([["Clients", null, true]]), body, "overview");
}

/* ══ Client detail ═══════════════════════════════════════════════════════ */

export function clientView() {
  const c = st.shownClient();
  if (!c) return clientsView();
  const engs = st.engagementsFor(c.id);
  const adding = S.editing;

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">${esc(c.name)}</h1>
          <p class="t-lede">
            ${esc([c.city, c.country].filter(Boolean).join(", "))} · ${esc(c.sectorShort || c.sector)}
          </p>
        </div>
        <div class="acts">
          ${btn("New engagement", "nav", { variant: "primary", ic: "plus", data: { href: "#/engagement/new" } })}
        </div>
      </div>
    </div>

    <section class="sec">
      ${rows(`
        ${row({ lead: icon("document", 17), title: "Reporting framework",
          side: `<span class="b ink2">${esc(c.framework)}</span>` })}
        ${row({ lead: icon("clock", 17), title: "Financial year-end",
          side: `<span class="b ink2">${esc(c.yearEnd)}</span>` })}
        ${row({ lead: icon("people", 17), title: "Client since",
          side: `<span class="b ink2">${esc(c.since)}</span>` })}
        ${row({ lead: icon("check", 17), title: "Client acceptance",
          detail: "Acceptance and continuance is a separate process, outside this prototype",
          side: c.acceptance === "Completed" ? tag("completed", "ok", "check") : tag(c.acceptance.toLowerCase(), "quiet") })}`)}
    </section>

    <section class="sec--loose">
      <div class="sec__h">
        <h2 class="t-h">Engagements</h2>
        <span class="sp"></span>
        ${btn("New engagement", "nav", { size: "sm", ic: "plus", data: { href: "#/engagement/new" } })}
      </div>
      ${engs.length ? rows(engs.map((e) => row({
        lead: icon("process", 17),
        title: `<span class="b">${esc(e.fy)} ${esc(e.type.toLowerCase())}</span>`,
        detail: `Period end ${esc(e.periodEnd)} · ${esc(e.framework)}${
          e.materiality ? ` · materiality ${esc(e.materiality)}` : ""}`,
        side: `${engStatus(e)}${e.canonical ? `<div class="t-meta" style="margin-top:4px">fully populated</div>` : ""}`,
        action: "open-engagement", data: { id: e.id },
      })).join(""))
      : empty("No engagement yet", "An engagement is created per financial year. It carries the team, the scope and the period.", "process")}
    </section>

    <div class="lay lay--equal sec--loose">
    <section>
      <div class="sec__h">
        <h2 class="t-h">Client contacts</h2>
        <span class="sp"></span>
        ${btn("Add contact", adding === "contact" ? "cancel-edit" : "edit-open",
          { size: "sm", ic: adding === "contact" ? "" : "plus", data: { id: "contact" } })}
      </div>
      <p class="t-sub sec__h measure">
        People at ${esc(c.short)}. They are contacts on the client record — adding one does not
        create an Audit AI account, and never will. Access to a questionnaire is granted per task.</p>

      ${adding === "contact" ? `<div class="s-surface pad sec__note">
        ${pair(field("c-name", "Name", { placeholder: "e.g. Ruud Timmermans" }),
               field("c-role", "Professional role", { placeholder: "e.g. Financial Controller" }))}
        ${pair(field("c-email", "E-mail", { type: "email", placeholder: "name@company.nl",
                 hint: "Only needed if they will receive a questionnaire." }),
               field("c-dept", "Department", { placeholder: "e.g. Finance" }))}
        <div class="acts sec">
          ${btn("Add contact", "save-contact", { variant: "primary", data: { client: c.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
        </div>
      </div>` : ""}

      ${c.contacts.length ? rows(c.contacts.map((p) => adding === `contact:${p.id}`
        ? `<div class="s-surface pad">
            <div class="t-eyebrow rail__h">Edit ${esc(p.name)} <span class="mono t-meta">${esc(p.id)}</span></div>
            ${pair(field("ce-name", "Name", { value: p.name }),
                   field("ce-role", "Professional role", { value: p.role }))}
            ${pair(field("ce-email", "E-mail", { type: "email", value: p.email || "" }),
                   field("ce-dept", "Department", { value: p.department || "" }))}
            <div class="acts sec">
              ${btn("Save", "save-contact-edit", { variant: "primary", data: { client: c.id, id: p.id } })}
              ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
            </div>
            <p class="t-meta sec__note measure">The same record is updated. Everywhere this person is
            referenced — process participants, the questionnaire recipient — follows automatically.</p>
          </div>`
        : row({
            lead: icon("people", 17),
            title: `<span class="b">${esc(p.name)}</span>`,
            detail: `${esc(p.role)}${p.email ? ` · ${esc(p.email)}` : ""}${p.department ? ` · ${esc(p.department)}` : ""}`,
            side: `${tag("client contact", "quiet")}
              ${btn("Edit", "edit-open", { variant: "ghost", size: "sm", data: { id: `contact:${p.id}` } })}`,
          })).join(""))
      : empty("No contacts yet", "Add the people you expect to speak to.", "people")}
    </section>

    <section>
      <div class="sec__h">
        <h2 class="t-h">Systems</h2>
        <span class="sp"></span>
        ${btn("Add system", adding === "system" ? "cancel-edit" : "edit-open",
          { size: "sm", ic: adding === "system" ? "" : "plus", data: { id: "system" } })}
      </div>
      <p class="t-sub sec__h measure">
        The applications the entity runs. Each process selects the ones relevant to it.</p>

      ${adding === "system" ? `<div class="s-surface pad sec__note">
        ${pair(field("s-name", "System", { placeholder: "e.g. Microsoft Dynamics 365 Business Central" }),
               field("s-owner", "Owner", { placeholder: "e.g. P. Halsema" }))}
        ${field("s-role", "What it is used for", { placeholder: "e.g. Quotation, order, shipment, invoice, general ledger" })}
        <div class="acts sec">
          ${btn("Add system", "save-system", { variant: "primary", data: { client: c.id } })}
          ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
        </div>
      </div>` : ""}

      ${c.systems.length ? rows(c.systems.map((x) => adding === `system:${x.id}`
        ? `<div class="s-surface pad">
            <div class="t-eyebrow rail__h">Edit ${esc(x.name)} <span class="mono t-meta">${esc(x.id)}</span></div>
            ${pair(field("se-name", "System", { value: x.name }),
                   field("se-owner", "Owner", { value: x.owner || "" }))}
            ${field("se-role", "What it is used for", { value: x.role || "" })}
            ${field("se-note", "Note", { value: x.note || "",
              placeholder: "e.g. outsourced since March 2026 — service organisation" })}
            <div class="acts sec">
              ${btn("Save", "save-system-edit", { variant: "primary", data: { client: c.id, id: x.id } })}
              ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
            </div>
            <p class="t-meta sec__note measure">The same record is updated. Any process that has
            selected this system shows the new information.</p>
          </div>`
        : row({
            lead: icon("system", 17),
            title: `<span class="b">${esc(x.name)}</span>`,
            detail: `${esc(x.role)}${x.owner ? ` · ${esc(x.owner)}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}`,
            side: btn("Edit", "edit-open", { variant: "ghost", size: "sm", data: { id: `system:${x.id}` } }),
          })).join(""))
      : empty("No systems yet", "Add the applications the entity runs.", "system")}
    </section>
    </div>
  `;

  return setupScreen(crumb([["Clients", "#/clients"], [c.short, null, true]]), body, "overview");
}

/* ══ New client ══════════════════════════════════════════════════════════ */

export function newClientView() {
  const d = S.draft;
  const ok = (d.name || "").trim().length > 1;

  const body = `
    <div class="head">
      ${btn("Clients", "nav", { variant: "ghost", size: "sm", ic: "back", data: { href: "#/clients" } })}
      <h1 class="t-display" style="margin-top:10px">New client</h1>
      <p class="t-lede">
        A client profile, not an engagement and not an acceptance decision. The financial year, the
        team and the scope come next, on the engagement.
      </p>
    </div>

    <section class="sec">
      <div class="sec__h"><h2 class="t-eyebrow">Company</h2></div>
      ${field("name", "Legal name", { value: d.name || "", placeholder: "e.g. Example Manufacturing B.V." })}
      ${pair(field("short", "Short name", { value: d.short || "",
               placeholder: "Derived from the legal name if left blank",
               hint: "Used in the breadcrumb and lists." }),
             field("sector", "Industry or sector", { value: d.sector || "",
               placeholder: "e.g. Manufacturing — precision components" }))}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Location</h2></div>
      ${pair(field("country", "Country", { value: d.country || "Netherlands", options: COUNTRIES }),
             field("city", "City", { value: d.city || "", placeholder: "Optional" }))}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Reporting</h2></div>
      ${pair(field("framework", "Reporting framework", { value: d.framework || "Dutch GAAP", options: FRAMEWORKS }),
             field("yearEnd", "Default financial year-end", { value: d.yearEnd || "31 December",
               placeholder: "e.g. 31 December",
               hint: "Defaults the period end on every engagement." }))}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">First contact — optional</h2></div>
      <p class="t-sub sec__h measure">
        Somebody at the entity. A contact is not an Audit AI account.</p>
      ${pair(field("contactName", "Name", { value: d.contactName || "", placeholder: "Optional" }),
             field("contactRole", "Professional role", { value: d.contactRole || "", placeholder: "e.g. Financial Controller" }))}
      ${field("contactEmail", "E-mail", { type: "email", value: d.contactEmail || "", placeholder: "Optional" })}
    </section>

    <section class="sec--loose">
      <div class="sec__h"><h2 class="t-eyebrow">Primary system — optional</h2></div>
      ${pair(field("systemName", "System", { value: d.systemName || "", placeholder: "e.g. Exact Online" }),
             field("systemRole", "What it is used for", { value: d.systemRole || "",
               placeholder: "e.g. Financial administration" }))}
    </section>

    <hr class="rule">
    <section class="sec">
      <div class="acts">
        ${btn("Create client", "create-client", { variant: "primary", size: "lg", disabled: !ok })}
        ${btn("Cancel", "nav", { variant: "ghost", data: { href: "#/clients" } })}
      </div>
      ${!ok ? `<p class="t-meta sec__note">A legal name is required. Everything else can be added later.</p>` : ""}
    </section>
  `;
  return setupScreen(crumb([["Clients", "#/clients"], ["New client", null, true]]), body, "form");
}

/* ══ New engagement ══════════════════════════════════════════════════════
   Three short stages, because engagement / team / scope are three different
   decisions — not because a wizard is good.
   ═══════════════════════════════════════════════════════════════════════ */

const STAGES = [
  { n: 1, name: "Engagement", ic: "process" },
  { n: 2, name: "Audit team", ic: "people" },
  { n: 3, name: "Interim scope", ic: "map" },
];

export function newEngagementView() {
  const c = st.shownClient();
  if (!c) return clientsView();
  const d = S.draft;
  const stage = d.stage || 1;
  // Seed the defaults into the draft, so what is shown and what is stored are
  // the same thing — a default nobody edits still has to be saved.
  if (d.team === undefined) S.draft.team = [st.me().id];
  if (d.teamRoles === undefined) S.draft.teamRoles = { [st.me().id]: st.me().role };
  if (d.processes === undefined) S.draft.processes = ["revenue"];
  const team = S.draft.team;
  const teamRoles = S.draft.teamRoles;
  const procs = S.draft.processes;
  const periodEnd = d.periodEnd !== undefined ? d.periodEnd : `${c.yearEnd} ${new Date().getFullYear() + 1}`;
  const fy = d.fy !== undefined ? d.fy : fyFromPeriodEnd(periodEnd);
  // Seed the draft from the defaults so validity is known before anyone types.
  if (d.periodEnd === undefined) { S.draft.periodEnd = periodEnd; S.draft.fy = fy; }

  const okStage1 = !!fy && !!periodEnd;
  /* The firm role is who they are at the firm; the engagement role is what
     they are responsible for HERE. The file needs a preparer and a reviewer,
     so that gate reads the engagement role. */
  const firmRoleOf = (id) => st.firmUser(id)?.role || "";
  const engRoleOf = (id) => teamRoles[id] || firmRoleOf(id);
  const hasSenior = team.some((id) => ["Manager", "Senior"].includes(engRoleOf(id)));

  const stageNav = `<div class="ribbon sec__h">
    ${STAGES.map((x, i) => `<div class="${cx("rbn", x.n < stage && "is-ok", x.n === stage && "is-now")}">
      <span class="rbn__top">${i ? `<span class="rbn__ln"></span>` : ""}
        <span class="rbn__m">${x.n < stage ? icon("check", 11) : ""}</span>
        <span class="rbn__n">${esc(x.name)}</span></span>
      <span class="rbn__c">${x.n < stage ? "done" : x.n === stage ? "now" : ""}</span>
    </div>`).join("")}
  </div>`;

  const body = `
    <div class="head">
      ${btn(c.short, "nav", { variant: "ghost", size: "sm", ic: "back", data: { href: "#/client" } })}
      <h1 class="t-display" style="margin-top:10px">New engagement</h1>
      <p class="t-lede">${esc(c.name)} — one engagement per financial year. It carries the period,
        the team and which processes are in scope for interim.</p>
    </div>

    ${stageNav}

    ${stage === 1 ? `
      <section class="sec">
        <div class="sec__h"><h2 class="t-eyebrow">Engagement details</h2></div>
        ${pair(field("fy", "Financial year", { value: fy, placeholder: "e.g. FY2027",
                 hint: "Derived from the period end. Override if the year is labelled differently." }),
               field("periodEnd", "Period end", { value: periodEnd, placeholder: "e.g. 31 December 2027",
                 hint: `Defaulted from ${esc(c.short)}'s year-end.` }))}
        ${pair(field("type", "Engagement type", { value: d.type || "Statutory audit", options: ENGAGEMENT_TYPES }),
               field("framework", "Reporting framework", { value: d.framework || c.framework, options: FRAMEWORKS,
                 hint: `Defaulted from the client profile.` }))}
        ${field("materiality", "Materiality — optional", { value: d.materiality || "",
          placeholder: "e.g. EUR 1,250,000",
          hint: "Engagement context. It does not drive the interim process work and no sampling depends on it." })}
        <div class="acts sec">
          ${btn("Continue to the team", "eng-stage", { variant: "primary", data: { n: 2 }, disabled: !okStage1, ic: "arrow" })}
          ${btn("Cancel", "nav", { variant: "ghost", data: { href: "#/client" } })}
        </div>
      </section>`
    : stage === 2 ? `
      <section class="sec">
        <div class="sec__h">
          <h2 class="t-eyebrow">Audit team</h2>
          <span class="sp"></span>
          ${btn("Firm people", "nav", { variant: "ghost", size: "sm", data: { href: "#/people" } })}
        </div>
        <p class="t-sub sec__h measure">
          Colleagues from firm people. The engagement references them, so nothing is copied — and
          the role someone carries <b class="ink2">on this engagement</b> is set here, defaulted
          from their firm role and independent of it from then on.</p>
        ${rows(st.firmUsers().map((u) => {
          const on = team.includes(u.id);
          return row({
            mod: on ? "attn" : "",
            lead: icon(on ? "check" : "people", 17),
            title: `<span class="${on ? "b" : "b ink3"}">${esc(u.name)}</span>${
              u.isMe ? ` <span class="t-meta">you</span>` : ""}`,
            detail: `Firm role <b class="ink2">${esc(u.role)}</b> · ${esc(u.access)} · ${esc(u.email)}`,
            side: `${on ? `<label class="t-meta nowrap" for="er-${esc(u.id)}"
                style="display:block;margin-bottom:3px">Engagement role</label>
              <select class="field" id="er-${esc(u.id)}" data-eng-role="${esc(u.id)}" style="width:150px">
                ${AUDIT_ROLES.map((r) => `<option${r === engRoleOf(u.id) ? " selected" : ""}>${esc(r)}</option>`).join("")}
              </select>` : ""}
              ${btn(on ? "Remove" : "Add", "eng-team",
                { variant: on ? "ghost" : "", size: "sm", data: { id: u.id } })}`,
          });
        }).join(""))}
        <p class="t-meta sec__note measure">
          Changing someone's engagement role here does not change their firm role, and a firm-level
          change later does not rewrite an engagement already created.</p>
        ${!hasSenior ? `<div class="sec__note">${callout(`<b>No manager or senior assigned.</b>
          The file can be created, but somebody has to prepare and review it.`, "warn")}</div>` : ""}
        <div class="acts sec">
          ${btn("Continue to scope", "eng-stage", { variant: "primary", data: { n: 3 }, ic: "arrow" })}
          ${btn("Back", "eng-stage", { variant: "ghost", data: { n: 1 }, ic: "back" })}
        </div>
      </section>`
    : `
      <section class="sec">
        <div class="sec__h"><h2 class="t-eyebrow">Interim scope</h2></div>
        <p class="t-sub sec__h measure">
          Which business processes are carried through the interim workflow. Each one runs the seven
          steps independently.</p>
        <div class="cards cards--2">
          ${processCatalogue.map((p) => {
            const on = procs.includes(p.id);
            return `<button class="${cx("card", on && "card--accent")}"
                data-act="eng-proc" data-id="${esc(p.id)}">
              <span class="card__hd">
                <span class="rw__lead">${icon(on ? "check" : "process", 18)}</span>
                <span class="sp">
                  <span class="card__t">${esc(p.name)}</span>
                  <span class="card__d">${esc(p.blurb)}</span>
                </span>
                ${p.workflow ? tag("methodology pack", "ok") : tag("no pack yet", "quiet")}
              </span>
            </button>`;
          }).join("")}
        </div>
        <p class="t-meta sec__note measure">
          Only Revenue has a methodology pack in the prototype. The others can be put in scope and
          will show as not started — the prototype does not pretend to run them.</p>
        ${!procs.length ? `<div class="sec__note">${callout(
          `<b>Nothing in scope.</b> Select at least one process.`, "warn")}</div>` : ""}
        <div class="acts sec">
          ${btn("Create engagement", "create-engagement", { variant: "primary", size: "lg",
            data: { client: c.id }, disabled: !procs.length })}
          ${btn("Back", "eng-stage", { variant: "ghost", data: { n: 2 }, ic: "back" })}
        </div>
      </section>`}
  `;

  return setupScreen(crumb([["Clients", "#/clients"], [c.short, "#/client"],
                            ["New engagement", null, true]]), body, "form");
}

/* ══ Firm people ═════════════════════════════════════════════════════════ */

export function peopleView() {
  const users = st.firmUsers();
  const inviting = S.editing === "invite";
  const d = S.draft;

  const body = `
    <div class="head">
      <div class="head__row">
        <div>
          <h1 class="t-display">Firm people</h1>
          <p class="t-lede">
            Colleagues at ${esc(firm.name)} who use Audit AI, with their firm role and their access
            level. Client contacts are not listed here — they live on the client record and never
            become accounts.
          </p>
        </div>
        <div class="acts">
          ${btn("Invite colleague", inviting ? "cancel-edit" : "edit-open",
            { variant: inviting ? "ghost" : "primary", ic: inviting ? "" : "plus", data: { id: "invite" } })}
        </div>
      </div>
    </div>

    ${inviting ? `<section class="sec"><div class="s-surface pad-l">
      <div class="sec__h"><h2 class="t-eyebrow">Invite a colleague</h2></div>
      ${pair(field("i-name", "Name", { placeholder: "e.g. Milan Jansen" }),
             field("i-email", "Work e-mail", { type: "email", placeholder: "name@kuyperbergman.nl" }))}
      ${pair(field("i-role", "Firm role", { value: d["i-role"] || "Assistant", options: AUDIT_ROLES,
               hint: "Their grade at the firm. It defaults their role on a new engagement." }),
             field("i-access", "Access level", { value: d["i-access"] || "Member", options: ACCESS_LEVELS,
               hint: "What they can do in the software. A different thing." }))}
      <div class="acts sec">
        ${btn("Add colleague", "save-colleague", { variant: "primary" })}
        ${btn("Cancel", "cancel-edit", { variant: "ghost" })}
      </div>
      <p class="t-meta sec__note measure">
        This creates a record in the prototype. No invitation is sent, no account is created and no
        password is set — authentication is deliberately not built.</p>
    </div></section>` : ""}

    <section class="sec">
      ${rows(users.map((u) => row({
        lead: icon("people", 17),
        title: `<span class="b">${esc(u.name)}</span>${u.isMe ? ` <span class="t-meta">you</span>` : ""}`,
        detail: `${esc(u.email)}${u.joined ? ` · since ${esc(u.joined)}` : ""}`,
        side: `${tag(u.role, "quiet")} ${u.access === "Admin" ? tag("Admin", "accent") : tag("Member", "quiet")}${
          u.pending ? `<div class="t-meta" style="margin-top:4px">added in this session</div>` : ""}`,
      })).join(""))}
      <p class="t-meta sec__note measure">
        <b class="ink2">Firm role</b> and <b class="ink2">access level</b> are separate on purpose.
        A partner is not automatically an administrator, and an administrator is not automatically
        a reviewer. A third thing is separate again: the <b class="ink2">engagement role</b> — what
        somebody is responsible for on one file. It is set on the engagement, defaults from the firm
        role, and changing it there never rewrites anything here.</p>
    </section>

    <section class="sec--loose">
      ${callout(`<b>Not built, deliberately.</b> Authentication, invitations by e-mail, SSO,
        Entra ID, MFA and provisioning are all out of scope for the prototype. What you see here is
        session state.`)}
    </section>
  `;
  return setupScreen(crumb([["Firm people", null, true]]), body, "form");
}
