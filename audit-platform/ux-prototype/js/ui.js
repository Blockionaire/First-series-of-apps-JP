/* ============================================================================
   ui.js — V3 primitives.

   Small on purpose. Everything here maps to a class in app.css; nothing here
   carries its own inline styling, so a design change happens in one file.
   ========================================================================== */

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const cx = (...xs) => xs.filter(Boolean).join(" ");
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

const attrs = (d = {}) => Object.entries(d)
  .filter(([, v]) => v !== undefined && v !== null)
  .map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");

/* --- Icons ------------------------------------------------------------------
   One family: 1.5px stroke on a 20px grid, round caps, no fill, currentColor.
   Icons mark object type. They never decorate, and there is no sparkle.
   -------------------------------------------------------------------------- */

const P = {
  /* sources and evidence */
  transcript: 'M4 4h12v9H8l-4 3.5V4z M7 7.5h6 M7 10h4',
  document:   'M5 2.5h6l4 4V17.5H5z M11 2.5v4h4',
  questionnaire: 'M5 2.5h10v15H5z M8 6.5h4 M8 10h4 M8 13.5h2',
  note:       'M4.5 3.5h11v13h-11z M7.5 7h5 M7.5 10.5h5 M7.5 14h3',
  evidence:   'M3 6.5l7-3.5 7 3.5v7L10 17l-7-3.5z M3 6.5L10 10l7-3.5 M10 10v7',
  quote:      'M6 5.5C4.3 6.6 3.5 8 3.5 9.8c0 1.6 1 2.7 2.4 2.7 1.3 0 2.2-.9 2.2-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.6.1.2-.9.8-1.7 1.8-2.4z M14 5.5c-1.7 1.1-2.5 2.5-2.5 4.3 0 1.6 1 2.7 2.4 2.7 1.3 0 2.2-.9 2.2-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.6.1.2-.9.8-1.7 1.8-2.4z',

  /* audit objects */
  contradiction: 'M10 2.5L2.5 16h15z M10 8v3.5 M10 13.8v.2',
  question:   'M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15z M8 7.8a2.1 2.1 0 113 1.9c-.6.4-1 .9-1 1.6v.3 M10 14v.2',
  finding:    'M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z M10 6v4.8 M10 13.4v.2',
  control:    'M10 2.5l6 2.6v4.6c0 3.4-2.4 6.1-6 7.8-3.6-1.7-6-4.4-6-7.8V5.1z M7.4 10l1.9 1.9 3.4-3.6',
  walkthrough:'M3 15.5h3.4l3.6-11h3.5 M13.5 4.5l-1.6-1.7 M13.5 4.5l-1.6 1.7 M3 15.5l1.7-1.6 M3 15.5l1.7 1.7',
  test:       'M8 2.5v5.2L4 15a1.6 1.6 0 001.4 2.5h9.2A1.6 1.6 0 0016 15l-4-7.3V2.5z M7 2.5h6 M6.1 11.5h7.8',
  reviewpoint:'M17 12.3a1.7 1.7 0 01-1.7 1.7H6.7L3 17.5V4.2a1.7 1.7 0 011.7-1.7h10.6A1.7 1.7 0 0117 4.2z M10 6v3 M10 11.2v.2',
  signature:  'M2.5 14.5c2.4 0 3-2.1 3.8-5.4C7 6.4 7.6 4.2 9 4.2c1.1 0 1.4 1 1.4 2.2 0 2.5-2 4-2 6 0 .9.5 1.5 1.3 1.5 1.6 0 2.6-2 4.2-2 .9 0 1.4.5 1.6 1.1 M2.5 17.5h15',
  variant:    'M4 4.5v3.2a2 2 0 002 2h8a2 2 0 012 2v3.8 M4 4.5h0 M16 15.5l-2.2-2.2 M16 15.5l-2.2 2.2 M4 10.5v5',
  map:        'M2.5 5.5l5-2 5 2 5-2v11l-5 2-5-2-5 2z M7.5 3.5v11 M12.5 5.5v11',
  step:       'M3.5 6.5h9l2.5 3.5-2.5 3.5h-9z',
  gate:       'M3.5 8.5h13v9h-13z M6.5 8.5V6a3.5 3.5 0 017 0v2.5 M10 12v2',
  process:    'M3 5.5h5v4H3z M12 5.5h5v4h-5z M3 13.5h5v4H3z M8 7.5h4 M5.5 9.5v4',

  /* interface */
  search:     'M9 15.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z M17.5 17.5l-3.9-3.9',
  check:      'M4 10.5l4 4 8-9',
  chevron:    'M7.5 4.5l5 5.5-5 5.5',
  back:       'M12.5 4.5l-5 5.5 5 5.5',
  down:       'M4.5 7.5l5.5 5 5.5-5',
  arrow:      'M3.5 10h13 M11.5 5l5 5-5 5',
  plus:       'M10 4v12 M4 10h12',
  undo:       'M7 7.5H3.5v-3.5 M4.2 7.9a6.5 6.5 0 11-.7 4.3',
  keyboard:   'M2.5 5.5h15v9h-15z M5.5 8.5h.2 M8.5 8.5h.2 M11.5 8.5h.2 M14.5 8.5h.2 M6.5 11.5h7',
  user:       'M10 10a3.2 3.2 0 100-6.4A3.2 3.2 0 0010 10z M3.8 17.5a6.4 6.4 0 0112.4 0',
  clock:      'M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15z M10 6v4.3l2.8 1.7',
  filter:     'M3 5h14l-5.5 6v5.5l-3-1.7V11z',
  link:       'M8.4 11.6a3.2 3.2 0 004.7.3l2.4-2.4a3.2 3.2 0 10-4.5-4.5l-1.3 1.3 M11.6 8.4a3.2 3.2 0 00-4.7-.3l-2.4 2.4a3.2 3.2 0 104.5 4.5l1.3-1.3',
  people:     'M7.4 9.6a3 3 0 100-6 3 3 0 000 6z M2 16.5a5.4 5.4 0 0110.8 0 M13.2 4.2a3 3 0 010 5.8 M14 12.2a5.4 5.4 0 014 4.3',
  system:     'M2.5 4.5h15v8h-15z M7 16.5h6 M10 12.5v4',
  spark:      'M10 2.5v3 M10 14.5v3 M2.5 10h3 M14.5 10h3 M5 5l2 2 M13 13l2 2 M15 5l-2 2 M7 13l-2 2',
};

/**
 * An icon. `size` is the rendered box; the grid is always 20.
 * Icons inherit colour, so they take on state colour without extra rules.
 */
export function icon(name, size = 16, o = {}) {
  const d = P[name];
  if (!d) return "";
  const { cls = "", title = "" } = o;
  return `<svg class="${esc(cls)}" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="${title ? "false" : "true"}"${title ? ` role="img"` : ""}>${
    title ? `<title>${esc(title)}</title>` : ""}${
    d.split(" M").map((seg, i) => `<path d="${i ? "M" + seg : seg}"/>`).join("")}</svg>`;
}

/* --- Buttons ----------------------------------------------------------------
   One primary per screen region. The component owns height, focus ring and the
   shortcut chip so no caller has to remember them.
   -------------------------------------------------------------------------- */
export function act(label, action, o = {}) {
  const { variant = "", size = "", disabled = false, data = {}, key = "",
          title = "", ic = "", wide = false } = o;
  const V = { go: "primary", primary: "primary", ok: "ok", danger: "danger",
              plain: "ghost", ghost: "ghost" }[variant] || variant;
  return `<button class="${cx("btn", V && "btn--" + V, size && "btn--" + size, wide && "btn--wide")}"
    ${action ? `data-act="${esc(action)}"` : ""}${attrs(data)}${disabled ? " disabled" : ""}
    ${title ? `title="${esc(title)}"` : ""}>${ic ? icon(ic, size === "sm" ? 14 : 16) : ""}${
    esc(label)}${key ? `<span class="k">${esc(key)}</span>` : ""}</button>`;
}

export const link = (label, action, data = {}, ic = "") =>
  `<button class="lnk" data-act="${esc(action)}"${attrs(data)}>${esc(label)}${
    ic ? icon(ic, 14) : ""}</button>`;

/* --- Status -----------------------------------------------------------------
   Never colour alone: every state carries a word, and most carry a shape too.
   -------------------------------------------------------------------------- */
export const STATE = {
  draft:         { w: "Draft",         d: "" },
  clean:         { w: "Traced",        d: "ok" },
  needs_source:  { w: "Needs support", d: "warn" },
  contradiction: { w: "Contradictory", d: "alert" },
  absent:        { w: "Not obtained",  d: "open" },
  edited:        { w: "Edited",        d: "" },
  approved:      { w: "Approved",      d: "ok" },
  rejected:      { w: "Rejected",      d: "" },
};

export function state(key, label) {
  const s = STATE[key] || STATE.draft;
  const tone = ["ok", "warn", "alert"].includes(s.d) ? s.d : "";
  return `<span class="${cx("state", tone && "state--" + tone)}">
    <i class="${cx("dot", s.d && "dot--" + s.d)}"></i>${esc(label ?? s.w)}</span>`;
}

export const dot = (tone = "") => `<i class="${cx("dot", tone && "dot--" + tone)}"></i>`;

export const tag = (text, tone = "", ic = "") =>
  `<span class="${cx("tag", tone && "tag--" + tone)}">${ic ? icon(ic, 12) : ""}${esc(text)}</span>`;

export const chip = (text, tone = "") =>
  `<span class="${cx("chip", tone && "chip--" + tone)}">${esc(text)}</span>`;

/* --- Rows and cards ---------------------------------------------------------
   A row enumerates. A card is a thing you might act on.
   -------------------------------------------------------------------------- */
export function row({ lead = "", title, detail = "", side = "", action, data = {}, mod = "" }) {
  const tag_ = action ? "button" : "div";
  return `<${tag_} class="${cx("rw", mod && "rw--" + mod, !action && "is-hot")}"
    ${action ? `data-act="${esc(action)}"` : ""}${attrs(data)}>
    ${lead ? `<span class="rw__lead">${lead}</span>` : ""}
    <span class="rw__main">
      <span class="rw__t">${title}</span>
      ${detail ? `<span class="rw__d">${detail}</span>` : ""}
    </span>
    ${side ? `<span class="rw__side">${side}</span>` : ""}
  </${tag_}>`;
}

export const rows = (html) => `<div class="rows">${html}</div>`;

export function card({ title, detail = "", side = "", body = "", foot = "",
                       mod = "", action, data = {}, lead = "" }) {
  const t = action ? "button" : "div";
  return `<${t} class="${cx("card", mod && "card--" + mod, !action && "card--hot")}"
    ${action ? `data-act="${esc(action)}"` : ""}${attrs(data)}>
    ${title ? `<span class="card__hd">
      ${lead ? `<span class="rw__lead">${lead}</span>` : ""}
      <span class="sp"><span class="card__t">${title}</span>
      ${detail ? `<span class="card__d">${detail}</span>` : ""}</span>
      ${side ? `<span class="rw__side">${side}</span>` : ""}
    </span>` : ""}
    ${body}
    ${foot ? `<span class="card__ft">${foot}</span>` : ""}
  </${t}>`;
}

/* --- The next action: the loudest thing on any overview -------------------- */
export const nextAction = (n, eyebrow = "Start here") => `
  <button class="next" data-act="nav" data-href="${esc(n.href)}">
    <span class="next__m">
      <span class="next__e">${icon("arrow", 15)}<span class="t-eyebrow">${esc(eyebrow)}</span></span>
      <span class="next__t">${esc(n.t)}</span>
      <span class="next__d">${esc(n.d)}</span>
    </span>
    <span class="next__go">${icon("chevron", 18)}</span>
  </button>`;

/* --- Progressive disclosure ------------------------------------------------ */
export function more(id, label, body, open) {
  return `<div class="${cx("more", open && "is-open")}">
    <button class="more__t" data-act="disclose" data-id="${esc(id)}">
      <span class="cv">${icon("chevron", 13)}</span>${esc(open ? label.replace(/^Show/, "Hide") : label)}</button>
    ${open ? `<div class="more__body">${body}</div>` : ""}
  </div>`;
}

export const bar = (parts) => {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return `<div class="bar">${parts.map((p) =>
    `<i class="f-${p.k}" style="width:${(p.n / total) * 100}%"></i>`).join("")}</div>`;
};

export const empty = (t, d = "", ic = "document") =>
  `<div class="empty"><span class="empty__ic">${icon(ic, 30)}</span>
    <div class="empty__t">${esc(t)}</div>
    ${d ? `<div class="empty__d">${esc(d)}</div>` : ""}</div>`;

export const callout = (html, mod = "") =>
  `<div class="${cx("callout", mod && "callout--" + mod)}">${html}</div>`;

/* --- Source Lens ------------------------------------------------------------
   The recessed surface. A claim rises; what supports it sits underneath, and
   the exact supporting words are marked inside the quote.
   -------------------------------------------------------------------------- */

const SRC_ICON = { transcript: "transcript", client_answer: "questionnaire",
                   prior_year: "document", access_log: "system",
                   assurance_report: "document", auditor_note: "note" };

/** Mark `phrase` inside `quote`, matched case-insensitively, once. */
function markPhrase(quote, phrase) {
  if (!phrase) return esc(quote);
  const i = quote.toLowerCase().indexOf(String(phrase).toLowerCase());
  if (i < 0) return esc(quote);
  return esc(quote.slice(0, i)) + "<mark>" + esc(quote.slice(i, i + phrase.length)) +
         "</mark>" + esc(quote.slice(i + phrase.length));
}

export function evidence(refs, o = {}) {
  const { footer = "", none = "" } = o;
  if (!refs.length && none) return `<div class="lens"><div class="lens__in">
    <p class="lens__none">${none}</p>${footer ? `<div class="lens__ft">${footer}</div>` : ""}</div></div>`;
  return `<div class="lens"><div class="lens__in">
    ${refs.map((r) => `<div class="${cx("src", r.tone && "src--" + r.tone)}">
      <div class="src__hd">
        <span class="src__ic">${icon(SRC_ICON[r.kind] || "document", 15)}</span>
        <span class="src__who">${esc(r.speaker || r.sourceName)}</span>
        <span class="src__meta">${esc(r.speaker ? r.sourceName + " · " + r.locator : r.locator)}</span>
      </div>
      ${r.question ? `<div class="src__ask">Asked: ${esc(r.question)}</div>` : ""}
      <div class="src__q">&ldquo;${markPhrase(r.quote, r.mark)}&rdquo;</div>
    </div>`).join("")}
    ${footer ? `<div class="lens__ft">${footer}</div>` : ""}
  </div></div>`;
}

/* --- Dependency view --------------------------------------------------------
   What this is holding up, as a fan-out. Not a graph.
   -------------------------------------------------------------------------- */
export const dependencies = (items, head = "This is blocking", clearing = false) => !items.length ? "" : `
  <div class="${cx("dep", clearing && "dep--clearing")}">
    <div class="dep__h">${esc(head)}</div>
    ${items.map((i) => `<div class="${cx("dep__i", i.clear && "is-clear")}">
      ${icon(i.icon || "step", 15)}
      <span>${esc(i.name)}</span>
      <span class="t-meta">${esc(i.state)}</span>
    </div>`).join("")}
  </div>`;
