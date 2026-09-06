/* ============================================================================
   ui.js — rendering helpers and shared components.

   Views are pure `state -> HTML string` functions. Event handling is delegated
   from the document root on [data-act] attributes, which keeps re-rendering
   trivial and maps cleanly onto a component framework later.
   ========================================================================== */

/** Escape untrusted-ish text for interpolation. All prototype data is ours, but
 *  auditor edits are typed in, so this is not optional. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Join template fragments, dropping null/false/undefined. */
export const j = (arr, sep = "") => arr.filter(Boolean).join(sep);

/** Conditional class list. */
export const cx = (...xs) => xs.filter(Boolean).join(" ");

export const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 100));

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

/* --- Status vocabulary ----------------------------------------------------
   Seven states, defined once. No confidence scores anywhere (02 §2.11, 01 §1.5).
   -------------------------------------------------------------------------- */
export const STATUS = {
  draft:         { label: "AI draft",       cls: "draft" },
  needs_review:  { label: "Needs review",   cls: "draft" },
  needs_source:  { label: "Needs source",   cls: "needssource" },
  contradiction: { label: "Contradictory",  cls: "contradiction" },
  missing:       { label: "Not obtained",   cls: "missing" },
  edited:        { label: "Edited",         cls: "edited" },
  approved:      { label: "Approved",       cls: "approved" },
  rejected:      { label: "Rejected",       cls: "rejected" },
  grounded:      { label: "Grounded",       cls: "grounded" },
};

export function status(key, overrideLabel) {
  const s = STATUS[key] || STATUS.draft;
  return `<span class="st st--${s.cls}"><i></i>${esc(overrideLabel || s.label)}</span>`;
}

/* --- Primitives ----------------------------------------------------------- */

export function btn(label, act, opts = {}) {
  const { variant = "", size = "", disabled = false, data = {}, title = "", icon = "" } = opts;
  const attrs = Object.entries(data)
    .map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<button class="${cx("btn", variant && "btn--" + variant, size && "btn--" + size)}"
    ${act ? `data-act="${esc(act)}"` : ""}${attrs}${disabled ? " disabled" : ""}
    ${title ? `title="${esc(title)}"` : ""}>${icon}${esc(label)}</button>`;
}

export function tag(text, variant = "") {
  return `<span class="${cx("tag", variant && "tag--" + variant)}">${esc(text)}</span>`;
}

export function toggle(label, on, act) {
  return `<button class="${cx("toggle", on && "is-on")}" data-act="${esc(act)}"><i></i>${esc(label)}</button>`;
}

export function metric(value, key, variant = "", suffix = "") {
  return `<div class="${cx("metric", variant && "metric--" + variant)}">
    <div class="metric__v">${esc(value)}${suffix ? `<small>${esc(suffix)}</small>` : ""}</div>
    <div class="metric__k">${esc(key)}</div>
  </div>`;
}

export function panel(title, body, opts = {}) {
  const { actions = "", flush = false, foot = "", sub = "" } = opts;
  return `<section class="panel">
    ${title ? `<header class="panel__head">
      <div><div class="h-sub">${esc(title)}</div>${sub ? `<div class="tiny dim">${esc(sub)}</div>` : ""}</div>
      ${actions ? `<div class="btn-row">${actions}</div>` : ""}
    </header>` : ""}
    <div class="${cx("panel__body", flush && "panel__body--flush")}">${body}</div>
    ${foot ? `<footer class="panel__foot">${foot}</footer>` : ""}
  </section>`;
}

export function note(text, variant = "") {
  return `<div class="${cx("note", variant && "note--" + variant)}">${text}</div>`;
}

export function empty(title, sub = "") {
  return `<div class="empty"><div class="empty__t">${esc(title)}</div>
    ${sub ? `<div class="tiny">${esc(sub)}</div>` : ""}</div>`;
}

export function kv(pairs) {
  return `<dl class="kv">${pairs
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
}

export function meter(value, max = 100, ok = false) {
  return `<div class="${cx("meter", ok && "meter--ok")}"><span style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></span></div>`;
}

/** Segmented coverage bar: covered / partial / open / not-applicable. */
export function coverageBar(c) {
  const total = c.covered + c.partial + c.open + c.na || 1;
  const w = (n) => `${(n / total) * 100}%`;
  return `<div class="bar">
    <span class="b-cov"  style="width:${w(c.covered)}"></span>
    <span class="b-part" style="width:${w(c.partial)}"></span>
    <span class="b-open" style="width:${w(c.open)}"></span>
    <span class="b-na"   style="width:${w(c.na)}"></span>
  </div>`;
}

export const coverageLegend = () => `<div class="legend">
  <span><i style="background:var(--ok)"></i>Covered</span>
  <span><i style="background:#9dbfa9"></i>Partially covered</span>
  <span><i style="background:#dcdcd6"></i>Open</span>
  <span><i style="background:#e6e6e0"></i>Not applicable</span>
</div>`;

/* --- Source chips ---------------------------------------------------------
   The provenance interaction: ambient chip -> hover preview -> click to pin.
   -------------------------------------------------------------------------- */
export function sourceChip(ref, opts = {}) {
  const { pinned = false, extra = 0 } = opts;
  if (!ref) {
    return `<button class="src src--none" data-act="explain-nosource"
      title="No source could be validated for this statement">no source</button>`;
  }
  const label = extra > 0 ? `${ref.short} +${extra}` : ref.short;
  return `<button class="${cx("src", pinned && "is-pinned", ref.conflict && "src--conflict")}"
    data-act="pin-source" data-ref="${esc(ref.id)}"
    data-quote="${esc(ref.quote)}" data-meta="${esc(ref.sourceName + " · " + ref.locator)}"
    >${esc(label)}</button>`;
}

export function tabs(items, activeId) {
  return `<nav class="tabs">${items.map((t) => {
    const c = t.count != null && t.count !== 0
      ? `<span class="${cx("tab__c", t.tone && "tab__c--" + t.tone)}">${t.count}</span>` : "";
    return `<button class="${cx("tab", t.id === activeId && "is-active")}"
      data-act="nav" data-href="${esc(t.href)}">${esc(t.label)}${c}</button>`;
  }).join("")}</nav>`;
}

export function crumbs(items) {
  return `<div class="crumbs">${items.map((it, i) => {
    const sep = i > 0 ? `<span class="sep">/</span>` : "";
    return it.href
      ? `${sep}<a data-act="nav" data-href="${esc(it.href)}">${esc(it.label)}</a>`
      : `${sep}<span class="cur">${esc(it.label)}</span>`;
  }).join("")}</div>`;
}

/* --- Icons (16px, stroke, no fill) ---------------------------------------- */
const ic = (d) =>
  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"
    stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICON = {
  work:     ic('<path d="M2.5 5.5h11v8h-11z"/><path d="M5.8 5.5V4a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1v1.5"/><path d="M2.5 8.6h11"/>'),
  clients:  ic('<circle cx="6" cy="5.5" r="2.2"/><path d="M2.4 13c0-2 1.6-3.4 3.6-3.4S9.6 11 9.6 13"/><path d="M11 4.2a2 2 0 0 1 0 3.9M12.2 12.6c0-1.3-.5-2.3-1.3-2.9"/>'),
  settings: ic('<circle cx="8" cy="8" r="2"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6"/>'),
  check:    ic('<path d="M3.5 8.4l3 3 6-6.8"/>'),
  chevron:  ic('<path d="M6 3.5 10.5 8 6 12.5"/>'),
  down:     ic('<path d="M3.5 6 8 10.5 12.5 6"/>'),
  external: ic('<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5"/><path d="M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H6.5"/>'),
};

/* --- Hover popover for source previews ------------------------------------ */
let popEl = null;
export function initPopover(root) {
  root.addEventListener("mouseover", (e) => {
    const chip = e.target.closest(".src[data-quote]");
    if (!chip) return;
    hidePopover();
    popEl = document.createElement("div");
    popEl.className = "pop";
    popEl.innerHTML = `<div class="pop__meta">${esc(chip.dataset.meta || "")}</div>
      <div class="pop__q">&ldquo;${esc(chip.dataset.quote)}&rdquo;</div>`;
    document.body.appendChild(popEl);
    const r = chip.getBoundingClientRect();
    const pr = popEl.getBoundingClientRect();
    let top = r.top - pr.height - 8;
    if (top < 8) top = r.bottom + 8;
    let left = Math.min(r.left, window.innerWidth - pr.width - 12);
    popEl.style.top = `${Math.max(8, top)}px`;
    popEl.style.left = `${Math.max(8, left)}px`;
  });
  root.addEventListener("mouseout", (e) => {
    if (e.target.closest(".src[data-quote]")) hidePopover();
  });
  window.addEventListener("scroll", hidePopover, true);
}
export function hidePopover() {
  if (popEl) { popEl.remove(); popEl = null; }
}

/* --- Drawer --------------------------------------------------------------- */
export function drawer({ title, sub = "", body, foot = "", wide = false }) {
  return `<div class="scrim" data-act="close-drawer"></div>
    <aside class="${cx("drawer", wide && "drawer--wide")}" role="dialog" aria-label="${esc(title)}">
      <header class="drawer__head">
        <div><div class="h-sec">${esc(title)}</div>
        ${sub ? `<div class="small muted" style="margin-top:3px">${sub}</div>` : ""}</div>
        ${btn("Close", "close-drawer", { variant: "ghost", size: "sm" })}
      </header>
      <div class="drawer__body">${body}</div>
      ${foot ? `<footer class="drawer__foot">${foot}</footer>` : ""}
    </aside>`;
}

/* --- Proposal / decision pair --------------------------------------------
   The visual grammar of "AI proposes, auditor decides" (02 §2.11).
   -------------------------------------------------------------------------- */
export function proposalDecision(proposal, decisionControl, decided) {
  return `<div class="stack-sm">
    <div>
      <div class="lbl" style="margin-bottom:3px">AI proposes</div>
      <div class="small muted" style="font-style:italic">${proposal}</div>
    </div>
    <div>
      <div class="lbl" style="margin-bottom:4px">Auditor decision${decided ? "" : " — required"}</div>
      ${decisionControl}
    </div>
  </div>`;
}
