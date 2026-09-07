/* ============================================================================
   ui.js — primitives for the second iteration.

   Deliberately small. There is no panel(), no metric(), no table() and no
   status pill, because none of those exist in the design system any more.
   ========================================================================== */

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const cx = (...xs) => xs.filter(Boolean).join(" ");
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

/** data-* attribute string from an object. */
const attrs = (d = {}) => Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");

/* --- Action ---------------------------------------------------------------
   Quiet by default. `go` is the single dark primary; `ok` only for approving.
   `key` renders the shortcut inside the button, which is how the keyboard
   model teaches itself.
   -------------------------------------------------------------------------- */
export function act(label, action, o = {}) {
  const { variant = "", size = "", disabled = false, data = {}, key = "", title = "" } = o;
  return `<button class="${cx("b-act", variant && "b-act--" + variant, size && "b-act--" + size)}"
    ${action ? `data-act="${esc(action)}"` : ""}${attrs(data)}${disabled ? " disabled" : ""}
    ${title ? `title="${esc(title)}"` : ""}>${esc(label)}${key ? `<span class="k">${esc(key)}</span>` : ""}</button>`;
}

export const link = (label, action, data = {}) =>
  `<button class="b-link" data-act="${esc(action)}"${attrs(data)}>${esc(label)}</button>`;

/* --- Status: a dot and a word ---------------------------------------------
   Seven audit states survive from v1; only their rendering changed. The word
   never contains "AI".
   -------------------------------------------------------------------------- */
export const STATE = {
  draft:         { w: "Draft",        d: "" },
  clean:         { w: "Traced",       d: "ok" },
  needs_source:  { w: "Needs support", d: "warn" },
  contradiction: { w: "Contradictory", d: "alert" },
  absent:        { w: "Not obtained",  d: "open" },
  edited:        { w: "Edited",        d: "" },
  approved:      { w: "Approved",      d: "ok" },
  rejected:      { w: "Rejected",      d: "" },
};

export function state(key, label) {
  const s = STATE[key] || STATE.draft;
  const tone = s.d === "ok" ? "ok" : s.d === "warn" ? "warn" : s.d === "alert" ? "alert" : "";
  return `<span class="${cx("state", tone && "state--" + tone)}">
    <i class="${cx("dot", s.d && "dot--" + s.d)}"></i>${esc(label ?? s.w)}</span>`;
}

export const dot = (tone = "") => `<i class="${cx("dot", tone && "dot--" + tone)}"></i>`;

/* --- List row -------------------------------------------------------------- */
export function row({ lead = "", title, detail = "", side = "", action, data = {}, mod = "" }) {
  const tag = action ? "button" : "div";
  return `<${tag} class="${cx("rw", mod && "rw--" + mod, !action && "is-hot")}"
    ${action ? `data-act="${esc(action)}"` : ""}${attrs(data)}>
    ${lead ? `<span class="rw__lead">${lead}</span>` : ""}
    <span class="rw__main">
      <span class="rw__t">${title}</span>
      ${detail ? `<span class="rw__d">${detail}</span>` : ""}
    </span>
    ${side ? `<span class="rw__side">${side}</span>` : ""}
  </${tag}>`;
}

export const chip = (text, tone = "") =>
  `<span class="${cx("chip", tone && "chip--" + tone)}">${esc(text)}</span>`;

/* --- Progressive disclosure -----------------------------------------------
   The single mechanism by which methodology depth is available without being
   in the way.
   -------------------------------------------------------------------------- */
export function more(id, label, body, open) {
  return `<div class="${cx("more", open && "is-open")}">
    <button class="more__t" data-act="disclose" data-id="${esc(id)}">
      <span class="cv">›</span>${esc(open ? label.replace(/^Show/, "Hide") : label)}</button>
    ${open ? `<div class="more__body">${body}</div>` : ""}
  </div>`;
}

export const bar = (parts) => {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return `<div class="bar">${parts.map((p) =>
    `<i class="f-${p.k}" style="width:${(p.n / total) * 100}%"></i>`).join("")}</div>`;
};

export const empty = (t, d = "") =>
  `<div class="empty"><div class="empty__t">${esc(t)}</div>${d ? `<div class="empty__d">${esc(d)}</div>` : ""}</div>`;

export const callout = (html, mod = "") =>
  `<div class="${cx("callout", mod && "callout--" + mod)}">${html}</div>`;

/* --- Evidence, rendered inline beneath a claim ---------------------------- */
export function evidence(refs, o = {}) {
  const { footer = "" } = o;
  return `<div class="ev"><div class="ev__in">
    ${refs.map((r) => `<div class="ev__src">
      ${r.speaker ? `<div class="ev__who">${esc(r.speaker)}</div>` : `<div class="ev__who">${esc(r.sourceName)}</div>`}
      <div class="ev__meta">${esc(r.speaker ? r.sourceName + " · " + r.locator : r.locator)}</div>
      ${r.question ? `<div class="ev__meta" style="font-family:var(--sans);font-size:12.5px">Asked: ${esc(r.question)}</div>` : ""}
      <div class="ev__q">&ldquo;${esc(r.quote)}&rdquo;</div>
    </div>`).join("")}
    ${footer ? `<div class="ev__foot">${footer}</div>` : ""}
  </div></div>`;
}
